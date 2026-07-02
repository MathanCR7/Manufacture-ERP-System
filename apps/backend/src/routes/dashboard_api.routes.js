const express = require('express');
const router = express.Router();
const prisma = require('../database/prisma');
const authenticateToken = require('../middlewares/auth.middleware');
// Apply authenticateToken only to dashboard-specific paths defined in this router
const dashboardPaths = [
  '/dashboard/kpis',
  '/purchase-orders',
  '/productions',
  '/lab-tests/summary',
  '/lab-tests',
  '/grn',
  '/orders',
  '/production-loss/summary',
  '/forecast/by-product',
  '/forecast/by-order',
  '/notifications'
];

const cache = {};
const CACHE_TTL = 3000; // 3 seconds in-memory cache
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

router.use((req, res, next) => {
  if (dashboardPaths.includes(req.path)) {
    return authenticateToken(req, res, (err) => {
      if (err) return next(err);
      return cacheMiddleware(req, res, next);
    });
  }
  next();
});
// 0. GET /api/dashboard/kpis
router.get('/dashboard/kpis', async (req, res, next) => {
  try {
    const activeProductions = await prisma.productionBatchNew.count({
      where: {
        status: 'In Progress',
        deletedAt: null
      }
    });

    const posPendingApproval = await prisma.rawMaterialPO.count({
      where: {
        status: 'PENDING'
      }
    });

    const lowStockRaw = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count 
      FROM "RawMaterial" 
      WHERE "currentStock" <= "alertLevel"
    `;
    const lowStockMaterials = lowStockRaw[0]?.count || 0;

    const prodPending = await prisma.productionBatchNew.count({
      where: {
        status: 'Completed',
        qcTests: { none: {} }
      }
    });

    const grnPending = await prisma.gRNReceive.count({
      where: {
        status: 'PENDING_LAB'
      }
    });

    const qcBatchesPending = prodPending + grnPending;

    const ordersToDispatch = await prisma.customerOrder.count({
      where: {
        status: 'Ready for Shipment',
        deletedAt: null
      }
    });

    const activeSessions = await prisma.userSessionLog.count({
      where: {
        logoutAt: null
      }
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const presentToday = await prisma.attendanceLog.count({
      where: {
        checkIn: { gte: startOfToday }
      }
    });

    res.json({
      activeProductions,
      posPendingApproval,
      lowStockMaterials,
      qcBatchesPending,
      ordersToDispatch,
      activeSessions,
      presentToday
    });
  } catch (error) {
    next(error);
  }
});

// 1. GET /api/purchase-orders?limit=12&sort=createdAt_desc
router.get('/purchase-orders', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const pos = await prisma.rawMaterialPO.findMany({
      where: {
        status: { not: 'DELETED' }
      },
      include: {
        supplier: true,
        uom: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const formatted = pos.map(po => ({
      id: po.id,
      referenceNo: po.referenceNo || `PO-${po.id.slice(0, 8).toUpperCase()}`,
      supplierName: po.supplier?.name || 'Unknown Supplier',
      amount: parseFloat(po.amount || 0),
      createdAt: po.createdAt,
      status: po.status // PENDING, ORDERED, RECEIVED, APPROVED
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// 2. GET /api/productions?status=active&limit=10
router.get('/productions', async (req, res, next) => {
  try {
    const statusQuery = req.query.status;
    const limit = parseInt(req.query.limit) || 10;

    let whereClause = {
      deletedAt: null
    };

    if (statusQuery === 'active') {
      whereClause.status = {
        in: ['In Progress', 'Planned', 'On Hold']
      };
    } else if (statusQuery && statusQuery !== 'All') {
      whereClause.status = statusQuery;
    }

    const batches = await prisma.productionBatchNew.findMany({
      where: whereClause,
      include: {
        product: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const formatted = batches.map(b => ({
      id: b.id,
      referenceNo: b.referenceNo,
      productName: b.product?.name || 'Unknown Product',
      quantity: parseFloat(b.quantity || 0),
      partiallyDoneQty: parseFloat(b.partiallyDoneQty || 0),
      remainingQty: parseFloat(b.remainingQty || 0),
      startDate: b.startDate,
      status: b.status,
      totalCost: parseFloat(b.totalCost || 0)
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/lab-tests/summary?date=today
router.get('/lab-tests/summary', async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Passed: production QC Pass + GRN lab test APPROVED
    const prodPass = await prisma.labProductionTestNew.count({
      where: {
        result: { in: ['Pass', 'pass', 'PASS'] },
        createdAt: { gte: startOfToday }
      }
    });

    const grnPass = await prisma.gRNLabTest.count({
      where: {
        overallDecision: 'APPROVED',
        createdAt: { gte: startOfToday }
      }
    });

    // Failed: production QC Fail + GRN lab test REJECTED
    const prodFail = await prisma.labProductionTestNew.count({
      where: {
        result: { in: ['Fail', 'fail', 'FAIL'] },
        createdAt: { gte: startOfToday }
      }
    });

    const grnFail = await prisma.gRNLabTest.count({
      where: {
        overallDecision: 'REJECTED',
        createdAt: { gte: startOfToday }
      }
    });

    // Pending: Completed production batches without QC yet + GRN PENDING_LAB status
    const prodPending = await prisma.productionBatchNew.count({
      where: {
        status: 'Completed',
        qcTests: { none: {} }
      }
    });

    const grnPending = await prisma.gRNReceive.count({
      where: {
        status: 'PENDING_LAB'
      }
    });

    const passed = prodPass + grnPass;
    const failed = prodFail + grnFail;
    const pending = prodPending + grnPending;

    res.json({
      passed,
      failed,
      pending,
      total: passed + failed + pending
    });
  } catch (error) {
    next(error);
  }
});

// 4. GET /api/lab-tests?limit=6&sort=testedAt_desc
router.get('/lab-tests', async (req, res, next) => {
  try {
    // If it's a request to '/lab-tests/summary', let it fall through or handle it (Express matches exact paths first, but just in case)
    if (req.path === '/summary') {
      return next();
    }

    const limit = parseInt(req.query.limit) || 6;

    // 1. Fetch recent production QC tests
    const prodTests = await prisma.labProductionTestNew.findMany({
      include: {
        batch: {
          include: { product: true }
        },
        tester: {
          select: { name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // 2. Fetch recent GRN lab tests
    const grnTests = await prisma.gRNLabTest.findMany({
      include: {
        grn: {
          include: {
            po: true
          }
        },
        tester: {
          select: { name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Combined list
    const list = [];

    prodTests.forEach(t => {
      list.push({
        id: t.id,
        batchNo: t.batch?.referenceNo || t.productionBatchId.slice(0, 8),
        productName: t.batch?.product?.name || 'Production Batch',
        testDate: t.createdAt,
        result: t.result?.toUpperCase() === 'PASS' ? 'PASS' : t.result?.toUpperCase() === 'FAIL' ? 'FAIL' : 'PENDING',
        testedBy: t.tester?.name || 'System',
        action: t.action || 'approved'
      });
    });

    grnTests.forEach(t => {
      list.push({
        id: t.id,
        batchNo: t.grn?.referenceNo || `GRN-${t.grnId.slice(0, 8)}`,
        productName: t.grn?.po?.name || 'Raw Material GRN',
        testDate: t.createdAt,
        result: t.overallDecision === 'APPROVED' ? 'PASS' : t.overallDecision === 'REJECTED' ? 'FAIL' : 'PENDING',
        testedBy: t.tester?.name || 'System',
        action: t.overallDecision || 'inspection'
      });
    });

    // Sort by testDate desc
    list.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));

    res.json(list.slice(0, limit));
  } catch (error) {
    next(error);
  }
});

// 5. GET /api/grn?limit=8&sort=receivedAt_desc (Intercepting only if limit query parameter is present)
router.get('/grn', async (req, res, next) => {
  try {
    if (!req.query.limit) {
      return next();
    }

    const limit = parseInt(req.query.limit) || 8;

    const grns = await prisma.gRNReceive.findMany({
      include: {
        po: {
          include: {
            supplier: true,
            uom: true
          }
        },
        receiver: {
          select: { name: true }
        },
        items: true
      },
      orderBy: {
        receivedDate: 'desc'
      },
      take: limit
    });

    const formattedGrns = grns.map(g => {
      let status = 'PARTIALLY ACCEPTED';
      if (g.status === 'LAB_APPROVED') status = 'ACCEPTED';
      if (g.status === 'LAB_REJECTED') status = 'REJECTED';

      const totalQty = g.items.reduce((sum, item) => sum + parseFloat(item.actualReceivedQty || 0), 0);

      return {
        id: g.id,
        grnNo: g.referenceNo,
        poRef: g.po?.referenceNo || 'N/A',
        supplier: g.po?.supplier?.name || 'Unknown',
        materialName: g.po?.name || g.items[0]?.rmName || 'Raw Material',
        qtyReceived: totalQty || parseFloat(g.po?.quantity || 0),
        unit: g.po?.uom?.abbreviation || 'kg',
        receivedDate: g.receivedDate,
        receivedBy: g.receiver?.name || 'System',
        status
      };
    });

    // Materials Received — Last 7 Days (x: date, y: qty_kg)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const allItemsIn7Days = await prisma.gRNReceiveItem.findMany({
      where: {
        grn: {
          receivedDate: {
            gte: sevenDaysAgo
          }
        }
      },
      include: {
        grn: {
          select: { receivedDate: true }
        }
      }
    });

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(d);
      endOfDay.setHours(23, 59, 59, 999);

      const itemsInDay = allItemsIn7Days.filter(item => {
        const itemDate = new Date(item.grn?.receivedDate);
        return itemDate >= startOfDay && itemDate <= endOfDay;
      });

      const totalQty = itemsInDay.reduce((sum, it) => sum + parseFloat(it.actualReceivedQty || 0), 0);
      const dateLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

      last7Days.push({
        date: dateLabel,
        qty_kg: totalQty
      });
    }

    res.json({
      grns: formattedGrns,
      last7Days
    });
  } catch (error) {
    next(error);
  }
});

// 6. GET /api/orders?limit=8&sort=createdAt_desc (Intercepting only if limit query parameter is present)
router.get('/orders', async (req, res, next) => {
  try {
    if (!req.query.limit) {
      return next();
    }

    const limit = parseInt(req.query.limit) || 8;

    const orders = await prisma.customerOrder.findMany({
      where: {
        deletedAt: null
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    const formatted = orders.map(o => {
      const totalQty = o.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
      const productNames = o.items.map(it => it.product?.name).filter(Boolean).join(', ') || 'N/A';

      return {
        id: o.id,
        referenceNo: o.referenceNo,
        customerName: o.customer?.name || 'Unknown Customer',
        productName: productNames,
        qty: totalQty,
        orderDate: o.createdAt,
        expected: o.deliveryDate,
        status: o.status
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// 7. GET /api/production-loss/summary?range=30d
router.get('/production-loss/summary', async (req, res, next) => {
  try {
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch losses
    const losses = await prisma.productionLoss.findMany({
      where: {
        date: { gte: startDate }
      },
      include: {
        lossProducts: true,
        lossMaterials: true
      }
    });

    let totalLossVal = 0;
    let totalLossKg = 0;

    losses.forEach(l => {
      totalLossVal += parseFloat(l.totalLoss || 0);
      
      const prodLoss = l.lossProducts.reduce((sum, p) => sum + parseFloat(p.lossQty || 0), 0);
      const matLoss = l.lossMaterials.reduce((sum, m) => sum + parseFloat(m.lossQty || 0), 0);
      totalLossKg += (prodLoss + matLoss);
    });

    // Get total cost of all production batches started in last 30 days
    const totalBatchCostObj = await prisma.productionBatchNew.aggregate({
      where: {
        startDate: { gte: startDate }
      },
      _sum: {
        totalCost: true
      }
    });

    const totalCost = parseFloat(totalBatchCostObj._sum.totalCost || 0);
    const lossPercent = totalCost > 0 ? (totalLossVal / totalCost) * 100 : 2.5; // default fallback if no costs

    // Construct daily loss array for last 30 days
    const dailyLoss = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayLosses = losses.filter(l => {
        const lossDate = new Date(l.date);
        return lossDate >= dayStart && lossDate <= dayEnd;
      });

      let dayLossKg = 0;
      dayLosses.forEach(l => {
        const prodLoss = l.lossProducts.reduce((sum, p) => sum + parseFloat(p.lossQty || 0), 0);
        const matLoss = l.lossMaterials.reduce((sum, m) => sum + parseFloat(m.lossQty || 0), 0);
        dayLossKg += (prodLoss + matLoss);
      });

      dailyLoss.push({
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        loss_qty_kg: dayLossKg
      });
    }

    res.json({
      totalLossKg,
      lossValueINR: totalLossVal,
      lossPercent,
      dailyLoss
    });
  } catch (error) {
    next(error);
  }
});

// 8. GET /api/forecast/by-product?days=30&limit=5
router.get('/forecast/by-product', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Get demand from undelivered customer orders
    const orders = await prisma.customerOrder.findMany({
      where: {
        status: { notIn: ['Delivered', 'Cancelled'] },
        deletedAt: null
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    const demandMap = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        if (!item.product) return;
        const name = item.product.name;
        if (!demandMap[name]) {
          demandMap[name] = 0;
        }
        demandMap[name] += parseFloat(item.quantity || 0);
      });
    });

    const result = Object.entries(demandMap).map(([name, demand]) => ({
      name,
      demand
    }));

    // Sort by demand descending
    result.sort((a, b) => b.demand - a.demand);

    res.json(result.slice(0, limit));
  } catch (error) {
    next(error);
  }
});

// 9. GET /api/forecast/by-order?days=30
router.get('/forecast/by-order', async (req, res, next) => {
  try {
    // Return area chart data grouped by week (x: week, y: forecasted_units)
    // We look at undelivered orders delivery dates in next 30 days
    const days = 30;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const orders = await prisma.customerOrder.findMany({
      where: {
        status: { notIn: ['Delivered', 'Cancelled'] },
        deliveryDate: {
          gte: new Date(),
          lte: endDate
        },
        deletedAt: null
      },
      include: {
        items: true
      }
    });

    // Group by week (e.g. "Week 1", "Week 2", etc.)
    const weeklyForecast = {};
    for (let w = 1; w <= 4; w++) {
      weeklyForecast[`Week ${w}`] = 0;
    }

    const now = new Date();
    orders.forEach(o => {
      const diffTime = new Date(o.deliveryDate) - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      let weekKey = 'Week 4';
      if (diffDays <= 7) weekKey = 'Week 1';
      else if (diffDays <= 14) weekKey = 'Week 2';
      else if (diffDays <= 21) weekKey = 'Week 3';

      const totalQty = o.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
      weeklyForecast[weekKey] += totalQty;
    });

    const result = Object.entries(weeklyForecast).map(([week, forecasted_units]) => ({
      week,
      forecasted_units
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 10. GET /api/notifications?unread=true&limit=20 (Intercepting only if unread query parameter is present)
router.get('/notifications', async (req, res, next) => {
  try {
    if (!req.query.unread) {
      return next();
    }

    const role = req.user.role;
    const limit = parseInt(req.query.limit) || 20;

    const notifications = await prisma.notification.findMany({
      where: {
        recipientRoles: {
          has: role
        },
        seenAt: null
      },
      orderBy: { eventAt: 'desc' },
      take: limit
    });

    const formatted = notifications.map(n => {
      // Map category/type to category for icons
      let category = 'PRODUCTION_COMPLETE';
      if (n.type.includes('LOW') || n.type.includes('CRITICAL')) category = 'LOW_STOCK';
      else if (n.type.includes('FAIL') || n.type.includes('REJECTED')) category = 'QC_FAIL';
      else if (n.type.includes('PENDING') || n.type.includes('CREATED')) category = 'PO_PENDING';

      return {
        id: n.id,
        category,
        title: n.message,
        timestamp: n.eventAt
      };
    });

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
