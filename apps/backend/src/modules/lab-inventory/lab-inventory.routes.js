const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// ─────────────────────── LAB INVENTORY ITEMS ───────────────────────

const labItemSchema = z.object({
  name: z.string().min(1),
  itemCategory: z.enum(['REAGENT', 'CHEMICAL', 'CONSUMABLE', 'EQUIPMENT', 'GLASSWARE', 'SAFETY']),
  quantityReceived: z.coerce.number().nonnegative(),
  uom: z.string().min(1),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().optional(),
  storageCondition: z.enum(['ROOM_TEMP', 'REFRIGERATED', 'FREEZER', 'FLAMMABLE']).optional(),
  minimumStockLevel: z.coerce.number().nonnegative().default(0),
  batchLotNumber: z.string().optional(),
});

// POST /api/lab-inventory — Add a new lab inventory item
router.post('/',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = labItemSchema.parse(req.body);

      const item = await prisma.labInventoryItem.create({
        data: {
          name: data.name,
          itemCategory: data.itemCategory,
          currentStock: data.quantityReceived,
          uom: data.uom,
          supplierName: data.supplierName || null,
          invoiceNumber: data.invoiceNumber || null,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          storageCondition: data.storageCondition || null,
          minimumStockLevel: data.minimumStockLevel,
          batchLotNumber: data.batchLotNumber || null,
          status: data.quantityReceived <= 0 ? 'CRITICAL' : data.quantityReceived <= data.minimumStockLevel ? 'LOW_STOCK' : 'SUFFICIENT',
          addedBy: req.user.id,
        },
        include: { adder: { select: { name: true } } },
      });

      // Audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATED',
          tableName: 'LabInventoryItem',
          recordId: item.id,
          oldValue: null,
          newValue: { name: item.name, currentStock: item.currentStock },
          ip: clientIp,
        },
      });

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// GET /api/lab-inventory — List all lab inventory items
router.get('/',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const { itemCategory, status } = req.query;
      const where = {};
      if (itemCategory) where.itemCategory = itemCategory;
      if (status) where.status = status;

      const items = await prisma.labInventoryItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { adder: { select: { name: true } } },
      });

      // Update status based on current stock vs minimum and expiry
      const now = new Date();
      const updatedItems = items.map(item => {
        let status = 'SUFFICIENT';
        if (item.expiryDate && new Date(item.expiryDate) <= now) {
          status = 'EXPIRED';
        } else if (Number(item.currentStock) <= 0) {
          status = 'CRITICAL';
        } else if (Number(item.currentStock) <= Number(item.minimumStockLevel)) {
          status = 'LOW_STOCK';
        }
        return { ...item, computedStatus: status };
      });

      res.json(updatedItems);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/lab-inventory/:id — Get single item
router.get('/:id',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const item = await prisma.labInventoryItem.findUnique({
        where: { id: req.params.id },
        include: {
          adder: { select: { name: true } },
          usages: {
            orderBy: { dateUsed: 'desc' },
            take: 20,
            include: { user: { select: { name: true } } },
          },
        },
      });
      if (!item) return res.status(404).json({ error: 'Lab inventory item not found' });
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// ─────────────────────── LAB INVENTORY USAGE ───────────────────────

const usageSchema = z.object({
  labTestId: z.string().uuid(),
  labItemId: z.string().uuid(),
  quantityUsed: z.coerce.number().positive(),
  dateUsed: z.string().optional(),
});

// POST /api/lab-inventory/use — Log usage of a lab item during a test
router.post('/use',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const data = usageSchema.parse(req.body);

      const labItem = await prisma.labInventoryItem.findUnique({ where: { id: data.labItemId } });
      if (!labItem) return res.status(404).json({ error: 'Lab inventory item not found' });
      if (Number(labItem.currentStock) < data.quantityUsed) {
        return res.status(409).json({ error: `Insufficient stock. Available: ${labItem.currentStock} ${labItem.uom}` });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Deduct stock
        const newStock = Number(labItem.currentStock) - data.quantityUsed;
        let newStatus = 'SUFFICIENT';
        if (newStock <= 0) newStatus = 'CRITICAL';
        else if (newStock <= Number(labItem.minimumStockLevel)) newStatus = 'LOW_STOCK';

        const updatedItem = await tx.labInventoryItem.update({
          where: { id: data.labItemId },
          data: { currentStock: newStock, status: newStatus },
        });

        // Create usage record
        const usage = await tx.labInventoryUsage.create({
          data: {
            labTestId: data.labTestId,
            labItemId: data.labItemId,
            quantityUsed: data.quantityUsed,
            dateUsed: data.dateUsed ? new Date(data.dateUsed) : new Date(),
            usedBy: req.user.id,
          },
          include: {
            labItem: true,
            user: { select: { name: true } },
          },
        });

        return { usage, updatedItem };
      });

      // Alert if low stock after deduction
      if (result.updatedItem.status === 'LOW_STOCK' || result.updatedItem.status === 'CRITICAL') {
        console.log(`[LAB INVENTORY ALERT] ${labItem.name} is now ${result.updatedItem.status}. Stock: ${result.updatedItem.currentStock} ${labItem.uom}`);
      }

      res.status(201).json(result.usage);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      next(error);
    }
  }
);

// GET /api/lab-inventory/usage — List all usage records
router.get('/usage',
  authenticateToken,
  roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT']),
  async (req, res, next) => {
    try {
      const { labTestId, labItemId } = req.query;
      const where = {};
      if (labTestId) where.labTestId = labTestId;
      if (labItemId) where.labItemId = labItemId;

      const usages = await prisma.labInventoryUsage.findMany({
        where,
        orderBy: { dateUsed: 'desc' },
        include: {
          labItem: { select: { name: true, uom: true } },
          user: { select: { name: true } },
        },
      });
      res.json(usages);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
