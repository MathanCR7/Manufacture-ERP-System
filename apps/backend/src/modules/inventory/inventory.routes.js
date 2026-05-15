const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

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
            uomId: grn.po.uomId,
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
      const { status, rawMaterialId, supplierId } = req.query;
      const where = {};
      if (status) where.status = status;
      if (rawMaterialId) where.rawMaterialId = rawMaterialId;
      if (supplierId) where.supplierId = supplierId;

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
