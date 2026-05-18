const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const workflowNotifications = require('../notifications/workflow.notifications');
const { generateReferenceNo } = require('../../utils/referenceGenerator');

const router = express.Router();

// ─────────────────────── PO STATUS UPDATE ───────────────────────
// PATCH /api/grn/po/:id/status — Update PO status (PENDING → ORDERED → RECEIVED)
const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ORDERED', 'RECEIVED']),
});

router.patch('/po/:id/status',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = updateStatusSchema.parse(req.body);

      const existing = await prisma.rawMaterialPO.findUnique({ where: { id }, include: { supplier: true } });
      if (!existing) return res.status(404).json({ error: 'Purchase Order not found' });
      if (existing.status === 'DELETED') return res.status(409).json({ error: 'Cannot update a deleted PO' });

      const updated = await prisma.rawMaterialPO.update({
        where: { id },
        data: { status },
        include: { supplier: true, uom: true, user: { select: { name: true } } }
      });

      // Audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'STATUS_UPDATE',
          tableName: 'RawMaterialPO',
          recordId: id,
          oldValue: { status: existing.status },
          newValue: { status },
          ip: clientIp,
        }
      });

      // Notify Material Receiver if status changed to RECEIVED
      if (status === 'RECEIVED') {
        try {
          await workflowNotifications.triggerPOStatusChanged?.({
            poId: id,
            referenceNo: updated.referenceNo,
            rmName: updated.name,
            newStatus: status,
            actorName: req.user.name || req.user.email,
            actorId: req.user.id,
            actorRole: req.user.role,
          });
        } catch (e) {
          console.error('Notification error on status change:', e.message);
        }
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// ─────────────────────── UPCOMING DELIVERIES ───────────────────────
// GET /api/grn/upcoming — All POs with status RECEIVED (upcoming deliveries for Material Receiver)
router.get('/upcoming',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']),
  async (req, res, next) => {
    try {
      const pos = await prisma.rawMaterialPO.findMany({
        where: { status: { in: ['RECEIVED', 'APPROVED'] } },
        orderBy: { updatedAt: 'desc' },
        include: { supplier: true, uom: true, user: { select: { name: true } } }
      });

      // Check if GRN exists for each PO
      const poIds = pos.map(p => p.id);
      const existingGrns = await prisma.gRNReceive.findMany({
        where: { poId: { in: poIds } },
        select: { poId: true, id: true, status: true, receivedDate: true, amountPaid: true, refundAmount: true }
      });
      const grnMap = {};
      existingGrns.forEach(g => { grnMap[g.poId] = g; });

      const result = pos
        .map(po => {
          const grn = grnMap[po.id] || null;
          return {
            id: po.id,
            referenceNo: po.referenceNo,
            rmId: po.rmId,
            name: po.name,
            quantity: po.quantity,
            amount: po.amount,
            uom: po.uom,
            supplierName: po.supplier?.name || null,
            supplierPhone: po.supplier?.phone || null,
            expectedDelivery: po.expectedDelivery,
            status: po.status,
            createdAt: po.createdAt,
            updatedAt: po.updatedAt,
            grnId: grn?.id || null,
            hasGrn: !!grn,
            grnStatus: grn?.status || null,
            receivedDate: grn?.receivedDate || null,
            amountPaid: grn?.amountPaid || null,
            refundAmount: grn?.refundAmount || null,
          };
        })
        // Exclude LAB_REJECTED entries from upcoming deliveries
        .filter(item => item.grnStatus !== 'LAB_REJECTED');

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────── GRN RECEIVE DELIVERY ───────────────────────
// POST /api/grn/receive — Submit a receive delivery form
const receiveSchema = z.object({
  poId: z.string().uuid(),
  receivedDate: z.string().min(1),
  items: z.array(z.object({
    rmId: z.string().min(1),
    rmName: z.string().min(1),
    expectedQty: z.coerce.number().nonnegative(),
    actualReceivedQty: z.coerce.number().nonnegative(),
    returnQty: z.coerce.number().nonnegative().default(0),
  })).min(1),
  amountPaid: z.coerce.number().nonnegative(),
  refundAmount: z.coerce.number().nonnegative().default(0),
  discrepancyNotes: z.string().optional(),
});

router.post('/receive',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'MATERIALS_RECEIVER']),
  async (req, res, next) => {
    try {
      const data = receiveSchema.parse(req.body);

      const po = await prisma.rawMaterialPO.findUnique({
        where: { id: data.poId },
        include: { supplier: true, uom: true }
      });
      if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
      if (po.status !== 'RECEIVED') return res.status(409).json({ error: 'PO must be in RECEIVED status to log delivery' });

      // Check if GRN already submitted for this PO
      const existingGrn = await prisma.gRNReceive.findFirst({ where: { poId: data.poId } });
      if (existingGrn) return res.status(409).json({ error: 'Delivery already received for this PO. GRN ID: ' + existingGrn.id });

      const referenceNo = await generateReferenceNo(prisma, 'GRNReceive', 'GRN');

      const grn = await prisma.gRNReceive.create({
        data: {
          referenceNo,
          poId: data.poId,
          receivedDate: new Date(data.receivedDate),
          amountPaid: data.amountPaid,
          refundAmount: data.refundAmount,
          discrepancyNotes: data.discrepancyNotes || null,
          receivedBy: req.user.id,
          status: 'PENDING_LAB',
          items: {
            create: data.items.map(item => ({
              rmId: item.rmId,
              rmName: item.rmName,
              expectedQty: item.expectedQty,
              actualReceivedQty: item.actualReceivedQty,
              returnQty: item.returnQty || 0,
            }))
          }
        },
        include: { items: true, po: { include: { supplier: true } } }
      });

      // Notify
      try {
        await workflowNotifications.triggerGRNSubmitted?.({
          rmId: po.rmId,
          rmName: po.name,
          receivedQty: data.items.reduce((s, i) => s + i.actualReceivedQty, 0),
          uom: po.uom?.abbreviation || 'units',
          receivedAmount: data.amountPaid,
          healthCondition: 'GOOD',
          confirmationStatus: 'APPROVED',
          grnId: grn.id,
          poId: po.id,
          actorName: req.user.name || req.user.email,
          actorId: req.user.id,
          actorRole: req.user.role,
        });
      } catch (e) {
        console.error('GRN notification error:', e.message);
      }

      res.status(201).json(grn);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// GET /api/grn/receive/:id — Get a specific GRN
router.get('/receive/:id',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const grn = await prisma.gRNReceive.findUnique({
        where: { id: req.params.id },
        include: {
          items: true,
          po: { include: { supplier: true, uom: true, user: { select: { name: true } } } },
          receiver: { select: { name: true, role: true } },
          labTest: true,
        }
      });
      if (!grn) return res.status(404).json({ error: 'GRN not found' });
      res.json(grn);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/grn/receive — List all GRNs
router.get('/receive',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const grns = await prisma.gRNReceive.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          po: { include: { supplier: true } },
          receiver: { select: { name: true } },
          labTest: { select: { id: true, status: true, overallDecision: true, overrideReason: true, labNotes: true, sampleQty: true, categoryParams: true, testedBy: true, approvedBy: true, approvedAt: true, createdAt: true, updatedAt: true } },
        }
      });
      res.json(grns);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────── LAB TEST ───────────────────────
// POST /api/grn/lab-test — Submit lab test results for a GRN
const labTestSchema = z.object({
  grnId: z.string().uuid(),
  testResults: z.array(z.object({
    grnItemId: z.string().uuid(),
    rmId: z.string(),
    rmName: z.string(),
    expiryDate: z.string().min(1),
    testNotes: z.string().optional(),
    passed: z.boolean(),
  })).min(1),
  overallDecision: z.enum(['APPROVED', 'REJECTED', 'NEED_SAMPLE']),
  labNotes: z.string().optional(),
  rmLabCategoryId: z.string().uuid().optional(),
  categoryParams: z.record(z.string(), z.any()).optional(),
});

router.post('/lab-test',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT', 'SUPERVISOR']),
  async (req, res, next) => {
    try {
      const data = labTestSchema.parse(req.body);

      const grn = await prisma.gRNReceive.findUnique({
        where: { id: data.grnId },
        include: { items: true, po: { include: { uom: true } } }
      });
      if (!grn) return res.status(404).json({ error: 'GRN not found' });
      if (grn.status !== 'PENDING_LAB') return res.status(409).json({ error: 'GRN is not pending lab test' });
      if (grn.labTest) return res.status(409).json({ error: 'Lab test already submitted for this GRN' });

      const labTest = await prisma.$transaction(async (tx) => {
        // Create lab test record
        const lt = await tx.gRNLabTest.create({
          data: {
            grnId: data.grnId,
            overallDecision: data.overallDecision,
            labNotes: data.labNotes || null,
            testedBy: req.user.id,
            ...(data.rmLabCategoryId && { rmLabCategoryId: data.rmLabCategoryId }),
            ...(data.categoryParams && { categoryParams: data.categoryParams }),
            testResults: {
              create: data.testResults.map(tr => ({
                grnItemId: tr.grnItemId,
                rmId: tr.rmId,
                rmName: tr.rmName,
                expiryDate: new Date(tr.expiryDate),
                testNotes: tr.testNotes || null,
                passed: tr.passed,
              }))
            }
          },
          include: { testResults: true }
        });

        // Update GRN status
        const newGrnStatus = data.overallDecision === 'APPROVED' ? 'LAB_APPROVED' : 
                             data.overallDecision === 'REJECTED' ? 'LAB_REJECTED' : 'LAB_RESAMPLE';
        await tx.gRNReceive.update({ where: { id: data.grnId }, data: { status: newGrnStatus } });

        // If approved, update RM stock for each item
        if (data.overallDecision === 'APPROVED') {
          for (const item of grn.items) {
            // --- Robust lookup: try 3 strategies so stock update never silently fails ---
            // Strategy 1: RawMaterial.code exactly matches PO registry rmId (e.g. "RM-00001")
            let rm = await tx.rawMaterial.findFirst({ where: { code: item.rmId } });

            // Strategy 2: Match by PO material name (most reliable — name entered at PO creation)
            if (!rm && grn.po?.name) {
              rm = await tx.rawMaterial.findFirst({
                where: { name: { equals: grn.po.name, mode: 'insensitive' } }
              });
            }

            // Strategy 3: Match by GRN item rmName as a last resort
            if (!rm && item.rmName) {
              rm = await tx.rawMaterial.findFirst({
                where: { name: { equals: item.rmName, mode: 'insensitive' } }
              });
            }

            if (rm) {
              const netQty = Number(item.actualReceivedQty) - Number(item.returnQty || 0);
              const updatedRm = await tx.rawMaterial.update({
                where: { id: rm.id },
                data: { currentStock: { increment: netQty } }
              });

              console.log(`[LAB APPROVED] Stock updated: ${rm.name} +${netQty} → new stock: ${updatedRm.currentStock}`);

              // Check if still at or below alert level → trigger notification
              if (Number(updatedRm.currentStock) <= Number(updatedRm.alertLevel)) {
                try {
                  await workflowNotifications.triggerRMLowStockAlert({
                    rmId: rm.id,
                    rmName: rm.name,
                    currentStock: updatedRm.currentStock,
                    reorderLevel: updatedRm.alertLevel,
                  });
                } catch (e) {
                  console.error('Low stock notification error:', e.message);
                }
              }
            } else {
              // Log warning — stock NOT updated (no matching RawMaterial found)
              console.warn(
                `[LAB APPROVED] WARNING: Could not find RawMaterial to update stock.`,
                `GRN item rmId="${item.rmId}", rmName="${item.rmName}", PO name="${grn.po?.name}".`,
                `Ensure RawMaterial.code or RawMaterial.name matches the PO material.`
              );
            }
          }

          // Update PO status to APPROVED
          await tx.rawMaterialPO.update({ where: { id: grn.poId }, data: { status: 'APPROVED' } });
        }

        return lt;
      });

      // Notify lab result
      try {
        const firstItem = grn.items[0];
        if (data.overallDecision === 'APPROVED') {
          await workflowNotifications.triggerLabRMApproved({
            rmId: grn.po?.rmId || firstItem?.rmId,
            rmName: grn.po?.name || firstItem?.rmName,
            labTestId: labTest.id,
            fat: 0, protein: 0, moisture: 0, acidity: 0,
            notes: data.labNotes || '',
            grnId: data.grnId,
            actorName: req.user.name || req.user.email,
            actorId: req.user.id,
            actorRole: req.user.role,
          });
        } else if (data.overallDecision === 'REJECTED') {
          await workflowNotifications.triggerLabRMRejected({
            rmId: grn.po?.rmId || firstItem?.rmId,
            rmName: grn.po?.name || firstItem?.rmName,
            labTestId: labTest.id,
            notes: data.labNotes || '',
            actorName: req.user.name || req.user.email,
            actorId: req.user.id,
            actorRole: req.user.role,
          });
        }
      } catch (e) {
        console.error('Lab notification error:', e.message);
      }

      res.status(201).json(labTest);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// GET /api/grn/lab-tests — Pending lab tests list
router.get('/lab-tests',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER']),
  async (req, res, next) => {
    try {
      const grns = await prisma.gRNReceive.findMany({
        where: { status: 'PENDING_LAB' },
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          po: { include: { supplier: true, uom: true } },
          receiver: { select: { name: true } },
        }
      });
      res.json(grns);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/grn/lab-results — All lab results
router.get('/lab-results',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const labTests = await prisma.gRNLabTest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          testResults: true,
          grn: {
            include: {
              po: { include: { supplier: true } },
              receiver: { select: { name: true } },
            }
          },
          tester: { select: { name: true } },
        }
      });
      res.json(labTests);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
