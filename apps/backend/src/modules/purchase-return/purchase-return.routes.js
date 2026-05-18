const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const { generateReferenceNo } = require('../../utils/referenceGenerator');

const router = express.Router();

// ─────────────────────── PURCHASE RETURN ───────────────────────

const returnSchema = z.object({
  poId: z.string().uuid().optional(),
  grnId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  returnQty: z.coerce.number().positive(),
  uom: z.string().optional(),
  returnReason: z.enum(['LAB_REJECTED', 'PHYSICAL_DAMAGE', 'WRONG_MATERIAL', 'SHORT_EXPIRY', 'QTY_MISMATCH', 'EXPIRED_RM', 'OTHER']),
  reasonDescription: z.string().min(1),
  initiatedBy: z.string().optional().default('RECEIVER_INITIATED'),
  responsibleUserId: z.string().uuid().optional(),
  returnDate: z.string().optional(),
  transporterName: z.string().optional(),
  transporterVehicle: z.string().optional(),
  transporterDriver: z.string().optional(),
  debitNoteNumber: z.string().optional(),
  rawMaterialName: z.string().optional(),
});

// Helper: notify all relevant roles about a purchase return event
async function notifyReturnEvent(tx, { type, message, referenceId, metadata }) {
  try {
    const targetUsers = await tx.user.findMany({
      where: { role: { in: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'] } },
      select: { id: true },
    });
    if (targetUsers.length > 0) {
      await tx.notification.createMany({
        data: targetUsers.map(u => ({
          userId: u.id,
          type,
          message,
          referenceType: 'PurchaseReturn',
          referenceId,
          metadata: metadata || {},
          isRead: false,
        })),
        skipDuplicates: true,
      });
    }
  } catch (e) {
    console.error('[PurchaseReturn] Notification error:', e.message);
  }
}

// ─────────────────────── CREATE ───────────────────────
// POST /api/purchase-return — Create a new purchase return
router.post('/',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF']),
  async (req, res, next) => {
    try {
      const data = returnSchema.parse(req.body);

      // Fetch PO (optional for production-initiated returns) and GRN
      const po = data.poId
        ? await prisma.rawMaterialPO.findUnique({ where: { id: data.poId }, include: { supplier: true, uom: true } })
        : null;
      const grn = data.grnId
        ? await prisma.gRNReceive.findUnique({ where: { id: data.grnId } })
        : null;

      if (data.poId && !po) return res.status(404).json({ error: 'Purchase Order not found' });
      if (data.grnId && !grn) return res.status(404).json({ error: 'GRN not found' });

      const referenceNo = await generateReferenceNo(prisma, 'PurchaseReturn', 'PR');

      const record = await prisma.purchaseReturn.create({
        data: {
          referenceNo,
          poId: data.poId || null,
          grnId: data.grnId || null,
          returnQty: data.returnQty,
          uom: data.uom || po?.uom?.abbreviation || null,
          returnReason: data.returnReason,
          reasonDescription: data.reasonDescription,
          initiatedBy: data.initiatedBy,
          responsibleUserId: data.responsibleUserId || null,
          returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
          transporterName: data.transporterName || null,
          transporterVehicle: data.transporterVehicle || null,
          transporterDriver: data.transporterDriver || null,
          debitNoteNumber: data.debitNoteNumber || null,
          status: 'PENDING',
          createdBy: req.user.id,
        },
        include: {
          po: { include: { supplier: true } },
          grn: true,
          responsibleUser: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      // Audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATED',
          tableName: 'PurchaseReturn',
          recordId: record.id,
          oldValue: null,
          newValue: { referenceNo: record.referenceNo, status: 'PENDING', returnReason: record.returnReason },
          ip: clientIp,
        },
      });

      // Notify supervisors/accountants on creation
      await notifyReturnEvent(prisma, {
        type: 'PURCHASE_RETURN_CREATED',
        message: `Purchase Return ${referenceNo} created. Reason: ${data.returnReason}. Qty: ${data.returnQty} ${data.uom || ''}. PO: ${po?.referenceNo || 'N/A'}`,
        referenceId: record.id,
        metadata: { referenceNo, returnReason: data.returnReason, returnQty: data.returnQty },
      });

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// ─────────────────────── LIST ───────────────────────
// GET /api/purchase-return — List all purchase returns
router.get('/',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { supplierId, returnReason, status, from, to } = req.query;
      const where = {};
      if (status) where.status = status;
      if (returnReason) where.returnReason = returnReason;
      if (from || to) {
        where.returnDate = {};
        if (from) where.returnDate.gte = new Date(from);
        if (to) where.returnDate.lte = new Date(to);
      }
      if (supplierId) where.po = { supplierId };

      const returns = await prisma.purchaseReturn.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          po: { include: { supplier: true, uom: true } },
          grn: { select: { referenceNo: true, status: true } },
          responsibleUser: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });
      res.json(returns);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────── GET ONE ───────────────────────
// GET /api/purchase-return/:id — Get single return
router.get('/:id',
  authenticateToken,
  async (req, res, next) => {
    try {
      const record = await prisma.purchaseReturn.findUnique({
        where: { id: req.params.id },
        include: {
          po: { include: { supplier: true, uom: true } },
          grn: true,
          responsibleUser: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });
      if (!record) return res.status(404).json({ error: 'Purchase Return not found' });
      res.json(record);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────── STATUS UPDATE + INVENTORY ───────────────────────
// PATCH /api/purchase-return/:id/status — Update status + reduce inventory on CLOSED
router.patch('/:id/status',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']),
  async (req, res, next) => {
    try {
      const { status } = z.object({
        status: z.enum(['PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'CLOSED']),
      }).parse(req.body);

      const existing = await prisma.purchaseReturn.findUnique({
        where: { id: req.params.id },
        include: { po: { include: { supplier: true, uom: true } }, grn: true },
      });
      if (!existing) return res.status(404).json({ error: 'Purchase Return not found' });

      // Transaction: update status + reduce inventory on CLOSED
      const updated = await prisma.$transaction(async (tx) => {
        const upd = await tx.purchaseReturn.update({
          where: { id: req.params.id },
          data: { status },
          include: {
            po: { include: { supplier: true, uom: true } },
            grn: true,
            responsibleUser: { select: { name: true } },
            creator: { select: { name: true } },
          },
        });

        // On CLOSED: reduce raw material inventory
        if (status === 'CLOSED' && existing.status !== 'CLOSED') {
          const returnQty = Number(existing.returnQty || 0);
          const po = existing.po;

          if (returnQty > 0 && po) {
            // Find the raw material record
            let rm = await tx.rawMaterial.findFirst({ where: { code: po.rmId } });
            if (!rm && po.name) {
              rm = await tx.rawMaterial.findFirst({
                where: { name: { equals: po.name, mode: 'insensitive' } },
              });
            }

            if (rm) {
              const newStock = Math.max(0, Number(rm.currentStock) - returnQty);
              await tx.rawMaterial.update({
                where: { id: rm.id },
                data: { currentStock: newStock },
              });
              console.log(`[PURCHASE RETURN CLOSED] Stock reduced: ${rm.name} -${returnQty} → ${newStock}`);
            } else {
              console.warn(`[PURCHASE RETURN CLOSED] Could not match RawMaterial for rmId="${po.rmId}", name="${po.name}". Stock NOT reduced.`);
            }
          }

          // Send CLOSED notifications inside transaction context
          await notifyReturnEvent(tx, {
            type: 'PURCHASE_RETURN_CLOSED',
            message: `Purchase Return ${existing.referenceNo} CLOSED. Qty: ${existing.returnQty} ${existing.uom || ''}. PO: ${po?.referenceNo || 'N/A'}. Inventory updated.`,
            referenceId: req.params.id,
            metadata: {
              referenceNo: existing.referenceNo,
              returnQty: existing.returnQty,
              uom: existing.uom,
              poNumber: po?.referenceNo,
              supplierName: po?.supplier?.name,
            },
          });
        } else if (status === 'DISPATCHED' && existing.status !== 'DISPATCHED') {
          await notifyReturnEvent(tx, {
            type: 'PURCHASE_RETURN_DISPATCHED',
            message: `Purchase Return ${existing.referenceNo} DISPATCHED to supplier ${existing.po?.supplier?.name || 'unknown'}.`,
            referenceId: req.params.id,
            metadata: { referenceNo: existing.referenceNo, status: 'DISPATCHED' },
          });
        }

        return upd;
      });

      // Audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'STATUS_UPDATE',
          tableName: 'PurchaseReturn',
          recordId: req.params.id,
          oldValue: { status: existing.status },
          newValue: { status },
          ip: clientIp,
        },
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// ─────────────────────── UPDATE LOGISTICS ───────────────────────
// PATCH /api/purchase-return/:id — Update logistics fields
router.patch('/:id',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT']),
  async (req, res, next) => {
    try {
      const updateData = z.object({
        responsibleUserId: z.string().uuid().optional(),
        returnDate: z.string().optional(),
        transporterName: z.string().optional(),
        transporterVehicle: z.string().optional(),
        transporterDriver: z.string().optional(),
        debitNoteNumber: z.string().optional(),
        reasonDescription: z.string().optional(),
      }).parse(req.body);

      const existing = await prisma.purchaseReturn.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Purchase Return not found' });

      const data = {};
      if (updateData.responsibleUserId) data.responsibleUserId = updateData.responsibleUserId;
      if (updateData.returnDate) data.returnDate = new Date(updateData.returnDate);
      if (updateData.transporterName !== undefined) data.transporterName = updateData.transporterName;
      if (updateData.transporterVehicle !== undefined) data.transporterVehicle = updateData.transporterVehicle;
      if (updateData.transporterDriver !== undefined) data.transporterDriver = updateData.transporterDriver;
      if (updateData.debitNoteNumber !== undefined) data.debitNoteNumber = updateData.debitNoteNumber;
      if (updateData.reasonDescription !== undefined) data.reasonDescription = updateData.reasonDescription;

      const updated = await prisma.purchaseReturn.update({
        where: { id: req.params.id },
        data,
        include: {
          po: { include: { supplier: true, uom: true } },
          grn: true,
          responsibleUser: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

module.exports = router;
