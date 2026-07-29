const { z } = require('zod');
const prisma = require('../../database/prisma');
const { generateRmId } = require('../../utils/rmIdGenerator');
const { generateReferenceNo } = require('../../utils/referenceGenerator');
const workflowNotifications = require('../notifications/workflow.notifications');

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

exports.generateRmId = async (req, res, next) => {
  try {
    const candidateId = await generateRmId(prisma);
    res.json({ candidateId });
  } catch (error) {
    next(error);
  }
};

exports.rotateRmId = async (req, res, next) => {
  try {
    const candidateId = await generateRmId(prisma);
    res.json({ candidateId });
  } catch (error) {
    next(error);
  }
};

exports.getPOs = async (req, res, next) => {
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
      uom: po.uom ? (po.uom.abbreviation || po.uom.name) : null,
      supplierName: po.supplier ? po.supplier.name : null,
      expectedDelivery: po.expectedDelivery,
      status: po.status,
      createdAt: po.createdAt,
      subtotal: po.subtotal,
      orderTax: po.orderTax,
      discount: po.discount,
      shipping: po.shipping,
      otherCharges: po.otherCharges,
      cgst: po.cgst,
      sgst: po.sgst,
      igst: po.igst,
      grandTotal: po.grandTotal,
      items: po.items
    }));

    res.json(formattedPos);
  } catch (error) {
    next(error);
  }
};

exports.getPOById = async (req, res, next) => {
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
};

const createPOSchema = z.object({
  rmId: z.string().trim().min(1).max(20, "RM ID cannot exceed 20 characters"), 
  name: z.string().min(2),
  quantity: z.coerce.number().positive(),
  amount: z.coerce.number().positive(),
  uomId: z.string().min(1),
  expectedDelivery: z.string().min(1),
  supplierId: z.string().uuid().optional(),
  
  // Financial details
  subtotal: z.coerce.number().optional(),
  orderTax: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  shipping: z.coerce.number().optional(),
  otherCharges: z.coerce.number().optional(),
  cgst: z.coerce.number().optional(),
  sgst: z.coerce.number().optional(),
  igst: z.coerce.number().optional(),
  grandTotal: z.coerce.number().optional(),
  items: z.any().optional(),
  quotationId: z.string().nullable().optional(),
});

exports.createPO = async (req, res, next) => {
  try {
    const parsedData = createPOSchema.parse(req.body);
    const resolvedUomId = await resolveUomId(parsedData.uomId);
    
    if (!resolvedUomId) {
      return res.status(400).json({ error: 'Invalid UOM provided' });
    }
    
    const referenceNo = await generateReferenceNo(prisma, 'RawMaterialPO', 'PO');

    const createdPO = await prisma.$transaction(async (tx) => {
      await tx.idRegistry.upsert({
        where: { id: parsedData.rmId },
        update: { status: 'ACTIVE' },
        create: {
          id: parsedData.rmId,
          status: 'ACTIVE',
          createdBy: req.user.id
        }
      });

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
          createdBy: req.user.id,
          subtotal: parsedData.subtotal || 0,
          orderTax: parsedData.orderTax || 0,
          discount: parsedData.discount || 0,
          shipping: parsedData.shipping || 0,
          otherCharges: parsedData.otherCharges || 0,
          cgst: parsedData.cgst || 0,
          sgst: parsedData.sgst || 0,
          igst: parsedData.igst || 0,
          grandTotal: parsedData.grandTotal || 0,
          items: parsedData.items || null,
        }
      });

      // If created from an RM Quotation, mark quotation status as CONVERTED and prevent duplicate conversions
      if (parsedData.quotationId) {
        const existingQuote = await tx.rMQuotation.findUnique({
          where: { id: parsedData.quotationId }
        });

        if (existingQuote && existingQuote.status === 'CONVERTED') {
          const err = new Error('This quotation has already been converted into a Purchase Order.');
          err.statusCode = 409;
          throw err;
        }

        await tx.rMQuotation.update({
          where: { id: parsedData.quotationId },
          data: { status: 'CONVERTED' }
        });
      }

      return po;
    });

    const actualUom = await prisma.uOM.findUnique({ where: { id: resolvedUomId } });

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
    if (error.code === 'P2000') {
        return res.status(400).json({ error: "Value too long for database. Check RM ID length." });
    }
    if (error.code === 'P2002') {
        return res.status(409).json({ error: "A unique constraint failed (likely rmId unique constraint in PO table). Remove @unique from rmId in schema." });
    }
    next(error);
  }
};

const updatePOSchema = z.object({
  name: z.string().min(2).optional(),
  quantity: z.coerce.number().positive().optional(),
  amount: z.coerce.number().positive().optional(),
  uomId: z.string().min(1).optional(),
  expectedDelivery: z.string().min(1).optional(),
  supplierId: z.string().uuid().nullable().optional(),
  
  // Financial details
  subtotal: z.coerce.number().optional(),
  orderTax: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  shipping: z.coerce.number().optional(),
  otherCharges: z.coerce.number().optional(),
  cgst: z.coerce.number().optional(),
  sgst: z.coerce.number().optional(),
  igst: z.coerce.number().optional(),
  grandTotal: z.coerce.number().optional(),
  items: z.any().optional(),
});

exports.updatePO = async (req, res, next) => {
  try {
    const { id } = req.params;

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

    if (req.user.role === 'PURCHASE_ACCOUNTANT' && existing.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own purchase orders.' });
    }

    const parsedData = updatePOSchema.parse(req.body);

    let resolvedUomId = existing.uomId;
    if (parsedData.uomId) {
      resolvedUomId = await resolveUomId(parsedData.uomId);
      if (!resolvedUomId) {
        return res.status(400).json({ error: 'Invalid UOM provided' });
      }
    }

    const updateData = {};
    if (parsedData.name !== undefined) updateData.name = parsedData.name;
    if (parsedData.quantity !== undefined) updateData.quantity = parsedData.quantity;
    if (parsedData.amount !== undefined) updateData.amount = parsedData.amount;
    if (parsedData.expectedDelivery !== undefined) updateData.expectedDelivery = new Date(parsedData.expectedDelivery);
    if (parsedData.supplierId !== undefined) updateData.supplierId = parsedData.supplierId || null;
    if (parsedData.uomId !== undefined) updateData.uomId = resolvedUomId;
    if (parsedData.subtotal !== undefined) updateData.subtotal = parsedData.subtotal;
    if (parsedData.orderTax !== undefined) updateData.orderTax = parsedData.orderTax;
    if (parsedData.discount !== undefined) updateData.discount = parsedData.discount;
    if (parsedData.shipping !== undefined) updateData.shipping = parsedData.shipping;
    if (parsedData.otherCharges !== undefined) updateData.otherCharges = parsedData.otherCharges;
    if (parsedData.cgst !== undefined) updateData.cgst = parsedData.cgst;
    if (parsedData.sgst !== undefined) updateData.sgst = parsedData.sgst;
    if (parsedData.igst !== undefined) updateData.igst = parsedData.igst;
    if (parsedData.grandTotal !== undefined) updateData.grandTotal = parsedData.grandTotal;
    if (parsedData.items !== undefined) updateData.items = parsedData.items;

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

    const updatedPO = await prisma.rawMaterialPO.update({
      where: { id },
      data: updateData,
      include: {
        uom: true,
        supplier: true,
        user: { select: { name: true, email: true, role: true } }
      }
    });

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
};

exports.deletePO = async (req, res, next) => {
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

    try {
      await workflowNotifications.triggerPOCancelled({
        poId: po.id,
        rmId: po.rmId,
        rmName: po.name,
        cancelReason: 'Cancelled by user', 
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
};

exports.getUOMs = async (req, res, next) => {
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
};

const createUOMSchema = z.object({
  name: z.string().min(2),
  abbreviation: z.string().min(1),
});

exports.createUOM = async (req, res, next) => {
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
};

exports.generateWasteReference = async (req, res, next) => {
  try {
    const candidateId = await generateReferenceNo(prisma, 'RMWaste', 'RMW');
    res.json({ candidateId });
  } catch (error) {
    next(error);
  }
};

exports.getWastes = async (req, res, next) => {
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
};

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

exports.createWaste = async (req, res, next) => {
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

      for (const item of parsedData.items) {
        const rm = await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: { currentStock: { decrement: item.quantity } }
        });

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
};

exports.getWasteById = async (req, res, next) => {
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
};

exports.updateWaste = async (req, res, next) => {
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
      for (const oldItem of existing.items) {
        await tx.rawMaterial.update({
          where: { id: oldItem.rawMaterialId },
          data: { currentStock: { increment: oldItem.quantity } }
        });
      }

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
};

exports.deleteWaste = async (req, res, next) => {
  try {
    const existing = await prisma.rMWaste.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'RM Waste not found' });
    }
    
    await prisma.$transaction(async (tx) => {
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
};

exports.getStock = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const rms = await prisma.rawMaterial.findMany({
      orderBy: { name: 'asc' },
    });
    
    const stock = rms.map(rm => {
      const qty = Number(rm.currentStock) || 0;
      const rate = Number(rm.ratePerUnit) || 0;
      return {
        id: rm.id,
        code: rm.code,
        name: rm.name,
        availableQuantity: qty,
        floatingStock: 0,
        ratePerUnit: rate,
        value: qty * rate,
        unit: rm.unitId,
        alertLevel: rm.alertLevel
      };
    });

    res.json(stock);
  } catch (error) {
    next(error);
  }
};
