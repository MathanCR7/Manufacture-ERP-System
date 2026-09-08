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
      items: po.items,
      paymentStatus: po.paymentStatus || 'UNPAID',
      paidAmount: parseFloat(po.paidAmount || 0)
    }));

    res.json(formattedPos);
  } catch (error) {
    next(error);
  }
};

const updatePOPaymentSchema = z.object({
  paymentStatus: z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID']),
  paidAmount: z.coerce.number().nonnegative().optional()
});

exports.updatePOPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paidAmount } = updatePOPaymentSchema.parse(req.body);

    const po = await prisma.rawMaterialPO.findUnique({ where: { id } });
    if (!po) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    const totalAmount = Number(po.grandTotal && Number(po.grandTotal) > 0 ? po.grandTotal : po.amount);
    let finalPaidAmount = paidAmount !== undefined ? Number(paidAmount) : Number(po.paidAmount || 0);

    if (paymentStatus === 'PAID') {
      finalPaidAmount = totalAmount;
    } else if (paymentStatus === 'UNPAID') {
      finalPaidAmount = 0;
    }

    const updated = await prisma.rawMaterialPO.update({
      where: { id },
      data: {
        paymentStatus,
        paidAmount: finalPaidAmount
      },
      include: {
        uom: true,
        supplier: true
      }
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
};

exports.getPOById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const po = await prisma.rawMaterialPO.findFirst({
      where: {
        OR: [
          { id },
          { referenceNo: id }
        ]
      },
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

exports.getMaterialHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rm = await prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        category: true,
        uoms: true
      }
    });

    if (!rm) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // 1. Fetch Purchase Orders (matching direct rmId, code, name or in items JSON)
    const directPOs = await prisma.rawMaterialPO.findMany({
      where: {
        status: { not: 'DELETED' },
        OR: [
          { rmId: rm.code },
          { rmId: rm.id },
          { name: { equals: rm.name, mode: 'insensitive' } }
        ]
      },
      include: {
        supplier: true,
        uom: true,
        user: { select: { id: true, name: true, email: true } },
        grnReceives: {
          include: {
            receiver: { select: { id: true, name: true } },
            labTest: {
              include: {
                tester: { select: { id: true, name: true } },
                testResults: true
              }
            },
            inventoryBatch: {
              include: {
                uom: true,
                adder: { select: { id: true, name: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const multiItemPOs = await prisma.rawMaterialPO.findMany({
      where: {
        status: { not: 'DELETED' },
        items: { not: null },
        id: { notIn: directPOs.map(p => p.id) }
      },
      include: {
        supplier: true,
        uom: true,
        user: { select: { id: true, name: true, email: true } },
        grnReceives: {
          include: {
            receiver: { select: { id: true, name: true } },
            labTest: {
              include: {
                tester: { select: { id: true, name: true } },
                testResults: true
              }
            },
            inventoryBatch: {
              include: {
                uom: true,
                adder: { select: { id: true, name: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const matchedMultiItemPOs = multiItemPOs.filter(po => {
      if (Array.isArray(po.items)) {
        return po.items.some(item =>
          item.id === rm.id ||
          item.rmId === rm.code ||
          (item.name && item.name.toLowerCase() === rm.name.toLowerCase())
        );
      }
      return false;
    });

    const allMatchedPOs = [...directPOs, ...matchedMultiItemPOs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const formattedPurchases = allMatchedPOs.map(po => {
      let specificItem = null;
      if (Array.isArray(po.items)) {
        specificItem = po.items.find(item =>
          item.id === rm.id ||
          item.rmId === rm.code ||
          (item.name && item.name.toLowerCase() === rm.name.toLowerCase())
        );
      }

      const orderedQty = specificItem ? Number(specificItem.quantity || 0) : Number(po.quantity || 0);
      const unitPrice = specificItem ? Number(specificItem.unitPrice || 0) : (Number(po.quantity) > 0 ? Number(po.amount) / Number(po.quantity) : Number(po.amount || 0));
      const itemTotal = specificItem ? (Number(specificItem.total) || (orderedQty * unitPrice)) : Number(po.amount || 0);

      return {
        id: po.id,
        referenceNo: po.referenceNo || 'N/A',
        orderDate: po.createdAt,
        expectedDelivery: po.expectedDelivery,
        supplierId: po.supplierId,
        supplierName: po.supplier ? po.supplier.name : 'Unknown Supplier',
        supplierContact: po.supplier ? (po.supplier.phone || po.supplier.email) : null,
        status: po.status,
        paymentStatus: po.paymentStatus || 'UNPAID',
        paidAmount: Number(po.paidAmount || 0),
        grandTotal: Number(po.grandTotal || po.amount || 0),
        orderedQty,
        unitPrice,
        itemTotal,
        uom: specificItem?.uomLabel || (po.uom ? (po.uom.abbreviation || po.uom.name) : rm.unitId),
        createdBy: po.user ? po.user.name : null,
        grnCount: po.grnReceives?.length || 0
      };
    });

    // 2. Fetch GRN Receipts
    const grnItems = await prisma.gRNReceiveItem.findMany({
      where: {
        OR: [
          { rmId: rm.id },
          { rmId: rm.code },
          { rmName: { equals: rm.name, mode: 'insensitive' } }
        ]
      },
      include: {
        grn: {
          include: {
            po: {
              include: {
                supplier: true
              }
            },
            receiver: { select: { id: true, name: true, email: true } },
            labTest: {
              include: {
                tester: { select: { id: true, name: true } },
                testResults: true
              }
            },
            inventoryBatch: {
              include: {
                uom: true,
                adder: { select: { id: true, name: true } }
              }
            }
          }
        },
        labResults: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedGRN = grnItems.map(item => {
      const grn = item.grn;
      const lab = grn?.labTest;
      const batch = grn?.inventoryBatch;
      return {
        id: item.id,
        grnId: grn?.id,
        referenceNo: grn?.referenceNo || 'N/A',
        receivedDate: grn?.receivedDate || item.createdAt,
        poId: grn?.poId,
        poReferenceNo: grn?.po?.referenceNo || 'N/A',
        supplierName: grn?.po?.supplier?.name || 'N/A',
        expectedQty: Number(item.expectedQty || 0),
        actualReceivedQty: Number(item.actualReceivedQty || 0),
        returnQty: Number(item.returnQty || 0),
        discrepancyNotes: grn?.discrepancyNotes,
        vehicleNumber: grn?.vehicleNumber,
        driverName: grn?.driverName,
        challanNumber: grn?.challanNumber,
        invoiceNumber: grn?.invoiceNumber,
        invoiceDate: grn?.invoiceDate,
        isShortDelivery: grn?.isShortDelivery || false,
        inventoryStatus: grn?.inventoryStatus || 'NOT_UPLOADED',
        grnStatus: grn?.status || 'PENDING_LAB',
        receivedByName: grn?.receiver?.name || 'Gate Officer',
        batch: batch ? {
          id: batch.id,
          batchNumber: batch.batchNumber,
          netQty: Number(batch.netQty || 0),
          sampleQty: Number(batch.sampleQty || 0),
          storageLocation: batch.storageLocation || 'Main Warehouse',
          expiryDate: batch.expiryDate,
          status: batch.status,
          addedByName: batch.adder?.name || 'Inventory Officer',
          createdAt: batch.createdAt
        } : null,
        labTest: lab ? {
          id: lab.id,
          overallDecision: lab.overallDecision || 'PENDING',
          status: lab.status,
          testedByName: lab.tester?.name || 'Lab Staff',
          testedAt: lab.createdAt,
          sampleQty: Number(lab.sampleQty || 0),
          labNotes: lab.labNotes,
          overrideReason: lab.overrideReason
        } : null
      };
    });

    // 3. Fetch Inventory Batches
    const batches = await prisma.inventoryBatch.findMany({
      where: {
        OR: [
          { rawMaterialId: rm.id },
          { rawMaterialName: { equals: rm.name, mode: 'insensitive' } }
        ]
      },
      include: {
        po: { include: { supplier: true } },
        grn: { include: { receiver: { select: { name: true } } } },
        uom: true,
        adder: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedBatches = batches.map(b => ({
      id: b.id,
      batchNumber: b.batchNumber,
      poId: b.poId || b.po?.id,
      grnId: b.grnId || b.grn?.id,
      poReferenceNo: b.po?.referenceNo || 'N/A',
      grnReferenceNo: b.grn?.referenceNo || 'N/A',
      supplierName: b.po?.supplier?.name || 'N/A',
      receivedQty: Number(b.receivedQty || 0),
      sampleQty: Number(b.sampleQty || 0),
      netQty: Number(b.netQty || 0),
      uom: b.uom ? (b.uom.abbreviation || b.uom.name) : rm.unitId,
      storageLocation: b.storageLocation || 'Main RM Warehouse',
      expiryDate: b.expiryDate,
      status: b.status,
      addedByName: b.adder?.name || 'Inventory Team',
      createdAt: b.createdAt
    }));

    // 4. Fetch QC & Lab Test Reports
    const labResults = await prisma.gRNLabTestResult.findMany({
      where: {
        OR: [
          { rmId: rm.id },
          { rmId: rm.code },
          { rmName: { equals: rm.name, mode: 'insensitive' } }
        ]
      },
      include: {
        labTest: {
          include: {
            tester: { select: { name: true, email: true } },
            grn: {
              include: {
                po: { include: { supplier: true } }
              }
            }
          }
        },
        grnItem: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedLabReports = labResults.map(lr => {
      const lt = lr.labTest;
      return {
        id: lr.id,
        labTestId: lt?.id,
        grnId: lt?.grn?.id,
        poId: lt?.grn?.poId,
        grnReferenceNo: lt?.grn?.referenceNo || 'N/A',
        poReferenceNo: lt?.grn?.po?.referenceNo || 'N/A',
        supplierName: lt?.grn?.po?.supplier?.name || 'N/A',
        testDate: lt?.createdAt || lr.createdAt,
        passed: lr.passed,
        overallDecision: lt?.overallDecision || (lr.passed ? 'APPROVED' : 'REJECTED'),
        status: lt?.status || 'COMPLETED',
        testedByName: lt?.tester?.name || 'Lab Assistant',
        sampleQty: Number(lt?.sampleQty || 0),
        expiryDate: lr.expiryDate,
        testNotes: lr.testNotes || lt?.labNotes || null,
        overrideReason: lt?.overrideReason || null,
        categoryParams: lr.categoryParams || lt?.categoryParams || null
      };
    });

    // 5. Fetch Stock Adjustments
    const adjustments = await prisma.rMStockAdjustment.findMany({
      where: { rawMaterialId: rm.id },
      include: {
        user: { select: { name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedAdjustments = adjustments.map(a => ({
      id: a.id,
      type: a.type,
      quantity: Number(a.quantity || 0),
      notes: a.notes || 'No reason provided',
      createdAt: a.createdAt,
      userName: a.user?.name || 'Supervisor',
      userRole: a.user?.role || 'SUPERVISOR'
    }));

    // 6. Fetch RM Wastage
    const wasteItems = await prisma.rMWasteItem.findMany({
      where: { rawMaterialId: rm.id },
      include: {
        waste: {
          include: {
            responsibleUser: { select: { name: true, role: true } },
            creatorUser: { select: { name: true, role: true } }
          }
        },
        uom: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedWaste = wasteItems.map(wi => ({
      id: wi.id,
      wasteId: wi.wasteId,
      referenceNo: wi.waste?.referenceNo || 'N/A',
      date: wi.waste?.date || wi.createdAt,
      quantity: Number(wi.quantity || 0),
      uom: wi.uom ? (wi.uom.abbreviation || wi.uom.name) : rm.unitId,
      lossAmount: Number(wi.lossAmount || 0),
      notes: wi.waste?.note || 'No reason specified',
      responsiblePerson: wi.waste?.responsibleUser?.name || 'N/A',
      createdBy: wi.waste?.creatorUser?.name || 'Staff',
      createdAt: wi.createdAt
    }));

    // 7. Fetch Production Usages
    const usages = await prisma.productionBatchRMUsage.findMany({
      where: { rmId: rm.id },
      include: {
        batch: {
          include: {
            product: true
          }
        }
      },
      orderBy: { batch: { createdAt: 'desc' } }
    });

    const formattedUsages = usages.map(u => {
      const batchNoStr = u.batch?.batchNo || u.batch?.referenceNo || 'N/A';
      const prodNameStr = u.batch?.product?.name 
        ? `${u.batch.product.name}${u.batch.product.code ? ` (${u.batch.product.code})` : ''}` 
        : 'Finished Product';

      return {
        id: u.id,
        batchId: u.batchId,
        batchNumber: batchNoStr,
        batchReferenceNo: u.batch?.referenceNo || 'N/A',
        batchNo: u.batch?.batchNo || null,
        productName: prodNameStr,
        productOnlyName: u.batch?.product?.name || 'Finished Product',
        productCode: u.batch?.product?.code || '',
        batchStatus: u.batch?.status || 'COMPLETED',
        requiredQty: Number(u.requiredQty || 0),
        availableQtyAtTime: Number(u.availableQtyAtTime || 0),
        actualUsedQty: Number(u.actualUsedQty || 0),
        unitCost: Number(u.unitCost || 0),
        totalCost: Number(u.totalCost || 0),
        usageStatus: u.status,
        date: u.batch?.startDate || u.batch?.createdAt || new Date()
      };
    });

    // 8. Fetch Purchase Returns
    const poIds = formattedPurchases.map(p => p.id);
    const grnIds = formattedGRN.map(g => g.grnId).filter(Boolean);

    const returns = (poIds.length > 0 || grnIds.length > 0) ? await prisma.purchaseReturn.findMany({
      where: {
        OR: [
          { poId: { in: poIds } },
          { grnId: { in: grnIds } }
        ]
      },
      include: {
        po: { include: { supplier: true } },
        grn: true,
        creator: { select: { name: true } },
        responsibleUser: { select: { name: true } }
      },
      orderBy: { returnDate: 'desc' }
    }) : [];

    const formattedReturns = returns.map(r => ({
      id: r.id,
      referenceNo: r.referenceNo,
      returnDate: r.returnDate,
      returnQty: Number(r.returnQty || 0),
      returnReason: r.returnReason,
      reasonDescription: r.reasonDescription,
      poId: r.poId,
      grnId: r.grnId,
      supplierName: r.po?.supplier?.name || 'N/A',
      poReferenceNo: r.po?.referenceNo || 'N/A',
      grnReferenceNo: r.grn?.referenceNo || 'N/A',
      status: r.status,
      initiatedBy: r.initiatedBy,
      createdByName: r.creator?.name || 'Staff'
    }));

    // 9. Calculate Aggregate Metrics
    const currentStock = Number(rm.currentStock || 0);
    const ratePerUnit = Number(rm.ratePerUnit || 0);
    const alertLevel = Number(rm.alertLevel || 0);

    const totalPurchasedQty = formattedPurchases.reduce((acc, p) => acc + p.orderedQty, 0);
    const totalPurchasedValue = formattedPurchases.reduce((acc, p) => acc + (p.itemTotal || 0), 0);
    const totalInwardedQty = formattedGRN.reduce((acc, g) => acc + g.actualReceivedQty, 0);
    const totalConsumedQty = formattedUsages.reduce((acc, u) => acc + u.actualUsedQty, 0);
    const totalConsumedCost = formattedUsages.reduce((acc, u) => acc + u.totalCost, 0);

    const totalAdjustmentAddition = formattedAdjustments
      .filter(a => a.type === 'ADDITION')
      .reduce((acc, a) => acc + a.quantity, 0);
    const totalAdjustmentSubtraction = formattedAdjustments
      .filter(a => a.type === 'SUBTRACTION')
      .reduce((acc, a) => acc + a.quantity, 0);
    const netAdjustedQty = totalAdjustmentAddition - totalAdjustmentSubtraction;

    const totalWastedQty = formattedWaste.reduce((acc, w) => acc + w.quantity, 0);
    const totalWastedLoss = formattedWaste.reduce((acc, w) => acc + w.lossAmount, 0);

    const stockHealth = currentStock <= 0 ? 'CRITICAL' : (currentStock <= alertLevel ? 'LOW' : 'OPTIMAL');

    const hasHistory = (
      formattedPurchases.length > 0 ||
      formattedGRN.length > 0 ||
      formattedBatches.length > 0 ||
      formattedLabReports.length > 0 ||
      formattedAdjustments.length > 0 ||
      formattedWaste.length > 0 ||
      formattedUsages.length > 0 ||
      formattedReturns.length > 0
    );

    // 10. Generate Unified Chronological Timeline
    const timelineEvents = [];

    formattedPurchases.forEach(p => {
      timelineEvents.push({
        id: `po-${p.id}`,
        type: 'PURCHASE_ORDER',
        title: `PO Created: ${p.referenceNo}`,
        subtitle: `Supplier: ${p.supplierName} • Qty: ${p.orderedQty} ${p.uom}`,
        timestamp: p.orderDate,
        status: p.status,
        badgeColor: 'blue',
        user: p.createdBy,
        metadata: {
          poId: p.id,
          referenceNo: p.referenceNo,
          orderedQty: p.orderedQty,
          rate: p.unitPrice,
          total: p.itemTotal,
          paymentStatus: p.paymentStatus
        }
      });
    });

    formattedGRN.forEach(g => {
      timelineEvents.push({
        id: `grn-${g.id}`,
        type: 'GRN_RECEIVE',
        title: `GRN Received: ${g.referenceNo}`,
        subtitle: `Received: ${g.actualReceivedQty} ${rm.unitId} • PO: ${g.poReferenceNo}`,
        timestamp: g.receivedDate,
        status: g.grnStatus,
        badgeColor: 'teal',
        user: g.receivedByName,
        metadata: {
          grnId: g.grnId || g.id,
          poId: g.poId,
          referenceNo: g.referenceNo,
          poReferenceNo: g.poReferenceNo,
          challan: g.challanNumber,
          vehicle: g.vehicleNumber,
          supplier: g.supplierName
        }
      });
    });

    formattedBatches.forEach(b => {
      timelineEvents.push({
        id: `batch-${b.id}`,
        type: 'INVENTORY_BATCH',
        title: `Batch Stored: ${b.batchNumber}`,
        subtitle: `Net Qty: ${b.netQty} ${b.uom} • Location: ${b.storageLocation}`,
        timestamp: b.createdAt,
        status: b.status,
        badgeColor: 'emerald',
        user: b.addedByName,
        metadata: {
          batchId: b.id,
          batchNumber: b.batchNumber,
          grnId: b.grnId,
          storageLocation: b.storageLocation,
          expiryDate: b.expiryDate
        }
      });
    });

    formattedLabReports.forEach(l => {
      timelineEvents.push({
        id: `lab-${l.id}`,
        type: 'LAB_QC',
        title: `QC Inspection: ${l.overallDecision}`,
        subtitle: `GRN: ${l.grnReferenceNo} • Tested by: ${l.testedByName}`,
        timestamp: l.testDate,
        status: l.overallDecision,
        badgeColor: l.overallDecision === 'APPROVED' ? 'emerald' : (l.overallDecision === 'REJECTED' ? 'rose' : 'amber'),
        user: l.testedByName,
        metadata: {
          labTestId: l.labTestId,
          grnId: l.grnId,
          grnReferenceNo: l.grnReferenceNo,
          notes: l.testNotes,
          sampleQty: l.sampleQty
        }
      });
    });

    formattedAdjustments.forEach(a => {
      const isAdd = a.type === 'ADDITION';
      timelineEvents.push({
        id: `adj-${a.id}`,
        type: 'STOCK_ADJUSTMENT',
        title: `Stock ${isAdd ? 'Addition (+)' : 'Subtraction (-)'}: ${a.quantity} ${rm.unitId}`,
        subtitle: `Reason: ${a.notes}`,
        timestamp: a.createdAt,
        status: a.type,
        badgeColor: isAdd ? 'cyan' : 'amber',
        user: `${a.userName} (${a.userRole})`,
        metadata: {
          notes: a.notes
        }
      });
    });

    formattedWaste.forEach(w => {
      timelineEvents.push({
        id: `waste-${w.id}`,
        type: 'RM_WASTE',
        title: `Wastage Recorded: ${w.quantity} ${w.uom}`,
        subtitle: `Loss: ₹${w.lossAmount.toLocaleString('en-IN')} • Ref: ${w.referenceNo}`,
        timestamp: w.date,
        status: 'WASTED',
        badgeColor: 'rose',
        user: w.responsiblePerson,
        metadata: {
          wasteId: w.wasteId,
          referenceNo: w.referenceNo,
          notes: w.notes,
          lossAmount: w.lossAmount
        }
      });
    });

    formattedUsages.forEach(u => {
      timelineEvents.push({
        id: `usage-${u.id}`,
        type: 'PRODUCTION_USAGE',
        title: `Consumed in Production: ${u.actualUsedQty} ${rm.unitId}`,
        subtitle: `Batch: ${u.batchNumber} • ${u.productName}`,
        timestamp: u.date,
        status: u.usageStatus,
        badgeColor: 'indigo',
        user: 'Production System',
        metadata: {
          batchId: u.batchId,
          batchNumber: u.batchNumber,
          productName: u.productName,
          totalCost: u.totalCost
        }
      });
    });

    formattedReturns.forEach(r => {
      timelineEvents.push({
        id: `return-${r.id}`,
        type: 'PURCHASE_RETURN',
        title: `Purchase Return: ${r.returnQty} ${rm.unitId}`,
        subtitle: `Reason: ${r.returnReason} • Ref: ${r.referenceNo}`,
        timestamp: r.returnDate,
        status: r.status,
        badgeColor: 'red',
        user: r.createdByName,
        metadata: {
          returnId: r.id,
          poId: r.poId,
          grnId: r.grnId,
          referenceNo: r.referenceNo,
          supplier: r.supplierName,
          reason: r.reasonDescription
        }
      });
    });

    // Sort timeline descending
    timelineEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      material: {
        id: rm.id,
        name: rm.name,
        code: rm.code,
        category: rm.category?.name || 'General',
        unit: rm.unitId,
        currentStock,
        ratePerUnit,
        stockValue: currentStock * ratePerUnit,
        alertLevel,
        stockHealth,
        description: rm.description
      },
      summary: {
        hasHistory,
        currentStock,
        stockHealth,
        totalPurchasedQty,
        totalPurchasedValue,
        totalInwardedQty,
        totalConsumedQty,
        totalConsumedCost,
        totalAdjustmentAddition,
        totalAdjustmentSubtraction,
        netAdjustedQty,
        totalWastedQty,
        totalWastedLoss
      },
      timeline: timelineEvents,
      purchases: formattedPurchases,
      grnReceipts: formattedGRN,
      batches: formattedBatches,
      labReports: formattedLabReports,
      stockAdjustments: formattedAdjustments,
      wasteRecords: formattedWaste,
      productionUsages: formattedUsages,
      purchaseReturns: formattedReturns
    });
  } catch (error) {
    next(error);
  }
};
