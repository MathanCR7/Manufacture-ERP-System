const express = require('express');
const { z } = require('zod');
const prisma = require('../database/prisma');
const authenticateToken = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { generateRmId } = require('../utils/rmIdGenerator');
const { generateReferenceNo } = require('../utils/referenceGenerator');
const workflowNotifications = require('../modules/notifications/workflow.notifications');

const router = express.Router();

// GET /api/rm/id/generate
router.get('/rm/id/generate', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), async (req, res, next) => {
  try {
    const candidateId = await generateRmId(prisma);
    res.json({ candidateId });
  } catch (error) {
    next(error);
  }
});

// GET /api/rm/id/rotate
router.post('/rm/id/rotate', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), async (req, res, next) => {
  try {
    const candidateId = await generateRmId(prisma);
    res.json({ candidateId });
  } catch (error) {
    next(error);
  }
});

// GET /api/rm/po
router.get('/rm/po', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER']), async (req, res, next) => {
  try {
    const pos = await prisma.rawMaterialPO.findMany({
      where: {
        status: { not: 'DELETED' }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uom: true,
        supplier: true
      }
    });

    const formattedPos = pos.map(po => ({
      id: po.id,
      referenceNo: po.referenceNo || 'N/A',
      rmId: po.rmId,
      name: po.name,
      quantity: po.quantity,
      amount: po.amount,
      uom: po.uom ? po.uom.name : null,
      supplierName: po.supplier ? po.supplier.name : null,
      expectedDelivery: po.expectedDelivery,
      status: po.status,
      createdAt: po.createdAt
    }));

    res.json(formattedPos);
  } catch (error) {
    next(error);
  }
});

// GET /api/rm/po/:id
router.get('/rm/po/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER']), async (req, res, next) => {
  try {
    const po = await prisma.rawMaterialPO.findUnique({
      where: { id: req.params.id },
      include: {
        uom: true,
        user: { select: { name: true, email: true } },
        idRegistry: true,
        supplier: true
      }
    });

    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    res.json(po);
  } catch (error) {
    next(error);
  }
});

/**
 * UPDATED SCHEMA
 * 1. max(20) to match your DB VarChar(20) for IDs like RM-00001
 * 2. z.coerce.number() to handle string inputs from forms
 * 3. Relaxed date validation to handle various frontend formats
 */
const createPOSchema = z.object({
  rmId: z.string().trim().min(1).max(20, "RM ID cannot exceed 20 characters"), 
  name: z.string().min(2),
  quantity: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
  uomId: z.string().min(1),
  expectedDelivery: z.string().min(1),
  supplierId: z.string().uuid().optional(),
});

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const resolveUomId = async (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const existing = await prisma.uOM.findUnique({ where: { id: trimmed } });
    if (existing) return existing.id;
  }

  const normalized = trimmed.toLowerCase();
  const existingUom = await prisma.uOM.findFirst({
    where: {
      isActive: true,
      OR: [
        { abbreviation: { equals: normalized, mode: 'insensitive' } },
        { name: { equals: normalized, mode: 'insensitive' } }
      ]
    }
  });

  if (existingUom) return existingUom.id;

  const newUom = await prisma.uOM.create({
    data: {
      name: trimmed,
      abbreviation: trimmed,
      isActive: true
    }
  });

  return newUom.id;
};

// POST /api/rm/po
router.post('/rm/po', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), async (req, res, next) => {
  try {
    const parsedData = createPOSchema.parse(req.body);
    const resolvedUomId = await resolveUomId(parsedData.uomId);
    
    if (!resolvedUomId) {
      return res.status(400).json({ error: 'Invalid UOM provided' });
    }
    
    // Generate PO Reference No
    const referenceNo = await generateReferenceNo(prisma, 'RawMaterialPO', 'PO');

    const createdPO = await prisma.$transaction(async (tx) => {
      // 1. Create or Update IdRegistry (Upsert allows reuse of RM IDs)
      await tx.idRegistry.upsert({
        where: { id: parsedData.rmId },
        update: { status: 'ACTIVE' },
        create: {
          id: parsedData.rmId,
          status: 'ACTIVE',
          createdBy: req.user.id
        }
      });

      // 2. Create RawMaterialPO
      const po = await tx.rawMaterialPO.create({
        data: {
          referenceNo,
          rmId: parsedData.rmId,
          name: parsedData.name,
          quantity: parsedData.quantity,
          amount: parsedData.amount,
          uomId: resolvedUomId,
          expectedDelivery: new Date(parsedData.expectedDelivery),
          supplierId: parsedData.supplierId,
          status: 'PENDING',
          createdBy: req.user.id
        }
      });

      return po;
    });

    // Fetch actual UOM name for notification
    const actualUom = await prisma.uOM.findUnique({ where: { id: resolvedUomId } });

    // Fire Notification Event
    try {
      await workflowNotifications.triggerPOCreated({
        rmId: parsedData.rmId,
        rmName: parsedData.name,
        quantity: parsedData.quantity,
        uom: actualUom ? actualUom.abbreviation : 'units',
        amount: parsedData.amount,
        expectedDeliveryDate: new Date(parsedData.expectedDelivery).toLocaleDateString('en-GB'),
        poId: createdPO.id,
        referenceNo: createdPO.referenceNo,
        actorName: req.user.name || 'User',
        actorId: req.user.id,
        actorRole: req.user.role
      });
    } catch (notifErr) {
      console.error('Failed to trigger PO_CREATED notification:', notifErr);
    }

    res.locals.recordId = createdPO.id;
    res.status(201).json(createdPO);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    // Specific check for column length or unique constraint errors
    if (error.code === 'P2000') {
        return res.status(400).json({ error: "Value too long for database. Check RM ID length." });
    }
    if (error.code === 'P2002') {
        return res.status(409).json({ error: "A unique constraint failed (likely rmId unique constraint in PO table). Remove @unique from rmId in schema." });
    }
    next(error);
  }
});

// PUT /api/rm/po/:id  — Edit a PENDING PO and write a full audit log
const updatePOSchema = z.object({
  name: z.string().min(2).optional(),
  quantity: z.coerce.number().positive().optional(),
  amount: z.coerce.number().positive().optional(),
  uomId: z.string().min(1).optional(),
  expectedDelivery: z.string().min(1).optional(),
  supplierId: z.string().uuid().nullable().optional(),
});

router.put('/rm/po/:id', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Load current PO with all relations for "old values" snapshot
    const existing = await prisma.rawMaterialPO.findUnique({
      where: { id },
      include: {
        uom: true,
        supplier: true,
        user: { select: { name: true, email: true, role: true } }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    if (existing.status !== 'PENDING') {
      return res.status(409).json({ error: 'Only PENDING purchase orders can be edited.' });
    }

    // Only PURCHASE_ACCOUNTANT who owns the PO (or MAIN_MASTER) can edit
    if (req.user.role === 'PURCHASE_ACCOUNTANT' && existing.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own purchase orders.' });
    }

    const parsedData = updatePOSchema.parse(req.body);

    // 2. Resolve UOM if provided
    let resolvedUomId = existing.uomId;
    if (parsedData.uomId) {
      resolvedUomId = await resolveUomId(parsedData.uomId);
      if (!resolvedUomId) {
        return res.status(400).json({ error: 'Invalid UOM provided' });
      }
    }

    // 3. Build update payload (only changed fields)
    const updateData = {};
    if (parsedData.name !== undefined) updateData.name = parsedData.name;
    if (parsedData.quantity !== undefined) updateData.quantity = parsedData.quantity;
    if (parsedData.amount !== undefined) updateData.amount = parsedData.amount;
    if (parsedData.expectedDelivery !== undefined) updateData.expectedDelivery = new Date(parsedData.expectedDelivery);
    if (parsedData.supplierId !== undefined) updateData.supplierId = parsedData.supplierId || null;
    if (parsedData.uomId !== undefined) updateData.uomId = resolvedUomId;

    // 4. Capture full old-value snapshot for audit log
    const oldSnapshot = {
      referenceNo: existing.referenceNo,
      rmId: existing.rmId,
      name: existing.name,
      quantity: Number(existing.quantity),
      amount: Number(existing.amount),
      uomId: existing.uomId,
      uomName: existing.uom ? `${existing.uom.name} (${existing.uom.abbreviation})` : null,
      expectedDelivery: existing.expectedDelivery,
      supplierId: existing.supplierId,
      supplierName: existing.supplier ? existing.supplier.name : null,
      status: existing.status,
      createdBy: existing.createdBy,
      createdByName: existing.user ? existing.user.name : null,
      createdAt: existing.createdAt,
    };

    // 5. Perform update
    const updatedPO = await prisma.rawMaterialPO.update({
      where: { id },
      data: updateData,
      include: {
        uom: true,
        supplier: true,
        user: { select: { name: true, email: true, role: true } }
      }
    });

    // 6. Capture full new-value snapshot for audit log
    const newSnapshot = {
      referenceNo: updatedPO.referenceNo,
      rmId: updatedPO.rmId,
      name: updatedPO.name,
      quantity: Number(updatedPO.quantity),
      amount: Number(updatedPO.amount),
      uomId: updatedPO.uomId,
      uomName: updatedPO.uom ? `${updatedPO.uom.name} (${updatedPO.uom.abbreviation})` : null,
      expectedDelivery: updatedPO.expectedDelivery,
      supplierId: updatedPO.supplierId,
      supplierName: updatedPO.supplier ? updatedPO.supplier.name : null,
      status: updatedPO.status,
      createdBy: updatedPO.createdBy,
      createdByName: updatedPO.user ? updatedPO.user.name : null,
      updatedAt: updatedPO.updatedAt,
      editedBy: req.user.id,
      editedByName: req.user.name || req.user.email,
      editedByRole: req.user.role,
    };

    // 7. Write audit log
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE',
        tableName: 'RawMaterialPO',
        recordId: id,
        oldValue: oldSnapshot,
        newValue: newSnapshot,
        ip: clientIp,
      }
    });

    // 8. Fire notification (best-effort)
    try {
      await workflowNotifications.triggerPOUpdated?.({
        poId: id,
        referenceNo: updatedPO.referenceNo,
        rmId: updatedPO.rmId,
        rmName: updatedPO.name,
        actorName: req.user.name || 'User',
        actorId: req.user.id,
        actorRole: req.user.role,
        changes: updateData,
      });
    } catch (notifErr) {
      console.error('Failed to trigger PO_UPDATED notification:', notifErr.message);
    }

    res.json(updatedPO);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// DELETE /api/rm/po/:id
router.delete('/rm/po/:id', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), async (req, res, next) => {
  try {
    const po = await prisma.rawMaterialPO.findUnique({
      where: { id: req.params.id }
    });

    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    if (po.status !== 'PENDING') {
      return res.status(409).json({ error: 'Cannot delete after GRN' });
    }

    if (req.user.role === 'PURCHASE_ACCOUNTANT' && po.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own purchase orders.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.rawMaterialPO.update({
        where: { id: req.params.id },
        data: {
          status: 'DELETED',
          deletedAt: new Date()
        }
      });

      // Optional: Logic to check if any other active POs use this rmId before marking registry as DELETED
      const otherPOs = await tx.rawMaterialPO.findFirst({
        where: { rmId: po.rmId, status: { not: 'DELETED' }, id: { not: req.params.id } }
      });

      if (!otherPOs) {
        await tx.idRegistry.update({
          where: { id: po.rmId },
          data: { status: 'DELETED' }
        });
      }
    });

    // Fire Notification Event for Cancellation
    try {
      await workflowNotifications.triggerPOCancelled({
        poId: po.id,
        rmId: po.rmId,
        rmName: po.name,
        cancelReason: 'Cancelled by user', // Or read from req.body if provided
        actorName: req.user.name || 'User',
        actorId: req.user.id,
        actorRole: req.user.role
      });
    } catch (notifErr) {
      console.error('Failed to trigger PO_CANCELLED notification:', notifErr);
    }

    res.json({ message: 'Purchase Order deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/uom
router.get('/uom', authenticateToken, async (req, res, next) => {
  try {
    const { rawMaterialId } = req.query;

    if (rawMaterialId) {
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId },
        include: { uoms: true }
      });

      if (!rawMaterial) {
        return res.status(404).json({ error: 'Raw Material not found' });
      }

      if (rawMaterial.uoms?.length > 0) {
        return res.json(rawMaterial.uoms);
      }

      const normalizedUnits = [rawMaterial.unitId, rawMaterial.consumptionUnit]
        .filter(Boolean)
        .map(u => u.trim().toLowerCase());

      if (normalizedUnits.length > 0) {
        const matchedUoms = await prisma.uOM.findMany({
          where: {
            isActive: true,
            OR: normalizedUnits.map((normalizedUnit) => ({
              abbreviation: { equals: normalizedUnit, mode: 'insensitive' },
            })).concat(normalizedUnits.map((normalizedUnit) => ({
              name: { equals: normalizedUnit, mode: 'insensitive' },
            })))
          },
          orderBy: { name: 'asc' }
        });
        if (matchedUoms.length > 0) {
          return res.json(matchedUoms);
        }
      }
    }

    const uoms = await prisma.uOM.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(uoms);
  } catch (error) {
    next(error);
  }
});

const createUOMSchema = z.object({
  name: z.string().min(2),
  abbreviation: z.string().min(1),
});

// POST /api/uom
router.post('/uom', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const parsedData = createUOMSchema.parse(req.body);
    const newUOM = await prisma.uOM.create({
      data: {
        name: parsedData.name,
        abbreviation: parsedData.abbreviation,
        isActive: true,
      }
    });
    res.status(201).json(newUOM);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// GET /api/rm-waste/reference/generate
router.get('/rm-waste/reference/generate', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const candidateId = await generateReferenceNo(prisma, 'RMWaste', 'RMW');
    res.json({ candidateId });
  } catch (error) {
    next(error);
  }
});

// GET /api/rm-waste
router.get('/rm-waste', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const wastes = await prisma.rMWaste.findMany({
      include: {
        items: {
          include: { rawMaterial: true, uom: true }
        },
        responsibleUser: { select: { name: true } },
        creatorUser: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(wastes);
  } catch (error) {
    next(error);
  }
});

const createRMWasteSchema = z.object({
  date: z.string().min(1),
  totalLoss: z.coerce.number().nonnegative(),
  note: z.string().optional(),
  responsibleId: z.string().uuid(),
  items: z.array(z.object({
    rawMaterialId: z.string().uuid(),
    quantity: z.coerce.number().positive(),
    uomId: z.string().min(1),
    lossAmount: z.coerce.number().nonnegative(),
  })).min(1)
});

// POST /api/rm-waste
router.post('/rm-waste', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const parsedData = createRMWasteSchema.parse(req.body);
    
    const itemsWithResolvedUoms = await Promise.all(parsedData.items.map(async (item) => {
      const resolvedUomId = await resolveUomId(item.uomId);
      if (!resolvedUomId) {
        throw new z.ZodError([{ path: ['items', 'uomId'], message: `Invalid UOM provided: ${item.uomId}` }]);
      }
      return { ...item, uomId: resolvedUomId };
    }));

    const waste = await prisma.$transaction(async (tx) => {
      const referenceNo = await generateReferenceNo(tx, 'RMWaste', 'RMW');
      
      const newWaste = await tx.rMWaste.create({
        data: {
          referenceNo,
          date: new Date(parsedData.date),
          totalLoss: parsedData.totalLoss,
          note: parsedData.note,
          responsibleId: parsedData.responsibleId,
          createdBy: req.user.id,
          items: {
            create: itemsWithResolvedUoms.map(item => ({
              rawMaterialId: item.rawMaterialId,
              quantity: item.quantity,
              uomId: item.uomId,
              lossAmount: item.lossAmount
            }))
          }
        },
        include: { items: true }
      });

      // Update currentStock and check for low stock
      for (const item of parsedData.items) {
        const rm = await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { currentStock: { decrement: item.quantity } }
        });

        // Trigger notification if stock drops to or below alertLevel
        if (Number(rm.currentStock) <= Number(rm.alertLevel)) {
          await workflowNotifications.triggerRMLowStockAlert({
            rmId: rm.id,
            rmName: rm.name,
            currentStock: rm.currentStock,
            reorderLevel: rm.alertLevel
          });
        }
      }

      return newWaste;
    });

    res.status(201).json(waste);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// GET /api/rm-waste/:id
router.get('/rm-waste/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const waste = await prisma.rMWaste.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: { rawMaterial: true, uom: true }
        },
        responsibleUser: { select: { name: true, role: true } },
        creatorUser: { select: { name: true, role: true } }
      }
    });
    if (!waste) {
      return res.status(404).json({ error: 'RM Waste not found' });
    }
    res.json(waste);
  } catch (error) {
    next(error);
  }
});

// PUT /api/rm-waste/:id
router.put('/rm-waste/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.rMWaste.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!existing) {
      return res.status(404).json({ error: 'RM Waste not found' });
    }

    const parsedData = createRMWasteSchema.parse(req.body);

    const itemsWithResolvedUoms = await Promise.all(parsedData.items.map(async (item) => {
      const resolvedUomId = await resolveUomId(item.uomId);
      if (!resolvedUomId) {
        throw new z.ZodError([{ path: ['items', 'uomId'], message: `Invalid UOM provided: ${item.uomId}` }]);
      }
      return { ...item, uomId: resolvedUomId };
    }));

    const updatedWaste = await prisma.$transaction(async (tx) => {
      // Revert old stock
      for (const oldItem of existing.items) {
        await tx.rawMaterial.update({
          where: { id: oldItem.rawMaterialId },
          data: { currentStock: { increment: oldItem.quantity } }
        });
      }

      // Update waste
      const waste = await tx.rMWaste.update({
        where: { id },
        data: {
          date: new Date(parsedData.date),
          totalLoss: parsedData.totalLoss,
          note: parsedData.note,
          responsibleId: parsedData.responsibleId,
          items: {
            deleteMany: {},
            create: itemsWithResolvedUoms.map(item => ({
              rawMaterialId: item.rawMaterialId,
              quantity: item.quantity,
              uomId: item.uomId,
              lossAmount: item.lossAmount
            }))
          }
        },
        include: { items: true }
      });

      // Apply new stock
      for (const item of parsedData.items) {
        const rm = await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { currentStock: { decrement: item.quantity } }
        });
        
        if (Number(rm.currentStock) <= Number(rm.alertLevel)) {
          await workflowNotifications.triggerRMLowStockAlert?.({
            rmId: rm.id,
            rmName: rm.name,
            currentStock: rm.currentStock,
            reorderLevel: rm.alertLevel
          });
        }
      }

      return waste;
    });

    res.json(updatedWaste);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// DELETE /api/rm-waste/:id
router.delete('/rm-waste/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const existing = await prisma.rMWaste.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'RM Waste not found' });
    }
    
    await prisma.$transaction(async (tx) => {
      // Revert stock
      for (const item of existing.items) {
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { currentStock: { increment: item.quantity } }
        });
      }
      
      await tx.rMWaste.delete({
        where: { id: req.params.id }
      });
    });
    
    res.json({ message: 'RM Waste deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/rm-stock
router.get('/rm-stock', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']), async (req, res, next) => {
  try {
    // Disable HTTP caching — stock changes on every lab approval, 304s must never be served
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const rms = await prisma.rawMaterial.findMany({
      orderBy: { name: 'asc' },
    });
    
    // Map to required fields: SN, Code, Material Name, Available Quantity, Floating Stock, Rate Per Unit, Value
    const stock = rms.map(rm => {
      const qty = Number(rm.currentStock) || 0;
      const rate = Number(rm.ratePerUnit) || 0;
      return {
        id: rm.id,
        code: rm.code,
        name: rm.name,
        availableQuantity: qty,
        floatingStock: 0, // Mock for floating stock for now
        ratePerUnit: rate,
        value: qty * rate,
        unit: rm.unitId, // Used for display "Piece", "Yard"
        alertLevel: rm.alertLevel
      };
    });

    res.json(stock);
  } catch (error) {
    next(error);
  }
});

module.exports = router;