const prisma = require('../../database/prisma');

class DashboardController {
  async getDashboardSummary(req, res, next) {
    try {
      // 1. Top Metrics (Live from DB)
      const [
        totalProducts,
        totalRm,
        totalSupplier,
        totalCustomer
      ] = await Promise.all([
        prisma.productionBatch.count({ where: { status: 'COMPLETED' } }),
        prisma.rawMaterial.count(),
        prisma.supplier.count(),
        prisma.customer.count()
      ]);

      // 2. Charts (Live from DB)
      const currentYear = new Date().getFullYear();
      const expenses = await prisma.expense.findMany({
        where: {
          date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        }
      });

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      const moneyFlowMap = {};
      monthNames.forEach(m => {
        moneyFlowMap[m] = { name: m, Purchases: 0, SupplierPayments: 0, NonInventoryCost: 0, Sales: 0, CustomerDueReceived: 0, Expenses: 0, Payroll: 0 };
      });

      expenses.forEach(exp => {
        const monthName = monthNames[new Date(exp.date).getMonth()];
        if (moneyFlowMap[monthName]) {
          moneyFlowMap[monthName].Expenses += parseFloat(exp.amount || 0);
        }
      });

      // Let's get POs for purchases
      const pos = await prisma.rawMaterialPO.findMany({
        where: {
          createdAt: {
             gte: new Date(`${currentYear}-01-01`),
             lte: new Date(`${currentYear}-12-31`)
          }
        }
      });

      pos.forEach(po => {
        const monthName = monthNames[new Date(po.createdAt).getMonth()];
        if (moneyFlowMap[monthName]) {
          moneyFlowMap[monthName].Purchases += parseFloat(po.amount || 0);
        }
      });


      const moneyFlowData = Object.values(moneyFlowMap).slice(0, 6); // First 6 months for example
      
      const accountBalanceData = [];

      // 3. Running Productions (Live from DB)
      const rawProductions = await prisma.productionBatch.findMany({
        where: { status: 'IN_PROGRESS' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { idRegistry: true }
      });

      const runningProductions = rawProductions.map(b => {
        const timeDiffMs = new Date() - new Date(b.createdAt);
        const diffHours = Math.floor(timeDiffMs / (1000 * 60 * 60));
        
        return {
          referenceNo: `MP-${b.id.substring(0, 6).toUpperCase()}`,
          product: b.idRegistry?.id || 'Unknown',
          startDate: b.createdAt,
          consumedTime: `${diffHours} Hour(s)`, 
          productionCost: `INR ${b.actualRmUsed || 0}`, 
          salePrice: '-'
        };
      });

      // 4. Expired Products (Live from DB)
      const expiredTests = await prisma.labProductionTest.findMany({
        where: {
          expiryDate: { lte: new Date() }
        },
        include: { batch: true },
        take: 5
      });

      const expireProducts = expiredTests.map(test => ({
        production: `MP-${test.batchId.substring(0, 6).toUpperCase()}`,
        name: `Batch Product`,
        code: `QC-${test.id.substring(0, 6).toUpperCase()}`,
        expiryDate: test.expiryDate ? test.expiryDate.toLocaleDateString() : 'N/A',
        status: 'expired'
      }));

      const runningCustomerOrders = [];

      // Live Low RM Stock
      const allRms = await prisma.rawMaterial.findMany();
      const rawMaterialsLowStock = allRms.filter(rm => Number(rm.currentStock) <= Number(rm.alertLevel)).slice(0, 10);

      const lowRmStock = rawMaterialsLowStock.map(rm => ({
        code: rm.code,
        name: rm.name,
        currentStock: rm.currentStock
      }));

      // Live Supplier Receivables
      const suppliersWithReceivables = await prisma.supplier.findMany({
        where: { openingBalance: { gt: 0 } },
        take: 5
      });

      const supplierReceivables = suppliersWithReceivables.map(s => ({
        date: s.createdAt.toLocaleDateString(),
        supplier: s.name,
        amount: `INR ${s.openingBalance}`
      }));

      // Live Customer Payables
      const customersWithPayables = await prisma.customer.findMany({
        where: { openingBalance: { gt: 0 } },
        take: 5
      });

      const customerPayables = customersWithPayables.map(c => ({
        referenceNo: c.id.substring(0, 6).toUpperCase(),
        date: c.createdAt.toLocaleDateString(),
        customer: c.name,
        amount: `INR ${c.openingBalance}`
      }));

      // --- New Data: User Management, PO Details, Lab Assistant --- //
      const usersData = await prisma.user.findMany({
        select: { id: true, name: true, role: true, isActive: true },
        take: 5
      });

      const pendingPOs = await prisma.rawMaterialPO.findMany({
        where: { status: 'PENDING' },
        include: { idRegistry: true, supplier: true },
        take: 5
      });

      const poDetails = pendingPOs.map(po => ({
        id: po.id,
        referenceNo: po.referenceNo || 'N/A',
        rm: po.idRegistry?.id || 'Unknown',
        supplier: po.supplier?.name || 'Unknown',
        quantity: `${po.quantity} Units`,
        status: po.status
      }));

      const pendingRMLabTests = await prisma.gRNReceive.findMany({
        where: { status: 'PENDING_LAB' },
        include: { po: { include: { supplier: true } } },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      const labAssistantTasks = pendingRMLabTests.map(grn => ({
        id: grn.id.substring(0, 8).toUpperCase(),
        grnId: grn.id,
        grnRef: grn.referenceNo || 'N/A',
        supplier: grn.po?.supplier?.name || 'Unknown',
        status: grn.status
      }));

      res.json({
        topMetrics: {
          totalProduct: totalProducts || 0,
          totalRm: totalRm || 0,
          totalSupplier: totalSupplier || 0,
          totalCustomer: totalCustomer || 0
        },
        moneyFlowData,
        accountBalanceData,
        runningProductions,
        runningCustomerOrders,
        lowRmStock,
        expireProducts,
        supplierReceivables,
        customerPayables,
        // new additions
        usersData,
        poDetails,
        labAssistantTasks
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
