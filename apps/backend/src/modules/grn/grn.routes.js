const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const workflowNotifications = require('../notifications/workflow.notifications');
const { generateReferenceNo } = require('../../utils/referenceGenerator');

const { getNextBatchForRM, receivePOAndProcess } = require('./grn.helper');

const router = express.Router();

// ─────────────────────── PO STATUS UPDATE ───────────────────────
// PATCH /api/grn/po/:id/status — Update PO status (PENDING / DRAFT → ORDERED → RECEIVED)
const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ORDERED', 'RECEIVED', 'DRAFT']),
});

router.patch('/po/:id/status',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      let { status } = updateStatusSchema.parse(req.body);
      if (status === 'DRAFT') status = 'PENDING';

      const existing = await prisma.rawMaterialPO.findUnique({ where: { id }, include: { supplier: true, uom: true } });
      if (!existing) return res.status(404).json({ error: 'Purchase Order not found' });
      if (existing.status === 'DELETED') return res.status(409).json({ error: 'Cannot update a deleted PO' });

      let finalStatus = status;

      // If status is transitioning to RECEIVED, run the receipt & lab/inventory process
      if (status === 'RECEIVED') {
        const procResult = await prisma.$transaction(async (tx) => {
          return await receivePOAndProcess({ po: existing, reqUserId: req.user.id, tx });
        });
        finalStatus = procResult.finalPoStatus || 'RECEIVED';
      } else {
        await prisma.rawMaterialPO.update({
          where: { id },
          data: { status: finalStatus }
        });
      }

      const updated = await prisma.rawMaterialPO.findUnique({
        where: { id },
        include: {
          supplier: true,
          uom: true,
          user: { select: { name: true } },
          inventoryBatches: { include: { uom: true }, orderBy: { createdAt: 'desc' } },
          grnReceives: { include: { items: true, inventoryBatches: true, labTest: { include: { testResults: true } } }, orderBy: { createdAt: 'desc' } }
        }
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
          newValue: { status: finalStatus },
          ip: clientIp,
        }
      });

      // Notify Material Receiver if status changed to ORDERED or RECEIVED
      try {
        await workflowNotifications.triggerPOStatusChanged?.({
          poId: id,
          referenceNo: updated.referenceNo,
          rmName: updated.name,
          newStatus: finalStatus,
          actorName: req.user.name || req.user.email,
          actorId: req.user.id,
          actorRole: req.user.role,
        });
      } catch (e) {
        console.error('Notification error on status change:', e.message);
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// ─────────────────────── UPCOMING DELIVERIES ───────────────────────
// GET /api/grn/upcoming — Only POs with status ORDERED (awaiting delivery for Material Receiver)
router.get('/upcoming',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']),
  async (req, res, next) => {
    try {
      const pos = await prisma.rawMaterialPO.findMany({
        where: { status: 'ORDERED' },
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
            items: po.items,
            vehicleNumber: po.vehicleNumber || null,
            transporterName: po.transporterName || null,
            transportMode: po.transportMode || 'ROAD',
            ewayBillNo: po.ewayBillNo || null,
            ewayBillDate: po.ewayBillDate || null,
            supplierInvoiceNo: po.supplierInvoiceNo || null,
            supplierInvoiceDate: po.supplierInvoiceDate || null,
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

// ─────────────────────── NEXT BATCH PER RAW MATERIAL ───────────────────────
// GET /api/grn/next-batch/:rmId — Get next sequential batch number for a raw material
router.get('/next-batch/:rmId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { rmId } = req.params;
      const { rmName } = req.query;
      const result = await getNextBatchForRM(rmId, rmName);
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
  // Transport details
  vehicleNumber: z.string().optional().nullable(),
  driverName: z.string().optional().nullable(),
  transporterName: z.string().optional().nullable(),
  transportMode: z.string().optional().nullable(),
  lrNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  challanNumber: z.string().optional().nullable(),

  items: z.array(z.object({
    rmId: z.string().min(1),
    rmName: z.string().min(1),
    expectedQty: z.coerce.number().nonnegative(),
    actualReceivedQty: z.coerce.number().nonnegative(),
    returnQty: z.coerce.number().nonnegative().default(0),
    batchNumber: z.string().optional().nullable(),
    mfgDate: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    inspectionStatus: z.string().optional().nullable().default('ACCEPTED'),
    coaRequired: z.boolean().default(false),
    coaNumber: z.string().optional().nullable(),
    rejectedQty: z.coerce.number().nonnegative().default(0),
    rejectionReason: z.string().optional().nullable(),
    labTestRequired: z.boolean().default(true),
  })).min(1),
  amountPaid: z.coerce.number().nonnegative(),
  refundAmount: z.coerce.number().nonnegative().default(0),
  discrepancyNotes: z.string().optional().nullable(),
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
      if (!['ORDERED', 'RECEIVED'].includes(po.status)) return res.status(409).json({ error: 'PO must be in ORDERED or RECEIVED status to log delivery' });

      // Check if GRN already submitted for this PO
      const existingGrn = await prisma.gRNReceive.findFirst({ where: { poId: data.poId } });
      if (existingGrn) return res.status(409).json({ error: 'Delivery already received for this PO. GRN ID: ' + existingGrn.id });

      // Check if all items in this receipt are exempt from lab testing
      const isAllExempt = data.items.every(item => item.labTestRequired === false);
      const initialStatus = isAllExempt ? 'LAB_APPROVED' : 'PENDING_LAB';
      const initialInvStatus = isAllExempt ? 'UPLOADED' : 'NOT_UPLOADED';

      const { grn, pr } = await prisma.$transaction(async (tx) => {
        const referenceNo = await generateReferenceNo(tx, 'GRNReceive', 'GRN');

        const g = await tx.gRNReceive.create({
          data: {
            referenceNo,
            poId: data.poId,
            receivedDate: new Date(data.receivedDate),
            amountPaid: data.amountPaid,
            refundAmount: data.refundAmount,
            discrepancyNotes: data.discrepancyNotes || null,
            receivedBy: req.user.id,
            status: initialStatus,
            inventoryStatus: initialInvStatus,
            isExempt: isAllExempt,
            vehicleNumber: data.vehicleNumber || null,
            driverName: data.driverName || null,
            transporterName: data.transporterName || null,
            transportMode: data.transportMode || 'ROAD',
            lrNumber: data.lrNumber || null,
            invoiceNumber: data.invoiceNumber || null,
            invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
            challanNumber: data.challanNumber || null,
            isShortDelivery: data.items.some(i => Number(i.actualReceivedQty) < Number(i.expectedQty)),
            items: {
              create: data.items.map(item => ({
                rmId: item.rmId,
                rmName: item.rmName,
                expectedQty: item.expectedQty,
                actualReceivedQty: item.actualReceivedQty,
                returnQty: item.returnQty || item.rejectedQty || 0,
                batchNumber: item.batchNumber || null,
                mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                inspectionStatus: item.inspectionStatus || 'ACCEPTED',
                coaRequired: !!item.coaRequired,
                coaNumber: item.coaNumber || null,
                rejectedQty: item.rejectedQty || 0,
                rejectionReason: item.rejectionReason || null,
                labTestRequired: item.labTestRequired !== false,
              }))
            }
          },
          include: { items: true, po: { include: { supplier: true, uom: true } } }
        });

        // FOR ALL ITEMS THAT ARE LAB TEST EXEMPT: DIRECT INVENTORY UPDATE AT RECEIPT!
        for (const item of data.items) {
          if (item.labTestRequired === false) {
            const acceptedQty = Math.max(0, Number(item.actualReceivedQty) - Number(item.rejectedQty || item.returnQty || 0));
            if (acceptedQty <= 0) continue;

            // Strategy 1: Match RawMaterial
            let rm = await tx.rawMaterial.findFirst({ where: { code: item.rmId } });
            if (!rm && item.rmName) {
              rm = await tx.rawMaterial.findFirst({ where: { name: { equals: item.rmName, mode: 'insensitive' } } });
            }
            if (!rm && po.name) {
              rm = await tx.rawMaterial.findFirst({ where: { name: { equals: po.name, mode: 'insensitive' } } });
            }

            if (rm) {
              await tx.rawMaterial.update({
                where: { id: rm.id },
                data: { currentStock: { increment: acceptedQty } }
              });

              // Create InventoryBatch per item
              let batchNum = item.batchNumber;
              if (!batchNum) {
                const auto = await getNextBatchForRM(item.rmId, item.rmName);
                batchNum = auto.batchNumber;
              }
              const clash = await tx.inventoryBatch.findUnique({ where: { batchNumber: batchNum } });
              if (clash) {
                batchNum = `${batchNum}-${Date.now().toString().slice(-4)}`;
              }

              const category = await tx.rMCategory.findUnique({ where: { id: rm.categoryId } });

              await tx.inventoryBatch.create({
                data: {
                  batchNumber: batchNum,
                  poId: g.poId,
                  grnId: g.id,
                  rawMaterialId: rm.id,
                  rawMaterialName: item.rmName || rm.name,
                  rmCategory: category?.name || null,
                  supplierId: po.supplierId || null,
                  receivedQty: item.actualReceivedQty,
                  sampleQty: 0,
                  netQty: acceptedQty,
                  uomId: po.uomId,
                  storageLocation: null,
                  mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
                  expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                  status: 'AVAILABLE',
                  addedBy: req.user.id,
                }
              });
              console.log(`[EXEMPT ITEM] InventoryBatch ${batchNum} directly created at receipt for ${item.rmName} (+${acceptedQty})`);
            }
          }
        }

        // Update PO status: APPROVED if all exempt, otherwise RECEIVED
        await tx.rawMaterialPO.update({
          where: { id: data.poId },
          data: { status: isAllExempt ? 'APPROVED' : 'RECEIVED' }
        });

        // Check if any item has returnQty > 0 or rejectedQty > 0
        const returnItems = data.items
          .filter(item => Number(item.returnQty || item.rejectedQty || 0) > 0)
          .map(item => {
            let itemUom = '';
            if (po.items && Array.isArray(po.items)) {
              const poItem = po.items.find(pi => pi.rmId === item.rmId || pi.name === item.rmName);
              if (poItem?.uomLabel) itemUom = poItem.uomLabel;
              else if (poItem?.unit) itemUom = poItem.unit;
            }
            return {
              rmId: item.rmId,
              rmName: item.rmName,
              returnQty: Number(item.rejectedQty || item.returnQty),
              reason: item.rejectionReason || 'Rejected during receipt inspection',
              uom: itemUom || g.po?.uom?.abbreviation || null,
            };
          });

        let pRecord = null;
        if (returnItems.length > 0) {
          const prRefNo = await generateReferenceNo(tx, 'PurchaseReturn', 'PR');
          const totalReturnQty = returnItems.reduce((s, i) => s + i.returnQty, 0);

          pRecord = await tx.purchaseReturn.create({
            data: {
              referenceNo: prRefNo,
              poId: g.poId,
              grnId: g.id,
              returnQty: totalReturnQty,
              uom: g.po?.uom?.abbreviation || null,
              returnReason: 'QTY_MISMATCH',
              reasonDescription: data.discrepancyNotes || 'Immediate return logged during GRN receipt',
              initiatedBy: 'RECEIVER_INITIATED',
              status: 'CLOSED',
              createdBy: req.user.id,
              items: returnItems,
              returnDate: new Date(data.receivedDate),
            }
          });
        }

        return { grn: g, pr: pRecord };
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

      res.status(201).json({
        ...grn,
        isExempt: isAllExempt,
        message: isAllExempt
          ? 'Material(s) are Lab Test Exempt. Delivery logged and uploaded directly to inventory stock!'
          : 'GRN submitted. Items requiring lab testing have been queued for Lab Assistant.'
      });
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
      const { id } = req.params;
      const grn = await prisma.gRNReceive.findFirst({
        where: {
          OR: [
            { id },
            { referenceNo: id }
          ]
        },
        include: {
          items: true,
          po: { include: { supplier: true, uom: true, user: { select: { name: true } } } },
          receiver: { select: { name: true, role: true } },
          inventoryBatches: true,
          labTest: {
            include: {
              testResults: {
                orderBy: { createdAt: 'asc' }
              }
            }
          },
        }
      });
      if (!grn) return res.status(404).json({ error: 'GRN not found' });
      const mapped = {
        ...grn,
        inventoryStatus: (grn.status === 'LAB_APPROVED' || grn.inventoryStatus === 'UPLOADED') ? 'UPLOADED' : (grn.inventoryStatus || 'NOT_UPLOADED')
      };
      res.json(mapped);
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
          items: true,
          po: { include: { supplier: true, uom: true } },
          receiver: { select: { name: true } },
          inventoryBatches: true,
          labTest: { select: { id: true, status: true, overallDecision: true, overrideReason: true, labNotes: true, sampleQty: true, categoryParams: true, testedBy: true, approvedBy: true, approvedAt: true, createdAt: true, updatedAt: true } },
        }
      });
      const mapped = grns.map(g => ({
        ...g,
        inventoryStatus: (g.status === 'LAB_APPROVED' || g.inventoryStatus === 'UPLOADED') ? 'UPLOADED' : (g.inventoryStatus || 'NOT_UPLOADED')
      }));
      res.json(mapped);
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
    expiryDate: z.string().min(1).refine(val => {
      const d = new Date(val);
      return !isNaN(d.getTime()) && d.getFullYear() <= 9999 && d.getFullYear() >= 1900;
    }, { message: "Invalid expiry date or year out of range (1900-9999)" }),
    testNotes: z.string().optional(),
    passed: z.boolean(),
    needTesting: z.boolean().default(true),
    rmLabCategoryId: z.string().uuid().optional().nullable(),
    categoryParams: z.record(z.string(), z.any()).optional().nullable(),
  })).min(1),
  overallDecision: z.enum(['APPROVED', 'REJECTED', 'NEED_SAMPLE']),
  labNotes: z.string().optional(),
  rmLabCategoryId: z.string().uuid().optional(),
  categoryParams: z.record(z.string(), z.any()).optional(),
  isDraft: z.boolean().default(false),
});

router.post('/lab-test',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = labTestSchema.parse(req.body);

      if (!data.isDraft) {
        for (const tr of data.testResults) {
          if (tr.needTesting !== false) {
            if (!tr.rmLabCategoryId) {
              return res.status(400).json({ error: `RM Lab Category is required for material: ${tr.rmName}` });
            }

            const cat = await prisma.rMLabCategory.findUnique({
              where: { id: tr.rmLabCategoryId },
              include: { requiredResults: true }
            });
            if (!cat) {
              return res.status(400).json({ error: `Selected RM Lab Category not found for material: ${tr.rmName}` });
            }

            const params = tr.categoryParams || {};

            // If category has requiredResults defined, all must be filled
            if (cat.requiredResults && cat.requiredResults.length > 0) {
              for (const p of cat.requiredResults) {
                const val = params[p.paramName];
                if (val === undefined || val === null || String(val).trim() === '') {
                  return res.status(400).json({
                    error: `RM test parameter "${p.paramName}" is mandatory and cannot be empty for ${tr.rmName}.`
                  });
                }
              }
            } else if (cat.labTests && cat.labTests.length > 0) {
              for (const testName of cat.labTests) {
                const val = params[testName];
                if (val === undefined || val === null || String(val).trim() === '') {
                  return res.status(400).json({
                    error: `RM test parameter "${testName}" is mandatory and cannot be empty for ${tr.rmName}.`
                  });
                }
              }
            } else {
              const nonEmpties = Object.values(params).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
              if (nonEmpties.length === 0) {
                return res.status(400).json({
                  error: `RM test parameters are required and cannot be empty for ${tr.rmName}.`
                });
              }
            }
          }
        }
      }

      const grn = await prisma.gRNReceive.findUnique({
        where: { id: data.grnId },
        include: { items: true, po: { include: { uom: true } }, labTest: true }
      });
      if (!grn) return res.status(404).json({ error: 'GRN not found' });
      if (grn.status !== 'PENDING_LAB') return res.status(409).json({ error: 'GRN is not pending lab test' });

      const labTest = await prisma.$transaction(async (tx) => {
        if (grn.labTest) {
          // Delete old results and test record
          await tx.gRNLabTestResult.deleteMany({ where: { labTestId: grn.labTest.id } });
          await tx.gRNLabTest.delete({ where: { id: grn.labTest.id } });
        }

        // Create lab test record
        const lt = await tx.gRNLabTest.create({
          data: {
            grnId: data.grnId,
            status: data.isDraft ? 'IN_PROGRESS' : 'APPROVED',
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
                passed: tr.needTesting === false ? true : tr.passed,
                needTesting: tr.needTesting !== false,
                rmLabCategoryId: tr.rmLabCategoryId || null,
                categoryParams: tr.categoryParams || null,
              }))
            }
          },
          include: { testResults: true }
        });

        // Update GRN status, stock, inventory batch and PO ONLY if this is NOT a draft
        if (!data.isDraft) {
          const newGrnStatus = data.overallDecision === 'APPROVED' ? 'LAB_APPROVED' : 
                               data.overallDecision === 'REJECTED' ? 'LAB_REJECTED' : 'LAB_RESAMPLE';
          const grnUpdateData = { status: newGrnStatus };
          if (data.overallDecision === 'APPROVED') {
            grnUpdateData.inventoryStatus = 'UPLOADED';
          }
          await tx.gRNReceive.update({ where: { id: data.grnId }, data: grnUpdateData });

          // If approved, update RM stock for each item
          if (data.overallDecision === 'APPROVED') {
            for (const item of grn.items) {
              // Skip items that were marked labTestRequired === false (already stocked at receipt!)
              if (item.labTestRequired === false) {
                console.log(`[LAB APPROVED] Skipping stock update for EXEMPT item (already stocked at receipt): ${item.rmName}`);
                continue;
              }

              // Find test result of this item to see if it passed or did not need testing
              const trResult = data.testResults.find(tr => tr.grnItemId === item.id);
              const isPassed = trResult ? (trResult.needTesting === false || trResult.passed === true) : true;

              if (!isPassed) {
                console.log(`[LAB APPROVED] Skipping stock update for FAILED raw material: ${item.rmName} (rmId: ${item.rmId})`);
                continue;
              }

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

                console.log(`[LAB APPROVED] Stock updated for PASSED/EXEMPT item: ${rm.name} +${netQty} → new stock: ${updatedRm.currentStock}`);

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

            // Auto-create InventoryBatch for each approved item
            for (const item of grn.items) {
              // Skip items that were marked labTestRequired === false (batch already created at receipt!)
              if (item.labTestRequired === false) {
                console.log(`[LAB APPROVED] Skipping batch creation for EXEMPT item (batch already created at receipt): ${item.rmName}`);
                continue;
              }

              const trResult = data.testResults.find(tr => tr.grnItemId === item.id);
              const isPassed = trResult ? (trResult.needTesting === false || trResult.passed === true) : true;
              if (!isPassed) continue;

              let rm = await tx.rawMaterial.findFirst({ where: { code: item.rmId } });
              if (!rm && item.rmName) {
                rm = await tx.rawMaterial.findFirst({ where: { name: { equals: item.rmName, mode: 'insensitive' } } });
              }
              if (!rm && grn.po?.name) {
                rm = await tx.rawMaterial.findFirst({ where: { name: { equals: grn.po.name, mode: 'insensitive' } } });
              }

              const existingBatch = await tx.inventoryBatch.findFirst({
                where: { grnId: grn.id, rawMaterialId: rm ? rm.id : item.rmId }
              });

              if (!existingBatch) {
                let batchNum = item.batchNumber;
                if (!batchNum) {
                  const auto = await getNextBatchForRM(item.rmId, item.rmName);
                  batchNum = auto.batchNumber;
                }
                const clash = await tx.inventoryBatch.findUnique({ where: { batchNumber: batchNum } });
                if (clash) {
                  batchNum = `${batchNum}-${Date.now().toString().slice(-4)}`;
                }

                const netQty = Math.max(0, Number(item.actualReceivedQty) - Number(item.returnQty || item.rejectedQty || 0));
                const category = rm ? await tx.rMCategory.findUnique({ where: { id: rm.categoryId } }) : null;
                const finalExpiry = trResult?.expiryDate ? new Date(trResult.expiryDate) : (item.expiryDate || null);

                await tx.inventoryBatch.create({
                  data: {
                    batchNumber: batchNum,
                    poId: grn.poId,
                    grnId: grn.id,
                    rawMaterialId: rm?.id || item.rmId || 'unknown',
                    rawMaterialName: item.rmName || grn.po?.name || 'Unknown',
                    rmCategory: category?.name || null,
                    supplierId: grn.po?.supplierId || null,
                    receivedQty: item.actualReceivedQty,
                    sampleQty: Number(data.sampleQty || 0),
                    netQty,
                    uomId: grn.po?.uomId || rm?.unitId,
                    storageLocation: null,
                    mfgDate: item.mfgDate || null,
                    expiryDate: finalExpiry,
                    status: 'AVAILABLE',
                    addedBy: req.user.id,
                  }
                });
                console.log(`[LAB APPROVED] InventoryBatch ${batchNum} created for item ${item.rmName}`);
              }
            }

            // Update PO status to APPROVED
            await tx.rawMaterialPO.update({ where: { id: grn.poId }, data: { status: 'APPROVED' } });
          }
        }

        return lt;
      });

      // Notify lab result only if finalized
      if (!data.isDraft) {
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
      const { testingRequiredOnly } = req.query;
      const labTests = await prisma.gRNLabTest.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          testResults: true,
          grn: {
            include: {
              items: true,
              po: { include: { supplier: true } },
              receiver: { select: { name: true } },
            }
          },
          tester: { select: { name: true } },
        }
      });

      if (testingRequiredOnly === 'true') {
        // Return only lab tests that have at least one material where testing was required
        const filtered = labTests
          .filter(lt => (lt.testResults || []).some(tr => tr.needTesting !== false))
          .map(lt => ({
            ...lt,
            testResults: (lt.testResults || []).filter(tr => tr.needTesting !== false)
          }));
        return res.json(filtered);
      }

      res.json(labTests);
    } catch (error) {
      next(error);
    }
  }
);

router.getNextBatchForRM = getNextBatchForRM;
module.exports = router;
module.exports.getNextBatchForRM = getNextBatchForRM;
