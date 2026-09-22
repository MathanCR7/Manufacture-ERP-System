const prisma = require('../../database/prisma');

/**
 * Extracts live ERP database data and formats it into the exact
 * 17-source ERP Data Payload for the Chief Quantitative Operations Analyst
 * and Predictive AI Engine.
 */
async function extractERPPayload(options = {}) {
  const asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
  const enterpriseName = options.enterpriseName || 'Manufacturing ERP';
  const reportingCurrency = options.reportingCurrency || 'INR';
  const horizonDays = parseInt(options.horizonDays, 10) || 30;
  const sixtyDaysAgo = new Date(asOfDate.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(asOfDate.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Batch 1: Finished Products, Raw Materials & Stock Movements
  const [products, rawMaterials, stockMovements] = await Promise.all([
    prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      include: {
        stockLevels: true,
        unit: true,
        category: true,
        bom: {
          include: {
            rawMaterial: {
              include: { uoms: true }
            }
          }
        },
        stages: {
          include: { stage: true },
          orderBy: { sortOrder: 'asc' }
        }
      }
    }),
    prisma.rawMaterial.findMany({
      include: {
        category: true,
        uoms: true
      }
    }),
    prisma.productStockMovement.findMany({
      select: {
        productId: true,
        direction: true,
        quantity: true
      }
    })
  ]);

  // Batch 2: Orders, Procurement and Batches
  const [customerOrders, purchaseOrders, grns, productionBatches] = await Promise.all([
    prisma.customerOrder.findMany({
      where: { deletedAt: null },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.rawMaterialPO.findMany({
      where: { deletedAt: null },
      include: {
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.gRNReceive.findMany({
      include: {
        items: true,
        labTest: true
      },
      orderBy: { receivedDate: 'desc' }
    }),
    prisma.productionBatchNew.findMany({
      where: { deletedAt: null },
      include: {
        product: true,
        rmUsages: true,
        qcTests: true
      },
      orderBy: { startDate: 'desc' }
    })
  ]);

  // Batch 3: Workforce, Stages & Expenses
  const [users, attendanceLogs, stagesMaster, expenses] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, empId: true }
    }),
    prisma.attendanceLog.findMany({
      where: {
        createdAt: { gte: sixtyDaysAgo }
      }
    }),
    prisma.productionStageMaster.findMany({
      where: { isActive: true }
    }),
    prisma.expense.findMany({
      where: {
        date: { gte: ninetyDaysAgo }
      },
      orderBy: { date: 'desc' }
    })
  ]);

  // Batch 4: Parties, Lab Tests, Returns & Campaigns
  const [suppliers, customers, grnLabTests, labProductionTests, salesReturns, purchaseReturns, salesCampaigns] = await Promise.all([
    prisma.supplier.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, creditLimit: true, openingBalance: true, status: true }
    }),
    prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, creditLimit: true, paymentTermsDays: true, openingBalance: true }
    }),
    prisma.gRNLabTest.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        testResults: true
      }
    }),
    prisma.labProductionTestNew.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.salesReturn.findMany({
      include: {
        items: {
          include: { product: true }
        },
        order: true
      }
    }),
    prisma.purchaseReturn.findMany({
      orderBy: { returnDate: 'desc' }
    }),
    prisma.salesCampaign.findMany({
      where: { status: 'Active' },
      include: { preOrders: true }
    })
  ]);

  // Aggregate stock movements by product
  const movementsMap = {};
  stockMovements.forEach(m => {
    const pid = m.productId;
    if (!movementsMap[pid]) movementsMap[pid] = { in: 0, out: 0 };
    const qty = Number(m.quantity || 0);
    if (m.direction === 1) movementsMap[pid].in += qty;
    else if (m.direction === -1) movementsMap[pid].out += qty;
  });

  // Normalize Finished Products with live calculated stock
  const finishedProductsData = products.map(p => {
    const sl = p.stockLevels?.[0] || null;
    const mov = movementsMap[p.id];
    let calculatedStock = Number(p.currentStock || 0);
    if (mov) {
      const live = Number(p.openingStock || 0) + mov.in - mov.out;
      if (live >= 0) calculatedStock = live;
    }

    const minLevel = sl ? Number(sl.minLevel || 0) : Number(p.alertLevel || 10);
    const maxLevel = sl ? Number(sl.maxLevel || 0) : minLevel * 4 || 100;
    const reorderPoint = sl ? Number(sl.reorderPoint || 0) : minLevel;

    // Standard hours from product stages
    let standardStageHours = 0;
    (p.stages || []).forEach(st => {
      standardStageHours += Number(st.months || 0) * 720 +
        Number(st.days || 0) * 24 +
        Number(st.hours || 0) +
        Number(st.minutes || 0) / 60;
    });

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      currentStock: calculatedStock,
      alertLevel: Number(p.alertLevel || 0),
      salePrice: Number(p.salePrice || 0),
      totalCost: Number(p.totalCost || 0),
      profitMargin: Number(p.profitMargin || 0),
      minLevel,
      maxLevel,
      reorderPoint,
      unit: p.unit?.abbreviation || 'pcs',
      category: p.category?.name || 'Standard',
      standardStageHours: Number(standardStageHours.toFixed(2)),
      bom: (p.bom || []).map(b => ({
        rmId: b.rmId,
        rawMaterialName: b.rawMaterial?.name || '',
        rawMaterialCode: b.rawMaterial?.code || '',
        consumptionPerUnit: Number(b.consumptionPerUnit || 0),
        unitPrice: Number(b.unitPrice || 0),
        totalCost: Number(b.totalCost || 0),
        unit: b.rawMaterial?.uoms?.[0]?.abbreviation || 'kg'
      })),
      stages: (p.stages || []).map(st => ({
        stageId: st.stageId,
        stageName: st.stage?.name || 'Stage',
        days: Number(st.days || 0),
        hours: Number(st.hours || 0),
        minutes: Number(st.minutes || 0),
        standardHours: Number((Number(st.hours || 0) + Number(st.minutes || 0) / 60 + Number(st.days || 0) * 24).toFixed(2))
      }))
    };
  });

  // Normalize Raw Materials
  const rawMaterialsData = rawMaterials.map(rm => ({
    id: rm.id,
    name: rm.name,
    code: rm.code,
    ratePerUnit: Number(rm.ratePerUnit || 0),
    currentStock: Number(rm.currentStock || 0),
    alertLevel: Number(rm.alertLevel || 0),
    categoryName: rm.category?.name || 'General',
    unit: rm.uoms?.[0]?.abbreviation || 'kg'
  }));

  // Normalize Customer Orders
  const customerOrdersData = customerOrders.map(o => ({
    id: o.id,
    referenceNo: o.referenceNo,
    customer: o.customer?.name || 'Customer',
    customerId: o.customerId,
    paymentTermsDays: Number(o.customer?.paymentTermsDays || 30),
    status: o.status,
    grandTotal: Number(o.grandTotal || 0),
    createdAt: o.createdAt.toISOString(),
    deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString().split('T')[0] : null,
    items: (o.items || []).map(i => ({
      productId: i.productId,
      productCode: i.product?.code || '',
      productName: i.product?.name || '',
      quantity: Number(i.quantity || 0),
      unitPrice: Number(i.unitPrice || 0),
      deliveryDate: i.deliveryDate ? i.deliveryDate.toISOString().split('T')[0] : ''
    }))
  }));

  // Normalize Purchase Orders
  const purchaseOrdersData = purchaseOrders.map(po => ({
    id: po.id,
    referenceNo: po.referenceNo || 'PO',
    supplierId: po.supplierId,
    supplierName: po.supplier?.name || 'Supplier',
    materialName: po.name,
    quantity: Number(po.quantity || 0),
    amount: Number(po.grandTotal || po.amount || 0),
    paidAmount: Number(po.paidAmount || 0),
    expectedDelivery: po.expectedDelivery ? po.expectedDelivery.toISOString() : null,
    paymentStatus: po.paymentStatus || 'UNPAID',
    status: po.status,
    createdAt: po.createdAt.toISOString()
  }));

  // Normalize Goods Receipt Notes (GRN)
  const goodsReceiptNotesData = grns.map(g => ({
    id: g.id,
    referenceNo: g.referenceNo,
    poId: g.poId,
    receivedDate: g.receivedDate ? g.receivedDate.toISOString() : null,
    status: g.status,
    isShortDelivery: Boolean(g.isShortDelivery),
    items: (g.items || []).map(i => ({
      rmName: i.rmName,
      expectedQty: Number(i.expectedQty || 0),
      actualReceivedQty: Number(i.actualReceivedQty || 0),
      rejectedQty: Number(i.rejectedQty || 0)
    }))
  }));

  // Normalize Production Batches
  const productionBatchData = productionBatches.map(b => {
    const planned = Number(b.quantity || 1);
    const actual = Number(b.actualOutput || planned);
    const yieldPercent = Number(((actual / planned) * 100).toFixed(2));

    return {
      id: b.id,
      referenceNo: b.referenceNo,
      productId: b.productId,
      productCode: b.product?.code || '',
      productName: b.product?.name || '',
      productionType: b.productionType || 'Make to Stock',
      status: b.status,
      startDate: b.startDate ? b.startDate.toISOString() : null,
      completeDate: b.completeDate ? b.completeDate.toISOString() : null,
      quantity: planned,
      actualOutput: actual,
      yieldPercent,
      rmUsages: (b.rmUsages || []).map(u => ({
        rmId: u.rmId,
        requiredQty: Number(u.requiredQty || 0),
        actualUsedQty: Number(u.actualUsedQty || 0),
        status: u.status
      }))
    };
  });

  // Calculate live Attendance Rate from logs
  const totalUsersCount = Math.max(1, users.length);
  const workdays60 = 44; // ~5 days/week over 60 days
  const expectedAttendanceLogs = totalUsersCount * workdays60;
  const actualLogsCount = attendanceLogs.length;
  const attendanceRate = actualLogsCount > 0 ? Math.min(1.0, Math.max(0.75, Number((actualLogsCount / expectedAttendanceLogs).toFixed(2)))) : 0.88;

  // Master Stages
  const stagesData = stagesMaster.map(s => ({
    id: s.id,
    stageName: s.name,
    standardHours: 2.0
  }));

  // Operating Expenses
  const operatingExpensesData = expenses.map(e => ({
    id: e.id,
    title: e.title,
    amount: Number(e.amount || 0),
    category: e.category || 'General Operations',
    date: e.date ? e.date.toISOString().split('T')[0] : ''
  }));

  // Suppliers with credit terms
  const suppliersData = suppliers.map(s => ({
    id: s.id,
    supplierName: s.name,
    creditLimit: Number(s.creditLimit || 0),
    openingBalance: Number(s.openingBalance || 0),
    creditPeriodDays: 30 // standard supplier credit period
  }));

  // Customers
  const customersData = customers.map(c => ({
    id: c.id,
    name: c.name,
    creditLimit: Number(c.creditLimit || 0),
    paymentTermsDays: Number(c.paymentTermsDays || 30),
    openingBalance: Number(c.openingBalance || 0)
  }));

  // Sales Returns
  const salesReturnsData = salesReturns.map(sr => ({
    id: sr.id,
    returnNo: sr.returnNo,
    reason: sr.reason,
    refundMethod: sr.refundMethod,
    createdAt: sr.createdAt.toISOString(),
    items: (sr.items || []).map(item => ({
      productId: item.productId,
      productName: item.product?.name || '',
      quantity: Number(item.quantity || 0),
      condition: item.condition
    }))
  }));

  // Purchase Returns
  const purchaseReturnsData = purchaseReturns.map(pr => ({
    id: pr.id,
    referenceNo: pr.referenceNo,
    poId: pr.poId,
    grnId: pr.grnId,
    returnQty: Number(pr.returnQty || 0),
    returnReason: pr.returnReason,
    returnDate: pr.returnDate ? pr.returnDate.toISOString() : null,
    status: pr.status
  }));

  // Sales Campaigns
  const salesCampaignsData = salesCampaigns.map(sc => ({
    id: sc.id,
    name: sc.name,
    status: sc.status,
    preOrdersCount: sc.preOrders?.length || 0
  }));

  // Lab Tests summary
  const labTestsData = {
    grnLabTests: grnLabTests.map(t => ({
      id: t.id,
      grnId: t.grnId,
      status: t.status,
      overallDecision: t.overallDecision,
      categoryParams: t.categoryParams
    })),
    productionLabTests: labProductionTests.map(t => ({
      id: t.id,
      batchId: t.productionBatchId,
      result: t.result,
      action: t.action,
      qcParams: t.qcParams
    }))
  };

  return {
    systemContext: {
      enterpriseName,
      asOfDate: asOfDate.toISOString(),
      reportingCurrency,
      horizonDays
    },
    inventoryData: {
      finishedProducts: finishedProductsData,
      rawMaterials: rawMaterialsData
    },
    salesAndOrderData: {
      customerOrders: customerOrdersData,
      customers: customersData
    },
    procurementAndVendorData: {
      purchaseOrders: purchaseOrdersData,
      goodsReceiptNotes: goodsReceiptNotesData,
      suppliers: suppliersData
    },
    productionBatchData: {
      batches: productionBatchData
    },
    workforceData: {
      activeUsers: users,
      attendanceRate,
      stages: stagesData
    },
    qualityAndLabData: labTestsData,
    financialsAndBudgets: {
      operatingExpenses: operatingExpensesData,
      supplierBalances: suppliersData
    },
    salesCampaignData: {
      campaigns: salesCampaignsData
    },
    returnsData: {
      salesReturns: salesReturnsData,
      purchaseReturns: purchaseReturnsData
    }
  };
}

module.exports = {
  extractERPPayload
};
