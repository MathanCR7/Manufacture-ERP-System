const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// Schema for adding an adjustment
const adjustmentSchema = z.object({
  rawMaterialId: z.string().uuid(),
  type: z.enum(['ADDITION', 'SUBTRACTION']),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional()
});

// POST /api/rm-stock-adjustment
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const data = adjustmentSchema.parse(req.body);

    const adjustment = await prisma.$transaction(async (tx) => {
      // Update RawMaterial currentStock
      const rm = await tx.rawMaterial.findUnique({ where: { id: data.rawMaterialId } });
      if (!rm) {
        throw new Error('Raw Material not found');
      }

      let newStock;
      if (data.type === 'ADDITION') {
        newStock = Number(rm.currentStock) + data.quantity;
      } else {
        if (data.quantity > Number(rm.currentStock)) {
          throw new Error(`Cannot subtract ${data.quantity}. Current stock is only ${rm.currentStock}.`);
        }
        newStock = Number(rm.currentStock) - data.quantity;
      }

      // Create adjustment record
      const record = await tx.rMStockAdjustment.create({
        data: {
          rawMaterialId: data.rawMaterialId,
          type: data.type,
          quantity: data.quantity,
          notes: data.notes || null,
          createdBy: req.user.id
        },
        include: {
          rawMaterial: { include: { category: true } }
        }
      });

      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: { currentStock: newStock }
      });

      // Create audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATED',
          tableName: 'RMStockAdjustment',
          recordId: record.id,
          oldValue: { currentStock: Number(rm.currentStock) },
          newValue: { currentStock: newStock, type: data.type, quantity: data.quantity },
          ip: clientIp,
        }
      });

      return record;
    });

    res.status(201).json(adjustment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    if (error.message.includes('Cannot subtract')) return res.status(400).json({ error: error.message });
    next(error);
  }
});

// GET /api/rm-stock-adjustment
router.get('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const adjustments = await prisma.rMStockAdjustment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rawMaterial: true,
        user: { select: { name: true } }
      }
    });
    
    // Format response matching the table columns UI request
    const formatted = adjustments.map(adj => ({
      id: adj.id,
      rawMaterialId: adj.rawMaterialId,
      rawMaterialCode: adj.rawMaterial.code,
      rawMaterialName: adj.rawMaterial.name,
      type: adj.type,
      quantity: adj.quantity,
      unit: adj.rawMaterial.unitId,
      notes: adj.notes,
      createdAt: adj.createdAt,
      createdBy: adj.user?.name || 'Unknown'
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// PUT /api/rm-stock-adjustment/:id
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const data = adjustmentSchema.parse(req.body);
    const id = req.params.id;

    const adjustment = await prisma.$transaction(async (tx) => {
      const existing = await tx.rMStockAdjustment.findUnique({ where: { id }, include: { rawMaterial: true } });
      if (!existing) throw new Error('Stock adjustment not found');

      const rm = await tx.rawMaterial.findUnique({ where: { id: existing.rawMaterialId } });
      
      // 1. Revert previous adjustment
      let currentStockAfterRevert = Number(rm.currentStock);
      if (existing.type === 'ADDITION') {
        currentStockAfterRevert -= Number(existing.quantity);
      } else {
        currentStockAfterRevert += Number(existing.quantity);
      }

      // If they are changing the rawMaterialId, we should revert old RM and apply to new RM
      // But for simplicity, let's assume rawMaterialId cannot be changed, or if it is changed we handle it
      if (existing.rawMaterialId !== data.rawMaterialId) {
        // Revert old RM
        await tx.rawMaterial.update({
          where: { id: existing.rawMaterialId },
          data: { currentStock: Math.max(0, currentStockAfterRevert) }
        });

        // Apply to new RM
        const newRm = await tx.rawMaterial.findUnique({ where: { id: data.rawMaterialId } });
        let stockAfterNewApply = Number(newRm.currentStock);
        if (data.type === 'ADDITION') {
          stockAfterNewApply += data.quantity;
        } else {
          if (data.quantity > stockAfterNewApply) {
            throw new Error(`Cannot subtract ${data.quantity}. Current stock is only ${stockAfterNewApply}.`);
          }
          stockAfterNewApply -= data.quantity;
        }
        await tx.rawMaterial.update({
          where: { id: data.rawMaterialId },
          data: { currentStock: stockAfterNewApply }
        });
      } else {
        // Same RM
        let stockAfterNewApply = currentStockAfterRevert;
        if (data.type === 'ADDITION') {
          stockAfterNewApply += data.quantity;
        } else {
          if (data.quantity > stockAfterNewApply) {
            throw new Error(`Cannot subtract ${data.quantity}. Current stock is only ${stockAfterNewApply}.`);
          }
          stockAfterNewApply -= data.quantity;
        }
        await tx.rawMaterial.update({
          where: { id: data.rawMaterialId },
          data: { currentStock: stockAfterNewApply }
        });
      }

      // Update adjustment record
      const record = await tx.rMStockAdjustment.update({
        where: { id },
        data: {
          rawMaterialId: data.rawMaterialId,
          type: data.type,
          quantity: data.quantity,
          notes: data.notes || null
        }
      });

      return record;
    });

    res.json(adjustment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    if (error.message.includes('Cannot subtract')) return res.status(400).json({ error: error.message });
    next(error);
  }
});

// DELETE /api/rm-stock-adjustment/:id
router.delete('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.rMStockAdjustment.findUnique({ where: { id } });
      if (!existing) throw new Error('Stock adjustment not found');

      const rm = await tx.rawMaterial.findUnique({ where: { id: existing.rawMaterialId } });
      
      // Revert stock
      let newStock = Number(rm.currentStock);
      if (existing.type === 'ADDITION') {
        newStock -= Number(existing.quantity);
        if (newStock < 0) newStock = 0;
      } else {
        newStock += Number(existing.quantity);
      }

      await tx.rawMaterial.update({
        where: { id: existing.rawMaterialId },
        data: { currentStock: newStock }
      });

      // Delete record
      await tx.rMStockAdjustment.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    next(error);
  }
});

module.exports = router;
