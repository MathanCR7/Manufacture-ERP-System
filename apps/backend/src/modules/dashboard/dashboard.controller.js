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
        prisma.idRegistry.count({ where: { status: 'ACTIVE' } }),
        prisma.supplier.count(),
        prisma.customer.count()
      ]);

      // 2. Charts (Live from DB)
      // Aggregate Expenses by month for Money Flow
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

      const moneyFlowData = Object.values(moneyFlowMap).slice(0, 6); // First 6 months for example
      
      // We don't have an Account table yet, returning empty for the pie chart
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
          productionCost: `INR ${b.actualRmUsed || 0}`, // Using rmUsed as a proxy for cost since no actual cost field exists
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
        expiryDate: test.expiryDate.toLocaleDateString(),
        status: 'expired'
      }));

      // Tables that do not have dedicated DB models yet return empty arrays
      const runningCustomerOrders = [];
      const lowRmStock = [];
      const supplierReceivables = [];
      const customerPayables = [];

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
        customerPayables
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
