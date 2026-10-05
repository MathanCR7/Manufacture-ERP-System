const express = require('express');
const { z } = require('zod');
const multer = require('multer');
const XLSX = require('xlsx');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

const cache = {};
const CACHE_TTL = 3000; // 3 seconds cache
const activeRequests = {};

const cacheMiddleware = (req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  const cacheKey = `${req.user?.role || 'anonymous'}:${req.originalUrl}`;
  const now = Date.now();
  const entry = cache[cacheKey];
  if (entry && (now - entry.timestamp) < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(entry.data);
  }

  // Request Coalescing (Singleflight Pattern)
  if (activeRequests[cacheKey]) {
    activeRequests[cacheKey].push(res);
    return;
  }

  activeRequests[cacheKey] = [];

  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache[cacheKey] = {
        timestamp: Date.now(),
        data: body
      };
    }

    const queue = activeRequests[cacheKey] || [];
    delete activeRequests[cacheKey];

    for (const pendingRes of queue) {
      try {
        pendingRes.setHeader('X-Cache', 'HIT-COALESCED');
        originalJson.call(pendingRes, body);
      } catch (err) {
        console.error('Coalesced response error:', err);
      }
    }

    return originalJson.call(this, body);
  };

  res.setHeader('X-Cache', 'MISS');
  next();
};

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

const resolveStageId = async (tx, value) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const existing = await tx.productionStageMaster.findUnique({ where: { id: trimmed } });
    if (existing) return existing.id;
  }

  const existingByName = await tx.productionStageMaster.findFirst({
    where: {
      name: { equals: trimmed, mode: 'insensitive' }
    }
  });

  if (existingByName) return existingByName.id;

  const newStage = await tx.productionStageMaster.create({
    data: {
      name: trimmed,
      description: `Production stage: ${trimmed}`,
      isActive: true
    }
  });

  return newStage.id;
};

// Handler for master dropdowns and form metadata
const getProductMastersHandler = async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: { select: { finishedProducts: true, subcategories: true } }
      },
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
          { name: 'Pasteurization', description: 'Thermal processing for food safety', isActive: true },
          { name: 'Ageing', description: 'Aging mix at cold temperature', isActive: true },
          { name: 'VAT', description: 'Aging/Holding VAT tank processing', isActive: true },
          { name: 'Mixing', description: 'Blending and emulsifying raw materials', isActive: true },
          { name: 'CF - Cont. Freezer', description: 'Continuous freezer processing', isActive: true },
          { name: 'BF - Bath Freezer', description: 'Brine bath freezer processing', isActive: true },
          { name: 'CM - Candy Machine', description: 'Automated candy/stick molding machine', isActive: true },
          { name: 'Manual Weight', description: 'Manual weighing and portion verification', isActive: true },
          { name: 'HT - Hardening Tunner', description: 'Hardening tunnel blast freezing', isActive: true },
          { name: 'PACKING', description: 'Primary and secondary packaging', isActive: true },
          { name: 'LABLE AND PRINTING', description: 'Batch coding, labeling and printing', isActive: true },
          { name: 'Freezing', description: 'Solidification and sub-zero chilling', isActive: true },
          { name: 'QC', description: 'Quality control, sensory and lab inspection', isActive: true },
          { name: 'Storage', description: 'Cold room pallet storage & inventory intake', isActive: true }
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

    // Approved raw materials for formulation
    const rawMaterials = await prisma.rawMaterial.findMany({
      include: { category: true, uoms: true },
      orderBy: { name: 'asc' }
    });

    // Users for responsible persons dropdown
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true }
    });

    // Subcategories with their category and base templates
    const subcategories = await prisma.productSubcategory.findMany({
      where: { status: 'ACTIVE' },
      include: {
        _count: { select: { products: true } },
        category: { select: { id: true, name: true, code: true } },
        defaultUom: { select: { id: true, name: true, abbreviation: true } },
        baseTemplates: {
          select: { id: true, name: true, wastagePercent: true, overheadPercent: true }
        },
        specTemplate: {
          include: {
            fields: {
              orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }]
            }
          }
        }
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });

    res.json({ categories, subcategories, units, stages, nonInventoryItems, rawMaterials, users });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/masters - Fetch all metadata for master dropdowns
router.get('/masters', authenticateToken, getProductMastersHandler);

// GET /api/products/form-metadata - Alias for master dropdowns
router.get('/form-metadata', authenticateToken, getProductMastersHandler);

// GET /api/products/search - Fast lookup for billing & POS
router.get('/search', authenticateToken, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit || '300', 10), 1000);

    const whereClause = {
      deletedAt: null,
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { category: { name: { contains: q, mode: 'insensitive' } } }
        ]
      } : {})
    };

    const products = await prisma.finishedProduct.findMany({
      where: whereClause,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, abbreviation: true } },
        stockLevels: { select: { minLevel: true, maxLevel: true, reorderPoint: true } }
      },
      orderBy: { name: 'asc' }
    });

    const productIds = products.map(p => p.id);
    const [batches, movements] = await Promise.all([
      prisma.productionBatchNew.findMany({
        where: {
          productId: { in: productIds },
          status: { in: ['Completed', 'qc_passed'] },
          remainingQty: { gt: 0 },
          deletedAt: null
        },
        orderBy: { expiryDate: 'asc' },
        select: {
          id: true,
          productId: true,
          batchNo: true,
          referenceNo: true,
          remainingQty: true,
          expiryDate: true
        }
      }),
      prisma.productStockMovement.findMany({
        where: { productId: { in: productIds } },
        select: {
          productId: true,
          quantity: true,
          direction: true
        }
      })
    ]);

    const batchMap = {};
    batches.forEach(b => {
      if (!batchMap[b.productId]) batchMap[b.productId] = [];
      batchMap[b.productId].push(b);
    });

    const netMovements = {};
    movements.forEach(m => {
      const q = Number(m.quantity || 0);
      const dir = Number(m.direction || 0);
      netMovements[m.productId] = (netMovements[m.productId] || 0) + (dir * q);
    });

    const results = products.map(p => {
      const pBatches = batchMap[p.id] || [];
      const totalBatchStock = pBatches.reduce((s, b) => s + Number(b.remainingQty || 0), 0);
      const nextBatch = pBatches[0] || null;

      const baseCategory = p.category?.name || p.specifications?.group || 'General';
      const subcategoryName = p.subcategory?.name || p.specifications?.category || p.specifications?.series || '';
      const unitOfSaleName = p.unit?.abbreviation || p.unit?.name || 'pcs';

      // Live ledger calculation: openingStock + stock movements
      const ledgerMovementStock = Number(p.openingStock || 0) + (netMovements[p.id] || 0);
      const rawCurrentStock = p.currentStock !== null && p.currentStock !== undefined ? Number(p.currentStock) : null;

      // Real live stock: if active batch stock > 0, use batch stock; otherwise rawCurrentStock or ledger movement
      let calculatedLiveStock = 0;
      if (totalBatchStock > 0) {
        calculatedLiveStock = totalBatchStock;
      } else if (rawCurrentStock !== null && !isNaN(rawCurrentStock)) {
        calculatedLiveStock = rawCurrentStock;
      } else {
        calculatedLiveStock = ledgerMovementStock;
      }

      return {
        id: p.id,
        code: p.code,
        systemCode: p.code,
        name: p.name,
        productName: p.productName || p.name,
        category: p.category?.name || baseCategory,
        baseCategory: baseCategory,
        subcategory: subcategoryName,
        unit: unitOfSaleName,
        unitOfSale: unitOfSaleName,
        salePrice: Number(p.salePrice || 0),
        currentStock: calculatedLiveStock,
        stock: calculatedLiveStock,
        directStock: rawCurrentStock !== null ? rawCurrentStock : ledgerMovementStock,
        batchStock: totalBatchStock,
        ledgerStock: ledgerMovementStock,
        activeBatchesCount: pBatches.length,
        nextExpiringBatch: nextBatch ? {
          batchId: nextBatch.id,
          batchNo: nextBatch.batchNo || nextBatch.referenceNo,
          expiryDate: nextBatch.expiryDate,
          remainingQty: Number(nextBatch.remainingQty)
        } : null,
        hsnCode: p.specifications?.hsnCode || p.hsnCode || '21050000',
        gstRate: p.specifications?.gstPercent !== undefined
          ? Number(p.specifications.gstPercent)
          : (Number(p.igst || 0) || (Number(p.cgst || 0) + Number(p.sgst || 0)) || 5),
        cgst: Number(p.cgst || 2.5),
        sgst: Number(p.sgst || 2.5),
        igst: Number(p.igst || 5.0),
        size: p.size || p.specifications?.sizeML || '',
        cavity: p.specifications?.cavity || '',
        series: p.specifications?.series || '',
        description: p.description || '',
        specifications: p.specifications || {},
        alertLevel: Number(p.alertLevel || 0)
      };
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/bulk-template - Download Product Master import template
router.get('/bulk-template', authenticateToken, async (req, res, next) => {
  try {
    const templateData = [
      {
        'Product Code': 'FP-000101',
        'Product Name': 'Mango Kulfi 100ml',
        'Category': 'Kulfi',
        'UOM': 'pcs',
        'Sale Price (INR)': 45.00,
        'Min Stock Alert': 50,
        'HSN Code': '21050000',
        'GST Rate (%)': 18,
        'Opening Stock': 100,
        'Description': 'Premium creamy mango kulfi'
      },
      {
        'Product Code': 'FP-000102',
        'Product Name': 'Malai Kulfi Stick',
        'Category': 'Kulfi',
        'UOM': 'pcs',
        'Sale Price (INR)': 35.00,
        'Min Stock Alert': 100,
        'HSN Code': '21050000',
        'GST Rate (%)': 18,
        'Opening Stock': 200,
        'Description': 'Rich traditional cardamom malai kulfi'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="product_master_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// POST /api/products/bulk-import - Bulk validate or upsert products from Excel / CSV
router.post('/bulk-import', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an Excel or CSV file.' });
    }

    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'The uploaded sheet is empty.' });
    }

    const validRows = [];
    const errors = [];

    const categories = await prisma.productCategory.findMany({ where: { status: 'ACTIVE' } });
    const uoms = await prisma.uOM.findMany({ where: { isActive: true } });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors = [];

      const name = (row['Product Name'] || row['name'] || '').toString().trim();
      const code = (row['Product Code'] || row['code'] || '').toString().trim();
      const categoryName = (row['Category'] || row['category'] || '').toString().trim();
      const uomName = (row['UOM'] || row['uom'] || row['Unit'] || 'pcs').toString().trim();
      const salePrice = Number(row['Sale Price (INR)'] || row['Sale Price'] || row['salePrice'] || 0);
      const minStock = Number(row['Min Stock Alert'] || row['minLevel'] || row['Min Stock'] || 0);
      const hsnCode = (row['HSN Code'] || row['hsnCode'] || '21050000').toString().trim();
      const gstRate = Number(row['GST Rate (%)'] || row['gstRate'] || row['GST Rate'] || 18);
      const openingStock = Number(row['Opening Stock'] || row['openingStock'] || 0);
      const description = (row['Description'] || row['description'] || '').toString().trim();

      if (!name) rowErrors.push('Product Name is required');
      if (salePrice < 0 || isNaN(salePrice)) rowErrors.push('Sale Price must be a non-negative number');
      if (gstRate < 0 || gstRate > 28 || isNaN(gstRate)) rowErrors.push('GST Rate must be between 0% and 28%');

      let categoryId = null;
      if (categoryName) {
        const foundCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (foundCat) categoryId = foundCat.id;
      }
      if (!categoryId && categories.length > 0) {
        categoryId = categories[0].id;
      }

      let uomId = null;
      if (uomName) {
        const foundUom = uoms.find(u => u.name.toLowerCase() === uomName.toLowerCase() || u.abbreviation.toLowerCase() === uomName.toLowerCase());
        if (foundUom) uomId = foundUom.id;
      }
      if (!uomId && uoms.length > 0) {
        uomId = uoms[0].id;
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNum,
          productName: name || 'Unnamed',
          code: code || 'Auto',
          reasons: rowErrors
        });
      } else {
        validRows.push({
          row: rowNum,
          name,
          code: code || null,
          categoryId,
          unitId: uomId,
          salePrice,
          minStock,
          hsnCode,
          gstRate,
          openingStock,
          description,
          uomName,
          categoryName
        });
      }
    }

    if (dryRun) {
      return res.json({
        dryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        validPreview: validRows.slice(0, 10),
        errors
      });
    }

    const importedProducts = await prisma.$transaction(async (tx) => {
      const createdList = [];

      for (const item of validRows) {
        let finalCode = item.code;
        if (!finalCode) {
          finalCode = await generateProductCode(tx);
        }

        const existing = await tx.finishedProduct.findFirst({
          where: {
            OR: [
              { code: finalCode },
              { name: { equals: item.name, mode: 'insensitive' } }
            ],
            deletedAt: null
          }
        });

        let savedProduct;
        if (existing) {
          savedProduct = await tx.finishedProduct.update({
            where: { id: existing.id },
            data: {
              salePrice: item.salePrice,
              hsnCode: item.hsnCode,
              gstRate: item.gstRate,
              alertLevel: item.minStock,
              unitId: item.unitId || existing.unitId,
              categoryId: item.categoryId || existing.categoryId,
            }
          });
        } else {
          savedProduct = await tx.finishedProduct.create({
            data: {
              code: finalCode,
              name: item.name,
              categoryId: item.categoryId,
              unitId: item.unitId,
              salePrice: item.salePrice,
              currentStock: item.openingStock,
              openingStock: item.openingStock,
              alertLevel: item.minStock,
              hsnCode: item.hsnCode,
              gstRate: item.gstRate,
              totalCost: item.salePrice * 0.7,
              createdBy: req.user.id
            }
          });

          await tx.productStockLevel.upsert({
            where: { productId: savedProduct.id },
            update: { minLevel: item.minStock, reorderPoint: item.minStock },
            create: { productId: savedProduct.id, minLevel: item.minStock, reorderPoint: item.minStock, maxLevel: item.minStock * 5 }
          });
        }

        createdList.push(savedProduct);
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'BULK_IMPORT_PRODUCTS',
          tableName: 'products',
          recordId: 'BULK',
          oldValue: null,
          newValue: { importedCount: createdList.length },
          ip: req.ip || '127.0.0.1'
        }
      });

      return createdList;
    });

    res.json({
      success: true,
      importedCount: importedProducts.length,
      skippedErrorsCount: errors.length,
      errors
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/stock - Current stock per finished product
router.get('/stock', authenticateToken, async (req, res, next) => {
  try {
    const productsData = await prisma.$queryRaw`
      SELECT 
        p.id, 
        p.code, 
        p.name, 
        p.opening_stock AS "openingStock", 
        p.sale_price AS "salePrice", 
        p.alert_level AS "alertLevel",
        p.unit_id AS "unitId",
        c.name AS "categoryName",
        u.abbreviation AS "unitAbbr", 
        u.name AS "unitName",
        psl.min_level AS "minLevel", 
        psl.max_level AS "maxLevel", 
        psl.reorder_point AS "reorderPoint",
        COALESCE(sm.net_movement, 0)::float AS "netMovement"
      FROM products p
      LEFT JOIN "ProductCategory" c ON p.category_id = c.id
      LEFT JOIN "UOM" u ON p.unit_id = u.id
      LEFT JOIN product_stock_levels psl ON p.id = psl.product_id
      LEFT JOIN (
        SELECT product_id, SUM(direction * quantity) AS net_movement
        FROM product_stock_movements
        GROUP BY product_id
      ) sm ON p.id = sm.product_id
      WHERE p.deleted_at IS NULL
    `;

    const result = [];
    for (const row of productsData) {
      const currentStock = Number(row.openingStock || 0) + Number(row.netMovement || 0);
      
      const minLevel = row.minLevel !== null ? Number(row.minLevel) : Number(row.alertLevel || 0) * 0.5;
      const maxLevel = row.maxLevel !== null ? Number(row.maxLevel) : 0;
      const reorderPoint = row.reorderPoint !== null ? Number(row.reorderPoint) : Number(row.alertLevel || 0);

      let status = 'OK';
      if (currentStock <= minLevel && minLevel > 0) {
        status = 'Critical';
      } else if (currentStock <= reorderPoint && reorderPoint > 0) {
        status = 'Low';
      }

      result.push({
        id: row.id,
        code: row.code,
        name: row.name,
        category: row.categoryName || 'N/A',
        unit: row.unitAbbr || row.unitName || row.unitId || 'pcs',
        currentStock,
        minLevel,
        maxLevel,
        reorderPoint,
        unitValue: Number(row.salePrice || 0),
        totalValue: currentStock * Number(row.salePrice || 0),
        status,
        salePrice: Number(row.salePrice || 0)
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/stock/:productId/history - Comprehensive product stock history & stock ledger audit trail
router.get('/stock/:productId/history', authenticateToken, async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await prisma.finishedProduct.findFirst({
      where: {
        OR: [
          { id: productId },
          { code: productId }
        ],
        deletedAt: null
      },
      include: {
        category: true,
        unit: true,
        creator: { select: { id: true, name: true, email: true, role: true } },
        stockLevels: true,
        bom: {
          include: {
            rawMaterial: {
              include: { uoms: true }
            }
          }
        },
        nonInventoryCosts: {
          include: { item: true }
        },
        stages: {
          include: { stage: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Finished Product not found' });
    }

    // 1. Stock Movements (Chronological for Running Balance)
    const rawMovements = await prisma.productStockMovement.findMany({
      where: { productId: product.id },
      include: {
        batch: {
          include: {
            qcTests: true
          }
        },
        order: {
          include: {
            customer: true
          }
        },
        creator: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    let currentBalance = Number(product.openingStock || 0);
    const chronologicalMovements = rawMovements.map(m => {
      const change = (m.direction || 1) * Number(m.quantity || 0);
      currentBalance += change;
      return {
        id: m.id,
        type: m.type,
        direction: m.direction,
        quantity: Number(m.quantity || 0),
        balanceAfter: currentBalance,
        referenceNo: m.batch?.batchNo || m.batch?.referenceNo || m.order?.referenceNo || 'MANUAL',
        batchId: m.batchId,
        orderId: m.orderId,
        batchNo: m.batch?.batchNo || m.batch?.referenceNo || null,
        orderNo: m.order?.referenceNo || null,
        note: m.note || '',
        actorName: m.creator?.name || 'System User',
        actorRole: m.creator?.role || 'OPERATOR',
        createdAt: m.createdAt
      };
    });

    // Reversed for latest first display in ledger table
    const ledgerMovements = [...chronologicalMovements].reverse();

    // 2. Production Inflow Batches
    const batches = await prisma.productionBatchNew.findMany({
      where: { productId: product.id },
      include: {
        creator: { select: { name: true } },
        qcTests: {
          include: {
            tester: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedBatches = batches.map(b => {
      const planned = Number(b.plannedQuantity || 0);
      const actual = Number(b.actualOutput || 0);
      const yieldPct = planned > 0 ? ((actual / planned) * 100).toFixed(1) : '100';
      const latestQc = b.qcTests && b.qcTests.length > 0 ? b.qcTests[b.qcTests.length - 1] : null;
      return {
        id: b.id,
        batchNo: b.batchNo || b.referenceNo || 'N/A',
        referenceNo: b.referenceNo || 'N/A',
        plannedQuantity: planned,
        actualOutput: actual,
        unit: product.unit?.abbreviation || 'pcs',
        yieldPercent: yieldPct,
        unitCost: Number(b.unitCost || 0),
        totalCost: Number(b.totalCost || 0),
        status: b.status,
        stage: b.stage,
        startDate: b.startDate,
        endDate: b.endDate,
        qcStatus: latestQc ? (latestQc.action === 'approved' ? 'APPROVED' : (latestQc.action === 'rejected' ? 'REJECTED' : 'PENDING')) : 'NOT_TESTED',
        qcResult: latestQc?.result || 'N/A',
        qcTester: latestQc?.tester?.name || 'Lab Staff',
        supervisorName: b.supervisor?.name || b.creator?.name || 'Supervisor',
        createdAt: b.createdAt
      };
    });

    // 3. Customer Orders & Allocations
    const orderItems = await prisma.customerOrderItem.findMany({
      where: { productId: product.id },
      include: {
        order: {
          include: {
            customer: true,
            creator: { select: { name: true } }
          }
        }
      },
      orderBy: { order: { deliveryDate: 'desc' } }
    });

    const formattedOrders = orderItems.map(item => ({
      id: item.id,
      orderId: item.order?.id,
      referenceNo: item.order?.referenceNo || 'N/A',
      customerName: item.order?.customer?.name || 'N/A',
      customerContact: item.order?.customer?.phone || item.order?.customer?.email || 'N/A',
      orderDate: item.order?.createdAt,
      deliveryDate: item.deliveryDate || item.order?.deliveryDate,
      orderedQty: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      subtotal: Number(item.subtotal || 0),
      profit: Number(item.profit || 0),
      unit: product.unit?.abbreviation || 'pcs',
      status: item.order?.status || 'Quotation',
      orderType: item.order?.type
    }));

    // 4. Product Wastage Records
    const wastages = await prisma.productWastage.findMany({
      where: { productId: product.id },
      include: {
        creator: { select: { name: true, role: true } }
      },
      orderBy: { date: 'desc' }
    });

    const formattedWastages = wastages.map(w => ({
      id: w.id,
      referenceNo: w.referenceNo || 'N/A',
      date: w.date,
      quantity: Number(w.quantity || 0),
      unit: product.unit?.abbreviation || 'pcs',
      lossAmount: Number(w.quantity || 0) * Number(product.salePrice || 0),
      note: w.note || 'No notes provided',
      createdBy: w.creator?.name || 'Supervisor'
    }));

    // 5. Customer Sales Returns
    const returnItems = await prisma.salesReturnItem.findMany({
      where: { productId: product.id },
      include: {
        return: {
          include: {
            order: {
              include: {
                customer: true
              }
            }
          }
        }
      },
      orderBy: { return: { createdAt: 'desc' } }
    });

    const formattedReturns = returnItems.map(ri => ({
      id: ri.id,
      returnId: ri.return?.id,
      referenceNo: ri.return?.returnNo || 'N/A',
      returnDate: ri.return?.createdAt,
      customerName: ri.return?.order?.customer?.name || 'N/A',
      quantity: Number(ri.quantity || 0),
      unit: product.unit?.abbreviation || 'pcs',
      reason: ri.return?.reason || 'Customer Return',
      status: ri.return?.status || 'PENDING',
      action: 'RESTOCK'
    }));

    // 6. Bill of Materials (BoM Ingredients)
    const formattedBOM = (product.bom || []).map(b => ({
      id: b.id,
      rmId: b.rmId,
      rmName: b.rawMaterial?.name || 'Raw Material',
      rmCode: b.rawMaterial?.code || 'RM',
      rmUnit: b.rawMaterial?.unitId || 'kg',
      currentStock: Number(b.rawMaterial?.currentStock || 0),
      consumptionPerUnit: Number(b.consumptionPerUnit || 0),
      unitPrice: Number(b.unitPrice || 0),
      totalCost: Number(b.totalCost || 0)
    }));

    // 7. Unified Chronological Timeline
    const timelineEvents = [];

    chronologicalMovements.forEach(m => {
      const isAdd = m.direction === 1;
      const isProd = m.type === 'production_in';
      const isSales = m.type === 'order_allocation';

      timelineEvents.push({
        id: `mov-${m.id}`,
        type: isProd ? 'PRODUCTION_INFLOW' : (isSales ? 'SALES_ALLOCATION' : 'STOCK_MOVEMENT'),
        title: isProd ? `Finished Product Produced: +${m.quantity} ${product.unit?.abbreviation || 'pcs'}` : (isSales ? `Stock Allocated to Order: -${m.quantity} ${product.unit?.abbreviation || 'pcs'}` : `Stock Movement: ${isAdd ? '+' : '-'}${m.quantity} ${product.unit?.abbreviation || 'pcs'}`),
        subtitle: m.note || `Ref: ${m.referenceNo}`,
        timestamp: m.createdAt,
        status: m.type.replace(/_/g, ' ').toUpperCase(),
        badgeColor: isAdd ? 'emerald' : 'rose',
        user: m.actorName,
        metadata: {
          batchId: m.batchId,
          orderId: m.orderId,
          referenceNo: m.referenceNo,
          quantity: m.quantity,
          direction: m.direction,
          balanceAfter: m.balanceAfter
        }
      });
    });

    formattedWastages.forEach(w => {
      timelineEvents.push({
        id: `waste-${w.id}`,
        type: 'PRODUCT_WASTAGE',
        title: `Product Wastage Discarded: -${w.quantity} ${w.unit}`,
        subtitle: `Ref: ${w.referenceNo} • Loss: ₹${w.lossAmount.toLocaleString('en-IN')}`,
        timestamp: w.date,
        status: 'WASTED',
        badgeColor: 'rose',
        user: w.createdBy,
        metadata: {
          referenceNo: w.referenceNo,
          quantity: w.quantity,
          lossAmount: w.lossAmount,
          note: w.note
        }
      });
    });

    formattedReturns.forEach(r => {
      timelineEvents.push({
        id: `return-${r.id}`,
        type: 'SALES_RETURN',
        title: `Customer Return Received: +${r.quantity} ${r.unit}`,
        subtitle: `Customer: ${r.customerName} • Ref: ${r.referenceNo}`,
        timestamp: r.returnDate,
        status: r.status,
        badgeColor: 'teal',
        user: 'Sales Desk',
        metadata: {
          returnId: r.returnId,
          referenceNo: r.referenceNo,
          quantity: r.quantity,
          reason: r.reason
        }
      });
    });

    timelineEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 8. Aggregate Metrics
    const stockLevel = product.stockLevels?.[0] || null;
    const minLevel = stockLevel?.minLevel !== undefined ? Number(stockLevel.minLevel) : Number(product.alertLevel || 0) * 0.5;
    const maxLevel = stockLevel?.maxLevel !== undefined ? Number(stockLevel.maxLevel) : 0;
    const reorderPoint = stockLevel?.reorderPoint !== undefined ? Number(stockLevel.reorderPoint) : Number(product.alertLevel || 0);

    const totalProducedIn = chronologicalMovements.filter(m => m.direction === 1).reduce((sum, m) => sum + m.quantity, 0);
    const totalAllocatedOut = chronologicalMovements.filter(m => m.direction === -1).reduce((sum, m) => sum + m.quantity, 0);
    const totalWasted = formattedWastages.reduce((sum, w) => sum + w.quantity, 0);
    const totalWastedLoss = formattedWastages.reduce((sum, w) => sum + w.lossAmount, 0);

    let stockHealth = 'OPTIMAL';
    if (currentBalance <= minLevel && minLevel > 0) {
      stockHealth = 'CRITICAL';
    } else if (currentBalance <= reorderPoint && reorderPoint > 0) {
      stockHealth = 'LOW';
    }

    // 9. Fetch items of same category for Stock Query grid
    let categoryProducts = [];
    if (product.categoryId) {
      const sameCategoryItems = await prisma.finishedProduct.findMany({
        where: {
          categoryId: product.categoryId,
          id: { not: product.id },
          deletedAt: null
        },
        take: 12,
        include: {
          unit: true
        },
        orderBy: { name: 'asc' }
      });
      categoryProducts = sameCategoryItems.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        currentStock: Number(p.openingStock || 0),
        salePrice: Number(p.salePrice || 0),
        unit: p.unit?.abbreviation || 'pcs'
      }));
    }

    // Costing calculations
    const totalBomCost = formattedBOM.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const avgCostPrice = totalBomCost > 0 ? totalBomCost : Number(product.salePrice || 0) * 0.7;
    const closingValue = currentBalance * avgCostPrice;

    res.json({
      product: {
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category?.name || 'N/A',
        unit: product.unit?.abbreviation || product.unit?.name || 'pcs',
        salePrice: Number(product.salePrice || 0),
        openingStock: Number(product.openingStock || 0),
        currentStock: currentBalance,
        minLevel,
        maxLevel,
        reorderPoint,
        stockHealth,
        totalValue: currentBalance * Number(product.salePrice || 0),
        imageUrl: product.imageUrl,
        createdAt: product.createdAt
      },
      metrics: {
        currentStock: currentBalance,
        totalGoodsValue: currentBalance * Number(product.salePrice || 0),
        totalProducedIn,
        totalAllocatedOut,
        totalWasted,
        totalWastedLoss,
        completedBatchesCount: formattedBatches.filter(b => b.status === 'COMPLETED').length,
        pendingBatchesCount: formattedBatches.filter(b => b.status !== 'COMPLETED').length,
        totalOrdersCount: formattedOrders.length
      },
      costingSummary: {
        avgCostPrice,
        standardCost: totalBomCost || Number(product.salePrice || 0) * 0.7,
        closingValue,
        salePrice: Number(product.salePrice || 0),
        lastProduction: formattedBatches[0] || null,
        lastSale: formattedOrders[0] || null
      },
      categoryProducts,
      ledger: ledgerMovements,
      batches: formattedBatches,
      orders: formattedOrders,
      bom: formattedBOM,
      wastages: formattedWastages,
      returns: formattedReturns,
      timeline: timelineEvents
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/low-stock - Products below min stock
router.get('/low-stock', authenticateToken, async (req, res, next) => {
  try {
    const productsData = await prisma.$queryRaw`
      SELECT 
        p.id, 
        p.code, 
        p.name, 
        p.opening_stock AS "openingStock", 
        p.sale_price AS "salePrice", 
        p.alert_level AS "alertLevel",
        p.unit_id AS "unitId",
        c.name AS "categoryName",
        u.abbreviation AS "unitAbbr", 
        u.name AS "unitName",
        psl.min_level AS "minLevel", 
        psl.max_level AS "maxLevel", 
        psl.reorder_point AS "reorderPoint",
        COALESCE(sm.net_movement, 0)::float AS "netMovement"
      FROM products p
      LEFT JOIN "ProductCategory" c ON p.category_id = c.id
      LEFT JOIN "UOM" u ON p.unit_id = u.id
      LEFT JOIN product_stock_levels psl ON p.id = psl.product_id
      LEFT JOIN (
        SELECT product_id, SUM(direction * quantity) AS net_movement
        FROM product_stock_movements
        GROUP BY product_id
      ) sm ON p.id = sm.product_id
      WHERE p.deleted_at IS NULL
    `;

    const result = [];
    for (const row of productsData) {
      const currentStock = Number(row.openingStock || 0) + Number(row.netMovement || 0);
      
      const minLevel = row.minLevel !== null ? Number(row.minLevel) : Number(row.alertLevel || 0) * 0.5;
      const maxLevel = row.maxLevel !== null ? Number(row.maxLevel) : 0;
      const reorderPoint = row.reorderPoint !== null ? Number(row.reorderPoint) : Number(row.alertLevel || 0);

      if (currentStock <= minLevel && minLevel > 0) {
        result.push({
          id: row.id,
          code: row.code,
          name: row.name,
          category: row.categoryName || 'N/A',
          unit: row.unitAbbr || row.unitName || row.unitId || 'pcs',
          currentStock,
          minLevel,
          maxLevel,
          reorderPoint,
          status: 'Critical',
          salePrice: Number(row.salePrice || 0)
        });
      } else if (currentStock <= reorderPoint && reorderPoint > 0) {
        result.push({
          id: row.id,
          code: row.code,
          name: row.name,
          category: row.categoryName || 'N/A',
          unit: row.unitAbbr || row.unitName || row.unitId || 'pcs',
          currentStock,
          minLevel,
          maxLevel,
          reorderPoint,
          status: 'Low',
          salePrice: Number(row.salePrice || 0)
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
        include: { product: true }
      });

      // 3. Log a stock movement OUT (-1) for this wastage
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

// GET /api/products - list all products
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const products = await prisma.finishedProduct.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      include: {
        category: true,
        subcategory: {
          include: {
            specTemplate: {
              include: {
                fields: { orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }] }
              }
            }
          }
        },
        unit: true,
        bom: { include: { rawMaterial: true } },
        nonInventoryCosts: { include: { item: true } },
        stages: { include: { stage: true } },
        stockLevels: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch movements for all products to compute live stock
    const movements = await prisma.productStockMovement.findMany({
      select: {
        productId: true,
        quantity: true,
        direction: true
      }
    });

    const netMovements = {};
    movements.forEach(m => {
      const q = Number(m.quantity || 0);
      const dir = Number(m.direction || 0);
      netMovements[m.productId] = (netMovements[m.productId] || 0) + (dir * q);
    });

    const liveProducts = products.map(p => {
      const net = netMovements[p.id] || 0;
      const liveStock = Number(p.openingStock || 0) + net;
      return {
        ...p,
        currentStock: liveStock
      };
    });

    res.json(liveProducts);
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
        subcategory: {
          include: {
            specTemplate: {
              include: {
                fields: { orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }] }
              }
            }
          }
        },
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

    // Fetch movements for this product to compute live stock
    const movements = await prisma.productStockMovement.findMany({
      where: { productId: product.id },
      select: {
        quantity: true,
        direction: true
      }
    });

    let net = 0;
    movements.forEach(m => {
      net += Number(m.direction || 0) * Number(m.quantity || 0);
    });

    product.currentStock = Number(product.openingStock || 0) + net;

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id/available-batches - Batches for FEFO & manual picking
router.get('/:id/available-batches', authenticateToken, async (req, res, next) => {
  try {
    const batchAllocationService = require('../../services/batchAllocation.service');
    const batches = await batchAllocationService.getAvailableBatches(req.params.id);
    res.json(batches);
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

// Shared robust schema for Product Creation & Update
const formatZodError = (err) => {
  if (err instanceof z.ZodError) {
    return err.errors.map(e => `${e.path.length > 0 ? e.path.join('.') : 'field'}: ${e.message}`).join(', ');
  }
  return err?.message || 'Validation failed';
};

const productValidationSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  categoryId: z.string().trim().min(1, 'Category is required'),
  subcategoryId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  specifications: z.record(z.any()).optional().nullable().default({}),
  customAttributes: z.array(z.object({
    key: z.string(),
    value: z.any()
  })).optional().nullable().default([]),

  // Universal Core Attributes
  brand: z.string().optional().nullable(),
  productName: z.string().optional().nullable(),
  categoryPathText: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dimensionLength: z.preprocess(v => v !== '' && v !== null && v !== undefined ? Number(v) : null, z.number().nullable().optional()),
  dimensionWidth: z.preprocess(v => v !== '' && v !== null && v !== undefined ? Number(v) : null, z.number().nullable().optional()),
  dimensionHeight: z.preprocess(v => v !== '' && v !== null && v !== undefined ? Number(v) : null, z.number().nullable().optional()),
  dimensionUnit: z.string().optional().nullable().default('cm'),
  weightValue: z.preprocess(v => v !== '' && v !== null && v !== undefined ? Number(v) : null, z.number().nullable().optional()),
  weightUnit: z.string().optional().nullable().default('kg'),
  material: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  upcEan: z.string().optional().nullable(),
  countryOfOrigin: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  keyFeatures: z.string().optional().nullable(),

  unitId: z.string().trim().min(1, 'Unit of sale is required'),
  stockMethod: z.string().default('FIFO'),
  openingStock: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  alertLevel: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  profitMargin: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
  salePrice: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().optional().nullable().default(0)),
  cgst: z.preprocess(v => Number(v) || 0, z.number().default(18)),
  sgst: z.preprocess(v => Number(v) || 0, z.number().default(9)),
  igst: z.preprocess(v => Number(v) || 0, z.number().default(9)),
  bom: z.array(z.object({
    rmId: z.string().min(1, 'Raw material is required'),
    consumption: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
    unitPrice: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0)),
    totalCost: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0))
  })).default([]),
  nonInventoryCosts: z.array(z.object({
    itemId: z.string().min(1, 'Cost factor item is required'),
    cost: z.preprocess(v => Math.max(0, Number(v) || 0), z.number().nonnegative().default(0))
  })).default([]),
  stages: z.array(z.object({
    stageId: z.string().min(1, 'Stage is required'),
    months: z.preprocess(v => Math.max(0, Math.round(Number(v) || 0)), z.number().int().nonnegative().default(0)),
    days: z.preprocess(v => Math.max(0, Math.round(Number(v) || 0)), z.number().int().nonnegative().default(0)),
    hours: z.preprocess(v => Math.max(0, Math.round(Number(v) || 0)), z.number().int().nonnegative().default(0)),
    minutes: z.preprocess(v => Math.max(0, Math.round(Number(v) || 0)), z.number().int().nonnegative().default(0)),
    sortOrder: z.preprocess(v => Math.max(0, Math.round(Number(v) || 0)), z.number().int().nonnegative().default(0))
  })).default([]),
  expectedOutput: z.preprocess(v => Math.max(1, Number(v) || 1), z.number().nonnegative().optional().nullable().default(1)),
  sopSteps: z.array(z.object({
    stepNumber: z.preprocess(v => Math.max(1, Math.round(Number(v) || 1)), z.number().int().default(1)),
    instruction: z.preprocess(v => (v === null || v === undefined ? '' : String(v)), z.string().default('')),
    tempTime: z.preprocess(v => (v === null || v === undefined ? '' : String(v)), z.string().optional().nullable().default('')),
    safetyNote: z.preprocess(v => (v === null || v === undefined ? '' : String(v)), z.string().optional().nullable().default(''))
  })).optional().nullable().default([]),
  imageUrl: z.string().optional().nullable(),
  isSopLocked: z.boolean().optional()
});

// POST /api/products/generate-sku - Smart Auto-Generated SKU and Barcode
router.post('/generate-sku', authenticateToken, async (req, res, next) => {
  try {
    const { categoryId, subcategoryId, name } = req.body;
    let catPrefix = 'CAT';
    let subPrefix = 'GEN';

    if (categoryId) {
      const cat = await prisma.productCategory.findUnique({ where: { id: categoryId } });
      if (cat) catPrefix = cat.code || cat.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
    }

    if (subcategoryId) {
      const sub = await prisma.productSubcategory.findUnique({ where: { id: subcategoryId } });
      if (sub) subPrefix = sub.skuPrefix || sub.code || sub.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
    }

    const words = (name || 'PRD').trim().split(/\s+/).filter(Boolean);
    let initials = '';
    if (words.length === 1) {
      initials = words[0].slice(0, 4).toUpperCase();
    } else {
      initials = words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
    }
    if (!initials) initials = 'ITEM';

    const basePrefix = `${catPrefix}-${subPrefix}-${initials}`;

    // Query highest existing sequence
    const existing = await prisma.finishedProduct.findMany({
      where: { sku: { startsWith: basePrefix } },
      select: { sku: true },
      orderBy: { sku: 'desc' },
      take: 1
    });

    let nextSeq = 1;
    if (existing.length > 0 && existing[0].sku) {
      const segs = existing[0].sku.split('-');
      const lastNum = parseInt(segs[segs.length - 1], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }

    const sku = `${basePrefix}-${String(nextSeq).padStart(4, '0')}`;
    const barcode = `890${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 10)}`;

    res.json({
      sku,
      barcode,
      basePrefix,
      sequence: nextSeq
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/products/bulk-import - Material Master Excel Bulk Upload with Dynamic Specification Validation
router.post('/bulk-import', authenticateToken, roleMiddleware(['MAIN_MASTER']), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Please upload an Excel (.xlsx, .xls) or CSV file' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded sheet contains no data rows.' });
    }

    // Pre-fetch all categories, subcategories with templates, and UOMs
    const [categories, subcategories, uoms] = await Promise.all([
      prisma.productCategory.findMany(),
      prisma.productSubcategory.findMany({
        include: { specTemplate: { include: { fields: true } } }
      }),
      prisma.uOM.findMany()
    ]);

    const results = {
      totalRows: rawRows.length,
      successCount: 0,
      failedCount: 0,
      errors: [],
      created: []
    };

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;
      const rowErrors = [];

      const rawName = String(row.Product_Name || row.name || row['Product Name'] || '').trim();
      if (!rawName) {
        rowErrors.push('Product_Name is required');
      }

      // Resolve Category
      const rawCat = String(row.Category || row.category || '').trim();
      let matchedCat = null;
      if (rawCat) {
        matchedCat = categories.find(c =>
          c.id === rawCat ||
          c.name.toLowerCase() === rawCat.toLowerCase() ||
          (c.code && c.code.toLowerCase() === rawCat.toLowerCase())
        );
      }
      if (!matchedCat && categories.length > 0) {
        matchedCat = categories[0];
      }

      if (!matchedCat) {
        rowErrors.push(`Category '${rawCat}' could not be resolved`);
      }

      // Resolve Subcategory
      const rawSub = String(row.Subcategory || row.subcategory || '').trim();
      let matchedSub = null;
      if (rawSub) {
        matchedSub = subcategories.find(s =>
          (matchedCat ? s.categoryId === matchedCat.id : true) &&
          (s.id === rawSub || s.name.toLowerCase() === rawSub.toLowerCase() || s.code.toLowerCase() === rawSub.toLowerCase())
        );
      }

      // Resolve UOM
      const rawUom = String(row.UOM || row.uom || row.Unit || 'pcs').trim().toLowerCase();
      let matchedUom = uoms.find(u => u.name.toLowerCase() === rawUom || u.abbreviation.toLowerCase() === rawUom);
      if (!matchedUom) {
        matchedUom = uoms[0];
      }

      // Dynamic Specifications parsing and validation
      const specifications = {};
      if (matchedSub && matchedSub.specTemplate && matchedSub.specTemplate.fields) {
        const fields = matchedSub.specTemplate.fields;
        for (const f of fields) {
          const matchingRowKey = Object.keys(row).find(k => {
            const clean = k.toLowerCase().replace(/^spec:\s*/, '');
            return clean.startsWith(f.fieldName.toLowerCase()) || clean.startsWith(f.fieldKey.toLowerCase());
          });

          const val = matchingRowKey !== undefined ? row[matchingRowKey] : undefined;

          if (f.isMandatory && (val === undefined || val === null || String(val).trim() === '')) {
            rowErrors.push(`Mandatory specification '${f.fieldName}' is missing`);
          } else if (val !== undefined && val !== null && String(val).trim() !== '') {
            if (f.fieldType === 'NUMBER') {
              const numVal = Number(val);
              if (isNaN(numVal)) {
                rowErrors.push(`Specification '${f.fieldName}' must be a valid number`);
              } else {
                if (f.minValue !== null && numVal < Number(f.minValue)) {
                  rowErrors.push(`Specification '${f.fieldName}' value ${numVal} is below minimum allowed ${f.minValue}`);
                }
                if (f.maxValue !== null && numVal > Number(f.maxValue)) {
                  rowErrors.push(`Specification '${f.fieldName}' value ${numVal} exceeds maximum allowed ${f.maxValue}`);
                }
                specifications[f.fieldKey] = numVal;
              }
            } else if (f.fieldType === 'BOOLEAN') {
              const strVal = String(val).toLowerCase().trim();
              specifications[f.fieldKey] = strVal === 'true' || strVal === 'yes' || strVal === '1';
            } else {
              specifications[f.fieldKey] = String(val).trim();
            }
          }
        }
      }

      if (rowErrors.length > 0) {
        results.failedCount++;
        results.errors.push({ row: rowNum, product: rawName || 'Unknown', errors: rowErrors });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const code = await generateProductCode(tx);
          const salePrice = Number(row.Sale_Price || row.salePrice || 0);
          const openingStock = Number(row.Opening_Stock || row.openingStock || 0);
          const alertLevel = Number(row.Alert_Level || row.alertLevel || 0);

          const newProduct = await tx.finishedProduct.create({
            data: {
              code,
              name: rawName.toUpperCase(),
              categoryId: matchedCat.id,
              subcategoryId: matchedSub?.id || null,
              unitId: matchedUom.id,
              stockMethod: 'FIFO',
              salePrice,
              openingStock,
              currentStock: openingStock,
              alertLevel,
              totalCost: 0,
              profitMargin: 0,
              cgst: 9,
              sgst: 9,
              igst: 0,
              createdBy: req.user.id,
              sku: row.SKU ? String(row.SKU).trim().toUpperCase() : null,
              brand: row.Brand ? String(row.Brand).trim().toUpperCase() : null,
              productName: rawName.toUpperCase(),
              categoryPathText: `${matchedCat.name} > ${matchedSub?.name || 'GENERAL'}`.toUpperCase(),
              description: row.Description ? String(row.Description).trim() : null,
              dimensionLength: row.Dimension_Length ? Number(row.Dimension_Length) : null,
              dimensionWidth: row.Dimension_Width ? Number(row.Dimension_Width) : null,
              dimensionHeight: row.Dimension_Height ? Number(row.Dimension_Height) : null,
              dimensionUnit: row.Dimension_Unit ? String(row.Dimension_Unit).trim().toLowerCase() : 'cm',
              weightValue: row.Weight ? Number(row.Weight) : null,
              weightUnit: row.Weight_Unit ? String(row.Weight_Unit).trim().toLowerCase() : 'kg',
              material: row.Material ? String(row.Material).trim().toUpperCase() : null,
              color: row.Color ? String(row.Color).trim().toUpperCase() : null,
              size: row.Size ? String(row.Size).trim().toUpperCase() : null,
              modelNumber: row.Model_Number ? String(row.Model_Number).trim().toUpperCase() : null,
              upcEan: row.UPC_EAN ? String(row.UPC_EAN).trim() : null,
              countryOfOrigin: row.Country_of_Origin ? String(row.Country_of_Origin).trim().toUpperCase() : 'INDIA',
              warranty: row.Warranty ? String(row.Warranty).trim() : null,
              keyFeatures: row.Key_Features ? String(row.Key_Features).trim() : null,
              specifications
            }
          });

          results.created.push({ id: newProduct.id, code: newProduct.code, name: newProduct.name });
          results.successCount++;
        });
      } catch (insertErr) {
        results.failedCount++;
        results.errors.push({ row: rowNum, product: rawName, errors: [insertErr.message] });
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// POST /api/products - Create Product
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const data = productValidationSchema.parse(req.body);

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
      const salePrice = data.salePrice !== undefined ? Number(data.salePrice) : totalCost * (1 + Number(data.profitMargin) / 100);

      // 1. Create main product
      const newProduct = await tx.finishedProduct.create({
        data: {
          code,
          name: data.name ? data.name.trim().toUpperCase() : data.name,
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
          expectedOutput: data.expectedOutput || null,
          sopSteps: data.sopSteps || null,
          isSopLocked: data.isSopLocked !== undefined ? data.isSopLocked : (data.sopSteps && data.sopSteps.length > 0 ? true : false),
          sopHistory: [],
          imageUrl: data.imageUrl || null,
          createdBy: req.user.id,
          // Classification & Dynamic Specs
          subcategoryId: data.subcategoryId || null,
          sku: data.sku ? String(data.sku).trim().toUpperCase() : null,
          barcode: data.barcode ? String(data.barcode).trim().toUpperCase() : null,
          specifications: data.specifications || {},
          customAttributes: data.customAttributes || [],
          // Universal Core Attributes
          brand: data.brand ? String(data.brand).trim().toUpperCase() : null,
          productName: (data.productName || data.name).trim().toUpperCase(),
          categoryPathText: data.categoryPathText ? String(data.categoryPathText).trim().toUpperCase() : null,
          description: data.description ? String(data.description).trim() : null,
          dimensionLength: data.dimensionLength !== undefined && data.dimensionLength !== null ? Number(data.dimensionLength) : null,
          dimensionWidth: data.dimensionWidth !== undefined && data.dimensionWidth !== null ? Number(data.dimensionWidth) : null,
          dimensionHeight: data.dimensionHeight !== undefined && data.dimensionHeight !== null ? Number(data.dimensionHeight) : null,
          dimensionUnit: data.dimensionUnit || 'cm',
          weightValue: data.weightValue !== undefined && data.weightValue !== null ? Number(data.weightValue) : null,
          weightUnit: data.weightUnit || 'kg',
          material: data.material ? String(data.material).trim().toUpperCase() : null,
          color: data.color ? String(data.color).trim().toUpperCase() : null,
          size: data.size ? String(data.size).trim().toUpperCase() : null,
          modelNumber: data.modelNumber ? String(data.modelNumber).trim().toUpperCase() : null,
          upcEan: data.upcEan ? String(data.upcEan).trim() : null,
          countryOfOrigin: data.countryOfOrigin ? String(data.countryOfOrigin).trim().toUpperCase() : null,
          warranty: data.warranty ? String(data.warranty).trim() : null,
          keyFeatures: data.keyFeatures ? String(data.keyFeatures).trim() : null
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
        const stageRecords = [];
        for (let idx = 0; idx < data.stages.length; idx++) {
          const s = data.stages[idx];
          const resolvedId = await resolveStageId(tx, s.stageId);
          if (resolvedId) {
            stageRecords.push({
              productId: newProduct.id,
              stageId: resolvedId,
              months: s.months,
              days: s.days,
              hours: s.hours,
              minutes: s.minutes,
              sortOrder: s.sortOrder !== undefined ? s.sortOrder : idx
            });
          }
        }
        if (stageRecords.length > 0) {
          await tx.productStage.createMany({ data: stageRecords });
        }
      }

      // Write action to Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_PRODUCT',
          tableName: 'products',
          recordId: newProduct.id,
          newValue: {
            code: newProduct.code,
            name: newProduct.name,
            totalCost: newProduct.totalCost,
            salePrice: newProduct.salePrice
          },
          ip: req.ip || '127.0.0.1'
        }
      });

      return newProduct;
    });

    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = formatZodError(error);
      console.error('\n[ZOD VALIDATION ERROR IN POST PRODUCT]:', formatted, error.errors);
      return res.status(400).json({ error: formatted, details: error.errors });
    }
    console.error('\n[PRODUCT CREATE ERROR]:', error);
    return res.status(400).json({ error: error.message || 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update Product
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const data = productValidationSchema.parse(req.body);

    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.finishedProduct.findFirst({
        where: { id, deletedAt: null },
        include: { bom: true }
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
      const salePrice = data.salePrice !== undefined ? Number(data.salePrice) : totalCost * (1 + Number(data.profitMargin) / 100);

      // Archive previous SOP values if locked and edited
      let updatedSopHistory = Array.isArray(existing.sopHistory) ? [...existing.sopHistory] : [];
      if (existing.isSopLocked && (
        JSON.stringify(existing.sopSteps) !== JSON.stringify(data.sopSteps) ||
        JSON.stringify(existing.bom.map(b => ({ rmId: b.rmId, consumption: Number(b.consumptionPerUnit) }))) !== 
        JSON.stringify(data.bom.map(b => ({ rmId: b.rmId, consumption: b.consumption }))) ||
        Number(existing.expectedOutput) !== Number(data.expectedOutput)
      )) {
        const editorUser = await tx.user.findUnique({ where: { id: req.user.id } });
        const editorName = editorUser ? editorUser.name : req.user.role;
        
        updatedSopHistory.push({
          date: new Date().toISOString(),
          editorName,
          expectedOutput: existing.expectedOutput ? Number(existing.expectedOutput) : null,
          sopSteps: existing.sopSteps,
          bom: existing.bom.map(b => ({
            rmId: b.rmId,
            consumption: Number(b.consumptionPerUnit),
            unitPrice: Number(b.unitPrice),
            totalCost: Number(b.totalCost)
          }))
        });
      }

      // 1. Update product
      const updatedProduct = await tx.finishedProduct.update({
        where: { id },
        data: {
          name: data.name ? data.name.trim().toUpperCase() : data.name,
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
          alertLevel: data.alertLevel,
          expectedOutput: data.expectedOutput || null,
          sopSteps: data.sopSteps || null,
          isSopLocked: data.isSopLocked !== undefined ? data.isSopLocked : (data.sopSteps && data.sopSteps.length > 0 ? true : false),
          sopHistory: updatedSopHistory,
          imageUrl: data.imageUrl || null,
          // Classification & Dynamic Specs
          subcategoryId: data.subcategoryId !== undefined ? data.subcategoryId : existing.subcategoryId,
          sku: data.sku !== undefined ? (data.sku ? String(data.sku).trim().toUpperCase() : null) : existing.sku,
          barcode: data.barcode !== undefined ? (data.barcode ? String(data.barcode).trim().toUpperCase() : null) : existing.barcode,
          specifications: data.specifications !== undefined ? data.specifications : existing.specifications,
          customAttributes: data.customAttributes !== undefined ? data.customAttributes : existing.customAttributes,
          // Universal Core Attributes
          brand: data.brand !== undefined ? (data.brand ? String(data.brand).trim().toUpperCase() : null) : existing.brand,
          productName: data.productName !== undefined ? (data.productName ? String(data.productName).trim().toUpperCase() : (data.name ? data.name.trim().toUpperCase() : '')) : (existing.productName || existing.name),
          categoryPathText: data.categoryPathText !== undefined ? (data.categoryPathText ? String(data.categoryPathText).trim().toUpperCase() : null) : existing.categoryPathText,
          description: data.description !== undefined ? (data.description ? String(data.description).trim() : null) : existing.description,
          dimensionLength: data.dimensionLength !== undefined ? (data.dimensionLength !== '' && data.dimensionLength !== null ? Number(data.dimensionLength) : null) : existing.dimensionLength,
          dimensionWidth: data.dimensionWidth !== undefined ? (data.dimensionWidth !== '' && data.dimensionWidth !== null ? Number(data.dimensionWidth) : null) : existing.dimensionWidth,
          dimensionHeight: data.dimensionHeight !== undefined ? (data.dimensionHeight !== '' && data.dimensionHeight !== null ? Number(data.dimensionHeight) : null) : existing.dimensionHeight,
          dimensionUnit: data.dimensionUnit !== undefined ? (data.dimensionUnit || 'cm') : existing.dimensionUnit,
          weightValue: data.weightValue !== undefined ? (data.weightValue !== '' && data.weightValue !== null ? Number(data.weightValue) : null) : existing.weightValue,
          weightUnit: data.weightUnit !== undefined ? (data.weightUnit || 'kg') : existing.weightUnit,
          material: data.material !== undefined ? (data.material ? String(data.material).trim().toUpperCase() : null) : existing.material,
          color: data.color !== undefined ? (data.color ? String(data.color).trim().toUpperCase() : null) : existing.color,
          size: data.size !== undefined ? (data.size ? String(data.size).trim().toUpperCase() : null) : existing.size,
          modelNumber: data.modelNumber !== undefined ? (data.modelNumber ? String(data.modelNumber).trim().toUpperCase() : null) : existing.modelNumber,
          upcEan: data.upcEan !== undefined ? (data.upcEan ? String(data.upcEan).trim() : null) : existing.upcEan,
          countryOfOrigin: data.countryOfOrigin !== undefined ? (data.countryOfOrigin ? String(data.countryOfOrigin).trim().toUpperCase() : null) : existing.countryOfOrigin,
          warranty: data.warranty !== undefined ? (data.warranty ? String(data.warranty).trim() : null) : existing.warranty,
          keyFeatures: data.keyFeatures !== undefined ? (data.keyFeatures ? String(data.keyFeatures).trim() : null) : existing.keyFeatures
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
        const stageRecords = [];
        for (let idx = 0; idx < data.stages.length; idx++) {
          const s = data.stages[idx];
          const resolvedId = await resolveStageId(tx, s.stageId);
          if (resolvedId) {
            stageRecords.push({
              productId: id,
              stageId: resolvedId,
              months: s.months,
              days: s.days,
              hours: s.hours,
              minutes: s.minutes,
              sortOrder: s.sortOrder !== undefined ? s.sortOrder : idx
            });
          }
        }
        if (stageRecords.length > 0) {
          await tx.productStage.createMany({ data: stageRecords });
        }
      }

      // Write action to Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_PRODUCT_SOP',
          tableName: 'products',
          recordId: id,
          oldValue: {
            expectedOutput: existing.expectedOutput,
            sopSteps: existing.sopSteps
          },
          newValue: {
            expectedOutput: data.expectedOutput,
            sopSteps: data.sopSteps
          },
          ip: req.ip || '127.0.0.1'
        }
      });

      return updatedProduct;
    });

    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = formatZodError(error);
      console.error('\n[ZOD VALIDATION ERROR IN PUT PRODUCT]:', formatted, error.errors);
      return res.status(400).json({ error: formatted, details: error.errors });
    }
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('\n[PRODUCT UPDATE ERROR]:', error);
    return res.status(400).json({ error: error.message || 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Try Hard Delete, fallback to Soft Delete
router.delete('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.finishedProduct.findFirst({
      where: { id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    try {
      // Attempt hard delete first
      await prisma.finishedProduct.delete({
        where: { id }
      });
    } catch (e) {
      // Fallback to soft delete if referenced by other tables (foreign key violation)
      await prisma.finishedProduct.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});



module.exports = router;
