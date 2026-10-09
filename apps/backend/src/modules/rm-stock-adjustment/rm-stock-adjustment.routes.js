const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// Schema for individual batch item
const batchItemSchema = z.object({
  id: z.string().optional().nullable(),
  batchNumber: z.string().min(1),
  quantity: z.coerce.number().positive(),
  weight: z.string().optional().nullable(),
  mfgBatchNo: z.string().optional().nullable(),
  mfgDate: z.string().optional().nullable(),
  expDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  storageLocation: z.string().optional().nullable(),
  poReferenceNo: z.string().optional().nullable(),
  grnReferenceNo: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  ratePerUnit: z.coerce.number().optional().nullable(),
});

// Schema for adding/editing an adjustment
const adjustmentSchema = z.object({
  rawMaterialId: z.string().uuid(),
  type: z.enum(['ADDITION', 'SUBTRACTION']),
  quantity: z.coerce.number().positive(),
  notes: z.string().optional().nullable(),
  batches: z.array(batchItemSchema).optional().nullable()
});

// POST /api/rm-stock-adjustment
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']), async (req, res, next) => {
  try {
    const data = adjustmentSchema.parse(req.body);

    const adjustment = await prisma.$transaction(async (tx) => {
      // 1. Fetch RawMaterial
      const rm = await tx.rawMaterial.findUnique({
        where: { id: data.rawMaterialId },
        include: { category: true }
      });
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

      // 2. Create adjustment record
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

      // 3. Update RawMaterial currentStock
      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: { currentStock: newStock }
      });

      // 4. Handle Batches Allocation
      const batchesList = Array.isArray(data.batches) ? data.batches : [];

      if (data.type === 'ADDITION') {
        // Create or update InventoryBatch for each added batch
        for (const b of batchesList) {
          const expDateVal = (b.expiryDate || b.expDate) ? new Date(b.expiryDate || b.expDate) : null;
          const mfgDateVal = b.mfgDate ? new Date(b.mfgDate) : null;

          const existingBatch = await tx.inventoryBatch.findUnique({
            where: { batchNumber: b.batchNumber }
          }).catch(() => null);

          if (existingBatch) {
            // Increment existing batch quantity
            await tx.$executeRawUnsafe(
              `UPDATE "InventoryBatch" 
               SET "netQty" = "netQty" + $1, 
                   "receivedQty" = "receivedQty" + $1, 
                   "status" = 'AVAILABLE',
                   "storageLocation" = COALESCE($2, "storageLocation"),
                   "weight" = COALESCE($3, "weight"),
                   "mfgBatchNo" = COALESCE($4, "mfgBatchNo"),
                   "updatedAt" = NOW() 
               WHERE "id" = $5`,
              b.quantity,
              b.storageLocation || null,
              b.weight || null,
              b.mfgBatchNo || null,
              existingBatch.id
            );
          } else {
            // Insert new InventoryBatch record
            await tx.$executeRawUnsafe(
              `INSERT INTO "InventoryBatch" (
                "id", "batchNumber", "rawMaterialId", "rawMaterialName", "rmCategory",
                "receivedQty", "sampleQty", "netQty", "wastedQty", "uomId",
                "storageLocation", "expiryDate", "mfgDate", "weight", "mfgBatchNo",
                "status", "addedBy", "adjustmentId", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid()::text, $1, $2, $3, $4,
                $5, 0, $5, 0, $6,
                $7, $8, $9, $10, $11,
                'AVAILABLE', $12, $13, NOW(), NOW()
              )`,
              b.batchNumber,
              rm.id,
              rm.name,
              rm.category?.name || null,
              b.quantity,
              rm.unitId,
              b.storageLocation || 'Main RM Store',
              expDateVal,
              mfgDateVal,
              b.weight || null,
              b.mfgBatchNo || null,
              req.user.id,
              record.id
            );
          }
        }
      } else if (data.type === 'SUBTRACTION') {
        // Deduct from existing InventoryBatch records
        for (const b of batchesList) {
          const deductQty = Number(b.quantity || 0);
          if (deductQty > 0) {
            if (b.id) {
              await tx.$executeRawUnsafe(
                `UPDATE "InventoryBatch" 
                 SET "netQty" = GREATEST(0, "netQty" - $1), 
                     "status" = CASE WHEN ("netQty" - $1) <= 0 THEN 'DEPLETED' ELSE "status" END,
                     "updatedAt" = NOW() 
                 WHERE "id" = $2`,
                deductQty,
                b.id
              );
            } else if (b.batchNumber) {
              await tx.$executeRawUnsafe(
                `UPDATE "InventoryBatch" 
                 SET "netQty" = GREATEST(0, "netQty" - $1), 
                     "status" = CASE WHEN ("netQty" - $1) <= 0 THEN 'DEPLETED' ELSE "status" END,
                     "updatedAt" = NOW() 
                 WHERE "batchNumber" = $2`,
                deductQty,
                b.batchNumber
              );
            }
          }
        }
      }

      // 5. Store batches JSON in RMStockAdjustment record
      await tx.$executeRawUnsafe(
        `UPDATE "RMStockAdjustment" SET "batches" = $1::jsonb WHERE "id" = $2`,
        JSON.stringify(batchesList),
        record.id
      );

      // 6. Create Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATED',
          tableName: 'RMStockAdjustment',
          recordId: record.id,
          oldValue: { currentStock: Number(rm.currentStock) },
          newValue: { 
            currentStock: newStock, 
            type: data.type, 
            quantity: data.quantity,
            batchesCount: batchesList.length 
          },
          ip: clientIp,
        }
      });

      return {
        ...record,
        batches: batchesList
      };
    });

    res.status(201).json(adjustment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    if (error.message.includes('Cannot subtract')) return res.status(400).json({ error: error.message });
    next(error);
  }
});

// GET /api/rm-stock-adjustment
router.get('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT']), async (req, res, next) => {
  try {
    const adjustments = await prisma.rMStockAdjustment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rawMaterial: true,
        user: { select: { name: true } }
      }
    });

    // Query batches stored in JSONB column
    const adjBatches = await prisma.$queryRawUnsafe(
      `SELECT "id", "batches" FROM "RMStockAdjustment"`
    ).catch(() => []);

    const batchMap = new Map();
    adjBatches.forEach(row => {
      let b = row.batches;
      if (typeof b === 'string') {
        try { b = JSON.parse(b); } catch (_) { b = []; }
      }
      batchMap.set(row.id, Array.isArray(b) ? b : []);
    });
    
    // Format response matching the table columns UI request
    const formatted = adjustments.map(adj => ({
      id: adj.id,
      rawMaterialId: adj.rawMaterialId,
      rawMaterialCode: adj.rawMaterial.code,
      rawMaterialName: adj.rawMaterial.name,
      type: adj.type,
      quantity: Number(adj.quantity),
      unit: adj.rawMaterial.unitId,
      notes: adj.notes,
      batches: batchMap.get(adj.id) || [],
      createdAt: adj.createdAt,
      createdBy: adj.user?.name || 'Unknown'
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// PUT /api/rm-stock-adjustment/:id
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']), async (req, res, next) => {
  try {
    const data = adjustmentSchema.parse(req.body);
    const id = req.params.id;

    const adjustment = await prisma.$transaction(async (tx) => {
      // 1. Fetch existing adjustment
      const existing = await tx.rMStockAdjustment.findUnique({ 
        where: { id }, 
        include: { rawMaterial: true } 
      });
      if (!existing) throw new Error('Stock adjustment not found');

      // Fetch existing batches from DB
      const existingBatchesRow = await tx.$queryRawUnsafe(
        `SELECT "batches" FROM "RMStockAdjustment" WHERE "id" = $1`,
        id
      ).catch(() => []);
      let oldBatches = existingBatchesRow[0]?.batches || [];
      if (typeof oldBatches === 'string') {
        try { oldBatches = JSON.parse(oldBatches); } catch (_) { oldBatches = []; }
      }

      const rm = await tx.rawMaterial.findUnique({ where: { id: existing.rawMaterialId } });
      if (!rm) throw new Error('Raw Material not found');

      // 2. Revert previous adjustment's effect on RawMaterial currentStock
      let currentStockAfterRevert = Number(rm.currentStock);
      if (existing.type === 'ADDITION') {
        currentStockAfterRevert -= Number(existing.quantity);
      } else {
        currentStockAfterRevert += Number(existing.quantity);
      }

      // Revert previous batches effect
      if (existing.type === 'ADDITION') {
        // Delete or decrement InventoryBatches that were created by this adjustment
        for (const b of oldBatches) {
          const qty = Number(b.quantity || 0);
          // If adjustmentId matched or batch was created here, clean up
          await tx.$executeRawUnsafe(
            `DELETE FROM "InventoryBatch" WHERE "adjustmentId" = $1 AND "batchNumber" = $2`,
            id, b.batchNumber
          );
          // If it still exists (pre-existing lot), decrement
          await tx.$executeRawUnsafe(
            `UPDATE "InventoryBatch" 
             SET "netQty" = GREATEST(0, "netQty" - $1),
                 "receivedQty" = GREATEST(0, "receivedQty" - $1),
                 "status" = CASE WHEN ("netQty" - $1) <= 0 THEN 'DEPLETED' ELSE "status" END,
                 "updatedAt" = NOW() 
             WHERE "batchNumber" = $2`,
            qty, b.batchNumber
          );
        }
      } else if (existing.type === 'SUBTRACTION') {
        // Restore netQty on previously deducted batches
        for (const b of oldBatches) {
          const qty = Number(b.quantity || 0);
          if (qty > 0) {
            await tx.$executeRawUnsafe(
              `UPDATE "InventoryBatch" 
               SET "netQty" = "netQty" + $1,
                   "status" = 'AVAILABLE',
                   "updatedAt" = NOW() 
               WHERE ("id" = $2 OR "batchNumber" = $3)`,
              qty, b.id || '', b.batchNumber || ''
            );
          }
        }
      }

      // 3. Apply new adjustment to target RM
      const targetRm = (existing.rawMaterialId === data.rawMaterialId) 
        ? rm 
        : await tx.rawMaterial.findUnique({ where: { id: data.rawMaterialId }, include: { category: true } });

      let baseStock = (existing.rawMaterialId === data.rawMaterialId) ? currentStockAfterRevert : Number(targetRm.currentStock);
      let stockAfterNewApply;
      if (data.type === 'ADDITION') {
        stockAfterNewApply = baseStock + data.quantity;
      } else {
        if (data.quantity > baseStock) {
          throw new Error(`Cannot subtract ${data.quantity}. Current stock is only ${baseStock}.`);
        }
        stockAfterNewApply = baseStock - data.quantity;
      }

      // If RM changed, update old RM with reverted stock
      if (existing.rawMaterialId !== data.rawMaterialId) {
        await tx.rawMaterial.update({
          where: { id: existing.rawMaterialId },
          data: { currentStock: Math.max(0, currentStockAfterRevert) }
        });
      }

      // Update new RM stock
      await tx.rawMaterial.update({
        where: { id: data.rawMaterialId },
        data: { currentStock: stockAfterNewApply }
      });

      // 4. Apply new batches
      const newBatchesList = Array.isArray(data.batches) ? data.batches : [];
      if (data.type === 'ADDITION') {
        for (const b of newBatchesList) {
          const expDateVal = (b.expiryDate || b.expDate) ? new Date(b.expiryDate || b.expDate) : null;
          const mfgDateVal = b.mfgDate ? new Date(b.mfgDate) : null;

          const existingBatch = await tx.inventoryBatch.findUnique({
            where: { batchNumber: b.batchNumber }
          }).catch(() => null);

          if (existingBatch) {
            await tx.$executeRawUnsafe(
              `UPDATE "InventoryBatch" 
               SET "netQty" = "netQty" + $1, 
                   "receivedQty" = "receivedQty" + $1, 
                   "status" = 'AVAILABLE',
                   "updatedAt" = NOW() 
               WHERE "id" = $2`,
              b.quantity,
              existingBatch.id
            );
          } else {
            await tx.$executeRawUnsafe(
              `INSERT INTO "InventoryBatch" (
                "id", "batchNumber", "rawMaterialId", "rawMaterialName", "rmCategory",
                "receivedQty", "sampleQty", "netQty", "wastedQty", "uomId",
                "storageLocation", "expiryDate", "mfgDate", "weight", "mfgBatchNo",
                "status", "addedBy", "adjustmentId", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid()::text, $1, $2, $3, $4,
                $5, 0, $5, 0, $6,
                $7, $8, $9, $10, $11,
                'AVAILABLE', $12, $13, NOW(), NOW()
              )`,
              b.batchNumber,
              targetRm.id,
              targetRm.name,
              targetRm.category?.name || null,
              b.quantity,
              targetRm.unitId,
              b.storageLocation || 'Main RM Store',
              expDateVal,
              mfgDateVal,
              b.weight || null,
              b.mfgBatchNo || null,
              req.user.id,
              id
            );
          }
        }
      } else if (data.type === 'SUBTRACTION') {
        for (const b of newBatchesList) {
          const deductQty = Number(b.quantity || 0);
          if (deductQty > 0) {
            await tx.$executeRawUnsafe(
              `UPDATE "InventoryBatch" 
               SET "netQty" = GREATEST(0, "netQty" - $1), 
                   "status" = CASE WHEN ("netQty" - $1) <= 0 THEN 'DEPLETED' ELSE "status" END,
                   "updatedAt" = NOW() 
               WHERE ("id" = $2 OR "batchNumber" = $3)`,
              deductQty,
              b.id || '',
              b.batchNumber || ''
            );
          }
        }
      }

      // 5. Update adjustment record
      const record = await tx.rMStockAdjustment.update({
        where: { id },
        data: {
          rawMaterialId: data.rawMaterialId,
          type: data.type,
          quantity: data.quantity,
          notes: data.notes || null
        }
      });

      // Update batches JSONB column
      await tx.$executeRawUnsafe(
        `UPDATE "RMStockAdjustment" SET "batches" = $1::jsonb WHERE "id" = $2`,
        JSON.stringify(newBatchesList),
        id
      );

      return {
        ...record,
        batches: newBatchesList
      };
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
router.delete('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']), async (req, res, next) => {
  try {
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.rMStockAdjustment.findUnique({ where: { id } });
      if (!existing) throw new Error('Stock adjustment not found');

      // Fetch batches from adjustment
      const existingBatchesRow = await tx.$queryRawUnsafe(
        `SELECT "batches" FROM "RMStockAdjustment" WHERE "id" = $1`,
        id
      ).catch(() => []);
      let oldBatches = existingBatchesRow[0]?.batches || [];
      if (typeof oldBatches === 'string') {
        try { oldBatches = JSON.parse(oldBatches); } catch (_) { oldBatches = []; }
      }

      const rm = await tx.rawMaterial.findUnique({ where: { id: existing.rawMaterialId } });
      
      // Revert RM currentStock
      let newStock = Number(rm?.currentStock || 0);
      if (existing.type === 'ADDITION') {
        newStock -= Number(existing.quantity);
        if (newStock < 0) newStock = 0;
      } else {
        newStock += Number(existing.quantity);
      }

      if (rm) {
        await tx.rawMaterial.update({
          where: { id: existing.rawMaterialId },
          data: { currentStock: newStock }
        });
      }

      // Revert batches
      if (existing.type === 'ADDITION') {
        // Delete any InventoryBatch records created by this adjustment
        await tx.$executeRawUnsafe(
          `DELETE FROM "InventoryBatch" WHERE "adjustmentId" = $1`,
          id
        );
        for (const b of oldBatches) {
          const qty = Number(b.quantity || 0);
          await tx.$executeRawUnsafe(
            `UPDATE "InventoryBatch" 
             SET "netQty" = GREATEST(0, "netQty" - $1),
                 "receivedQty" = GREATEST(0, "receivedQty" - $1),
                 "status" = CASE WHEN ("netQty" - $1) <= 0 THEN 'DEPLETED' ELSE "status" END,
                 "updatedAt" = NOW() 
             WHERE "batchNumber" = $2`,
            qty, b.batchNumber
          );
        }
      } else if (existing.type === 'SUBTRACTION') {
        // Restore netQty on deducted batches
        for (const b of oldBatches) {
          const qty = Number(b.quantity || 0);
          if (qty > 0) {
            await tx.$executeRawUnsafe(
              `UPDATE "InventoryBatch" 
               SET "netQty" = "netQty" + $1,
                   "status" = 'AVAILABLE',
                   "updatedAt" = NOW() 
               WHERE ("id" = $2 OR "batchNumber" = $3)`,
              qty, b.id || '', b.batchNumber || ''
            );
          }
        }
      }

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
