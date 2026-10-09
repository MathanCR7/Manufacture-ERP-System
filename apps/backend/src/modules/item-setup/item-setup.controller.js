const ItemSetupRepository = require('./item-setup.repository');
const prisma = require('../../database/prisma');

// Helper to record deletion snapshot in AuditLog
const logDeletionAudit = async (req, action, tableName, recordId, oldValue) => {
  try {
    let userId = req.user?.id;
    if (!userId) {
      const firstUser = await prisma.user.findFirst({ select: { id: true } });
      userId = firstUser ? firstUser.id : null;
    }
    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          tableName,
          recordId,
          oldValue: oldValue || {},
          newValue: null,
          ip: req.ip || req.connection?.remoteAddress || '127.0.0.1'
        }
      });
    }
  } catch (err) {
    console.error(`[AuditLog Error] Failed to log deletion for ${tableName} (${recordId}):`, err.message);
  }
};

// Helper to find all Purchase Orders referencing a Raw Material
const getRawMaterialPOReferences = async (rmId, rmCode) => {
  const pos = await prisma.rawMaterialPO.findMany({
    where: { deletedAt: null },
    select: { id: true, referenceNo: true, rmId: true, name: true, items: true }
  });

  const matchingPOs = [];
  const seenNos = new Set();
  for (const po of pos) {
    const isTopMatch = Boolean(po.rmId && (po.rmId === rmCode || po.rmId === rmId));
    let isItemMatch = false;
    if (Array.isArray(po.items)) {
      isItemMatch = po.items.some(it => 
        it && (
          it.id === rmId || 
          it.rmId === rmId || 
          it.rmId === rmCode || 
          it.code === rmCode || 
          (it.itemType === 'RAW_MATERIAL' && (it.id === rmId || it.rmId === rmCode))
        )
      );
    }
    if (isTopMatch || isItemMatch) {
      const poNum = po.referenceNo || po.id;
      if (!seenNos.has(poNum)) {
        seenNos.add(poNum);
        matchingPOs.push({
          id: po.id,
          referenceNo: poNum,
          name: po.name
        });
      }
    }
  }
  return matchingPOs;
};

// Helper to find all Purchase Orders referencing a Non-Inventory Item
const getNonInventoryPOReferences = async (itemId, itemCode) => {
  const pos = await prisma.rawMaterialPO.findMany({
    where: { deletedAt: null },
    select: { id: true, referenceNo: true, rmId: true, name: true, items: true }
  });

  const matchingPOs = [];
  const seenNos = new Set();
  for (const po of pos) {
    if (Array.isArray(po.items)) {
      const hasItem = po.items.some(it => 
        it && (it.itemType === 'NON_INVENTORY' || !it.itemType) && 
        (it.id === itemId || it.rmId === itemId || it.rmId === itemCode || it.code === itemCode)
      );
      if (hasItem) {
        const poNum = po.referenceNo || po.id;
        if (!seenNos.has(poNum)) {
          seenNos.add(poNum);
          matchingPOs.push({
            id: po.id,
            referenceNo: poNum,
            name: po.name
          });
        }
      }
    }
  }
  return matchingPOs;
};

const sanitizeRawMaterialData = (raw) => {
  const data = { ...raw };
  if (data.ratePerUnit !== undefined) data.ratePerUnit = parseFloat(data.ratePerUnit) || 0;
  if (data.openingStock !== undefined) data.openingStock = parseFloat(data.openingStock) || 0;
  if (data.alertLevel !== undefined) data.alertLevel = parseFloat(data.alertLevel) || 0;
  if (data.name && typeof data.name === 'string') data.name = data.name.trim().toUpperCase();
  if (data.code && typeof data.code === 'string') data.code = data.code.trim().toUpperCase();

  // Alternate UOM & Conversion logic
  const hasAlt = Boolean(data.hasAlternateUom === true || data.hasAlternateUom === 'true');
  data.hasAlternateUom = hasAlt;
  if (hasAlt && data.alternateUom && typeof data.alternateUom === 'string' && data.alternateUom.trim()) {
    data.alternateUom = data.alternateUom.trim().toLowerCase();
    const baseQty = parseFloat(data.baseUomQty) > 0 ? parseFloat(data.baseUomQty) : 1;
    const altQty = parseFloat(data.alternateUomQty) > 0 ? parseFloat(data.alternateUomQty) : 1;
    data.baseUomQty = baseQty;
    data.alternateUomQty = altQty;
    data.conversionFactor = altQty / baseQty;
    data.consumptionUnit = data.alternateUom;
  } else {
    data.hasAlternateUom = false;
    data.alternateUom = null;
    data.baseUomQty = 1;
    data.alternateUomQty = 1;
    data.conversionFactor = 1;
    data.consumptionUnit = null;
  }
  return data;
};

const sanitizeNonInventoryData = (raw) => {
  const data = { ...raw };
  if (data.ratePerUnit !== undefined) data.ratePerUnit = parseFloat(data.ratePerUnit) || 0;
  if (data.name && typeof data.name === 'string') data.name = data.name.trim().toUpperCase();
  if (data.code && typeof data.code === 'string') data.code = data.code.trim().toUpperCase();

  // Alternate UOM & Conversion logic
  const hasAlt = Boolean(data.hasAlternateUom === true || data.hasAlternateUom === 'true');
  data.hasAlternateUom = hasAlt;
  if (hasAlt && data.alternateUom && typeof data.alternateUom === 'string' && data.alternateUom.trim()) {
    data.alternateUom = data.alternateUom.trim().toLowerCase();
    const baseQty = parseFloat(data.baseUomQty) > 0 ? parseFloat(data.baseUomQty) : 1;
    const altQty = parseFloat(data.alternateUomQty) > 0 ? parseFloat(data.alternateUomQty) : 1;
    data.baseUomQty = baseQty;
    data.alternateUomQty = altQty;
    data.conversionFactor = altQty / baseQty;
    data.consumptionUnit = data.alternateUom;
  } else {
    data.hasAlternateUom = false;
    data.alternateUom = null;
    data.baseUomQty = 1;
    data.alternateUomQty = 1;
    data.conversionFactor = 1;
    data.consumptionUnit = null;
  }
  return data;
};

const cascadeRawMaterialNameSync = async (existing, newName) => {
  try {
    // 1. All Purchase Orders (both active and soft-deleted/archived)
    const allPOs = await prisma.rawMaterialPO.findMany({
      select: { id: true, rmId: true, name: true, items: true }
    });

    for (const po of allPOs) {
      let poNeedsUpdate = false;
      let poUpdatedName = po.name;
      if (
        po.rmId === existing.id || 
        po.rmId === existing.code || 
        (po.name && po.name.trim().toUpperCase() === existing.name.trim().toUpperCase())
      ) {
        poUpdatedName = newName;
        poNeedsUpdate = true;
      }

      let poUpdatedItems = po.items;
      if (Array.isArray(po.items)) {
        let itemsModified = false;
        poUpdatedItems = po.items.map(it => {
          if (it && (
            it.id === existing.id || 
            it.rmId === existing.id || 
            it.rmId === existing.code || 
            it.code === existing.code ||
            (it.name && it.name.trim().toUpperCase() === existing.name.trim().toUpperCase()) ||
            (it.materialName && it.materialName.trim().toUpperCase() === existing.name.trim().toUpperCase())
          )) {
            itemsModified = true;
            return {
              ...it,
              name: newName,
              materialName: newName
            };
          }
          return it;
        });
        if (itemsModified) {
          poNeedsUpdate = true;
        }
      }

      if (poNeedsUpdate) {
        await prisma.rawMaterialPO.update({
          where: { id: po.id },
          data: {
            name: poUpdatedName,
            items: poUpdatedItems
          }
        });
      }
    }

    // 2. Inventory Batches
    await prisma.$executeRawUnsafe(
      `UPDATE "InventoryBatch" 
       SET "rawMaterialName" = $1, "updatedAt" = NOW() 
       WHERE "rawMaterialId" = $2 OR "rawMaterialId" = $3 OR UPPER("rawMaterialName") = UPPER($4)`,
      newName, existing.id, existing.code, existing.name
    ).catch(() => null);

    // 3. GRN Receive Items
    await prisma.$executeRawUnsafe(
      `UPDATE "GRNReceiveItem" 
       SET "rmName" = $1 
       WHERE "rmId" = $2 OR "rmId" = $3 OR UPPER("rmName") = UPPER($4)`,
      newName, existing.id, existing.code, existing.name
    ).catch(() => null);

    // 4. GRN Lab Test Results
    await prisma.$executeRawUnsafe(
      `UPDATE "GRNLabTestResult" 
       SET "rmName" = $1 
       WHERE "rmId" = $2 OR "rmId" = $3 OR UPPER("rmName") = UPPER($4)`,
      newName, existing.id, existing.code, existing.name
    ).catch(() => null);

    // 5. RM Quotation Items (rm_quotation_items)
    await prisma.$executeRawUnsafe(
      `UPDATE "rm_quotation_items" 
       SET "material_name" = $1 
       WHERE "material_id" = $2 OR "material_code" = $3 OR UPPER("material_name") = UPPER($4)`,
      newName, existing.id, existing.code, existing.name
    ).catch(() => null);

    // 6. Purchase Returns (items JSON array)
    const returnsWithItems = await prisma.purchaseReturn.findMany({
      where: { items: { not: null } },
      select: { id: true, items: true }
    }).catch(() => []);

    for (const pr of returnsWithItems) {
      if (Array.isArray(pr.items)) {
        let returnModified = false;
        const updatedReturnItems = pr.items.map(it => {
          if (it && (
            it.rmId === existing.id || 
            it.rmId === existing.code || 
            (it.rmName && it.rmName.trim().toUpperCase() === existing.name.trim().toUpperCase())
          )) {
            returnModified = true;
            return { ...it, rmName: newName };
          }
          return it;
        });

        if (returnModified) {
          await prisma.purchaseReturn.update({
            where: { id: pr.id },
            data: { items: updatedReturnItems }
          }).catch(() => null);
        }
      }
    }

    // 7. Production Batches RM Variance (rmVariance JSON)
    const batchesWithVariance = await prisma.productionBatchNew.findMany({
      where: { rmVariance: { not: null } },
      select: { id: true, rmVariance: true }
    }).catch(() => []);

    for (const pb of batchesWithVariance) {
      if (Array.isArray(pb.rmVariance)) {
        let varianceModified = false;
        const updatedVariance = pb.rmVariance.map(v => {
          if (v && (
            v.rmId === existing.id || 
            v.rmId === existing.code || 
            (v.rawMaterialName && v.rawMaterialName.trim().toUpperCase() === existing.name.trim().toUpperCase())
          )) {
            varianceModified = true;
            return { ...v, rawMaterialName: newName };
          }
          return v;
        });

        if (varianceModified) {
          await prisma.productionBatchNew.update({
            where: { id: pb.id },
            data: { rmVariance: updatedVariance }
          }).catch(() => null);
        }
      }
    }
  } catch (err) {
    console.warn('Cascade RM name update warning:', err.message);
  }
};

const cascadeNonInventoryItemNameSync = async (existing, newName) => {
  try {
    // 1. All POs
    const allPOs = await prisma.rawMaterialPO.findMany({
      select: { id: true, rmId: true, name: true, items: true }
    });

    for (const po of allPOs) {
      let poNeedsUpdate = false;
      let poUpdatedName = po.name;
      if (
        po.rmId === existing.id || 
        po.rmId === existing.code || 
        (po.name && po.name.trim().toUpperCase() === existing.name.trim().toUpperCase())
      ) {
        poUpdatedName = newName;
        poNeedsUpdate = true;
      }

      let poUpdatedItems = po.items;
      if (Array.isArray(po.items)) {
        let itemsModified = false;
        poUpdatedItems = po.items.map(it => {
          if (it && (
            it.id === existing.id || 
            it.rmId === existing.id || 
            it.rmId === existing.code || 
            it.code === existing.code ||
            (it.name && it.name.trim().toUpperCase() === existing.name.trim().toUpperCase()) ||
            (it.materialName && it.materialName.trim().toUpperCase() === existing.name.trim().toUpperCase())
          )) {
            itemsModified = true;
            return {
              ...it,
              name: newName,
              materialName: newName
            };
          }
          return it;
        });
        if (itemsModified) poNeedsUpdate = true;
      }

      if (poNeedsUpdate) {
        await prisma.rawMaterialPO.update({
          where: { id: po.id },
          data: {
            name: poUpdatedName,
            items: poUpdatedItems
          }
        });
      }
    }

    // 2. RM Quotation Items
    await prisma.$executeRawUnsafe(
      `UPDATE "rm_quotation_items" 
       SET "material_name" = $1 
       WHERE "material_id" = $2 OR "material_code" = $3 OR UPPER("material_name") = UPPER($4)`,
      newName, existing.id, existing.code, existing.name
    ).catch(() => null);
  } catch (err) {
    console.warn('Cascade Non-inventory item name update warning:', err.message);
  }
};

const createCrudController = (methodPrefix, pluralPrefix) => ({
  create: async (req, res, next) => {
    try {
      const data = req.body;
      if (data.ratePerUnit) data.ratePerUnit = parseFloat(data.ratePerUnit);
      if (data.openingStock) data.openingStock = parseFloat(data.openingStock);
      if (data.alertLevel) data.alertLevel = parseFloat(data.alertLevel);
      if (data.name && typeof data.name === 'string') data.name = data.name.trim().toUpperCase();
      if (data.code && typeof data.code === 'string') data.code = data.code.trim().toUpperCase();
      
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
      if (data.name && typeof data.name === 'string') data.name = data.name.trim().toUpperCase();
      if (data.code && typeof data.code === 'string') data.code = data.code.trim().toUpperCase();

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
    // ─────────────────────── 1. RM Category ───────────────────────
    this.RMCategory = {
      ...createCrudController('RMCategory', 'RMCategories'),
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const category = await prisma.rMCategory.findUnique({
            where: { id }
          });

          if (!category) {
            return res.status(404).json({ message: 'Raw material category not found' });
          }

          // Check if there are raw materials referencing this category
          const referencingRMs = await prisma.rawMaterial.findMany({
            where: { categoryId: id },
            select: { id: true, name: true, code: true }
          });

          if (referencingRMs.length > 0) {
            const rmSummary = referencingRMs.map(r => `${r.code} - ${r.name}`).join(', ');
            return res.status(409).json({
              error: 'FOREIGN_KEY_VIOLATION',
              message: `Cannot delete raw material category "${category.name}" because it is already used by ${referencingRMs.length} raw material(s): ${rmSummary}. Please reassign or delete these raw materials first.`,
              rawMaterials: referencingRMs
            });
          }

          // Safe to delete
          await ItemSetupRepository.deleteRMCategory(id);

          // Log in AuditLog
          await logDeletionAudit(req, 'DELETE_RAW_MATERIAL_CATEGORY', 'raw_material_categories', id, category);

          return res.status(200).json({ message: 'Category deleted successfully' });
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(409).json({
              error: 'CATEGORY_IN_USE',
              message: 'Cannot delete raw material category because it is referenced by other database records.'
            });
          }
          next(error);
        }
      }
    };

    // ─────────────────────── 2. Raw Material ───────────────────────
    this.RawMaterial = {
      ...createCrudController('RawMaterial', 'RawMaterials'),
      getAll: async (req, res, next) => {
        try {
          const materials = await ItemSetupRepository.getRawMaterials();
          
          // Get all active POs to annotate materials with purchase history
          const pos = await prisma.rawMaterialPO.findMany({
            where: { deletedAt: null },
            select: { id: true, referenceNo: true, rmId: true, items: true }
          });

          const annotated = materials.map(mat => {
            const matchingPOs = [];
            for (const po of pos) {
              const isTop = po.rmId === mat.code || po.rmId === mat.id;
              let isItem = false;
              if (Array.isArray(po.items)) {
                isItem = po.items.some(it => 
                  it && (it.id === mat.id || it.rmId === mat.code || it.rmId === mat.id || it.code === mat.code)
                );
              }
              if (isTop || isItem) {
                matchingPOs.push(po.referenceNo || po.id);
              }
            }
            const uniquePOs = [...new Set(matchingPOs)];
            return {
              ...mat,
              hasPurchases: uniquePOs.length > 0,
              purchaseOrders: uniquePOs
            };
          });

          res.json(annotated);
        } catch (error) { next(error); }
      },
      getById: async (req, res, next) => {
        try {
          const mat = await ItemSetupRepository.getRawMaterialById(req.params.id);
          if (!mat) return res.status(404).json({ message: 'Raw material not found' });

          const matchingPOs = await getRawMaterialPOReferences(mat.id, mat.code);
          const poNumbers = matchingPOs.map(p => p.referenceNo);

          res.json({
            ...mat,
            hasPurchases: poNumbers.length > 0,
            purchaseOrders: poNumbers
          });
        } catch (error) { next(error); }
      },
      create: async (req, res, next) => {
        try {
          const data = sanitizeRawMaterialData(req.body);
          const result = await ItemSetupRepository.createRawMaterial(data);
          res.status(201).json(result);
        } catch (error) { next(error); }
      },
      update: async (req, res, next) => {
        try {
          const id = req.params.id;
          const existing = await prisma.rawMaterial.findUnique({ where: { id } });
          if (!existing) return res.status(404).json({ message: 'Raw material not found' });

          const poRefs = await getRawMaterialPOReferences(existing.id, existing.code);
          const hasPurchases = poRefs.length > 0;
          const sanitized = sanitizeRawMaterialData(req.body);

          const rawNewName = (sanitized.name || '').trim();
          const newName = rawNewName ? rawNewName.toUpperCase() : existing.name;
          const isNameChanged = newName && newName !== existing.name;

          let updatePayload = { ...sanitized };

          if (hasPurchases) {
            // Lock core financial & accounting fields (code, category, unit, rate, opening stock, hsn),
            // BUT allow RM Name, Alternate UOM, Alert Level and Description to be updated!
            updatePayload = {
              ...sanitized,
              name: newName,
              code: existing.code,
              categoryId: existing.categoryId,
              unitId: existing.unitId,
              ratePerUnit: existing.ratePerUnit,
              openingStock: existing.openingStock,
              hsnCode: existing.hsnCode
            };
          } else if (newName) {
            updatePayload.name = newName;
          }

          const result = await ItemSetupRepository.updateRawMaterial(id, updatePayload);

          // If the Raw Material Name changed, cascade the updated name across existing Purchase Orders,
          // Inventory Batches, GRN receives, Lab Results, Quotations, Returns, and Production Variances!
          if (isNameChanged) {
            await cascadeRawMaterialNameSync(existing, newName);
          }

          res.json({
            ...result,
            hasPurchases,
            purchaseOrders: poRefs.map(p => p.referenceNo)
          });
        } catch (error) { next(error); }
      },
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const existing = await prisma.rawMaterial.findUnique({ where: { id } });
          if (!existing) {
            return res.status(404).json({ message: 'Raw material not found' });
          }

          // Check if already purchased in Purchase Orders
          const poRefs = await getRawMaterialPOReferences(existing.id, existing.code);
          if (poRefs.length > 0) {
            const poNumbers = poRefs.map(p => p.referenceNo).join(', ');
            return res.status(409).json({
              error: 'PURCHASE_ORDER_EXISTS',
              message: `Cannot delete raw material "${existing.code} - ${existing.name}" because it has already been purchased in Purchase Order(s): ${poNumbers}. Raw materials with purchase history cannot be deleted.`,
              purchaseOrders: poRefs.map(p => p.referenceNo)
            });
          }

          // Check other referencing records: BOM, stock adjustments, waste, production usage
          const [productBOMs, wasteItems, stockAdjustments, batchUsages, lossMaterials] = await Promise.all([
            prisma.productBOM.findMany({
              where: { rmId: id },
              select: { id: true, product: { select: { id: true, name: true, code: true } } }
            }),
            prisma.rMWasteItem.findMany({
              where: { rawMaterialId: id },
              select: { id: true, waste: { select: { id: true, referenceNo: true } } }
            }),
            prisma.rMStockAdjustment.findMany({
              where: { rawMaterialId: id },
              select: { id: true, type: true, quantity: true }
            }),
            prisma.productionBatchRMUsage.findMany({
              where: { rmId: id },
              select: { id: true, batch: { select: { id: true, referenceNo: true } } }
            }),
            prisma.productionLossMaterial.findMany({
              where: { rmId: id },
              select: { id: true, loss: { select: { id: true, date: true } } }
            })
          ]);

          if (productBOMs.length > 0) {
            const boms = productBOMs.map(b => `${b.product?.code || 'PROD'} - ${b.product?.name || 'Item'}`).join(', ');
            return res.status(409).json({
              error: 'BOM_IN_USE',
              message: `Cannot delete raw material "${existing.code} - ${existing.name}" because it is used in Bill of Materials (BOM) for product(s): ${boms}.`
            });
          }

          if (wasteItems.length > 0) {
            const wastes = wasteItems.map(w => w.waste?.referenceNo || 'Waste').join(', ');
            return res.status(409).json({
              error: 'WASTE_LOG_EXISTS',
              message: `Cannot delete raw material "${existing.code} - ${existing.name}" because it is logged in RM Waste record(s): ${wastes}.`
            });
          }

          if (batchUsages.length > 0) {
            const batches = batchUsages.map(b => b.batch?.referenceNo || 'Batch').join(', ');
            return res.status(409).json({
              error: 'PRODUCTION_BATCH_IN_USE',
              message: `Cannot delete raw material "${existing.code} - ${existing.name}" because it has been consumed in production batch(es): ${batches}.`
            });
          }

          if (stockAdjustments.length > 0 || lossMaterials.length > 0) {
            return res.status(409).json({
              error: 'INVENTORY_RECORDS_EXIST',
              message: `Cannot delete raw material "${existing.code} - ${existing.name}" because inventory stock adjustment or loss history exists.`
            });
          }

          // Safe to delete
          await ItemSetupRepository.deleteRawMaterial(id);

          // Record in AuditLog
          await logDeletionAudit(req, 'DELETE_RAW_MATERIAL', 'raw_materials', id, existing);

          return res.status(200).json({ message: 'Raw material deleted successfully' });
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(409).json({
              error: 'RM_IN_USE',
              message: 'Cannot delete raw material because it is referenced by other database records.'
            });
          }
          next(error);
        }
      }
    };

    // ─────────────────────── 3. Non-Inventory Item ───────────────────────
    this.NonInventoryItem = {
      ...createCrudController('NonInventoryItem', 'NonInventoryItems'),
      getAll: async (req, res, next) => {
        try {
          const items = await ItemSetupRepository.getNonInventoryItems();
          
          const pos = await prisma.rawMaterialPO.findMany({
            where: { deletedAt: null },
            select: { id: true, referenceNo: true, items: true }
          });

          const annotated = items.map(it => {
            const matchingPOs = [];
            for (const po of pos) {
              if (Array.isArray(po.items)) {
                const found = po.items.some(item => 
                  item && (item.itemType === 'NON_INVENTORY' || !item.itemType) && 
                  (item.id === it.id || item.rmId === it.id || item.rmId === it.code || item.code === it.code)
                );
                if (found) matchingPOs.push(po.referenceNo || po.id);
              }
            }
            const uniquePOs = [...new Set(matchingPOs)];
            return {
              ...it,
              hasPurchases: uniquePOs.length > 0,
              purchaseOrders: uniquePOs
            };
          });

          res.json(annotated);
        } catch (error) { next(error); }
      },
      getById: async (req, res, next) => {
        try {
          const item = await ItemSetupRepository.getNonInventoryItemById(req.params.id);
          if (!item) return res.status(404).json({ message: 'Non-inventory item not found' });

          const matchingPOs = await getNonInventoryPOReferences(item.id, item.code);
          const poNumbers = matchingPOs.map(p => p.referenceNo);

          res.json({
            ...item,
            hasPurchases: poNumbers.length > 0,
            purchaseOrders: poNumbers
          });
        } catch (error) { next(error); }
      },
      create: async (req, res, next) => {
        try {
          const data = sanitizeNonInventoryData(req.body);
          const result = await ItemSetupRepository.createNonInventoryItem(data);
          res.status(201).json(result);
        } catch (error) { next(error); }
      },
      update: async (req, res, next) => {
        try {
          const id = req.params.id;
          const existing = await prisma.nonInventoryItem.findUnique({ where: { id } });
          if (!existing) return res.status(404).json({ message: 'Non-inventory item not found' });

          const poRefs = await getNonInventoryPOReferences(existing.id, existing.code);
          const hasPurchases = poRefs.length > 0;
          const sanitized = sanitizeNonInventoryData(req.body);

          const rawNewName = (sanitized.name || '').trim();
          const newName = rawNewName ? rawNewName.toUpperCase() : existing.name;
          const isNameChanged = newName && newName !== existing.name;

          let updatePayload = { ...sanitized };

          if (hasPurchases) {
            updatePayload = {
              ...sanitized,
              name: newName,
              code: existing.code,
              category: existing.category,
              unitId: existing.unitId,
              ratePerUnit: existing.ratePerUnit,
              hsnCode: existing.hsnCode
            };
          } else if (newName) {
            updatePayload.name = newName;
          }

          const result = await ItemSetupRepository.updateNonInventoryItem(id, updatePayload);

          // If the item name changed, cascade across POs and Quotations
          if (isNameChanged) {
            await cascadeNonInventoryItemNameSync(existing, newName);
          }

          res.json({
            ...result,
            hasPurchases,
            purchaseOrders: poRefs.map(p => p.referenceNo)
          });
        } catch (error) { next(error); }
      },
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const existing = await prisma.nonInventoryItem.findUnique({ where: { id } });
          if (!existing) {
            return res.status(404).json({ message: 'Non-inventory item not found' });
          }

          // Check if already purchased in Purchase Orders
          const poRefs = await getNonInventoryPOReferences(existing.id, existing.code);
          if (poRefs.length > 0) {
            const poNumbers = poRefs.map(p => p.referenceNo).join(', ');
            return res.status(409).json({
              error: 'PURCHASE_ORDER_EXISTS',
              message: `Cannot delete non-inventory item "${existing.code} - ${existing.name}" because it has already been purchased in Purchase Order(s): ${poNumbers}. Non-inventory items with purchase history cannot be deleted.`,
              purchaseOrders: poRefs.map(p => p.referenceNo)
            });
          }

          // Check if used in product costing
          const referencingCosts = await prisma.productNonInventoryCost.findMany({
            where: { itemId: id },
            select: {
              id: true,
              cost: true,
              product: { select: { id: true, name: true, code: true } }
            }
          });

          if (referencingCosts.length > 0) {
            const prodList = referencingCosts.map(c => `${c.product?.code || 'PROD'} - ${c.product?.name || 'Product'}`).join(', ');
            return res.status(409).json({
              error: 'COSTING_IN_USE',
              message: `Cannot delete non-inventory item "${existing.code} - ${existing.name}" because it is linked to product cost calculations in: ${prodList}.`
            });
          }

          // Safe to delete
          await ItemSetupRepository.deleteNonInventoryItem(id);

          // Record in AuditLog
          await logDeletionAudit(req, 'DELETE_NON_INVENTORY_ITEM', 'non_inventory_items', id, existing);

          return res.status(200).json({ message: 'Non-inventory item deleted successfully' });
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(409).json({
              error: 'NI_IN_USE',
              message: 'Cannot delete non-inventory item because it is referenced by other database records.'
            });
          }
          next(error);
        }
      }
    };

    // ─────────────────────── 4. Product Category ───────────────────────
    this.ProductCategory = {
      ...createCrudController('ProductCategory', 'ProductCategories'),
      delete: async (req, res, next) => {
        try {
          const id = req.params.id;
          const category = await prisma.productCategory.findUnique({ where: { id } });
          if (!category) {
            return res.status(404).json({ message: 'Product category not found' });
          }

          // 1. Check Subcategories
          const subcats = await prisma.productSubcategory.findMany({
            where: { categoryId: id },
            select: { id: true, code: true, name: true }
          });

          if (subcats.length > 0) {
            const subSummary = subcats.map(s => `${s.code} - ${s.name}`).join(', ');
            return res.status(409).json({
              error: 'FOREIGN_KEY_VIOLATION',
              message: `Cannot delete main category "${category.name}" because it contains ${subcats.length} subcategory(ies): ${subSummary}. Please delete or reassign all subcategories first.`,
              subcategories: subcats
            });
          }

          // 2. Check Products
          const finishedProducts = await prisma.finishedProduct.findMany({
            where: { categoryId: id },
            select: { id: true, code: true, name: true, sku: true }
          });
          const legacyProducts = await prisma.product.findMany({
            where: { categoryId: id },
            select: { id: true, code: true, name: true }
          });

          const totalProducts = [...finishedProducts, ...legacyProducts];
          if (totalProducts.length > 0) {
            const prodSummary = totalProducts.map(p => `${p.code || p.sku || 'PROD'} - ${p.name}`).join(', ');
            return res.status(409).json({
              error: 'FOREIGN_KEY_VIOLATION',
              message: `Cannot delete main category "${category.name}" because it contains ${totalProducts.length} product(s): ${prodSummary}. Please delete or reassign all products first.`,
              products: totalProducts
            });
          }

          // Safe to delete
          await ItemSetupRepository.deleteProductCategory(id);

          // Record in AuditLog
          await logDeletionAudit(req, 'DELETE_PRODUCT_CATEGORY', 'product_categories', id, category);

          return res.status(200).json({ message: 'Product category deleted successfully' });
        } catch (error) {
          if (error.code === 'P2003') {
            return res.status(409).json({
              error: 'CATEGORY_IN_USE',
              message: 'Cannot delete product category because it is referenced by other database records.'
            });
          }
          next(error);
        }
      }
    };

    // ─────────────────────── 5. Legacy Product (if called via /item-setup/product) ───
    this.Product = createCrudController('Product', 'Products');
  }
}

module.exports = new ItemSetupController();
