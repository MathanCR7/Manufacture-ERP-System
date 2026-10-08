const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const notificationService = require('../notifications/notifications.service');
const stockReservationService = require('../../services/stockReservation.service');

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

// Helper to generate unique production batch reference (MP-XXXXXX)
const generateBatchReference = async (tx) => {
  const result = await tx.$queryRaw`
    SELECT reference_no FROM production_batches 
    WHERE reference_no LIKE 'MP-%' 
    ORDER BY reference_no DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.reference_no) {
    return 'MP-000001';
  }

  const lastNumberStr = lastRecord.reference_no.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;
  return `MP-${String(nextNumber).padStart(6, '0')}`;
};

// Helper to check stock levels and trigger alerts
const checkAndNotifyStockAlerts = async (productId, tx) => {
  const product = await tx.finishedProduct.findUnique({
    where: { id: productId },
    include: { stockLevels: true, unit: true }
  });
  if (!product) return;

  const stockLevel = product.stockLevels[0];
  if (!stockLevel) return;

  // Calculate current stock
  const sumIn = await tx.productStockMovement.aggregate({
    where: { productId, direction: 1 },
    _sum: { quantity: true }
  });
  const sumOut = await tx.productStockMovement.aggregate({
    where: { productId, direction: -1 },
    _sum: { quantity: true }
  });

  const currentStock = Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
  const minLevel = Number(stockLevel.minLevel);
  const reorderPoint = Number(stockLevel.reorderPoint);

  if (currentStock < minLevel) {
    await notificationService.createNotification({
      type: 'STOCK_CRITICAL',
      recipient_roles: ['PRODUCTION_STAFF', 'MAIN_MASTER'],
      sender_role: 'SYSTEM',
      sender_id: 'system',
      reference_type: 'PRODUCT_STOCK',
      reference_id: productId,
      message: `CRITICAL: ${product.name} stock at ${currentStock} ${product.unit.abbreviation} — below minimum level of ${minLevel}. Immediate production required.`,
      metadata: { productId, currentStock, minLevel }
    }, tx);
  } else if (currentStock < reorderPoint) {
    await notificationService.createNotification({
      type: 'STOCK_REORDER',
      recipient_roles: ['PRODUCTION_STAFF', 'MAIN_MASTER'],
      sender_role: 'SYSTEM',
      sender_id: 'system',
      reference_type: 'PRODUCT_STOCK',
      reference_id: productId,
      message: `${product.name} stock at ${currentStock} ${product.unit.abbreviation} — below reorder point of ${reorderPoint}. Schedule production.`,
      metadata: { productId, currentStock, reorderPoint }
    }, tx);
  }
};

// GET /api/production/qc-queue - Batches pending QC
router.get('/qc-queue', authenticateToken, roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT', 'SUPERVISOR', 'PRODUCTION_STAFF']), async (req, res, next) => {
  try {
    const batches = await prisma.productionBatchNew.findMany({
      where: {
        status: 'Completed',
        deletedAt: null
      },
      include: {
        product: { include: { unit: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(batches);
  } catch (error) {
    next(error);
  }
});

// POST /api/production/qc-queue/:id/approve - Approve QC
router.post('/qc-queue/:id/approve', authenticateToken, roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const schema = z.object({
      expiryDate: z.string(),
      qcNotes: z.string().optional(),
      result: z.enum(['Pass', 'Fail', 'Partial Pass']),
      texture: z.string().min(1),
      taste: z.string().min(1),
      safety: z.string().min(1),
      appearance: z.string().min(1),
      weightPortion: z.string().min(1),
      customParams: z.record(z.any()).optional()
    });

    const data = schema.parse(req.body);
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatchNew.findUnique({
        where: { id },
        include: { product: { include: { unit: true } } }
      });

      if (!batch || batch.status !== 'Completed') {
        throw new Error('Batch not found or not in Completed status');
      }

      const expDate = new Date(data.expiryDate);

      // 1. Update batch status
      await tx.productionBatchNew.update({
        where: { id },
        data: {
          status: 'qc_passed',
          expiryDate: expDate
        }
      });

      const qcParams = {
        texture: data.texture,
        taste: data.taste,
        safety: data.safety,
        appearance: data.appearance,
        weightPortion: data.weightPortion,
        customParams: data.customParams || {}
      };

      // 2. Insert lab test result
      await tx.labProductionTestNew.create({
        data: {
          productionBatchId: id,
          expiryDate: expDate,
          qcNotes: data.qcNotes || null,
          result: data.result,
          action: 'approved',
          qcParams: qcParams,
          testedBy: req.user.id
        }
      });

      // 3. Add batch actual output quantity to stock
      const stockQty = batch.actualOutput !== null ? Number(batch.actualOutput) : Number(batch.quantity);
      await tx.productStockMovement.create({
        data: {
          productId: batch.productId,
          batchId: id,
          type: 'production_in',
          quantity: stockQty,
          direction: 1,
          note: `QC Approved. Released to stock. Notes: ${data.qcNotes || 'None'}`,
          createdBy: req.user.id
        }
      });

      // 4. Update FinishedProduct stock counter directly
      await tx.finishedProduct.update({
        where: { id: batch.productId },
        data: { currentStock: { increment: stockQty } }
      });

      // 5. Auto-allocate newly produced finished stock to waiting sales orders (linked order first, then FIFO backlog)
      await stockReservationService.allocateStockToWaitingOrders(batch.productId, stockQty, batch.orderId, tx);

      // Run stock levels check
      await notificationService.checkProductStockAlerts(batch.productId, tx);

      // 6. Fire SSE notification to Sales
      const formattedDate = expDate.toLocaleDateString('en-GB');
      await notificationService.createNotification({
        type: 'QC_APPROVED',
        recipient_roles: ['SALES_TEAM', 'MAIN_MASTER'],
        sender_role: req.user.role,
        sender_id: req.user.id,
        reference_type: 'PRODUCTION_BATCH',
        reference_id: id,
        message: `New stock available: ${batch.product.name} — ${stockQty} ${batch.product.unit.abbreviation} — Expires ${formattedDate} — Batch ${batch.referenceNo}`,
        metadata: {
          batchId: id,
          productName: batch.product.name,
          quantity: stockQty,
          expiryDate: data.expiryDate,
          referenceNo: batch.referenceNo
        }
      }, tx);

      // Write Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'APPROVE_PRODUCTION_QC',
          tableName: 'production_batches',
          recordId: id,
          oldValue: { status: batch.status },
          newValue: { status: 'qc_passed', expiryDate: expDate, qcParams: qcParams },
          ip: clientIp
        }
      });
    }, {
      maxWait: 15000,
      timeout: 20000
    });

    res.json({ message: 'Production QC approved and released to stock' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/production/qc-queue/:id/reject - Reject QC
router.post('/qc-queue/:id/reject', authenticateToken, roleMiddleware(['MAIN_MASTER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const schema = z.object({
      qcNotes: z.string().optional(),
      texture: z.string().optional(),
      taste: z.string().optional(),
      safety: z.string().optional(),
      appearance: z.string().optional(),
      weightPortion: z.string().optional(),
      customParams: z.record(z.any()).optional()
    });
    const data = schema.parse(req.body);
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatchNew.findUnique({
        where: { id },
        include: { product: true }
      });

      if (!batch || batch.status !== 'Completed') {
        throw new Error('Batch not found or not in Completed status');
      }

      // 1. Update status
      await tx.productionBatchNew.update({
        where: { id },
        data: { status: 'qc_failed' }
      });

      const qcParams = {
        texture: data.texture || 'Fail',
        taste: data.taste || 'Fail',
        safety: data.safety || 'Fail',
        appearance: data.appearance || 'Fail',
        weightPortion: data.weightPortion || 'Fail',
        customParams: data.customParams || {}
      };

      // 2. Insert test log
      await tx.labProductionTestNew.create({
        data: {
          productionBatchId: id,
          expiryDate: new Date(), // dummy
          qcNotes: data.qcNotes || null,
          result: 'Fail',
          action: 'rejected',
          qcParams: qcParams,
          testedBy: req.user.id
        }
      });

      // 3. Fire critical notification
      await notificationService.createNotification({
        type: 'QC_FAILED',
        recipient_roles: ['MAIN_MASTER', 'SUPERVISOR'],
        sender_role: req.user.role,
        sender_id: req.user.id,
        reference_type: 'PRODUCTION_BATCH',
        reference_id: id,
        message: `ALERT: Batch #${batch.referenceNo} for ${batch.product.name} has FAILED Quality QC check. Investigation required.`,
        metadata: {
          batchId: id,
          referenceNo: batch.referenceNo,
          productName: batch.product.name
        }
      }, tx);

      // Write Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'REJECT_PRODUCTION_QC',
          tableName: 'production_batches',
          recordId: id,
          oldValue: { status: batch.status },
          newValue: { status: 'qc_failed', qcParams: qcParams },
          ip: clientIp
        }
      });
    });

    res.json({ message: 'Production batch QC rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/production/loss - List loss reports
router.get('/loss', authenticateToken, async (req, res, next) => {
  try {
    const losses = await prisma.productionLoss.findMany({
      include: {
        batch: { include: { product: true } },
        responsiblePerson: { select: { name: true } },
        lossProducts: { include: { product: true } },
        lossMaterials: { include: { rawMaterial: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = losses.map(loss => {
      const totalCost = Number(loss.batch.totalCost || 0);
      const lossPercent = totalCost > 0 ? ((Number(loss.totalLoss) / totalCost) * 100).toFixed(2) : '0.00';

      const pCount = loss.lossProducts.length;
      const mCount = loss.lossMaterials.length;

      return {
        id: loss.id,
        referenceNo: loss.batch.referenceNo,
        productName: loss.batch.product.name,
        totalLoss: Number(loss.totalLoss),
        summary: `${pCount} products, ${mCount} materials`,
        lossPercent: `${lossPercent}%`,
        date: loss.date,
        responsiblePerson: loss.responsiblePerson.name
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// POST /api/production/loss - Create Loss Report
router.post('/loss', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const schema = z.object({
      date: z.string(),
      responsiblePersonId: z.string().uuid(),
      productionBatchId: z.string().uuid(),
      productLoss: z.array(z.object({
        productId: z.string().uuid(),
        productionQty: z.coerce.number().positive(),
        lossQty: z.coerce.number().positive(),
        lossAmount: z.coerce.number().positive()
      })),
      rawMaterialLoss: z.array(z.object({
        rmId: z.string().uuid(),
        productionQty: z.coerce.number().positive(),
        lossQty: z.coerce.number().positive(),
        lossAmount: z.coerce.number().positive()
      })),
      note: z.string().optional()
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatchNew.findUnique({
        where: { id: data.productionBatchId },
        include: { product: true }
      });

      if (!batch) {
        throw new Error('Batch not found');
      }

      const totalLoss = data.productLoss.reduce((sum, p) => sum + Number(p.lossAmount), 0) +
                        data.rawMaterialLoss.reduce((sum, m) => sum + Number(m.lossAmount), 0);

      // 1. Create loss record
      const lossRecord = await tx.productionLoss.create({
        data: {
          date: new Date(data.date),
          responsiblePersonId: data.responsiblePersonId,
          productionBatchId: data.productionBatchId,
          totalLoss,
          note: data.note || null,
          createdBy: req.user.id
        }
      });

      // 2. Create products loss
      if (data.productLoss.length > 0) {
        await tx.productionLossProduct.createMany({
          data: data.productLoss.map(p => ({
            lossId: lossRecord.id,
            productId: p.productId,
            productionQty: p.productionQty,
            lossQty: p.lossQty,
            lossAmount: p.lossAmount
          }))
        });
      }

      // 3. Create materials loss
      if (data.rawMaterialLoss.length > 0) {
        await tx.productionLossMaterial.createMany({
          data: data.rawMaterialLoss.map(m => ({
            lossId: lossRecord.id,
            rmId: m.rmId,
            productionQty: m.productionQty,
            lossQty: m.lossQty,
            lossAmount: m.lossAmount
          }))
        });
      }

      // 4. Update batch actual quantities
      const totalLossQty = data.productLoss.reduce((sum, p) => sum + Number(p.lossQty), 0);
      const newPartiallyDoneQty = Math.max(0, Number(batch.partiallyDoneQty) + Number(batch.quantity) - totalLossQty);
      const newRemainingQty = Math.max(0, Number(batch.quantity) - newPartiallyDoneQty);

      await tx.productionBatchNew.update({
        where: { id: batch.id },
        data: {
          partiallyDoneQty: newPartiallyDoneQty,
          remainingQty: newRemainingQty
        }
      });

      // 5. Fire notification
      const userPerson = await tx.user.findUnique({ where: { id: data.responsiblePersonId } });
      const personName = userPerson ? userPerson.name : 'Unknown';
      const formattedDate = new Date(data.date).toLocaleDateString('en-GB');

      await notificationService.createNotification({
        type: 'PRODUCTION_LOSS',
        recipient_roles: ['MAIN_MASTER', 'SUPERVISOR'],
        sender_role: req.user.role,
        sender_id: req.user.id,
        reference_type: 'PRODUCTION_LOSS',
        reference_id: lossRecord.id,
        message: `Production loss recorded for Batch ${batch.referenceNo}: $${totalLoss.toFixed(2)} loss on ${formattedDate} by ${personName}.`,
        metadata: {
          batchId: batch.id,
          referenceNo: batch.referenceNo,
          totalLoss,
          date: data.date,
          personName
        }
      }, tx);

      return lossRecord;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// GET /api/production/loss/:id - Get single loss report
router.get('/loss/:id', authenticateToken, async (req, res, next) => {
  try {
    const id = req.params.id;
    const loss = await prisma.productionLoss.findUnique({
      where: { id },
      include: {
        batch: { include: { product: true } },
        responsiblePerson: { select: { id: true, name: true } },
        lossProducts: { include: { product: true } },
        lossMaterials: { include: { rawMaterial: true } }
      }
    });

    if (!loss) {
      return res.status(404).json({ error: 'Production loss report not found' });
    }

    res.json(loss);
  } catch (error) {
    next(error);
  }
});

// PUT /api/production/loss/:id - Update production loss report
router.put('/loss/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      date: z.string(),
      responsiblePersonId: z.string().uuid(),
      productionBatchId: z.string().uuid(),
      productLoss: z.array(z.object({
        productId: z.string().uuid(),
        productionQty: z.coerce.number().positive(),
        lossQty: z.coerce.number().positive(),
        lossAmount: z.coerce.number().positive()
      })),
      rawMaterialLoss: z.array(z.object({
        rmId: z.string().uuid(),
        productionQty: z.coerce.number().positive(),
        lossQty: z.coerce.number().positive(),
        lossAmount: z.coerce.number().positive()
      })),
      note: z.string().optional()
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.productionLoss.findUnique({
        where: { id },
        include: {
          lossProducts: true,
          lossMaterials: true,
          batch: true
        }
      });

      if (!existing) {
        throw new Error('Loss report not found');
      }

      // Revert old batch quantities first
      const oldLossQty = existing.lossProducts.reduce((sum, p) => sum + Number(p.lossQty), 0);
      const revertedPartiallyDoneQty = Math.max(0, Number(existing.batch.partiallyDoneQty) - Number(existing.batch.quantity) + oldLossQty);

      // Fetch batch (could be a new batch selected)
      const batch = await tx.productionBatchNew.findUnique({
        where: { id: data.productionBatchId }
      });
      if (!batch) {
        throw new Error('Target batch not found');
      }

      // If batch is the same, revert it on the object
      let currentPartiallyDoneQty = Number(batch.partiallyDoneQty);
      if (existing.productionBatchId === data.productionBatchId) {
        currentPartiallyDoneQty = revertedPartiallyDoneQty;
      } else {
        // If batch changed, update the old batch to reverted quantities
        await tx.productionBatchNew.update({
          where: { id: existing.productionBatchId },
          data: {
            partiallyDoneQty: revertedPartiallyDoneQty,
            remainingQty: Math.max(0, Number(existing.batch.quantity) - revertedPartiallyDoneQty)
          }
        });
      }

      const totalLoss = data.productLoss.reduce((sum, p) => sum + Number(p.lossAmount), 0) +
                        data.rawMaterialLoss.reduce((sum, m) => sum + Number(m.lossAmount), 0);

      // Update main record
      const updatedLoss = await tx.productionLoss.update({
        where: { id },
        data: {
          date: new Date(data.date),
          responsiblePersonId: data.responsiblePersonId,
          productionBatchId: data.productionBatchId,
          totalLoss,
          note: data.note || null
        }
      });

      // Recreate product loss records
      await tx.productionLossProduct.deleteMany({ where: { lossId: id } });
      if (data.productLoss.length > 0) {
        await tx.productionLossProduct.createMany({
          data: data.productLoss.map(p => ({
            lossId: id,
            productId: p.productId,
            productionQty: p.productionQty,
            lossQty: p.lossQty,
            lossAmount: p.lossAmount
          }))
        });
      }

      // Recreate raw material loss records
      await tx.productionLossMaterial.deleteMany({ where: { lossId: id } });
      if (data.rawMaterialLoss.length > 0) {
        await tx.productionLossMaterial.createMany({
          data: data.rawMaterialLoss.map(m => ({
            lossId: id,
            rmId: m.rmId,
            productionQty: m.productionQty,
            lossQty: m.lossQty,
            lossAmount: m.lossAmount
          }))
        });
      }

      // Calculate and update target batch quantities
      const newLossQty = data.productLoss.reduce((sum, p) => sum + Number(p.lossQty), 0);
      const newPartiallyDoneQty = Math.max(0, currentPartiallyDoneQty + Number(batch.quantity) - newLossQty);
      const newRemainingQty = Math.max(0, Number(batch.quantity) - newPartiallyDoneQty);

      await tx.productionBatchNew.update({
        where: { id: batch.id },
        data: {
          partiallyDoneQty: newPartiallyDoneQty,
          remainingQty: newRemainingQty
        }
      });

      return updatedLoss;
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/production/loss/:id - Delete production loss report
router.delete('/loss/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.productionLoss.findUnique({
        where: { id },
        include: {
          lossProducts: true,
          lossMaterials: true,
          batch: true
        }
      });

      if (!existing) {
        throw new Error('Loss report not found');
      }

      // Revert batch quantities
      const totalLossQty = existing.lossProducts.reduce((sum, p) => sum + Number(p.lossQty), 0);
      const restoredPartiallyDoneQty = Math.max(0, Number(existing.batch.partiallyDoneQty) - Number(existing.batch.quantity) + totalLossQty);
      const restoredRemainingQty = Math.max(0, Number(existing.batch.quantity) - restoredPartiallyDoneQty);

      await tx.productionBatchNew.update({
        where: { id: existing.productionBatchId },
        data: {
          partiallyDoneQty: restoredPartiallyDoneQty,
          remainingQty: restoredRemainingQty
        }
      });

      // Delete relation records first
      await tx.productionLossProduct.deleteMany({
        where: { lossId: id }
      });

      await tx.productionLossMaterial.deleteMany({
        where: { lossId: id }
      });

      // Delete main record
      await tx.productionLoss.delete({
        where: { id }
      });
    });

    res.json({ message: 'Production loss report deleted and batch quantities restored' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/production - List all batches with pagination and filters
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, productionType, startDate, endDate, search, page = 1, limit = 10 } = req.query;

    const whereClause = { deletedAt: null };

    if (status) {
      whereClause.status = status;
    }
    if (productionType) {
      whereClause.productionType = productionType;
    }
    if (startDate || endDate) {
      whereClause.startDate = {};
      if (startDate) {
        whereClause.startDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.startDate.lte = new Date(endDate);
      }
    }

    if (search) {
      whereClause.OR = [
        { referenceNo: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [batches, total] = await prisma.$transaction([
      prisma.productionBatchNew.findMany({
        where: whereClause,
        include: {
          product: { include: { unit: true, category: true } },
          currentStage: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.productionBatchNew.count({ where: whereClause })
    ]);

    res.json({
      batches,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────── Production Base Templates & Dynamic Recipes ───────────────────────

// GET /api/production/base-templates - Fetch subcategory base recipe templates
router.get('/base-templates', authenticateToken, async (req, res, next) => {
  try {
    const { subcategoryId } = req.query;
    const where = subcategoryId ? { subcategoryId } : {};
    const templates = await prisma.productBaseTemplate.findMany({
      where,
      include: {
        items: {
          include: { rawMaterial: true },
          orderBy: { seqNo: 'asc' }
        },
        subcategory: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// POST /api/production/base-templates - Create subcategory base template
router.post('/base-templates', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      subcategoryId: z.string().uuid(),
      series: z.string().optional(),
      itemCodePrefix: z.string().optional(),
      groupName: z.string().optional(),
      wastagePercent: z.coerce.number().optional().default(6.0),
      overheadPercent: z.coerce.number().optional().default(10.0),
      sopSteps: z.any().optional(),
      items: z.array(z.object({
        seqNo: z.number().int().optional(),
        rmId: z.string().uuid(),
        categoryType: z.string().optional(),
        defaultQty: z.coerce.number().positive(),
        uom: z.string(),
        estimatedRate: z.coerce.number().optional().default(0),
        isOverhead: z.boolean().optional().default(false)
      })).optional()
    });

    const data = schema.parse(req.body);
    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.productBaseTemplate.create({
        data: {
          name: data.name,
          subcategoryId: data.subcategoryId,
          series: data.series || null,
          itemCodePrefix: data.itemCodePrefix || null,
          groupName: data.groupName || null,
          wastagePercent: data.wastagePercent,
          overheadPercent: data.overheadPercent,
          sopSteps: data.sopSteps || null
        }
      });

      if (data.items && data.items.length > 0) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await tx.productBaseTemplateItem.create({
            data: {
              templateId: created.id,
              seqNo: item.seqNo !== undefined ? item.seqNo : (i + 1),
              rmId: item.rmId,
              categoryType: item.categoryType || 'Key Raw Material',
              defaultQty: item.defaultQty,
              uom: item.uom,
              estimatedRate: item.estimatedRate,
              isOverhead: item.isOverhead
            }
          });
        }
      }

      return tx.productBaseTemplate.findUnique({
        where: { id: created.id },
        include: { items: { include: { rawMaterial: true } } }
      });
    });

    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// Comprehensive helper to fetch all purchase & warehouse inventory batches for a raw material
const getBatchesForRawMaterial = async (rmId) => {
  try {
    let rm = await prisma.rawMaterial.findFirst({
      where: {
        OR: [
          { id: rmId },
          { code: rmId }
        ]
      },
      include: { category: true }
    });

    const orConditions = [{ rawMaterialId: rmId }];
    if (rm) {
      orConditions.push({ rawMaterialId: rm.id });
      if (rm.code) orConditions.push({ rawMaterialId: rm.code });
      if (rm.name) orConditions.push({ rawMaterialName: rm.name });
    }

    const batches = await prisma.inventoryBatch.findMany({
      where: {
        OR: orConditions,
        netQty: { gt: 0 },
        status: 'AVAILABLE'
      },
      include: {
        grn: {
          include: {
            items: true,
            po: true
          }
        },
        po: true
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const grnOrConditions = [{ rmId: rmId }];
    if (rm) {
      grnOrConditions.push({ rmId: rm.id });
      if (rm.code) grnOrConditions.push({ rmId: rm.code });
      if (rm.name) grnOrConditions.push({ rmName: rm.name });
    }

    const grnItems = await prisma.gRNReceiveItem.findMany({
      where: {
        OR: grnOrConditions,
        actualReceivedQty: { gt: 0 }
      },
      include: {
        grn: {
          include: { po: true }
        }
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const formatted = [];
    const seenBatchNumbers = new Set();

    // 1. Batches from InventoryBatch
    for (const b of batches) {
      const grnItem = b.grn?.items?.find(it => it.rmId === rmId || (rm && (it.rmId === rm.id || it.rmId === rm.code)));
      const bNum = b.batchNumber;
      if (!seenBatchNumbers.has(bNum)) {
        seenBatchNumbers.add(bNum);
        formatted.push({
          id: b.id,
          internalBatchNo: b.batchNumber,
          supplierBatchNo: grnItem?.batchNumber || b.po?.poNumber || `SUP-LOT-${b.batchNumber.slice(-4)}`,
          mfgDate: b.mfgDate || grnItem?.mfgDate || b.createdAt,
          expiryDate: b.expiryDate || grnItem?.expiryDate || new Date(new Date(b.mfgDate || b.createdAt).getTime() + 180 * 24 * 60 * 60 * 1000),
          netQty: Number(b.netQty),
          storageLocation: b.storageLocation || 'Main Godown',
          grnRef: b.grn?.referenceNo || b.po?.poNumber || '',
          source: 'PURCHASE_GRN'
        });
      }
    }

    // 2. Batches from GRNReceiveItems if not duplicated
    for (const gi of grnItems) {
      const bNum = gi.batchNumber || `GRN-${gi.grn?.referenceNo || 'LOT'}-${gi.id.slice(0, 4)}`;
      if (!seenBatchNumbers.has(bNum)) {
        seenBatchNumbers.add(bNum);
        formatted.push({
          id: gi.id,
          internalBatchNo: bNum,
          supplierBatchNo: gi.batchNumber || gi.grn?.po?.poNumber || 'SUP-LOT-DIRECT',
          mfgDate: gi.mfgDate || gi.createdAt,
          expiryDate: gi.expiryDate || new Date(new Date(gi.mfgDate || gi.createdAt).getTime() + 180 * 24 * 60 * 60 * 1000),
          netQty: Number(gi.actualReceivedQty || 0),
          storageLocation: 'Central Receiving Store',
          grnRef: gi.grn?.referenceNo || gi.grn?.po?.poNumber || '',
          source: 'PURCHASE_GRN'
        });
      }
    }

    // 3. Fallback: Synthesize active warehouse lot for every material with warehouse inventory
    if (formatted.length === 0) {
      const cleanCode = (rm?.code || rm?.name || 'RM').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
      const mDate = rm?.createdAt || new Date();
      const expDate = new Date(new Date(mDate).getTime() + 365 * 24 * 60 * 60 * 1000);
      formatted.push({
        id: `wh-${rm?.id || rmId}`,
        internalBatchNo: `LOT-${cleanCode}-001`,
        supplierBatchNo: `SUP-GEN-${cleanCode.slice(-4) || '001'}`,
        mfgDate: mDate,
        expiryDate: expDate,
        netQty: Math.max(1, Number(rm?.currentStock || 100)),
        storageLocation: 'Primary Warehouse',
        grnRef: 'OPENING-STOCK',
        source: 'WAREHOUSE_LOT'
      });
    }

    // FEFO Sort: earliest expiry first
    formatted.sort((a, b) => {
      const tA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
      const tB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
      return tA - tB;
    });

    return formatted;
  } catch (err) {
    console.error('Error in getBatchesForRawMaterial:', err);
    return [];
  }
};

// Helper to attach FEFO lots to raw material item (supports split allocation across multiple batches)
const attachFefoLotToItem = async (rawItem, rmId) => {
  const lots = await getBatchesForRawMaterial(rmId);
  const reqQty = Number(rawItem.requiredQty || 1);
  const cleanUom = rawItem.selectedUom || rawItem.unit || 'units';

  if (lots && lots.length > 0) {
    let remainingNeeded = reqQty;
    const allocatedBatches = [];

    for (const lot of lots) {
      if (remainingNeeded <= 0) break;
      const avail = Number(lot.netQty || 0);
      if (avail <= 0) continue;
      const take = Number(Math.min(avail, remainingNeeded).toFixed(4));
      allocatedBatches.push({
        batchId: lot.id,
        internalBatchNo: lot.internalBatchNo,
        supplierBatchNo: lot.supplierBatchNo,
        mfgDate: lot.mfgDate,
        expiryDate: lot.expiryDate,
        allocatedQty: take,
        availableQty: avail,
        uom: cleanUom
      });
      remainingNeeded = Number((remainingNeeded - take).toFixed(4));
    }

    if (allocatedBatches.length === 0) {
      const earliest = lots[0];
      allocatedBatches.push({
        batchId: earliest.id,
        internalBatchNo: earliest.internalBatchNo,
        supplierBatchNo: earliest.supplierBatchNo,
        mfgDate: earliest.mfgDate,
        expiryDate: earliest.expiryDate,
        allocatedQty: reqQty,
        availableQty: Number(earliest.netQty || 0),
        uom: cleanUom
      });
    }

    const first = allocatedBatches[0];
    const combinedSummary = allocatedBatches.length > 1
      ? allocatedBatches.map(b => `${b.internalBatchNo} (${b.allocatedQty} ${cleanUom})`).join(' + ')
      : first.internalBatchNo;

    return {
      ...rawItem,
      allocatedBatches,
      allocatedBatchId: first.batchId,
      internalBatchNo: combinedSummary,
      supplierBatchNo: first.supplierBatchNo,
      mfgDate: first.mfgDate,
      expiryDate: first.expiryDate,
      lotNetQty: allocatedBatches.reduce((s, b) => s + b.allocatedQty, 0)
    };
  }

  // Fallback default warehouse lot
  const defLot = {
    batchId: `wh-${rmId}`,
    internalBatchNo: `LOT-RM-001`,
    supplierBatchNo: `SUP-LOT-001`,
    mfgDate: new Date(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    allocatedQty: reqQty,
    availableQty: Math.max(100, reqQty),
    uom: cleanUom
  };

  return {
    ...rawItem,
    allocatedBatches: [defLot],
    allocatedBatchId: defLot.batchId,
    internalBatchNo: defLot.internalBatchNo,
    supplierBatchNo: defLot.supplierBatchNo,
    mfgDate: defLot.mfgDate,
    expiryDate: defLot.expiryDate,
    lotNetQty: reqQty
  };
};

// Helper to format clean human UOM (never UUID)
const getCleanUom = (val, rm) => {
  if (val && typeof val === 'string' && !val.includes('-') && val.length < 20) {
    return val;
  }
  if (rm?.uoms && Array.isArray(rm.uoms) && rm.uoms.length > 0) {
    return rm.uoms[0].abbreviation || rm.uoms[0].name || 'kg';
  }
  if (rm?.consumptionUnit && !rm.consumptionUnit.includes('-')) {
    return rm.consumptionUnit;
  }
  return 'kg';
};

// Common Recipe Recommendation Handler (Auto-Learned or Subcategory Base or BOM)
const getProductRecipeHandler = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { qty = 1 } = req.query;
    const batchQty = Math.max(1, Number(qty) || 1);

    // 1. Check if product has an auto-learned recipe from previous runs
    const learned = await prisma.productLearnedRecipe.findUnique({
      where: { productId },
      include: {
        items: {
          include: { 
            rawMaterial: {
              include: { uoms: true, category: true }
            } 
          },
          orderBy: { seqNo: 'asc' }
        }
      }
    });

    if (learned && learned.items && learned.items.length > 0) {
      const items = await Promise.all(
        learned.items.map(async (item) => {
          const rm = item.rawMaterial;
          const requiredQty = Number(item.consumptionPerUnit) * batchQty;
          const currentStock = Number(rm.currentStock || 0);
          const cleanUom = getCleanUom(item.selectedUom, rm);

          const baseObj = {
            rmId: item.rmId,
            rawMaterialId: item.rmId,
            name: rm.name,
            code: rm.code,
            unit: cleanUom,
            selectedUom: cleanUom,
            hasAlternateUom: Boolean(rm.hasAlternateUom),
            alternateUom: rm.alternateUom,
            conversionFactor: Number(rm.conversionFactor || 1.0),
            baseUomQty: Number(rm.baseUomQty || 1.0),
            alternateUomQty: Number(rm.alternateUomQty || 1.0),
            consumptionPerUnit: Number(item.consumptionPerUnit),
            requiredQty,
            availableStock: currentStock,
            unitCost: Number(item.unitCost || rm.ratePerUnit || 0),
            totalCost: requiredQty * Number(item.unitCost || rm.ratePerUnit || 0),
            status: currentStock >= requiredQty ? 'Sufficient' : 'Insufficient',
            categoryType: item.categoryType || rm.category?.name || 'Key Raw Material',
            isLearned: true
          };

          return attachFefoLotToItem(baseObj, item.rmId);
        })
      );

      return res.json({
        source: 'LEARNED',
        title: 'Auto-Learned Recipe',
        description: `Auto-recommended formulation based on previous batch`,
        wastagePercent: Number(learned.wastagePercent || 6.0),
        overheadPercent: Number(learned.overheadPercent || 10.0),
        sopSteps: learned.sopSteps || null,
        items
      });
    }

    // 2. Check if product's subcategory has a Base Template (Excel Recipe Base)
    const product = await prisma.finishedProduct.findUnique({
      where: { id: productId },
      include: {
        subcategory: {
          include: {
            baseTemplates: {
              include: {
                items: {
                  include: { 
                    rawMaterial: {
                      include: { uoms: true, category: true }
                    } 
                  },
                  orderBy: { seqNo: 'asc' }
                }
              }
            }
          }
        },
        bom: {
          include: { 
            rawMaterial: {
              include: { uoms: true, category: true }
            } 
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let baseTemplate = product.subcategory?.baseTemplates?.[0];
    if (!baseTemplate && product.subcategoryId) {
      baseTemplate = await prisma.productBaseTemplate.findFirst({
        where: { subcategoryId: product.subcategoryId },
        include: {
          items: {
            include: { 
              rawMaterial: {
                include: { uoms: true, category: true }
              } 
            },
            orderBy: { seqNo: 'asc' }
          }
        }
      });
    }

    if (!baseTemplate) {
      baseTemplate = await prisma.productBaseTemplate.findFirst({
        where: {
          OR: [
            { groupName: { equals: product.category?.name, mode: 'insensitive' } },
            { name: { contains: 'Base', mode: 'insensitive' } }
          ]
        },
        include: {
          items: {
            include: { 
              rawMaterial: {
                include: { uoms: true, category: true }
              } 
            },
            orderBy: { seqNo: 'asc' }
          }
        }
      });
    }

    if (baseTemplate && baseTemplate.items && baseTemplate.items.length > 0) {
      const scale = batchQty > 0 ? (batchQty / 100) : 1;
      const items = await Promise.all(
        baseTemplate.items.map(async (item) => {
          const rm = item.rawMaterial;
          const requiredQty = Number(item.defaultQty) * scale;
          const currentStock = Number(rm?.currentStock || 0);
          const cleanUom = getCleanUom(item.uom, rm);

          const baseObj = {
            rmId: item.rmId,
            rawMaterialId: item.rmId,
            name: rm?.name || 'Raw Material',
            code: rm?.code || 'RM',
            unit: cleanUom,
            selectedUom: cleanUom,
            hasAlternateUom: Boolean(rm?.hasAlternateUom),
            alternateUom: rm?.alternateUom,
            conversionFactor: Number(rm?.conversionFactor || 1.0),
            baseUomQty: Number(rm?.baseUomQty || 1.0),
            alternateUomQty: Number(rm?.alternateUomQty || 1.0),
            consumptionPerUnit: Number(item.defaultQty) / 100,
            requiredQty,
            availableStock: currentStock,
            unitCost: Number(item.estimatedRate || rm?.ratePerUnit || 0),
            totalCost: requiredQty * Number(item.estimatedRate || rm?.ratePerUnit || 0),
            status: currentStock >= requiredQty ? 'Sufficient' : 'Insufficient',
            categoryType: item.categoryType || rm?.category?.name || 'Key Raw Material',
            isOverhead: item.isOverhead,
            isBaseTemplate: true
          };

          return attachFefoLotToItem(baseObj, item.rmId);
        })
      );

      return res.json({
        source: 'SUBCATEGORY_BASE',
        title: baseTemplate.name,
        description: `Subcategory template (${product.subcategory?.name || baseTemplate.name})`,
        wastagePercent: Number(baseTemplate.wastagePercent || 6.0),
        overheadPercent: Number(baseTemplate.overheadPercent || 10.0),
        sopSteps: baseTemplate.sopSteps || product.sopSteps || null,
        items
      });
    }

    // 3. Fallback to existing ProductBOM if any
    if (product.bom && product.bom.length > 0) {
      const items = await Promise.all(
        product.bom.map(async (b) => {
          const rm = b.rawMaterial;
          const requiredQty = Number(b.consumptionPerUnit) * batchQty;
          const currentStock = Number(rm.currentStock || 0);
          const cleanUom = getCleanUom(null, rm);

          const baseObj = {
            rmId: b.rmId,
            rawMaterialId: b.rmId,
            name: rm.name,
            code: rm.code,
            unit: cleanUom,
            selectedUom: cleanUom,
            hasAlternateUom: Boolean(rm.hasAlternateUom),
            alternateUom: rm.alternateUom,
            conversionFactor: Number(rm.conversionFactor || 1.0),
            baseUomQty: Number(rm.baseUomQty || 1.0),
            alternateUomQty: Number(rm.alternateUomQty || 1.0),
            consumptionPerUnit: Number(b.consumptionPerUnit),
            requiredQty,
            availableStock: currentStock,
            unitCost: Number(b.unitPrice || rm.ratePerUnit || 0),
            totalCost: requiredQty * Number(b.unitPrice || rm.ratePerUnit || 0),
            status: currentStock >= requiredQty ? 'Sufficient' : 'Insufficient',
            categoryType: rm.category?.name || 'Key Raw Material'
          };

          return attachFefoLotToItem(baseObj, b.rmId);
        })
      );

      return res.json({
        source: 'PRODUCT_BOM',
        title: 'Product BOM Formulation',
        description: 'Standard product BOM',
        wastagePercent: 6.0,
        overheadPercent: 10.0,
        sopSteps: product.sopSteps || null,
        items
      });
    }

    // 4. Default empty for fresh formulation
    return res.json({
      source: 'NONE',
      title: 'Custom Formulation',
      description: 'Manager enters raw materials & SOP for this batch',
      wastagePercent: 6.0,
      overheadPercent: 10.0,
      sopSteps: product.sopSteps || null,
      items: []
    });
  } catch (err) {
    next(err);
  }
};

// Mount both recommendation route and alias route
router.get('/recipe-recommendation/:productId', authenticateToken, getProductRecipeHandler);
router.get('/recipe/:productId', authenticateToken, getProductRecipeHandler);

// GET /api/production/rm-batches/:rmId - FEFO available inventory lots
router.get('/rm-batches/:rmId', authenticateToken, async (req, res, next) => {
  try {
    const { rmId } = req.params;
    const formatted = await getBatchesForRawMaterial(rmId);
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// GET /api/production/:id - Batch Detail
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const batch = await prisma.productionBatchNew.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        product: { include: { unit: true, category: true } },
        currentStage: true,
        rmUsages: { include: { rawMaterial: true } },
        order: { include: { customer: true } },
        creator: { select: { id: true, name: true } },
        qcTests: { include: { tester: { select: { name: true, email: true } } } }
      }
    });

    if (!batch) {
      return res.status(404).json({ error: 'Production batch not found' });
    }

    // Fetch timing logs from auditLogs
    const logs = await prisma.auditLog.findMany({
      where: { tableName: 'production_batches', recordId: req.params.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      ...batch,
      auditLogs: logs
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production - Create Production Batch
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']), async (req, res, next) => {
  try {
    const schema = z.object({
      productId: z.string(),
      productionType: z.string().optional().default('Make to Stock').transform(val => {
        if (val === 'Order-Based' || val === 'Make to Order') return 'Make to Order';
        return 'Make to Stock';
      }),
      status: z.string().default('Planned'),
      startDate: z.string(),
      completeDate: z.string().optional().nullable(),
      batchNo: z.string().optional().nullable(),
      expiryDays: z.coerce.number().positive(),
      quantity: z.coerce.number().positive(),
      note: z.string().optional().nullable(),
      attachmentPath: z.string().optional().nullable(),
      profitMargin: z.coerce.number().optional().nullable(),
      cgst: z.coerce.number().optional().nullable(),
      sgst: z.coerce.number().optional().nullable(),
      igst: z.coerce.number().optional().nullable(),
      orderId: z.string().optional().nullable().transform(v => (!v || v === '' ? null : v)),
      wastagePercent: z.coerce.number().optional().nullable(),
      overheadPercent: z.coerce.number().optional().nullable(),
      sopSteps: z.any().optional().nullable(),
      customBom: z.array(z.object({
        rmId: z.string(),
        requiredQty: z.coerce.number().positive(),
        unitCost: z.coerce.number().optional().nullable(),
        selectedUom: z.string().optional().nullable(),
        inputQty: z.coerce.number().optional().nullable(),
        conversionFactorUsed: z.coerce.number().optional().nullable(),
        allocatedBatchId: z.string().optional().nullable(),
        internalBatchNo: z.string().optional().nullable(),
        supplierBatchNo: z.string().optional().nullable(),
        mfgDate: z.string().optional().nullable(),
        expiryDate: z.string().optional().nullable(),
        categoryType: z.string().optional().nullable(),
        allocatedBatches: z.array(z.object({
          batchId: z.string().optional().nullable(),
          internalBatchNo: z.string().optional().nullable(),
          supplierBatchNo: z.string().optional().nullable(),
          mfgDate: z.string().optional().nullable(),
          expiryDate: z.string().optional().nullable(),
          allocatedQty: z.coerce.number().optional().nullable(),
          availableQty: z.coerce.number().optional().nullable(),
          uom: z.string().optional().nullable()
        })).optional().nullable()
      })).optional()
    });

    const data = schema.parse(req.body);

    const batch = await prisma.$transaction(async (tx) => {
      // 1. Lock and generate reference
      const referenceNo = await generateBatchReference(tx);

      // 2. Fetch product BOM
      const product = await tx.finishedProduct.findUnique({
        where: { id: data.productId },
        include: { bom: { include: { rawMaterial: true } } }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      let totalCost = 0;
      if (data.customBom && data.customBom.length > 0) {
        totalCost = data.customBom.reduce((sum, item) => sum + (Number(item.requiredQty) * Number(item.unitCost || 0)), 0);
      } else {
        totalCost = Number(product.totalCost) * data.quantity;
      }

      const profitMargin = data.profitMargin !== undefined ? data.profitMargin : Number(product.profitMargin);
      const cgst = data.cgst !== undefined ? data.cgst : Number(product.cgst);
      const sgst = data.sgst !== undefined ? data.sgst : Number(product.sgst);
      const igst = data.igst !== undefined ? data.igst : Number(product.igst);
      const salePrice = totalCost * (1 + profitMargin / 100);

      // 3. Create production batch
      const newBatch = await tx.productionBatchNew.create({
        data: {
          referenceNo,
          productId: data.productId,
          productionType: data.productionType,
          status: data.status,
          startDate: new Date(data.startDate),
          completeDate: data.completeDate ? new Date(data.completeDate) : null,
          batchNo: data.batchNo || null,
          expiryDays: data.expiryDays,
          quantity: data.quantity,
          remainingQty: data.quantity,
          partiallyDoneQty: 0,
          totalCost,
          profitMargin,
          cgst,
          sgst,
          igst,
          salePrice,
          note: data.note || null,
          attachmentPath: data.attachmentPath || null,
          createdBy: req.user.id,
          orderId: data.orderId || null
        }
      });

      // 4. Create raw material usage rows and reserve raw materials (deduct stock if In Progress)
      const bomItems = (data.customBom && data.customBom.length > 0)
        ? data.customBom.map(item => ({
            rmId: item.rmId,
            requiredQty: Number(item.requiredQty),
            unitPrice: item.unitCost || 0,
            selectedUom: item.selectedUom,
            inputQty: item.inputQty,
            conversionFactorUsed: item.conversionFactorUsed,
            allocatedBatchId: item.allocatedBatchId,
            internalBatchNo: item.internalBatchNo,
            supplierBatchNo: item.supplierBatchNo,
            mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            categoryType: item.categoryType,
            allocatedBatches: Array.isArray(item.allocatedBatches) ? item.allocatedBatches : []
          }))
        : product.bom.map(item => ({
            rmId: item.rmId,
            requiredQty: Number(item.consumptionPerUnit) * data.quantity,
            unitPrice: item.unitPrice,
            selectedUom: null,
            inputQty: null,
            conversionFactorUsed: 1.0,
            allocatedBatchId: null,
            internalBatchNo: null,
            supplierBatchNo: null,
            mfgDate: null,
            expiryDate: null,
            categoryType: 'Key Raw Material',
            allocatedBatches: []
          }));

      for (const item of bomItems) {
        const requiredQty = Number(item.requiredQty);
        const rm = await tx.rawMaterial.findFirst({
          where: {
            OR: [
              { id: item.rmId },
              { code: item.rmId }
            ]
          }
        });
        if (!rm) {
          console.warn(`[Production Batch] Skipping non-inventory or unmatched item: ${item.rmId}`);
          continue;
        }

        const actualRmId = rm.id;
        const unitCost = Number(item.unitPrice || rm.unitPrice || 0);
        const availableQtyAtTime = Number(rm.currentStock || 0);
        const status = availableQtyAtTime >= requiredQty ? 'Sufficient' : 'Insufficient';

        let lotSummary = item.internalBatchNo;
        if (Array.isArray(item.allocatedBatches) && item.allocatedBatches.length > 1) {
          lotSummary = item.allocatedBatches
            .map(b => `${b.internalBatchNo || 'LOT'} (${b.allocatedQty} ${b.uom || ''})`)
            .join(' + ');
        }

        // Create RM usage record with batch & alternate UOM metadata
        await tx.productionBatchRMUsage.create({
          data: {
            batchId: newBatch.id,
            rmId: actualRmId,
            requiredQty,
            availableQtyAtTime,
            actualUsedQty: requiredQty,
            unitCost,
            totalCost: requiredQty * unitCost,
            status,
            selectedUom: item.selectedUom || null,
            inputQty: item.inputQty ? Number(item.inputQty) : null,
            conversionFactorUsed: item.conversionFactorUsed ? Number(item.conversionFactorUsed) : 1.0,
            allocatedBatchId: item.allocatedBatchId || null,
            internalBatchNo: lotSummary || null,
            supplierBatchNo: item.supplierBatchNo || null,
            mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null
          }
        });

        // Deduct/reserve raw material stock immediately ONLY if In Progress
        if (data.status === 'In Progress' || data.status === 'In-Progress') {
          const newRmStock = Math.max(0, availableQtyAtTime - requiredQty);
          await tx.rawMaterial.update({
            where: { id: actualRmId },
            data: { currentStock: newRmStock }
          });

          // Multi-batch deduction: deduct each allocated lot from InventoryBatch
          if (Array.isArray(item.allocatedBatches) && item.allocatedBatches.length > 0) {
            for (const bAlloc of item.allocatedBatches) {
              const bId = bAlloc.batchId;
              const aQty = Number(bAlloc.allocatedQty || 0);
              if (bId && aQty > 0 && !bId.startsWith('wh-') && !bId.startsWith('custom-')) {
                const lot = await tx.inventoryBatch.findUnique({ where: { id: bId } }).catch(() => null);
                if (lot) {
                  const newLotNet = Math.max(0, Number(lot.netQty) - aQty);
                  await tx.inventoryBatch.update({
                    where: { id: bId },
                    data: {
                      netQty: newLotNet,
                      status: newLotNet <= 0 ? 'DEPLETED' : 'AVAILABLE'
                    }
                  }).catch(() => null);
                }
              }
            }
          } else if (item.allocatedBatchId && !item.allocatedBatchId.startsWith('wh-') && !item.allocatedBatchId.startsWith('custom-')) {
            const lot = await tx.inventoryBatch.findUnique({ where: { id: item.allocatedBatchId } }).catch(() => null);
            if (lot) {
              const newLotNet = Math.max(0, Number(lot.netQty) - requiredQty);
              await tx.inventoryBatch.update({
                where: { id: item.allocatedBatchId },
                data: {
                  netQty: newLotNet,
                  status: newLotNet <= 0 ? 'DEPLETED' : 'AVAILABLE'
                }
              }).catch(() => null);
            }
          }
        }
      }

      // Auto-learn recipe: upsert ProductLearnedRecipe for this product
      if (bomItems.length > 0) {
        const perUnitDivisor = data.quantity > 0 ? Number(data.quantity) : 1;
        const learnedRecipe = await tx.productLearnedRecipe.upsert({
          where: { productId: data.productId },
          create: {
            productId: data.productId,
            sourceBatchId: newBatch.id,
            baseBatchQty: data.quantity,
            wastagePercent: data.wastagePercent !== undefined ? data.wastagePercent : 6.0,
            overheadPercent: data.overheadPercent !== undefined ? data.overheadPercent : 10.0,
            sopSteps: data.sopSteps || null,
            lastUsedAt: new Date()
          },
          update: {
            sourceBatchId: newBatch.id,
            baseBatchQty: data.quantity,
            wastagePercent: data.wastagePercent !== undefined ? data.wastagePercent : 6.0,
            overheadPercent: data.overheadPercent !== undefined ? data.overheadPercent : 10.0,
            sopSteps: data.sopSteps || undefined,
            lastUsedAt: new Date()
          }
        });

        await tx.productLearnedRecipeItem.deleteMany({
          where: { learnedRecipeId: learnedRecipe.id }
        });

        for (let idx = 0; idx < bomItems.length; idx++) {
          const bItem = bomItems[idx];
          const matchedRm = await tx.rawMaterial.findFirst({
            where: {
              OR: [
                { id: bItem.rmId },
                { code: bItem.rmId }
              ]
            }
          });
          if (!matchedRm) continue;

          await tx.productLearnedRecipeItem.create({
            data: {
              learnedRecipeId: learnedRecipe.id,
              seqNo: idx + 1,
              rmId: matchedRm.id,
              consumptionPerUnit: Number(bItem.requiredQty) / perUnitDivisor,
              selectedUom: bItem.selectedUom || 'kg',
              unitCost: bItem.unitPrice || 0,
              categoryType: bItem.categoryType || 'Key Raw Material'
            }
          });
        }
      }

      // 5. If Order-Based, update customer order status to 'In Production'
      if (data.orderId) {
        await tx.customerOrder.update({
          where: { id: data.orderId },
          data: { status: 'In Production' }
        });
      }

      // Write Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_PRODUCTION_BATCH',
          tableName: 'production_batches',
          recordId: newBatch.id,
          oldValue: null,
          newValue: {
            referenceNo,
            productId: data.productId,
            productionType: data.productionType,
            quantity: data.quantity,
            status: data.status
          },
          ip: clientIp
        }
      });

      return newBatch;
    });

    res.status(201).json(batch);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/production/:id/status - Update Status
router.patch('/:id/status', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      status: z.enum(['Planned', 'In Progress', 'Completed', 'On Hold', 'Cancelled'])
    });

    const data = schema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatchNew.findUnique({
        where: { id },
        include: { product: true, rmUsages: { include: { rawMaterial: true } } }
      });

      if (!batch) {
        throw new Error('Batch not found');
      }

      // If status transitions to In Progress from Planned or another non-InProgress status, verify and lock stock
      if (data.status === 'In Progress' && batch.status !== 'In Progress') {
        const shortMaterials = batch.rmUsages.filter(u => Number(u.rawMaterial.currentStock || 0) < Number(u.requiredQty));
        if (shortMaterials.length > 0) {
          throw new Error(`Cannot start production. Shortfall in raw materials: ${shortMaterials.map(m => m.rawMaterial.name).join(', ')}`);
        }

        // Lock / deduct raw material stock
        for (const u of batch.rmUsages) {
          const currentStock = Number(u.rawMaterial.currentStock || 0);
          const reqQty = Number(u.requiredQty);
          await tx.rawMaterial.update({
            where: { id: u.rmId },
            data: { currentStock: Math.max(0, currentStock - reqQty) }
          });
          // Update status in usage record
          await tx.productionBatchRMUsage.update({
            where: { id: u.id },
            data: { status: 'Sufficient', availableQtyAtTime: currentStock }
          });
        }

        await notificationService.createNotification({
          type: 'PRODUCTION_STARTED',
          recipient_roles: ['SUPERVISOR', 'MAIN_MASTER', 'PRODUCTION_STAFF'],
          sender_role: req.user.role,
          sender_id: req.user.id,
          reference_type: 'PRODUCTION_BATCH',
          reference_id: id,
          message: `Production started: Batch #${batch.referenceNo} for ${batch.product.name} is now IN PROGRESS.`,
          metadata: {
            batchId: id,
            referenceNo: batch.referenceNo,
            productName: batch.product.name
          }
        }, tx);
      }

      // Update status
      const updateData = { status: data.status };
      if (data.status === 'Completed') {
        updateData.partiallyDoneQty = batch.quantity;
        updateData.remainingQty = 0;
      }
      const record = await tx.productionBatchNew.update({
        where: { id },
        data: updateData
      });

      // Write Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_PRODUCTION_STATUS',
          tableName: 'production_batches',
          recordId: id,
          oldValue: { status: batch.status },
          newValue: { status: data.status },
          ip: clientIp
        }
      });

      // If status completed, send real-time notification to Lab Assistant
      if (data.status === 'Completed') {
        await notificationService.createNotification({
          type: 'PRODUCTION_QC_REQUIRED',
          recipient_roles: ['LAB_ASSISTANT', 'MAIN_MASTER'],
          sender_role: req.user.role,
          sender_id: req.user.id,
          reference_type: 'PRODUCTION_BATCH',
          reference_id: id,
          message: `Batch #${batch.referenceNo} production completed — QC required for ${batch.product.name}`,
          metadata: {
            batchId: id,
            referenceNo: batch.referenceNo,
            productName: batch.product.name
          }
        }, tx);
      }

      return record;
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// POST /api/production/:id/complete - Complete batch, input actual RM used, actual output, return leftovers
router.post('/:id/complete', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      actualOutput: z.coerce.number().positive(),
      rmUsages: z.array(z.object({
        rmId: z.string().uuid(),
        actualUsedQty: z.coerce.number().nonnegative()
      })),
      note: z.string().optional()
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatchNew.findUnique({
        where: { id },
        include: { rmUsages: { include: { rawMaterial: true } }, product: true }
      });

      if (!batch) {
        throw new Error('Batch not found');
      }
      if (batch.status === 'Completed' || batch.status === 'qc_passed' || batch.status === 'qc_failed') {
        throw new Error('Batch is already completed or processed');
      }

      // Calculate variance and update RM stock levels
      const rmVariances = [];
      for (const reqUsage of data.rmUsages) {
        const dbUsage = batch.rmUsages.find(u => u.rmId === reqUsage.rmId);
        if (!dbUsage) continue;

        const reservedQty = Number(dbUsage.requiredQty);
        const actualUsed = Number(reqUsage.actualUsedQty);
        const variance = actualUsed - reservedQty;
        const leftover = reservedQty - actualUsed;

        rmVariances.push({
          rmId: reqUsage.rmId,
          rawMaterialName: dbUsage.rawMaterial.name,
          requiredQty: reservedQty,
          actualUsedQty: actualUsed,
          variance,
          leftover
        });

        // Update RM usage record
        await tx.productionBatchRMUsage.update({
          where: { id: dbUsage.id },
          data: {
            actualUsedQty: actualUsed,
            totalCost: actualUsed * Number(dbUsage.unitCost),
            status: variance > 0 ? 'Exceeded' : 'Sufficient'
          }
        });

        // Update stock
        const rm = await tx.rawMaterial.findUnique({ where: { id: reqUsage.rmId } });
        if (rm) {
          // If batch was already In Progress, requiredQty was reserved, adjust difference (leftover)
          // If batch was Planned/other, deduct actualUsed entirely
          const initialWasInProgress = batch.status === 'In Progress';
          const stockAdjustment = initialWasInProgress ? leftover : -actualUsed;
          const newStock = Math.max(0, Number(rm.currentStock) + stockAdjustment);

          await tx.rawMaterial.update({
            where: { id: reqUsage.rmId },
            data: { currentStock: newStock }
          });

          // Also adjust InventoryBatch lot if allocated
          if (dbUsage.allocatedBatchId) {
            const lot = await tx.inventoryBatch.findUnique({ where: { id: dbUsage.allocatedBatchId } });
            if (lot) {
              const lotAdjustment = initialWasInProgress ? leftover : -actualUsed;
              const newLotNet = Math.max(0, Number(lot.netQty) + lotAdjustment);
              await tx.inventoryBatch.update({
                where: { id: dbUsage.allocatedBatchId },
                data: {
                  netQty: newLotNet,
                  status: newLotNet <= 0 ? 'DEPLETED' : 'AVAILABLE'
                }
              });
            }
          }

          // Fire alert if there's a positive variance (overconsumed RM)
          if (variance > 0) {
            await notificationService.createNotification({
              type: 'RM_VARIANCE_ALERT',
              recipient_roles: ['MAIN_MASTER', 'SUPERVISOR'],
              sender_role: 'SYSTEM',
              sender_id: 'system',
              reference_type: 'PRODUCTION_BATCH',
              reference_id: id,
              message: `Variance Alert: Batch #${batch.referenceNo} overconsumed ${variance.toFixed(2)} units of ${rm.name} (SOP required ${reservedQty})`,
              metadata: { batchId: id, rmId: reqUsage.rmId, variance }
            }, tx);
          }
        }
      }

      // Update production batch
      const completedQty = data.actualOutput !== null && data.actualOutput !== undefined ? data.actualOutput : batch.quantity;
      const updatedBatch = await tx.productionBatchNew.update({
        where: { id },
        data: {
          status: 'Completed',
          completeDate: new Date(),
          actualOutput: data.actualOutput,
          partiallyDoneQty: completedQty,
          remainingQty: 0,
          rmVariance: rmVariances,
          note: data.note || batch.note
        }
      });

      // Lab QC Alert
      await notificationService.createNotification({
        type: 'PRODUCTION_QC_REQUIRED',
        recipient_roles: ['LAB_ASSISTANT', 'MAIN_MASTER'],
        sender_role: req.user.role,
        sender_id: req.user.id,
        reference_type: 'PRODUCTION_BATCH',
        reference_id: id,
        message: `Batch #${batch.referenceNo} production completed — QC Check required for ${batch.product.name}`,
        metadata: {
          batchId: id,
          referenceNo: batch.referenceNo,
          productName: batch.product.name
        }
      }, tx);

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'COMPLETE_PRODUCTION_BATCH',
          tableName: 'production_batches',
          recordId: id,
          oldValue: { status: batch.status },
          newValue: { status: 'Completed', actualOutput: data.actualOutput, rmVariance: rmVariances },
          ip: req.ip || '127.0.0.1'
        }
      });

      return updatedBatch;
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
