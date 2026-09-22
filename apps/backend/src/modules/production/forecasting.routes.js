const express = require('express');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const forecastingController = require('./forecasting.controller');

const router = express.Router();

const { extractERPPayload } = require('./forecastDataExtractor');
const forecastAIService = require('./forecastAIService');
const { getLiveHolidays } = require('./liveHolidayService');

// GET /api/forecasting/comprehensive - Multi-Domain Predictive Forecasting
router.get('/comprehensive', authenticateToken, (req, res, next) => {
  forecastingController.getComprehensiveForecast(req, res, next);
});

// POST /api/forecasting/what-if - Dynamic Scenario Simulation
router.post('/what-if', authenticateToken, (req, res, next) => {
  forecastingController.simulateWhatIf(req, res, next);
});

// GET /api/forecasting/payload - Extract live Section 3 Payload from PostgreSQL
router.get('/payload', authenticateToken, async (req, res, next) => {
  try {
    const payload = await extractERPPayload(req.query);
    res.json({ success: true, payload });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/ai-predict - Execute Master Prompt via AI or Quantitative Engine
router.post('/ai-predict', authenticateToken, async (req, res, next) => {
  try {
    let payload = req.body?.payload;
    if (!payload) {
      payload = await extractERPPayload(req.body);
    }
    const result = await forecastAIService.runForecastingPrompt(payload, {
      apiKey: req.body?.apiKey || req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY,
      horizonDays: req.body?.horizonDays || 30
    });
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasting/prompt - Return exact Master System Prompt
router.get('/prompt', authenticateToken, (req, res) => {
  res.json({
    success: true,
    prompt: forecastAIService.getMasterPrompt()
  });
});

// ============================================================================
// CALENDAR EVENTS & HOLIDAYS (PostgreSQL Database Persisted)
// ============================================================================

// GET /api/forecasting/calendar/events - Fetch events from PostgreSQL filtered by user role visibility
router.get('/calendar/events', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const allEvents = await prisma.$queryRawUnsafe(
      `SELECT id, title, date, time, priority, note, notified, 
              "createdBy", "creatorName", "creatorRole", "allowedRoles", 
              "createdAt", "updatedAt" 
       FROM "OperationsCalendarEvent" 
       ORDER BY date ASC, time ASC`
    );

    // Visibility filtering:
    // MAIN_MASTER / ADMIN can see all events
    // Other roles can see events if:
    // 1. createdBy === userId
    // 2. allowedRoles includes 'ALL' or is empty/null
    // 3. allowedRoles includes user's role
    const filteredEvents = allEvents.filter(ev => {
      if (!userRole || userRole === 'MAIN_MASTER' || userRole === 'ADMIN') return true;
      if (ev.createdBy === userId) return true;
      
      let roles = ev.allowedRoles;
      if (typeof roles === 'string') {
        try { roles = JSON.parse(roles); } catch { roles = ['ALL']; }
      }
      if (!Array.isArray(roles) || roles.length === 0 || roles.includes('ALL')) return true;
      return roles.includes(userRole);
    });

    res.json({ success: true, events: filteredEvents });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/calendar/events - Add event with user details and role visibility
router.post('/calendar/events', authenticateToken, async (req, res, next) => {
  try {
    const { id, title, date, time, priority, note, allowedRoles } = req.body;
    const eventId = id || `ue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const eventTitle = title || 'Scheduled Event';
    const eventDate = date;
    const eventTime = time || null;
    const eventPriority = priority || 'Medium';
    const eventNote = note || '';
    const userId = req.user?.id || 'system';
    const creatorName = req.user?.name || req.user?.email || 'System User';
    const creatorRole = req.user?.role || 'SUPERVISOR';
    const rolesList = Array.isArray(allowedRoles) && allowedRoles.length > 0 ? allowedRoles : ['ALL'];
    const rolesJson = JSON.stringify(rolesList);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "OperationsCalendarEvent" 
       (id, title, date, time, priority, note, notified, "createdBy", "creatorName", "creatorRole", "allowedRoles", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET 
         title = $2, date = $3, time = $4, priority = $5, note = $6, 
         "creatorName" = $8, "creatorRole" = $9, "allowedRoles" = $10::jsonb, "updatedAt" = CURRENT_TIMESTAMP`,
      eventId, eventTitle, eventDate, eventTime, eventPriority, eventNote, userId, creatorName, creatorRole, rolesJson
    );

    res.json({
      success: true,
      event: {
        id: eventId,
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        priority: eventPriority,
        note: eventNote,
        allowedRoles: rolesList,
        createdBy: userId,
        creatorName,
        creatorRole,
        notified: false
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/forecasting/calendar/events/:id - Update event with role visibility
router.put('/calendar/events/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, date, time, priority, note, allowedRoles } = req.body;
    const rolesList = Array.isArray(allowedRoles) && allowedRoles.length > 0 ? allowedRoles : ['ALL'];
    const rolesJson = JSON.stringify(rolesList);

    await prisma.$executeRawUnsafe(
      `UPDATE "OperationsCalendarEvent"
       SET title = $1, date = $2, time = $3, priority = $4, note = $5, "allowedRoles" = $6::jsonb, notified = false, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $7`,
      title, date, time || null, priority || 'Medium', note || '', rolesJson, id
    );

    res.json({ success: true, message: 'Event updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/forecasting/calendar/events/:id - Remove event from PostgreSQL
router.delete('/calendar/events/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.$executeRawUnsafe('DELETE FROM "OperationsCalendarEvent" WHERE id = $1', id);
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasting/calendar/holidays - Live Official Gazette Holidays from Real-Time Public Feeds
router.get('/calendar/holidays', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || 2026;
    const forceRefresh = req.query.refresh === 'true';
    const result = await getLiveHolidays(year, forceRefresh);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Helper to compute current stock for a product, taking openingStock into account
const getProductStock = async (productId) => {
  const product = await prisma.finishedProduct.findUnique({
    where: { id: productId }
  });
  if (!product) return 0;

  const sumIn = await prisma.productStockMovement.aggregate({
    where: { productId, direction: 1 },
    _sum: { quantity: true }
  });
  const sumOut = await prisma.productStockMovement.aggregate({
    where: { productId, direction: -1 },
    _sum: { quantity: true }
  });

  return Number(product.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
};

// GET /api/forecasting/by-order - Forecast by Order (analyzing materials & times)
router.get('/by-order', authenticateToken, async (req, res, next) => {
  try {
    // Get all undelivered orders
    const orders = await prisma.customerOrder.findMany({
      where: {
        status: { notIn: ['Delivered', 'Cancelled'] },
        deletedAt: null
      },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
                bom: {
                  include: {
                    rawMaterial: {
                      include: {
                        uoms: true
                      }
                    }
                  }
                },
                stages: true
              }
            }
          }
        }
      },
      orderBy: { deliveryDate: 'asc' }
    });

    const result = [];

    for (const order of orders) {
      const materialsMap = {};
      let overallStatus = 'Ready';
      let maxDurationMinutes = 0;

      // 1. Evaluate material requirements and production time per item
      for (const item of order.items) {
        const prod = item.product;
        const qtyOrdered = Number(item.quantity);
        const currentProductStock = await getProductStock(prod.id);
        const productShortfall = Math.max(0, qtyOrdered - currentProductStock);

        // Calculate lead time for shortfall
        if (productShortfall > 0) {
          overallStatus = 'Shortage';

          // Accumulate raw material requirements
          for (const bomItem of prod.bom) {
            const rm = bomItem.rawMaterial;
            const requiredQty = Number(bomItem.consumptionPerUnit) * productShortfall;
            const rmId = rm.id;

            if (!materialsMap[rmId]) {
              materialsMap[rmId] = {
                name: rm.name,
                unit: rm.uoms?.[0]?.abbreviation || 'units',
                requiredQty: 0,
                availableStock: Number(rm.currentStock || 0)
              };
            }
            materialsMap[rmId].requiredQty += requiredQty;
          }

          // Calculate stage times in minutes
          let productMinutes = 0;
          prod.stages.forEach(st => {
            productMinutes += Number(st.months || 0) * 30 * 24 * 60;
            productMinutes += Number(st.days || 0) * 24 * 60;
            productMinutes += Number(st.hours || 0) * 60;
            productMinutes += Number(st.minutes || 0);
          });

          // Scale by quantity logarithmically
          const durationForQty = productMinutes * (1 + Math.log10(productShortfall));
          if (durationForQty > maxDurationMinutes) {
            maxDurationMinutes = durationForQty;
          }
        }
      }

      // Convert materials map to sorted array
      const materials = Object.keys(materialsMap).map(id => {
        const m = materialsMap[id];
        const sufficient = m.availableStock >= m.requiredQty;
        const deficit = sufficient ? 0 : m.requiredQty - m.availableStock;
        if (!sufficient) {
          overallStatus = 'Shortage';
        }
        return {
          name: m.name,
          unit: m.unit,
          requiredQty: m.requiredQty,
          availableStock: m.availableStock,
          sufficient,
          deficit
        };
      });

      const leadTimeHours = Math.ceil(maxDurationMinutes / 60);

      result.push({
        orderId: order.id,
        referenceNo: order.referenceNo,
        customerName: order.customer?.name || 'N/A',
        deliveryDate: order.deliveryDate,
        totalSubtotal: Number(order.totalSubtotal || 0),
        overallStatus,
        materials,
        timeline: {
          leadTimeHours: leadTimeHours > 0 ? leadTimeHours : 24 // default minimum feasibility
        }
      });
    }

    // 2. Aggregate demand per product for undelivered orders
    const products = await prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      include: {
        stockLevels: true
      }
    });

    const analysisData = [];
    for (const prod of products) {
      // Find all undelivered items for this product
      const orderItems = await prisma.customerOrderItem.findMany({
        where: {
          productId: prod.id,
          order: {
            status: { notIn: ['Delivered', 'Cancelled'] },
            deletedAt: null
          }
        },
        include: {
          order: true
        }
      });

      const pendingOrdersCount = orderItems.length;
      const orderQtyNeeded = orderItems.reduce((sum, item) => sum + Number(item.quantity), 0);
      const currentStock = await getProductStock(prod.id);
      
      const stockLevel = prod.stockLevels[0] || null;
      const minLevel = stockLevel ? Number(stockLevel.minLevel) : 0;
      
      const shortage = currentStock - orderQtyNeeded;
      const needToProduce = Math.max(0, orderQtyNeeded - currentStock) + minLevel;
      
      // Keep track of the first order containing this product to pre-fill orderId if they click "+ Produce"
      const oldestOrder = orderItems.length > 0 ? orderItems[0].order : null;

      analysisData.push({
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        pendingOrdersCount,
        orderQtyNeeded,
        currentStock,
        minLevel,
        shortage,
        needToProduce,
        orderId: oldestOrder ? oldestOrder.id : null
      });
    }

    res.json({
      orders: result,
      analysis: analysisData
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/forecasting/by-product - Forecast by Product (Grouped)
router.get('/by-product', authenticateToken, async (req, res, next) => {
  try {
    // 1. Get all undelivered items grouped by product
    const orders = await prisma.customerOrder.findMany({
      where: {
        status: { notIn: ['Delivered', 'Cancelled'] },
        deletedAt: null
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                unit: true
              }
            }
          }
        }
      }
    });

    const productMap = {};

    for (const order of orders) {
      for (const item of order.items) {
        const prod = item.product;
        if (!productMap[prod.id]) {
          const currentStock = await getProductStock(prod.id);
          productMap[prod.id] = {
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            unit: prod.unit?.abbreviation || 'pcs',
            totalDemand: 0,
            currentStock,
            salePrice: Number(prod.salePrice || 0)
          };
        }
        productMap[prod.id].totalDemand += Number(item.quantity);
      }
    }

    const result = [];

    // Analyze each product
    for (const id of Object.keys(productMap)) {
      const item = productMap[id];
      const deficit = Math.max(0, item.totalDemand - item.currentStock);
      const status = deficit === 0 ? 'Sufficient' : 'Shortage';
      const shortfallValue = deficit * item.salePrice;

      result.push({
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        unit: item.unit,
        currentStock: item.currentStock,
        totalDemand: item.totalDemand,
        status,
        deficit,
        salePrice: item.salePrice,
        shortfallValue
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
