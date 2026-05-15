const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const { generateReferenceNo } = require('../../utils/referenceGenerator');

const router = express.Router();

// ─────────────────────── PURCHASE RETURN ───────────────────────

const returnSchema = z.object({
  poId: z.string().uuid(),
  grnId: z.string().uuid(),
  returnQty: z.coerce.number().positive(),
  uom: z.string().optional(),
  returnReason: z.enum(['LAB_REJECTED', 'PHYSICAL_DAMAGE', 'WRONG_MATERIAL', 'SHORT_EXPIRY', 'QTY_MISMATCH', 'OTHER']),
  reasonDescription: z.string().min(1),
  initiatedBy: z.string().optional().default('RECEIVER_INITIATED'),
  responsibleUserId: z.string().uuid().optional(),
  returnDate: z.string().optional(),
  transporterName: z.string().optional(),
  transporterVehicle: z.string().optional(),
  transporterDriver: z.string().optional(),
  debitNoteNumber: z.string().optional(),
});

// POST /api/purchase-return — Create a new purchase return
router.post('/',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT']),
  async (req, res, next) => {
    try {
      const data = returnSchema.parse(req.body);

      const [po, grn] = await Promise.all([
        prisma.rawMaterialPO.findUnique({ where: { id: data.poId }, include: { supplier: true, uom: true } }),
        prisma.gRNReceive.findUnique({ where: { id: data.grnId } }),
      ]);
      if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
      if (!grn) return res.status(404).json({ error: 'GRN not found' });

      const referenceNo = await generateReferenceNo(prisma, 'PurchaseReturn', 'PR');

      const record = await prisma.purchaseReturn.create({
        data: {
          referenceNo,
          poId: data.poId,
          grnId: data.grnId,
          returnQty: data.returnQty,
          uom: data.uom || po.uom?.abbreviation || null,
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
          newValue: { referenceNo: record.referenceNo, status: 'PENDING' },
          ip: clientIp,
        },
      });

      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

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

// PATCH /api/purchase-return/:id/status — Update status
router.patch('/:id/status',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']),
  async (req, res, next) => {
    try {
      const { status } = z.object({
        status: z.enum(['PENDING', 'DISPATCHED', 'ACKNOWLEDGED', 'CLOSED']),
      }).parse(req.body);

      const existing = await prisma.purchaseReturn.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Purchase Return not found' });

      const updated = await prisma.purchaseReturn.update({
        where: { id: req.params.id },
        data: { status },
      });

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

// PATCH /api/purchase-return/:id — Update logistics fields (complete a draft return)
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
