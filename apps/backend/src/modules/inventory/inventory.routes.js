const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const { resolveBatchUomId } = require('../grn/grn.helper');

const router = express.Router();

// ─────────────────────── INVENTORY UPLOAD ───────────────────────

const uploadSchema = z.object({
  grnId: z.string().uuid(),
  storageLocation: z.string().optional(),
  expiryDate: z.string().optional(),
  remarks: z.string().optional(),
});

// POST /api/inventory/upload — Upload a GRN to inventory after lab approval
router.post('/upload',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']),
  async (req, res, next) => {
    try {
      const data = uploadSchema.parse(req.body);

      // Fetch GRN with PO and lab test
      const grn = await prisma.gRNReceive.findUnique({
        where: { id: data.grnId },
        include: {
          po: { include: { supplier: true, uom: true, idRegistry: true } },
          labTest: true,
          items: true,
        },
      });
      if (!grn) return res.status(404).json({ error: 'GRN not found' });
      if (grn.status !== 'LAB_APPROVED') return res.status(409).json({ error: 'GRN must be lab-approved before inventory upload' });
      if (grn.inventoryStatus === 'UPLOADED') return res.status(409).json({ error: 'Inventory already uploaded for this GRN' });

      // Check lab approval
      if (!grn.labTest || grn.labTest.overallDecision !== 'APPROVED') {
        return res.status(409).json({ error: 'Lab test must be approved before inventory upload' });
      }

      // Calculate quantities
      const totalReceived = grn.items.reduce((s, i) => s + Number(i.actualReceivedQty) - Number(i.returnQty || 0), 0);
      const sampleQty = grn.labTest ? Number(grn.labTest.sampleQty || 0) : 0;
      const netQty = Math.max(0, totalReceived - sampleQty);

      // Generate batch number: RM-YYYYMMDD-POID_SHORT-GRNID_SHORT
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const poShort = grn.poId.slice(-6).toUpperCase();
      const grnShort = grn.id.slice(-6).toUpperCase();
      const batchNumber = `RM-${dateStr}-${poShort}-${grnShort}`;

      // Get first item's RM info
      const firstItem = grn.items[0];
      const rm = firstItem ? await prisma.rawMaterial.findFirst({ where: { code: firstItem.rmId } }) : null;
      const category = rm ? await prisma.rMCategory.findUnique({ where: { id: rm.categoryId } }) : null;

      const batch = await prisma.$transaction(async (tx) => {
        const batchUomId = await resolveBatchUomId(firstItem, rm, grn.po, tx);

        // Create inventory batch
        const b = await tx.inventoryBatch.create({
          data: {
            batchNumber,
            poId: grn.poId,
            grnId: grn.id,
            rawMaterialId: rm?.id || firstItem?.rmId || 'unknown',
            rawMaterialName: grn.po.name || firstItem?.rmName || 'Unknown',
            rmCategory: category?.name || null,
            supplierId: grn.po.supplierId || null,
            receivedQty: totalReceived,
            sampleQty,
            netQty,
            uomId: batchUomId || grn.po.uomId,
            storageLocation: data.storageLocation || null,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
            status: 'AVAILABLE',
            addedBy: req.user.id,
          },
          include: {
            po: { include: { supplier: true } },
            grn: { select: { referenceNo: true } },
            uom: true,
            adder: { select: { name: true } },
          },
        });

        // Update GRN inventory status
        await tx.gRNReceive.update({
          where: { id: grn.id },
          data: { inventoryStatus: 'UPLOADED' },
        });

        return b;
      });

      // Audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'INVENTORY_UPLOAD',
          tableName: 'InventoryBatch',
          recordId: batch.id,
          oldValue: null,
          newValue: { batchNumber, grnId: grn.id, netQty },
          ip: clientIp,
        },
      });

      res.status(201).json(batch);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// GET /api/inventory — List all inventory batches
router.get('/',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { status, rawMaterialId, supplierId, poId } = req.query;
      const where = {};
      if (status) where.status = status;
      if (rawMaterialId) where.rawMaterialId = rawMaterialId;
      if (supplierId) where.supplierId = supplierId;
      if (poId) where.poId = poId;

      const batches = await prisma.inventoryBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          po: { include: { supplier: true, uom: true } },
          grn: { select: { referenceNo: true, receivedDate: true } },
          uom: true,
          adder: { select: { name: true } },
        },
      });
      res.json(batches);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/health-check — Complete Stock Auditing & Health Check Dataset across 4 categories
router.get('/health-check',
  authenticateToken,
  async (req, res, next) => {
    try {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 1. Raw Materials: Batches + Master + Adjustments
      const [rmBatches, rawMaterials, rmAdjustments] = await Promise.all([
        prisma.inventoryBatch.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            uom: { select: { id: true, name: true, abbreviation: true } },
            po: { include: { supplier: { select: { id: true, name: true, phone: true } } } },
            grn: { select: { id: true, referenceNo: true, receivedDate: true } },
            adder: { select: { id: true, name: true } },
          },
        }),
        prisma.rawMaterial.findMany({
          orderBy: { name: 'asc' },
          include: {
            category: { select: { id: true, name: true } },
          },
        }),
        prisma.rMStockAdjustment.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
        })
      ]);

      // 2. Finished Goods: Production Batches + Master + Stock Levels
      const [fgBatches, finishedProducts] = await Promise.all([
        prisma.productionBatchNew.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                sku: true,
                barcode: true,
                currentStock: true,
                alertLevel: true,
                salePrice: true,
                category: { select: { id: true, name: true } },
                subcategory: { select: { id: true, name: true } },
              },
            },
          },
        }),
        prisma.finishedProduct.findMany({
          orderBy: { name: 'asc' },
          include: {
            category: { select: { id: true, name: true } },
            subcategory: { select: { id: true, name: true } },
            stockLevels: true,
          },
        }),
      ]);

      // 3. Machine / Equipment Assets & Asset Masters
      const [assets, assetMasters, machineLogs] = await Promise.all([
        prisma.asset.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.assetMaster.findMany({
          orderBy: { createdAt: 'desc' },
        }),
        prisma.productionMachineLog.findMany({
          take: 50,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // 4. Other Items (Non-Inventory Items)
      const nonInventoryItems = await prisma.nonInventoryItem.findMany({
        orderBy: { name: 'asc' },
        include: {
          productNonInventoryCosts: true,
        },
      });

      // Compute Health Metrics
      let expiredCount = 0;
      let expiringSoonCount = 0;
      let lowStockCount = 0;
      let healthyCount = 0;

      // Check RM batches expiry
      rmBatches.forEach(b => {
        if (b.expiryDate) {
          const exp = new Date(b.expiryDate);
          if (exp < now) expiredCount++;
          else if (exp <= in30Days) expiringSoonCount++;
          else healthyCount++;
        } else {
          healthyCount++;
        }
      });

      // Check FG batches expiry
      fgBatches.forEach(b => {
        if (b.expiryDate) {
          const exp = new Date(b.expiryDate);
          if (exp < now) expiredCount++;
          else if (exp <= in30Days) expiringSoonCount++;
        }
      });

      // Check RM master low stock
      rawMaterials.forEach(rm => {
        if (Number(rm.currentStock || 0) <= Number(rm.alertLevel || 0)) {
          lowStockCount++;
        }
      });

      // Check FG master low stock
      finishedProducts.forEach(fp => {
        if (Number(fp.currentStock || 0) <= Number(fp.alertLevel || 0)) {
          lowStockCount++;
        }
      });

      res.json({
        success: true,
        summary: {
          totalRawMaterialBatches: rmBatches.length,
          totalRawMaterialsMaster: rawMaterials.length,
          totalFinishedGoodsBatches: fgBatches.length,
          totalFinishedProductsMaster: finishedProducts.length,
          totalAssets: assets.length,
          totalAssetMasters: assetMasters.length,
          totalOtherItems: nonInventoryItems.length,
          expiredCount,
          expiringSoonCount,
          lowStockCount,
          healthyCount,
        },
        rawMaterials: {
          batches: rmBatches,
          master: rawMaterials,
          adjustments: rmAdjustments,
        },
        finishedGoods: {
          batches: fgBatches,
          master: finishedProducts,
        },
        machineAssets: {
          assets,
          assetMasters,
          machineLogs,
        },
        otherItems: {
          items: nonInventoryItems,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/:id — Get single inventory batch
router.get('/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const batch = await prisma.inventoryBatch.findUnique({
        where: { id: req.params.id },
        include: {
          po: { include: { supplier: true, uom: true } },
          grn: { include: { labTest: true, items: true } },
          uom: true,
          adder: { select: { name: true } },
        },
      });
      if (!batch) return res.status(404).json({ error: 'Inventory batch not found' });
      res.json(batch);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/grn/:grnId — Check if inventory uploaded for a GRN
router.get('/grn/:grnId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const batch = await prisma.inventoryBatch.findUnique({
        where: { grnId: req.params.grnId },
      });
      res.json({ uploaded: !!batch, batch });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
