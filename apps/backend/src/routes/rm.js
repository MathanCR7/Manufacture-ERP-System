const express = require('express');
const { z } = require('zod');
const prisma = require('../database/prisma');
const authenticateToken = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { generateRmId } = require('../utils/rmIdGenerator');

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

// POST /api/rm/id/rotate
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
      }
    });

    const formattedPos = pos.map(po => ({
      id: po.id,
      rmId: po.rmId,
      name: po.name,
      quantity: po.quantity,
      amount: po.amount,
      uom: po.uom ? po.uom.name : null,
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

const createPOSchema = z.object({
  rmId: z.string().length(6),
  name: z.string().min(2),
  quantity: z.number().positive(),
  amount: z.number().positive(),
  uomId: z.string().uuid(),
  expectedDelivery: z.string().datetime(),
});

// POST /api/rm/po
router.post('/rm/po', authenticateToken, roleMiddleware(['PURCHASE_ACCOUNTANT', 'MAIN_MASTER']), async (req, res, next) => {
  try {
    const parsedData = createPOSchema.parse(req.body);
    
    // Check if ID exists
    const existingId = await prisma.idRegistry.findUnique({
      where: { id: parsedData.rmId }
    });

    if (existingId) {
      return res.status(409).json({ error: 'RM ID already exists' });
    }

    const createdPO = await prisma.$transaction(async (tx) => {
      // 1. Create IdRegistry
      await tx.idRegistry.create({
        data: {
          id: parsedData.rmId,
          status: 'ACTIVE',
          createdBy: req.user.id
        }
      });

      // 2. Create RawMaterialPO
      const po = await tx.rawMaterialPO.create({
        data: {
          rmId: parsedData.rmId,
          name: parsedData.name,
          quantity: parsedData.quantity,
          amount: parsedData.amount,
          uomId: parsedData.uomId,
          expectedDelivery: parsedData.expectedDelivery,
          status: 'PENDING',
          createdBy: req.user.id
        }
      });

      return po;
    });

    res.locals.recordId = createdPO.id;
    res.status(201).json(createdPO);
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

      await tx.idRegistry.update({
        where: { id: po.rmId },
        data: {
          status: 'DELETED'
        }
      });
    });

    res.json({ message: 'Purchase Order deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/uom
router.get('/uom', authenticateToken, async (req, res, next) => {
  try {
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

module.exports = router;
