const ItemSetupRepository = require('./item-setup.repository');
const prisma = require('../../database/prisma');

const createCrudController = (methodPrefix, pluralPrefix) => ({
  create: async (req, res, next) => {
    try {
      const data = req.body;
      if (data.ratePerUnit) data.ratePerUnit = parseFloat(data.ratePerUnit);
      if (data.openingStock) data.openingStock = parseFloat(data.openingStock);
      if (data.alertLevel) data.alertLevel = parseFloat(data.alertLevel);
      
      const result = await ItemSetupRepository[`create${methodPrefix}`](data);
      res.status(201).json(result);
    } catch (error) { next(error); }
  },
  getAll: async (req, res, next) => {
    try {
      const results = await ItemSetupRepository[`get${pluralPrefix}`]();
      res.json(results);
    } catch (error) { next(error); }
  },
  getById: async (req, res, next) => {
    try {
      const result = await ItemSetupRepository[`get${methodPrefix}ById`](req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (error) { next(error); }
  },
  update: async (req, res, next) => {
    try {
      const data = req.body;
      if (data.ratePerUnit) data.ratePerUnit = parseFloat(data.ratePerUnit);
      if (data.openingStock) data.openingStock = parseFloat(data.openingStock);
      if (data.alertLevel) data.alertLevel = parseFloat(data.alertLevel);

      const result = await ItemSetupRepository[`update${methodPrefix}`](req.params.id, data);
      res.json(result);
    } catch (error) { next(error); }
  },
  delete: async (req, res, next) => {
    try {
      await ItemSetupRepository[`delete${methodPrefix}`](req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  }
});

class ItemSetupController {
  constructor() {
    this.RMCategory = {
      ...createCrudController('RMCategory', 'RMCategories'),
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const force = req.query.force === 'true';

          // Check if there are raw materials referencing this category
          const referencingRMs = await prisma.rawMaterial.findMany({
            where: { categoryId: id },
            select: { id: true, name: true, code: true }
          });

          if (referencingRMs.length > 0) {
            if (!force) {
              return res.status(409).json({
                error: 'FOREIGN_KEY_VIOLATION',
                message: 'Category is in use by raw materials',
                rawMaterials: referencingRMs
              });
            } else {
              try {
                // Delete all raw materials under this category
                await prisma.rawMaterial.deleteMany({
                  where: { categoryId: id }
                });
              } catch (rmError) {
                if (rmError.code === 'P2003') {
                  return res.status(400).json({
                    error: 'RM_IN_USE',
                    message: 'Cannot delete raw materials because they are already used in bills of materials (BOM), stock adjustments, or waste logs.'
                  });
                }
                throw rmError;
              }
            }
          }

          // Delete the raw material category
          await ItemSetupRepository.deleteRMCategory(id);
          res.status(204).send();
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(400).json({
              error: 'CATEGORY_IN_USE',
              message: 'Cannot delete raw material category because it is referenced by other records.'
            });
          }
          next(error);
        }
      }
    };
    this.RawMaterial = {
      ...createCrudController('RawMaterial', 'RawMaterials'),
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const force = req.query.force === 'true';

          // Check if there are referencing records
          const [stockAdjustments, productBOMs, wasteItems, batchUsages, lossMaterials] = await Promise.all([
            prisma.rMStockAdjustment.findMany({
              where: { rawMaterialId: id },
              select: { id: true, type: true, quantity: true, createdAt: true }
            }),
            prisma.productBOM.findMany({
              where: { rmId: id },
              select: {
                id: true,
                product: { select: { id: true, name: true, code: true } }
              }
            }),
            prisma.rMWasteItem.findMany({
              where: { rawMaterialId: id },
              select: {
                id: true,
                quantity: true,
                waste: { select: { id: true, referenceNo: true } }
              }
            }),
            prisma.productionBatchRMUsage.findMany({
              where: { rmId: id },
              select: {
                id: true,
                actualUsedQty: true,
                batch: { select: { id: true, referenceNo: true } }
              }
            }),
            prisma.productionLossMaterial.findMany({
              where: { rmId: id },
              select: {
                id: true,
                lossQty: true,
                loss: { select: { id: true, date: true } }
              }
            })
          ]);

          const hasReferences = 
            stockAdjustments.length > 0 || 
            productBOMs.length > 0 || 
            wasteItems.length > 0 || 
            batchUsages.length > 0 || 
            lossMaterials.length > 0;

          if (hasReferences) {
            if (!force) {
              return res.status(409).json({
                error: 'FOREIGN_KEY_VIOLATION',
                message: 'Raw material is referenced by other database records',
                references: {
                  stockAdjustments,
                  productBOMs,
                  wasteItems,
                  batchUsages,
                  lossMaterials
                }
              });
            } else {
              // Delete all referencing records first in a transaction
              await prisma.$transaction([
                prisma.rMStockAdjustment.deleteMany({ where: { rawMaterialId: id } }),
                prisma.productBOM.deleteMany({ where: { rmId: id } }),
                prisma.rMWasteItem.deleteMany({ where: { rawMaterialId: id } }),
                prisma.productionBatchRMUsage.deleteMany({ where: { rmId: id } }),
                prisma.productionLossMaterial.deleteMany({ where: { rmId: id } })
              ]);
            }
          }

          // Delete the raw material
          await ItemSetupRepository.deleteRawMaterial(id);
          res.status(204).send();
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(400).json({
              error: 'RM_IN_USE',
              message: 'Cannot delete raw material because it is referenced by other records.'
            });
          }
          next(error);
        }
      }
    };
    this.NonInventoryItem = {
      ...createCrudController('NonInventoryItem', 'NonInventoryItems'),
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const force = req.query.force === 'true';

          // Check if there are product costs referencing this item
          const referencingCosts = await prisma.productNonInventoryCost.findMany({
            where: { itemId: id },
            select: {
              id: true,
              cost: true,
              product: { select: { id: true, name: true, code: true } }
            }
          });

          if (referencingCosts.length > 0) {
            if (!force) {
              return res.status(409).json({
                error: 'FOREIGN_KEY_VIOLATION',
                message: 'Non-inventory item is referenced by product costs',
                references: {
                  productNonInventoryCosts: referencingCosts
                }
              });
            } else {
              // Delete referencing records first
              await prisma.productNonInventoryCost.deleteMany({
                where: { itemId: id }
              });
            }
          }

          // Delete the non-inventory item
          await ItemSetupRepository.deleteNonInventoryItem(id);
          res.status(204).send();
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(400).json({
              error: 'NI_IN_USE',
              message: 'Cannot delete non-inventory item because it is referenced by other records.'
            });
          }
          next(error);
        }
      }
    };
    this.ProductCategory = createCrudController('ProductCategory', 'ProductCategories');
    this.Product = createCrudController('Product', 'Products');
  }
}

module.exports = new ItemSetupController();
