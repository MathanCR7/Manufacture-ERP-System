const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// Helper to generate unique product code (FP-XXXXXX)
const generateProductCode = async (tx) => {
  // Lock table row to prevent race conditions
  const result = await tx.$queryRaw`
    SELECT code FROM products 
    WHERE code LIKE 'FP-%' 
    ORDER BY code DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.code) {
    return 'FP-000001';
  }

  const lastNumberStr = lastRecord.code.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;
  return `FP-${String(nextNumber).padStart(6, '0')}`;
};

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const resolveUomId = async (tx, value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const existing = await tx.uOM.findUnique({ where: { id: trimmed } });
    if (existing) return existing.id;
  }

  const normalized = trimmed.toLowerCase();
  const existingUom = await tx.uOM.findFirst({
    where: {
      isActive: true,
      OR: [
        { abbreviation: { equals: normalized, mode: 'insensitive' } },
        { name: { equals: normalized, mode: 'insensitive' } }
      ]
    }
  });

  if (existingUom) return existingUom.id;

  const newUom = await tx.uOM.create({
    data: {
      name: trimmed,
      abbreviation: trimmed,
      isActive: true
    }
  });

  return newUom.id;
};

// GET /api/products/masters - Fetch all metadata for master dropdowns
router.get('/masters', authenticateToken, async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' }
    });

    const units = await prisma.uOM.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    let stages = await prisma.productionStageMaster.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    if (stages.length === 0) {
      await prisma.productionStageMaster.createMany({
        data: [
          { name: 'Mixing', description: 'Blending raw materials', isActive: true },
          { name: 'Pasteurization', description: 'Thermal processing for food safety', isActive: true },
          { name: 'Freezing', description: 'Initial solidification step', isActive: true },
          { name: 'Hardening', description: 'Deep freezing stage', isActive: true },
          { name: 'Packaging', description: 'Packing into final containers', isActive: true },
          { name: 'Quality Control', description: 'Laboratory analysis and testing', isActive: true }
        ]
      });
      stages = await prisma.productionStageMaster.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
    }

    const nonInventoryItems = await prisma.nonInventoryItem.findMany({
      orderBy: { name: 'asc' }
    });

    // Approved raw materials from POs where status = approved (or all raw materials for selection)
    const rawMaterials = await prisma.rawMaterial.findMany({
      orderBy: { name: 'asc' }
    });

    // Users for responsible persons dropdown
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true }
    });

    res.json({ categories, units, stages, nonInventoryItems, rawMaterials, users });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/stock - Current stock per finished product
router.get('/stock', authenticateToken, async (req, res, next) => {
  try {
    const products = await prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        unit: true,
        stockLevels: true
      }
    });

    const result = [];
    for (const prod of products) {
      // Calculate current stock from movements
      const sumIn = await prisma.productStockMovement.aggregate({
        where: { productId: prod.id, direction: 1 },
        _sum: { quantity: true }
      });
      const sumOut = await prisma.productStockMovement.aggregate({
        where: { productId: prod.id, direction: -1 },
        _sum: { quantity: true }
      });

      const currentStock = Number(prod.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);

      const stockLevel = prod.stockLevels[0] || null;
      const minLevel = stockLevel ? Number(stockLevel.minLevel) : Number(prod.alertLevel || 0) * 0.5;
      const maxLevel = stockLevel ? Number(stockLevel.maxLevel) : 0;
      const reorderPoint = stockLevel ? Number(stockLevel.reorderPoint) : Number(prod.alertLevel || 0);

      let status = 'OK';
      if (currentStock <= minLevel && minLevel > 0) {
        status = 'Critical';
      } else if (currentStock <= reorderPoint && reorderPoint > 0) {
        status = 'Low';
      }

      result.push({
        id: prod.id,
        code: prod.code,
        name: prod.name,
        category: prod.category?.name || 'N/A',
        unit: prod.unit?.abbreviation || prod.unit?.name || prod.unitId || 'pcs',
        currentStock,
        minLevel,
        maxLevel,
        reorderPoint,
        unitValue: Number(prod.salePrice || 0),
        totalValue: currentStock * Number(prod.salePrice || 0),
        status,
        salePrice: Number(prod.salePrice || 0)
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/low-stock - Products below min stock
router.get('/low-stock', authenticateToken, async (req, res, next) => {
  try {
    const products = await prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        unit: true,
        stockLevels: true
      }
    });

    const result = [];
    for (const prod of products) {
      const sumIn = await prisma.productStockMovement.aggregate({
        where: { productId: prod.id, direction: 1 },
        _sum: { quantity: true }
      });
      const sumOut = await prisma.productStockMovement.aggregate({
        where: { productId: prod.id, direction: -1 },
        _sum: { quantity: true }
      });

      const currentStock = Number(prod.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
      const stockLevel = prod.stockLevels[0] || null;
      const minLevel = stockLevel ? Number(stockLevel.minLevel) : Number(prod.alertLevel || 0) * 0.5;
      const maxLevel = stockLevel ? Number(stockLevel.maxLevel) : 0;
      const reorderPoint = stockLevel ? Number(stockLevel.reorderPoint) : Number(prod.alertLevel || 0);

      if (currentStock <= minLevel && minLevel > 0) {
        result.push({
          id: prod.id,
          code: prod.code,
          name: prod.name,
          category: prod.category?.name || 'N/A',
          unit: prod.unit?.abbreviation || prod.unit?.name || prod.unitId || 'pcs',
          currentStock,
          minLevel,
          maxLevel,
          reorderPoint,
          status: 'Critical',
          salePrice: Number(prod.salePrice || 0)
        });
      } else if (currentStock <= reorderPoint && reorderPoint > 0) {
        result.push({
          id: prod.id,
          code: prod.code,
          name: prod.name,
          category: prod.category?.name || 'N/A',
          unit: prod.unit?.abbreviation || prod.unit?.name || prod.unitId || 'pcs',
          currentStock,
          minLevel,
          maxLevel,
          reorderPoint,
          status: 'Low',
          salePrice: Number(prod.salePrice || 0)
        });
      }
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/products/stock/levels - Set min/max/reorder levels
router.post('/stock/levels', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const schema = z.object({
      productId: z.string().uuid(),
      minLevel: z.coerce.number().nonnegative(),
      maxLevel: z.coerce.number().nonnegative(),
      reorderPoint: z.coerce.number().nonnegative()
    });

    const data = schema.parse(req.body);

    const level = await prisma.productStockLevel.upsert({
      where: { productId: data.productId },
      update: {
        minLevel: data.minLevel,
        maxLevel: data.maxLevel,
        reorderPoint: data.reorderPoint,
        updatedBy: req.user.id
      },
      create: {
        productId: data.productId,
        minLevel: data.minLevel,
        maxLevel: data.maxLevel,
        reorderPoint: data.reorderPoint,
        updatedBy: req.user.id
      }
    });

    res.json(level);
  } catch (error) {
    next(error);
  }
});

// GET /api/products - list all products
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const products = await prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        unit: true,
        bom: { include: { rawMaterial: true } },
        nonInventoryCosts: { include: { item: true } },
        stages: { include: { stage: true } },
        stockLevels: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id - product detail
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const product = await prisma.finishedProduct.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        category: true,
        unit: true,
        bom: { include: { rawMaterial: true } },
        nonInventoryCosts: { include: { item: true } },
        stages: { include: { stage: true } },
        stockLevels: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id/bom - Get product BOM
router.get('/:id/bom', authenticateToken, async (req, res, next) => {
  try {
    const bom = await prisma.productBOM.findMany({
      where: { productId: req.params.id },
      include: { rawMaterial: true }
    });
    res.json(bom);
  } catch (error) {
    next(error);
  }
});

// POST /api/products/:id/bom/expand?qty=X - Expand BoM by qty with stock check
router.post('/:id/bom/expand', authenticateToken, async (req, res, next) => {
  try {
    const qty = Number(req.query.qty || req.body.qty || 1);
    const bom = await prisma.productBOM.findMany({
      where: { productId: req.params.id },
      include: { rawMaterial: true }
    });

    const expanded = bom.map(item => {
      const requiredQty = Number(item.consumptionPerUnit) * qty;
      const availableStock = Number(item.rawMaterial.currentStock || 0);
      const isSufficient = availableStock >= requiredQty;

      return {
        id: item.id,
        rawMaterialId: item.rmId,
        rawMaterialName: item.rawMaterial.name,
        rawMaterialCode: item.rawMaterial.code,
        consumption: Number(item.consumptionPerUnit),
        requiredQty,
        availableStock,
        unitCost: Number(item.unitPrice),
        totalCost: requiredQty * Number(item.unitPrice),
        status: isSufficient ? 'Sufficient' : 'Insufficient'
      };
    });

    const totalRmCost = expanded.reduce((sum, item) => sum + item.totalCost, 0);

    res.json({
      items: expanded,
      totalRmCost
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/products - Create Product
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      categoryId: z.string().min(1),
      unitId: z.string().min(1),
      stockMethod: z.string(),
      openingStock: z.coerce.number().nonnegative().default(0),
      alertLevel: z.coerce.number().nonnegative().default(0),
      profitMargin: z.coerce.number().nonnegative(),
      cgst: z.coerce.number().default(18),
      sgst: z.coerce.number().default(9),
      igst: z.coerce.number().default(9),
      bom: z.array(z.object({
        rmId: z.string().min(1),
        consumption: z.coerce.number().positive(),
        unitPrice: z.coerce.number().positive(),
        totalCost: z.coerce.number().positive()
      })),
      nonInventoryCosts: z.array(z.object({
        itemId: z.string().min(1),
        cost: z.coerce.number().positive()
      })),
      stages: z.array(z.object({
        stageId: z.string().min(1),
        months: z.coerce.number().default(0),
        days: z.coerce.number().default(0),
        hours: z.coerce.number().default(0),
        minutes: z.coerce.number().default(0),
        sortOrder: z.coerce.number().default(0)
      }))
    });

    const data = schema.parse(req.body);

    const product = await prisma.$transaction(async (tx) => {
      const code = await generateProductCode(tx);

      // Resolve static UOM label/UUID
      const resolvedUomId = await resolveUomId(tx, data.unitId);
      if (!resolvedUomId) {
        throw new Error('Invalid UOM provided');
      }

      // Calculate cost aggregates
      const totalRawMaterialCost = data.bom.reduce((sum, b) => sum + Number(b.totalCost), 0);
      const totalNonInventoryCost = data.nonInventoryCosts.reduce((sum, n) => sum + Number(n.cost), 0);
      const totalCost = totalRawMaterialCost + totalNonInventoryCost;
      const salePrice = totalCost * (1 + Number(data.profitMargin) / 100);

      // 1. Create main product
      const newProduct = await tx.finishedProduct.create({
        data: {
          code,
          name: data.name,
          categoryId: data.categoryId,
          unitId: resolvedUomId,
          stockMethod: data.stockMethod,
          totalRawMaterialCost,
          totalNonInventoryCost,
          totalCost,
          profitMargin: data.profitMargin,
          cgst: data.cgst,
          sgst: data.sgst,
          igst: data.igst,
          salePrice,
          openingStock: data.openingStock,
          currentStock: data.openingStock,
          alertLevel: data.alertLevel,
          createdBy: req.user.id
        }
      });

      // 2. Create BOM items
      if (data.bom.length > 0) {
        await tx.productBOM.createMany({
          data: data.bom.map(b => ({
            productId: newProduct.id,
            rmId: b.rmId,
            consumptionPerUnit: b.consumption,
            unitPrice: b.unitPrice,
            totalCost: b.totalCost
          }))
        });
      }

      // 3. Create Non-Inventory cost items
      if (data.nonInventoryCosts.length > 0) {
        await tx.productNonInventoryCost.createMany({
          data: data.nonInventoryCosts.map(n => ({
            productId: newProduct.id,
            itemId: n.itemId,
            cost: n.cost
          }))
        });
      }

      // 4. Create stages
      if (data.stages.length > 0) {
        await tx.productStage.createMany({
          data: data.stages.map((s, idx) => ({
            productId: newProduct.id,
            stageId: s.stageId,
            months: s.months,
            days: s.days,
            hours: s.hours,
            minutes: s.minutes,
            sortOrder: s.sortOrder || idx
          }))
        });
      }

      return newProduct;
    });

    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n[ZOD VALIDATION ERROR IN POST PRODUCT]:', error.errors);
      return res.status(400).json({ error: error.errors });
    }
    console.error('\n[PRODUCT CREATE ERROR]:', error);
    next(error);
  }
});

// PUT /api/products/:id - Update Product
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      name: z.string().min(1),
      categoryId: z.string().min(1),
      unitId: z.string().min(1),
      stockMethod: z.string(),
      openingStock: z.coerce.number().nonnegative().default(0),
      alertLevel: z.coerce.number().nonnegative().default(0),
      profitMargin: z.coerce.number().nonnegative(),
      cgst: z.coerce.number().default(18),
      sgst: z.coerce.number().default(9),
      igst: z.coerce.number().default(9),
      bom: z.array(z.object({
        rmId: z.string().min(1),
        consumption: z.coerce.number().positive(),
        unitPrice: z.coerce.number().positive(),
        totalCost: z.coerce.number().positive()
      })),
      nonInventoryCosts: z.array(z.object({
        itemId: z.string().min(1),
        cost: z.coerce.number().positive()
      })),
      stages: z.array(z.object({
        stageId: z.string().min(1),
        months: z.coerce.number().default(0),
        days: z.coerce.number().default(0),
        hours: z.coerce.number().default(0),
        minutes: z.coerce.number().default(0),
        sortOrder: z.coerce.number().default(0)
      }))
    });

    const data = schema.parse(req.body);

    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.finishedProduct.findFirst({
        where: { id, deletedAt: null }
      });

      if (!existing) {
        throw new Error('Product not found or deleted');
      }

      // Resolve static UOM label/UUID
      const resolvedUomId = await resolveUomId(tx, data.unitId);
      if (!resolvedUomId) {
        throw new Error('Invalid UOM provided');
      }

      // Calculate cost aggregates
      const totalRawMaterialCost = data.bom.reduce((sum, b) => sum + Number(b.totalCost), 0);
      const totalNonInventoryCost = data.nonInventoryCosts.reduce((sum, n) => sum + Number(n.cost), 0);
      const totalCost = totalRawMaterialCost + totalNonInventoryCost;
      const salePrice = totalCost * (1 + Number(data.profitMargin) / 100);

      // 1. Update product
      const updatedProduct = await tx.finishedProduct.update({
        where: { id },
        data: {
          name: data.name,
          categoryId: data.categoryId,
          unitId: resolvedUomId,
          stockMethod: data.stockMethod,
          totalRawMaterialCost,
          totalNonInventoryCost,
          totalCost,
          profitMargin: data.profitMargin,
          cgst: data.cgst,
          sgst: data.sgst,
          igst: data.igst,
          salePrice,
          openingStock: data.openingStock,
          alertLevel: data.alertLevel
        }
      });

      // 2. Recreate BOM
      await tx.productBOM.deleteMany({ where: { productId: id } });
      if (data.bom.length > 0) {
        await tx.productBOM.createMany({
          data: data.bom.map(b => ({
            productId: id,
            rmId: b.rmId,
            consumptionPerUnit: b.consumption,
            unitPrice: b.unitPrice,
            totalCost: b.totalCost
          }))
        });
      }

      // 3. Recreate Non-Inventory costs
      await tx.productNonInventoryCost.deleteMany({ where: { productId: id } });
      if (data.nonInventoryCosts.length > 0) {
        await tx.productNonInventoryCost.createMany({
          data: data.nonInventoryCosts.map(n => ({
            productId: id,
            itemId: n.itemId,
            cost: n.cost
          }))
        });
      }

      // 4. Recreate Stages
      await tx.productStage.deleteMany({ where: { productId: id } });
      if (data.stages.length > 0) {
        await tx.productStage.createMany({
          data: data.stages.map((s, idx) => ({
            productId: id,
            stageId: s.stageId,
            months: s.months,
            days: s.days,
            hours: s.hours,
            minutes: s.minutes,
            sortOrder: s.sortOrder || idx
          }))
        });
      }

      return updatedProduct;
    });

    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n[ZOD VALIDATION ERROR IN PUT PRODUCT]:', error.errors);
      return res.status(400).json({ error: error.errors });
    }
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('\n[PRODUCT UPDATE ERROR]:', error);
    next(error);
  }
});

// DELETE /api/products/:id - Soft Delete
router.delete('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.finishedProduct.findFirst({
      where: { id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await prisma.finishedProduct.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/products/stock/movements - Fetch all stock movements
router.get('/stock/movements', authenticateToken, async (req, res, next) => {
  try {
    const movements = await prisma.productStockMovement.findMany({
      include: {
        product: true,
        batch: true,
        order: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(movements);
  } catch (error) {
    next(error);
  }
});

// Helper to generate unique reference code for product wastage (PW-XXXXXX)
const generateWastageReference = async (tx) => {
  const result = await tx.$queryRaw`
    SELECT reference_no FROM product_wastages 
    ORDER BY reference_no DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.reference_no) {
    return 'PW-000001';
  }

  const lastNumberStr = lastRecord.reference_no.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;
  return `PW-${String(nextNumber).padStart(6, '0')}`;
};

// GET /api/products/wastage - Get all product wastage records
router.get('/wastage', authenticateToken, async (req, res, next) => {
  try {
    const wastages = await prisma.productWastage.findMany({
      include: {
        product: true,
        creator: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { date: 'desc' }
    });
    res.json(wastages);
  } catch (error) {
    next(error);
  }
});

// POST /api/products/wastage - Create a new product wastage record
router.post('/wastage', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const schema = z.object({
      productId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      note: z.string().optional(),
      date: z.string().optional()
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate current stock for the product
      const product = await tx.finishedProduct.findUnique({
        where: { id: data.productId }
      });
      if (!product) {
        throw new Error('Product not found');
      }

      const sumIn = await tx.productStockMovement.aggregate({
        where: { productId: data.productId, direction: 1 },
        _sum: { quantity: true }
      });
      const sumOut = await tx.productStockMovement.aggregate({
        where: { productId: data.productId, direction: -1 },
        _sum: { quantity: true }
      });

      const currentStock = Number(product.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);

      // Validate wastage quantity is under or equal to current stock
      if (data.quantity > currentStock) {
        throw new Error(`Wastage quantity (${data.quantity}) cannot exceed current stock (${currentStock})`);
      }

      // Generate reference number
      const referenceNo = await generateWastageReference(tx);

      // 2. Create the wastage record
      const wastage = await tx.productWastage.create({
        data: {
          referenceNo,
          productId: data.productId,
          quantity: data.quantity,
          note: data.note || null,
          date: data.date ? new Date(data.date) : new Date(),
          createdBy: req.user.id
        },
        include: {
          product: true
        }
      });

      // 3. Log stock movement
      await tx.productStockMovement.create({
        data: {
          productId: data.productId,
          type: 'adjustment',
          quantity: data.quantity,
          direction: -1,
          note: `Wastage ${referenceNo}: ${data.note || 'No notes'}`,
          createdBy: req.user.id
        }
      });

      return wastage;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/products/wastage/:id - Update product wastage
router.put('/wastage/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      productId: z.string().uuid(),
      quantity: z.coerce.number().positive(),
      note: z.string().optional(),
      date: z.string().optional()
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.productWastage.findUnique({
        where: { id }
      });
      if (!existing) {
        throw new Error('Product wastage record not found');
      }

      // Calculate current stock excluding the current wastage record's movement
      const product = await tx.finishedProduct.findUnique({
        where: { id: data.productId }
      });
      if (!product) {
        throw new Error('Product not found');
      }

      // Get all movements IN
      const sumIn = await tx.productStockMovement.aggregate({
        where: { productId: data.productId, direction: 1 },
        _sum: { quantity: true }
      });
      // Get all movements OUT
      const sumOut = await tx.productStockMovement.aggregate({
        where: { productId: data.productId, direction: -1 },
        _sum: { quantity: true }
      });

      // Find the stock movement for this wastage
      const movement = await tx.productStockMovement.findFirst({
        where: {
          productId: existing.productId,
          direction: -1,
          note: { startsWith: `Wastage ${existing.referenceNo}` }
        }
      });

      const movementQty = movement ? Number(movement.quantity) : Number(existing.quantity);
      
      // Stock without this wastage record
      const stockBeforeThisWastage = Number(product.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0) + movementQty;

      if (data.quantity > stockBeforeThisWastage) {
        throw new Error(`Wastage quantity (${data.quantity}) cannot exceed available stock (${stockBeforeThisWastage})`);
      }

      // Update the wastage record
      const updatedWastage = await tx.productWastage.update({
        where: { id },
        data: {
          productId: data.productId,
          quantity: data.quantity,
          note: data.note || null,
          date: data.date ? new Date(data.date) : new Date(),
        },
        include: { product: true }
      });

      // Update or recreate the stock movement
      if (movement) {
        await tx.productStockMovement.update({
          where: { id: movement.id },
          data: {
            productId: data.productId,
            quantity: data.quantity,
            note: `Wastage ${existing.referenceNo}: ${data.note || 'No notes'}`,
            createdBy: req.user.id
          }
        });
      } else {
        await tx.productStockMovement.create({
          data: {
            productId: data.productId,
            type: 'adjustment',
            quantity: data.quantity,
            direction: -1,
            note: `Wastage ${existing.referenceNo}: ${data.note || 'No notes'}`,
            createdBy: req.user.id
          }
        });
      }

      return updatedWastage;
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/products/wastage/:id - Delete product wastage
router.delete('/wastage/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.productWastage.findUnique({
        where: { id }
      });
      if (!existing) {
        throw new Error('Product wastage record not found');
      }

      // Delete the stock movement first
      await tx.productStockMovement.deleteMany({
        where: {
          productId: existing.productId,
          direction: -1,
          note: { startsWith: `Wastage ${existing.referenceNo}` }
        }
      });

      // Delete the wastage record
      await tx.productWastage.delete({
        where: { id }
      });
    });

    res.json({ message: 'Product wastage record deleted and stock restored successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
