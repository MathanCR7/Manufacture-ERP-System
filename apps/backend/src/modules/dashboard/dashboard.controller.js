const prisma = require('../../database/prisma');

const fmtNum = (v) => parseFloat((v || 0).toString());

class DashboardController {

  // ─────────────────────────── ORIGINAL SUMMARY ───────────────────────────
  async getDashboardSummary(req, res, next) {
    try {
      const [totalProducts, totalRm, totalSupplier, totalCustomer] = await Promise.all([
        prisma.productionBatch.count({ where: { status: 'COMPLETED' } }),
        prisma.rawMaterial.count(),
        prisma.supplier.count(),
        prisma.customer.count()
      ]);

      const currentYear = new Date().getFullYear();
      const expenses = await prisma.expense.findMany({
        where: { date: { gte: new Date(`${currentYear}-01-01`), lte: new Date(`${currentYear}-12-31`) } }
      });

      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const moneyFlowMap = {};
      monthNames.forEach(m => { moneyFlowMap[m] = { name: m, Purchases: 0, Expenses: 0 }; });
      expenses.forEach(exp => {
        const month = monthNames[new Date(exp.date).getMonth()];
        if (moneyFlowMap[month]) moneyFlowMap[month].Expenses += fmtNum(exp.amount);
      });

      const pos = await prisma.rawMaterialPO.findMany({
        where: { createdAt: { gte: new Date(`${currentYear}-01-01`), lte: new Date(`${currentYear}-12-31`) } }
      });
      pos.forEach(po => {
        const month = monthNames[new Date(po.createdAt).getMonth()];
        if (moneyFlowMap[month]) moneyFlowMap[month].Purchases += fmtNum(po.amount);
      });

      const moneyFlowData = Object.values(moneyFlowMap).slice(0, 6);
      const rawProductions = await prisma.productionBatch.findMany({
        where: { status: 'IN_PROGRESS' }, take: 5, orderBy: { createdAt: 'desc' }, include: { idRegistry: true }
      });

      const runningProductions = rawProductions.map(b => ({
        referenceNo: `MP-${b.id.substring(0, 6).toUpperCase()}`,
        product: b.idRegistry?.id || 'Unknown',
        startDate: b.createdAt,
        consumedTime: `${Math.floor((new Date() - new Date(b.createdAt)) / 3600000)} Hour(s)`,
        productionCost: `INR ${b.actualRmUsed || 0}`,
        salePrice: '-'
      }));

      const expiredTests = await prisma.labProductionTest.findMany({
        where: { expiryDate: { lte: new Date() } }, include: { batch: true }, take: 5
      });
      const expireProducts = expiredTests.map(test => ({
        production: `MP-${test.batchId.substring(0, 6).toUpperCase()}`,
        name: 'Batch Product', code: `QC-${test.id.substring(0, 6).toUpperCase()}`,
        expiryDate: test.expiryDate ? test.expiryDate.toLocaleDateString() : 'N/A', status: 'expired'
      }));

      const allRms = await prisma.rawMaterial.findMany();
      const lowRmStock = allRms.filter(rm => Number(rm.currentStock) <= Number(rm.alertLevel)).slice(0, 10)
        .map(rm => ({ code: rm.code, name: rm.name, currentStock: rm.currentStock }));

      const suppliersWithReceivables = await prisma.supplier.findMany({ where: { openingBalance: { gt: 0 } }, take: 5 });
      const supplierReceivables = suppliersWithReceivables.map(s => ({
        date: s.createdAt.toLocaleDateString(), supplier: s.name, amount: `INR ${s.openingBalance}`
      }));

      const customersWithPayables = await prisma.customer.findMany({ where: { openingBalance: { gt: 0 } }, take: 5 });
      const customerPayables = customersWithPayables.map(c => ({
        referenceNo: c.id.substring(0, 6).toUpperCase(), date: c.createdAt.toLocaleDateString(),
        customer: c.name, amount: `INR ${c.openingBalance}`
      }));

      const usersData = await prisma.user.findMany({ select: { id: true, name: true, role: true, isActive: true }, take: 5 });
      const pendingPOs = await prisma.rawMaterialPO.findMany({ where: { status: 'PENDING' }, include: { idRegistry: true, supplier: true }, take: 5 });
      const poDetails = pendingPOs.map(po => ({
        id: po.id, referenceNo: po.referenceNo || 'N/A', rm: po.idRegistry?.id || 'Unknown',
        supplier: po.supplier?.name || 'Unknown', quantity: `${po.quantity} Units`, status: po.status
      }));

      const pendingRMLabTests = await prisma.gRNReceive.findMany({
        where: { status: 'PENDING_LAB' }, include: { po: { include: { supplier: true } } }, take: 5, orderBy: { createdAt: 'desc' }
      });
      const labAssistantTasks = pendingRMLabTests.map(grn => ({
        id: grn.id.substring(0, 8).toUpperCase(), grnId: grn.id,
        grnRef: grn.referenceNo || 'N/A', supplier: grn.po?.supplier?.name || 'Unknown', status: grn.status
      }));

      res.json({
        topMetrics: { totalProduct: totalProducts || 0, totalRm: totalRm || 0, totalSupplier: totalSupplier || 0, totalCustomer: totalCustomer || 0 },
        moneyFlowData, accountBalanceData: [], runningProductions, runningCustomerOrders: [],
        lowRmStock, expireProducts, supplierReceivables, customerPayables, usersData, poDetails, labAssistantTasks
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── EXECUTIVE DASHBOARD ───────────────────────────
  async getExecutiveDashboard(req, res, next) {
    try {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      const endOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

      // Revenue from orders (totalSubtotal of delivered orders)
      const [totalOrderRevenue, lastMonthRevenue, currentMonthRevenue] = await Promise.all([
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, where: { deletedAt: null } }),
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, where: { deletedAt: null, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, where: { deletedAt: null, createdAt: { gte: startOfMonth } } })
      ]);

      // Total expenses
      const totalExpenses = await prisma.expense.aggregate({ _sum: { amount: true } });
      const totalPurchases = await prisma.rawMaterialPO.aggregate({ _sum: { amount: true } });

      // Order pipeline
      const orderCounts = await prisma.customerOrder.groupBy({
        by: ['status'], _count: true,
        where: { deletedAt: null }
      });

      // Production batches and OEE stats
      const batchStatusCounts = await prisma.productionBatchNew.groupBy({
        by: ['status'], _count: true, where: { deletedAt: null }
      });
      const statusMap = {};
      batchStatusCounts.forEach(s => { statusMap[s.status] = s._count; });

      const completedBatches = (statusMap['Completed'] || 0) + (statusMap['qc_passed'] || 0);
      const inProgressBatches = statusMap['In Progress'] || 0;
      const totalBatches = Object.values(statusMap).reduce((a, b) => a + b, 0);

      // Production quantity summary
      const productionAgg = await prisma.productionBatchNew.aggregate({
        _sum: { quantity: true, partiallyDoneQty: true },
        where: { deletedAt: null }
      });

      // QC pass/fail rates
      const qcPassed = await prisma.labProductionTestNew.count({ where: { result: { in: ['Pass', 'pass'] } } });
      const qcFailed = await prisma.labProductionTestNew.count({ where: { result: { in: ['Fail', 'fail'] } } });
      const totalQc = qcPassed + qcFailed;
      const qcPassRate = totalQc > 0 ? ((qcPassed / totalQc) * 100).toFixed(1) : 0;

      // OEE Component Breakdown
      const availability = totalBatches > 0 ? Math.min(100, (completedBatches + inProgressBatches) / totalBatches * 100) : 0;
      const performance = fmtNum(productionAgg._sum.partiallyDoneQty) > 0 && fmtNum(productionAgg._sum.quantity) > 0
        ? Math.min(100, (fmtNum(productionAgg._sum.partiallyDoneQty) / fmtNum(productionAgg._sum.quantity)) * 100) : 0;
      const quality = parseFloat(qcPassRate);
      const oeeScore = totalBatches > 0 ? Math.round((availability / 100) * (performance / 100) * (quality / 100) * 100) : 0;

      // Inventory value (raw materials)
      const rawMaterials = await prisma.rawMaterial.findMany({ select: { currentStock: true, ratePerUnit: true } });
      const rmInventoryValue = rawMaterials.reduce((sum, rm) => sum + fmtNum(rm.currentStock) * fmtNum(rm.ratePerUnit), 0);

      // Finished product inventory value
      const finishedProducts = await prisma.finishedProduct.findMany({
        select: { currentStock: true, salePrice: true, openingStock: true }, where: { deletedAt: null }
      });
      const fpInventoryValue = finishedProducts.reduce((sum, fp) => {
        const stock = fmtNum(fp.currentStock) + fmtNum(fp.openingStock);
        return sum + stock * fmtNum(fp.salePrice);
      }, 0);

      // Top products by orders
      const topProductOrders = await prisma.customerOrderItem.groupBy({
        by: ['productId'], _sum: { quantity: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 5
      });
      const topProductIds = topProductOrders.map(x => x.productId);
      const topProductData = await prisma.finishedProduct.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true } });
      const topProducts = topProductOrders.map(p => {
        const prod = topProductData.find(d => d.id === p.productId);
        return { name: prod?.name || 'Unknown', revenue: fmtNum(p._sum.subtotal), qty: fmtNum(p._sum.quantity) };
      });

      // Top customers
      const topCustomerOrders = await prisma.customerOrder.groupBy({
        by: ['customerId'], _sum: { totalSubtotal: true }, orderBy: { _sum: { totalSubtotal: 'desc' } }, take: 5,
        where: { deletedAt: null }
      });
      const topCustomerIds = topCustomerOrders.map(x => x.customerId);
      const topCustomerData = await prisma.customer.findMany({ where: { id: { in: topCustomerIds } }, select: { id: true, name: true } });
      const topCustomers = topCustomerOrders.map(c => {
        const cust = topCustomerData.find(d => d.id === c.customerId);
        return { name: cust?.name || 'Unknown', revenue: fmtNum(c._sum.totalSubtotal) };
      });

      // Monthly revenue trend (last 12 months)
      const monthlyRevenue = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1); // avoid JavaScript setMonth month-length rollover bug
        d.setMonth(d.getMonth() - i);
        const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0));
        const nextStart = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0));
        const rev = await prisma.customerOrder.aggregate({
          _sum: { totalSubtotal: true }, where: { deletedAt: null, createdAt: { gte: start, lt: nextStart } }
        });
        const exp = await prisma.expense.aggregate({
          _sum: { amount: true }, where: { date: { gte: start, lt: nextStart } }
        });
        monthlyRevenue.push({
          month: d.toLocaleString('default', { month: 'short' }),
          revenue: fmtNum(rev._sum.totalSubtotal),
          expenses: fmtNum(exp._sum.amount)
        });
      }

      const totalRevenue = fmtNum(totalOrderRevenue._sum.totalSubtotal);
      const totalExpensesVal = fmtNum(totalExpenses._sum.amount) + fmtNum(totalPurchases._sum.amount);
      const netProfit = totalRevenue - totalExpensesVal;

      const orderPipeline = {};
      orderCounts.forEach(o => { orderPipeline[o.status] = o._count; });

      const lastMonthRev = fmtNum(lastMonthRevenue._sum.totalSubtotal);
      const currentMonthRev = fmtNum(currentMonthRevenue._sum.totalSubtotal);
      const revenueGrowth = lastMonthRev > 0 ? ((currentMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : 0;

      res.json({
        totalRevenue,
        currentMonthRevenue: currentMonthRev,
        revenueGrowth,
        netProfit,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0,
        totalExpenses: totalExpensesVal,
        totalGeneralExpenses: fmtNum(totalExpenses._sum.amount),
        totalDirectCosts: fmtNum(totalPurchases._sum.amount),
        orderPipeline,
        oeeScore,
        availability: parseFloat(availability.toFixed(1)),
        performance: parseFloat(performance.toFixed(1)),
        quality: parseFloat(quality.toFixed(1)),
        inventoryValue: rmInventoryValue + fpInventoryValue,
        rmInventoryValue,
        fpInventoryValue,
        topProducts,
        topCustomers,
        monthlyRevenue,
        activeBatches: inProgressBatches,
        completedBatches,
        totalBatches
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── SALES DASHBOARD ───────────────────────────
  async getSalesDashboard(req, res, next) {
    try {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [todaySales, monthSales, yearSales] = await Promise.all([
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, _count: true, where: { deletedAt: null, createdAt: { gte: startOfDay } } }),
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, _count: true, where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, _count: true, where: { deletedAt: null, createdAt: { gte: startOfYear } } })
      ]);

      // Order status breakdown
      const orderStatusCounts = await prisma.customerOrder.groupBy({
        by: ['status'], _count: true, _sum: { totalSubtotal: true }, where: { deletedAt: null }
      });

      // Recent orders
      const recentOrders = await prisma.customerOrder.findMany({
        where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 8,
        include: { customer: true, items: { include: { product: true } } }
      });

      // Quotation vs Confirmed rate
      const totalOrders = await prisma.customerOrder.count({ where: { deletedAt: null } });
      const confirmedOrders = await prisma.customerOrder.count({
        where: { deletedAt: null, status: { in: ['Confirmed', 'In Production', 'Ready for Shipment', 'Delivered'] } }
      });
      const conversionRate = totalOrders > 0 ? ((confirmedOrders / totalOrders) * 100).toFixed(1) : 0;

      // Top selling products
      const topProducts = await prisma.customerOrderItem.groupBy({
        by: ['productId'], _sum: { quantity: true, subtotal: true }, orderBy: { _sum: { subtotal: 'desc' } }, take: 6
      });
      const productIds = topProducts.map(p => p.productId);
      const productNames = await prisma.finishedProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, code: true } });
      const topSellingProducts = topProducts.map(p => {
        const prod = productNames.find(d => d.id === p.productId);
        return { name: prod?.name || 'Unknown', code: prod?.code || '', qty: fmtNum(p._sum.quantity), revenue: fmtNum(p._sum.subtotal) };
      });

      // Top customers
      const topCustomers = await prisma.customerOrder.groupBy({
        by: ['customerId'], _sum: { totalSubtotal: true }, _count: true, orderBy: { _sum: { totalSubtotal: 'desc' } }, take: 5,
        where: { deletedAt: null }
      });
      const custIds = topCustomers.map(c => c.customerId);
      const custNames = await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, customerType: true } });
      const topCustomerData = topCustomers.map(c => {
        const cust = custNames.find(d => d.id === c.customerId);
        return { name: cust?.name || 'Unknown', type: cust?.customerType || 'RETAIL', revenue: fmtNum(c._sum.totalSubtotal), orders: c._count };
      });

      // New customers this month
      const newCustomers = await prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } });
      const totalCustomers = await prisma.customer.count();

      // Daily sales chart (last 14 days)
      const dailySales = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        const agg = await prisma.customerOrder.aggregate({
          _sum: { totalSubtotal: true }, _count: true,
          where: { deletedAt: null, createdAt: { gte: start, lte: end } }
        });
        dailySales.push({ date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), revenue: fmtNum(agg._sum.totalSubtotal), orders: agg._count });
      }

      const formattedOrders = recentOrders.map(o => ({
        id: o.id, referenceNo: o.referenceNo, customerName: o.customer?.name || 'N/A',
        status: o.status, totalSubtotal: fmtNum(o.totalSubtotal), createdAt: o.createdAt,
        deliveryDate: o.deliveryDate, productNames: o.items.map(i => i.product?.name).filter(Boolean).join(', ') || 'N/A'
      }));

      const statusMap = {};
      orderStatusCounts.forEach(s => { statusMap[s.status] = { count: s._count, revenue: fmtNum(s._sum.totalSubtotal) }; });

      res.json({
        todaySales: { revenue: fmtNum(todaySales._sum.totalSubtotal), orders: todaySales._count },
        monthSales: { revenue: fmtNum(monthSales._sum.totalSubtotal), orders: monthSales._count },
        yearSales: { revenue: fmtNum(yearSales._sum.totalSubtotal), orders: yearSales._count },
        conversionRate,
        newCustomers,
        totalCustomers,
        orderStatusBreakdown: statusMap,
        recentOrders: formattedOrders,
        topSellingProducts,
        topCustomers: topCustomerData,
        dailySales
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── PRODUCTION DASHBOARD ───────────────────────────
  async getProductionDashboard(req, res, next) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Work order statuses
      const batchStatusCounts = await prisma.productionBatchNew.groupBy({
        by: ['status'], _count: true, where: { deletedAt: null }
      });
      const statusMap = {};
      batchStatusCounts.forEach(s => { statusMap[s.status] = s._count; });

      // Recent batches
      const recentBatches = await prisma.productionBatchNew.findMany({
        where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10,
        include: { product: true, qcTests: true }
      });

      // Production quantity summary
      const productionAgg = await prisma.productionBatchNew.aggregate({
        _sum: { quantity: true, partiallyDoneQty: true },
        where: { deletedAt: null, createdAt: { gte: startOfMonth } }
      });

      // QC pass/fail rates
      const qcPassed = await prisma.labProductionTestNew.count({ where: { result: { in: ['Pass', 'pass'] } } });
      const qcFailed = await prisma.labProductionTestNew.count({ where: { result: { in: ['Fail', 'fail'] } } });
      const totalQc = qcPassed + qcFailed;
      const qcPassRate = totalQc > 0 ? ((qcPassed / totalQc) * 100).toFixed(1) : 0;

      // OEE calculation: QC pass rate × availability × performance (simplified)
      const totalBatches = Object.values(statusMap).reduce((a, b) => a + b, 0);
      const completedBatches = (statusMap['Completed'] || 0) + (statusMap['qc_passed'] || 0);
      const availability = totalBatches > 0 ? Math.min(100, (completedBatches + (statusMap['In Progress'] || 0)) / totalBatches * 100) : 0;
      const performance = fmtNum(productionAgg._sum.partiallyDoneQty) > 0 && fmtNum(productionAgg._sum.quantity) > 0
        ? Math.min(100, (fmtNum(productionAgg._sum.partiallyDoneQty) / fmtNum(productionAgg._sum.quantity)) * 100) : 0;
      const quality = parseFloat(qcPassRate);
      const oee = totalBatches > 0 ? ((availability / 100) * (performance / 100) * (quality / 100) * 100).toFixed(1) : 0;

      // Production losses this month
      const losses = await prisma.productionLoss.findMany({
        where: { date: { gte: startOfMonth } }, include: { lossProducts: true, lossMaterials: true }
      });
      let totalLossKg = 0, totalLossVal = 0;
      losses.forEach(l => {
        totalLossVal += fmtNum(l.totalLoss);
        const ploss = l.lossProducts.reduce((s, p) => s + fmtNum(p.lossQty), 0);
        const mloss = l.lossMaterials.reduce((s, m) => s + fmtNum(m.lossQty), 0);
        totalLossKg += ploss + mloss;
      });

      // Weekly production trend (last 8 weeks)
      const weeklyTrend = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const agg = await prisma.productionBatchNew.aggregate({
          _sum: { quantity: true, partiallyDoneQty: true }, _count: true,
          where: { deletedAt: null, createdAt: { gte: weekStart, lte: weekEnd } }
        });
        weeklyTrend.push({
          week: `W${i === 0 ? 'now' : i}`,
          planned: fmtNum(agg._sum.quantity),
          actual: fmtNum(agg._sum.partiallyDoneQty),
          batches: agg._count
        });
      }

      const formattedBatches = recentBatches.map(b => ({
        id: b.id, referenceNo: b.referenceNo, productName: b.product?.name || 'N/A',
        status: b.status, quantity: fmtNum(b.quantity), partiallyDoneQty: fmtNum(b.partiallyDoneQty),
        startDate: b.startDate, completeDate: b.completeDate,
        qcStatus: b.qcTests?.length > 0 ? b.qcTests[0].result : 'Pending',
        donePercent: fmtNum(b.quantity) > 0 ? Math.min(100, Math.round(fmtNum(b.partiallyDoneQty) / fmtNum(b.quantity) * 100)) : 0
      }));

      // Scrap / rejection rate
      const totalProductionQty = fmtNum(productionAgg._sum.quantity);
      const scrapRate = totalProductionQty > 0 ? ((totalLossKg / totalProductionQty) * 100).toFixed(1) : 0;

      res.json({
        statusCounts: statusMap,
        totalBatchesMonth: recentBatches.length,
        plannedQtyMonth: fmtNum(productionAgg._sum.quantity),
        actualQtyMonth: fmtNum(productionAgg._sum.partiallyDoneQty),
        oee: parseFloat(oee),
        availability: availability.toFixed(1),
        performance: performance.toFixed(1),
        quality: qcPassRate,
        qcPassed, qcFailed, qcPassRate,
        totalLossKg, totalLossVal, scrapRate,
        weeklyTrend,
        recentBatches: formattedBatches
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── INVENTORY DASHBOARD ───────────────────────────
  async getInventoryDashboard(req, res, next) {
    try {
      const now = new Date();
      const last30Days = new Date(); last30Days.setDate(last30Days.getDate() - 30);

      // Raw material stock summary
      const rawMaterials = await prisma.rawMaterial.findMany({
        include: { category: true }
      });

      let rmTotalValue = 0, lowStockCount = 0, criticalCount = 0;
      const rmStockList = rawMaterials.map(rm => {
        const stock = fmtNum(rm.currentStock);
        const alertLevel = fmtNum(rm.alertLevel);
        const value = stock * fmtNum(rm.ratePerUnit);
        rmTotalValue += value;
        const status = stock <= 0 ? 'Out of Stock' : stock <= alertLevel ? 'Critical' : stock <= alertLevel * 2 ? 'Low' : 'OK';
        if (status === 'Low') lowStockCount++;
        if (status === 'Critical' || status === 'Out of Stock') criticalCount++;
        return {
          id: rm.id, name: rm.name, code: rm.code,
          category: rm.category?.name || 'N/A',
          currentStock: stock, alertLevel,
          ratePerUnit: fmtNum(rm.ratePerUnit), value, status
        };
      });

      // Finished product stock
      const finishedProducts = await prisma.finishedProduct.findMany({
        where: { deletedAt: null }, include: { category: true, unit: true }
      });
      let fpTotalValue = 0;
      const fpStockList = finishedProducts.map(fp => {
        const stock = fmtNum(fp.currentStock) + fmtNum(fp.openingStock);
        const value = stock * fmtNum(fp.salePrice);
        fpTotalValue += value;
        return {
          id: fp.id, name: fp.name, code: fp.code,
          category: fp.category?.name || 'N/A',
          unit: fp.unit?.abbreviation || 'pcs',
          currentStock: stock, alertLevel: fmtNum(fp.alertLevel),
          salePrice: fmtNum(fp.salePrice), value,
          status: stock <= 0 ? 'Out of Stock' : stock <= fmtNum(fp.alertLevel) ? 'Low' : 'OK'
        };
      });

      // Recent stock movements
      const recentMovements = await prisma.productStockMovement.findMany({
        orderBy: { createdAt: 'desc' }, take: 10, include: { product: true }
      });

      // GRN receives last 30 days (stock in)
      const recentGRNs = await prisma.gRNReceive.findMany({
        where: { receivedDate: { gte: last30Days } },
        include: { po: { include: { idRegistry: true } }, items: true }
      });
      const stockInLast30 = recentGRNs.reduce((sum, g) => {
        return sum + g.items.reduce((s, item) => s + fmtNum(item.actualReceivedQty), 0);
      }, 0);

      // Stock out last 30 days (from orders)
      const recentOrderItems = await prisma.customerOrderItem.findMany({
        where: { order: { createdAt: { gte: last30Days }, deletedAt: null } }
      });
      const stockOutLast30 = recentOrderItems.reduce((sum, item) => sum + fmtNum(item.quantity), 0);

      // Reorder alerts (RM below alert level)
      const reorderAlerts = rmStockList.filter(rm => rm.status === 'Critical' || rm.status === 'Low' || rm.status === 'Out of Stock');

      // Dead stock (no movement in last 30 days) - products with no orders
      const activeProductIds = new Set(recentOrderItems.map(i => i.productId));
      const deadStock = fpStockList.filter(fp => fp.currentStock > 0 && !activeProductIds.has(fp.id));

      // Stock movement trend last 14 days
      const movementTrend = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        const inCount = await prisma.gRNReceiveItem.count({
          where: { grn: { receivedDate: { gte: start, lte: end } } }
        });
        const outCount = await prisma.customerOrderItem.count({
          where: { order: { createdAt: { gte: start, lte: end }, deletedAt: null } }
        });
        movementTrend.push({ date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), in: inCount, out: outCount });
      }

      res.json({
        summary: {
          rmTotalValue, fpTotalValue, totalInventoryValue: rmTotalValue + fpTotalValue,
          totalRmItems: rawMaterials.length, totalFpItems: finishedProducts.length,
          lowStockCount, criticalCount,
          stockInLast30, stockOutLast30
        },
        rmStockList: rmStockList.slice(0, 20),
        fpStockList: fpStockList.slice(0, 20),
        reorderAlerts: reorderAlerts.slice(0, 10),
        deadStock: deadStock.slice(0, 10),
        recentMovements: recentMovements.map(m => ({
          id: m.id, productName: m.product?.name || 'N/A', type: m.type,
          quantity: fmtNum(m.quantity), direction: m.direction, createdAt: m.createdAt
        })),
        movementTrend
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── FINANCE DASHBOARD ───────────────────────────
  async getFinanceDashboard(req, res, next) {
    try {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

      // Revenue
      const [totalRevenue, monthRevenue, yearRevenue] = await Promise.all([
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true, totalCost: true, totalProfit: true }, where: { deletedAt: null } }),
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true, totalProfit: true }, where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
        prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true, totalProfit: true }, where: { deletedAt: null, createdAt: { gte: startOfYear } } })
      ]);

      // Expenses breakdown by category
      const expensesByCategory = await prisma.expense.groupBy({
        by: ['category'], _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }
      });

      // Total expenses
      const totalExpenses = await prisma.expense.aggregate({ _sum: { amount: true } });
      const monthExpenses = await prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startOfMonth } } });

      // AP: Total PO amounts (accounts payable)
      const totalPOAmount = await prisma.rawMaterialPO.aggregate({ _sum: { amount: true }, where: { status: { not: 'DELETED' } } });
      const pendingPOAmount = await prisma.rawMaterialPO.aggregate({ _sum: { amount: true }, where: { status: 'PENDING' } });

      // Asset AP Invoices (accounts payable from assets)
      const assetInvoices = await prisma.assetAPInvoice.aggregate({ _sum: { netPayable: true, invoiceTotal: true } });
      const openAssetInvoices = await prisma.assetAPInvoice.aggregate({ _sum: { netPayable: true }, where: { status: 'Open' } });

      // Revenue vs Expenses monthly chart (last 12 months)
      const monthlyFinancials = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1); // avoid JavaScript setMonth month-length rollover bug
        d.setMonth(d.getMonth() - i);
        const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0));
        const nextStart = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0));
        const [rev, exp] = await Promise.all([
          prisma.customerOrder.aggregate({ _sum: { totalSubtotal: true }, where: { deletedAt: null, createdAt: { gte: start, lt: nextStart } } }),
          prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: start, lt: nextStart } } })
        ]);
        monthlyFinancials.push({
          month: d.toLocaleString('default', { month: 'short' }),
          revenue: fmtNum(rev._sum.totalSubtotal),
          expenses: fmtNum(exp._sum.amount),
          profit: fmtNum(rev._sum.totalSubtotal) - fmtNum(exp._sum.amount)
        });
      }

      // GST summary from orders
      const orderGstAgg = await prisma.productionBatchNew.aggregate({
        _avg: { cgst: true, sgst: true, igst: true }, where: { deletedAt: null }
      });

      const totalRev = fmtNum(totalRevenue._sum.totalSubtotal);
      const totalExpVal = fmtNum(totalExpenses._sum.amount);
      const profitMargin = totalRev > 0 ? ((fmtNum(totalRevenue._sum.totalProfit) / totalRev) * 100).toFixed(1) : 0;

      // Customers with outstanding balances
      const creditCustomers = await prisma.customer.findMany({
        where: { openingBalance: { gt: 0 } }, take: 10, orderBy: { openingBalance: 'desc' }
      });
      const totalAR = creditCustomers.reduce((sum, c) => sum + fmtNum(c.openingBalance), 0);

      // Suppliers with outstanding amounts
      const debtSuppliers = await prisma.supplier.findMany({
        where: { openingBalance: { gt: 0 } }, take: 10, orderBy: { openingBalance: 'desc' }
      });
      const totalAP = debtSuppliers.reduce((sum, s) => sum + fmtNum(s.openingBalance), 0);

      res.json({
        revenue: { total: totalRev, month: fmtNum(monthRevenue._sum.totalSubtotal), year: fmtNum(yearRevenue._sum.totalSubtotal) },
        expenses: { total: totalExpVal, month: fmtNum(monthExpenses._sum.amount) },
        profit: { total: fmtNum(totalRevenue._sum.totalProfit), margin: profitMargin },
        accountsReceivable: { total: totalAR, count: creditCustomers.length },
        accountsPayable: { rmPO: fmtNum(pendingPOAmount._sum.amount), assetInvoices: fmtNum(openAssetInvoices._sum.netPayable), total: totalAP },
        expensesByCategory: expensesByCategory.map(e => ({ category: e.category, amount: fmtNum(e._sum.amount) })),
        monthlyFinancials,
        budgets: await prisma.departmentBudget.findMany(),
        topReceivables: creditCustomers.slice(0, 5).map(c => ({ name: c.name, amount: fmtNum(c.openingBalance) })),
        topPayables: debtSuppliers.slice(0, 5).map(s => ({ name: s.name, amount: fmtNum(s.openingBalance) }))
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── HR DASHBOARD ───────────────────────────
  async getHRDashboard(req, res, next) {
    try {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const { userId } = req.query;

      // Active employees
      const [totalUsers, activeUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } })
      ]);

      // Role distribution
      const roleDistribution = await prisma.user.groupBy({ by: ['role'], _count: true });

      // Attendance today
      const todayCheckIns = await prisma.attendanceLog.count({
        where: { checkIn: { gte: startOfDay }, ...(userId ? { userId } : {}) }
      });
      const todayCheckOuts = await prisma.attendanceLog.count({
        where: { checkOut: { gte: startOfDay }, ...(userId ? { userId } : {}) }
      });

      // Attendance this month
      const monthAttendance = await prisma.attendanceLog.findMany({
        where: { checkIn: { gte: startOfMonth }, ...(userId ? { userId } : {}) },
        include: { user: { select: { id: true, name: true, role: true } } }
      });

      // Average hours worked
      const completedSessions = monthAttendance.filter(a => a.duration != null);
      const avgDuration = completedSessions.length > 0
        ? (completedSessions.reduce((s, a) => s + (a.duration || 0), 0) / completedSessions.length / 60).toFixed(1)
        : 8;

      // Attendance rate (present / total working days * employees)
      const workingDays = Math.ceil((now - startOfMonth) / (1000 * 60 * 60 * 24));
      const expectedAttendance = (userId ? 1 : activeUsers) * Math.max(1, workingDays);
      const attendanceRate = expectedAttendance > 0 ? Math.min(100, ((monthAttendance.length / expectedAttendance) * 100).toFixed(1)) : 92;

      // Absenteeism = 1 - attendanceRate
      const absenteeismRate = (100 - parseFloat(attendanceRate)).toFixed(1);

      // Weekly attendance trend (last 7 days)
      const weeklyAttendance = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        const count = await prisma.attendanceLog.count({
          where: { checkIn: { gte: start, lte: end }, ...(userId ? { userId } : {}) }
        });
        weeklyAttendance.push({
          day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          present: count,
          absent: Math.max(0, (userId ? 1 : activeUsers) - count)
        });
      }

      // Recent session logs
      const recentSessions = await prisma.userSessionLog.findMany({
        where: userId ? { userId } : {},
        orderBy: { loginAt: 'desc' }, take: 15, include: { user: { select: { name: true, role: true } } }
      });

      // User with attendance stats
      const users = await prisma.user.findMany({
        where: { isActive: true, ...(userId ? { id: userId } : {}) }, select: { id: true, name: true, role: true, createdAt: true }
      });
      const userAttendanceStats = await Promise.all(
        users.slice(0, 25).map(async (u) => {
          const logs = await prisma.attendanceLog.count({ where: { userId: u.id, checkIn: { gte: startOfMonth } } });
          const avgDur = await prisma.attendanceLog.aggregate({
            _avg: { duration: true }, where: { userId: u.id, checkIn: { gte: startOfMonth } }
          });
          return {
            id: u.id, name: u.name, role: u.role,
            daysPresent: logs, avgHours: ((avgDur._avg.duration || 480) / 60).toFixed(1)
          };
        })
      );

      res.json({
        totalEmployees: totalUsers,
        activeEmployees: activeUsers,
        inactiveEmployees: totalUsers - activeUsers,
        roleDistribution: roleDistribution.map(r => ({ role: r.role, count: r._count })),
        attendance: {
          todayPresent: todayCheckIns, todayOut: todayCheckOuts,
          attendanceRate, absenteeismRate, avgDailyHours: avgDuration
        },
        weeklyAttendance,
        userStats: userAttendanceStats,
        recentSessions: recentSessions.map(s => ({
          name: s.user?.name || 'N/A', role: s.user?.role || 'N/A',
          loginAt: s.loginAt, logoutAt: s.logoutAt, duration: s.durationSeconds
        }))
      });
    } catch (error) { next(error); }
  }

  // ─────────────────────────── MAINTENANCE DASHBOARD ───────────────────────────
  async getMaintenanceDashboard(req, res, next) {
    try {
      const now = new Date();
      const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Asset overview
      const [totalAssets, activeAssets, inMaintenanceAssets] = await Promise.all([
        prisma.asset.count(),
        prisma.asset.count({ where: { status: 'Active' } }),
        prisma.asset.count({ where: { status: { in: ['Under Maintenance', 'In Repair'] } } })
      ]);

      // Assets by category
      const assetsByCategory = await prisma.asset.groupBy({
        by: ['category'], _count: true, _sum: { capitalizedCost: true, bookValue: true }
      });

      // Assets due for maintenance soon
      const upcomingMaintenance = await prisma.asset.findMany({
        where: { nextMaintenance: { gte: now, lte: nextWeek } },
        orderBy: { nextMaintenance: 'asc' }, take: 10,
        select: { id: true, assetId: true, assetName: true, category: true, nextMaintenance: true, status: true, location: true }
      });

      // Recently maintained assets
      const recentlyMaintained = await prisma.asset.findMany({
        where: { nextMaintenance: { gte: startOfMonth } }, take: 10,
        select: { id: true, assetId: true, assetName: true, category: true, nextMaintenance: true, status: true }
      });

      // Asset purchase value by department
      const assetsByDept = await prisma.asset.groupBy({
        by: ['department'], _count: true, _sum: { capitalizedCost: true, bookValue: true }
      });

      // Total asset value and depreciation
      const totalAssetValue = await prisma.asset.aggregate({
        _sum: { capitalizedCost: true, bookValue: true, accumulatedDepreciation: true, monthlyDepreciation: true }
      });

      // Department budgets
      const budgets = await prisma.departmentBudget.findMany();

      // Asset PO value this month (maintenance spending indicator)
      const assetPOThisMonth = await prisma.assetPO.aggregate({
        _sum: { grandTotal: true }, _count: true, where: { createdAt: { gte: startOfMonth } }
      });

      // Warranty expiry alerts
      const warrantyExpiring = await prisma.asset.findMany({
        where: { warrantyExpiry: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
        select: { assetId: true, assetName: true, warrantyExpiry: true, department: true }
      });

      // Availability = active / total
      const availability = totalAssets > 0 ? ((activeAssets / totalAssets) * 100).toFixed(1) : 95;
      const downtime = (100 - parseFloat(availability)).toFixed(1);

      res.json({
        summary: {
          totalAssets, activeAssets, inMaintenanceAssets,
          availability: parseFloat(availability), downtime: parseFloat(downtime),
          totalAssetValue: fmtNum(totalAssetValue._sum.capitalizedCost),
          currentBookValue: fmtNum(totalAssetValue._sum.bookValue),
          totalDepreciation: fmtNum(totalAssetValue._sum.accumulatedDepreciation),
          monthlyDepreciation: fmtNum(totalAssetValue._sum.monthlyDepreciation),
          maintenanceCostMonth: fmtNum(assetPOThisMonth._sum.grandTotal)
        },
        assetsByCategory: assetsByCategory.map(a => ({
          category: a.category, count: a._count,
          value: fmtNum(a._sum.capitalizedCost), bookValue: fmtNum(a._sum.bookValue)
        })),
        assetsByDept: assetsByDept.map(a => ({
          department: a.department, count: a._count,
          value: fmtNum(a._sum.capitalizedCost)
        })),
        upcomingMaintenance,
        warrantyExpiring,
        budgets,
        recentAssets: recentlyMaintained
      });
    } catch (error) { next(error); }
  }
}

module.exports = new DashboardController();
