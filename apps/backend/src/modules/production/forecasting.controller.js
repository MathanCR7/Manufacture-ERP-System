const prisma = require('../../database/prisma');

class ForecastingController {
  /**
   * Helper to compute accurate current finished product stock from movements and openingStock
   */
  async getProductStock(productId) {
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

    const calculated = Number(product.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
    return Math.max(0, calculated > 0 ? calculated : Number(product.currentStock || 0));
  }

  /**
   * GET /api/forecasting/comprehensive
   * Unified 7-Domain Predictive Forecasting Engine with Future Calendar Milestones
   */
  async getComprehensiveForecast(req, res, next) {
    try {
      const { horizonDays: queryHorizon, startDate: qStart, endDate: qEnd } = req.query;
      const now = new Date();
      let horizonDays = parseInt(queryHorizon, 10);
      if (isNaN(horizonDays) || horizonDays <= 0) {
        if (qStart && qEnd) {
          const diffMs = new Date(qEnd).getTime() - new Date(qStart).getTime();
          horizonDays = Math.max(7, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        } else {
          horizonDays = 30;
        }
      }
      horizonDays = Math.min(365, horizonDays);

      const forecastStart = qStart ? new Date(qStart) : new Date(now);
      const forecastEnd = qEnd ? new Date(qEnd) : new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

      // 1. Ingest Data Concurrently
      const [
        products,
        rawMaterials,
        customerOrders,
        purchaseOrders,
        grnList,
        productionBatches,
        users,
        attendanceLogs,
        expenses,
        salesReturns,
        purchaseReturns,
        campaigns
      ] = await Promise.all([
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
        prisma.customerOrder.findMany({
          where: { deletedAt: null },
          include: {
            customer: true,
            items: {
              include: {
                product: true
              }
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
            qcTests: true,
            creator: { select: { id: true, name: true, role: true } }
          },
          orderBy: { startDate: 'desc' }
        }),
        prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true, role: true, empId: true }
        }),
        prisma.attendanceLog.findMany({
          where: {
            createdAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.expense.findMany({
          where: {
            date: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
          }
        }),
        prisma.salesReturn.findMany({
          include: { items: true }
        }),
        prisma.purchaseReturn.findMany(),
        prisma.salesCampaign.findMany({
          where: { status: 'Active' },
          include: { preOrders: true }
        })
      ]);

      const calendarMilestones = [];

      // =========================================================================
      // DOMAIN 1: INVENTORY & STOCK FORECASTING
      // =========================================================================
      const productSalesVelocity = {};
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      let totalUnitsSoldAll = 0;

      // Calculate historical daily velocity per finished good
      for (const order of customerOrders) {
        for (const item of order.items) {
          const pid = item.productId;
          const qty = Number(item.quantity || 0);
          if (!productSalesVelocity[pid]) {
            productSalesVelocity[pid] = { totalSold: 0, orderCount: 0, dailySales: {} };
          }
          productSalesVelocity[pid].totalSold += qty;
          productSalesVelocity[pid].orderCount++;
          totalUnitsSoldAll += qty;

          const orderDay = item.deliveryDate ? item.deliveryDate.toISOString().split('T')[0] : order.createdAt.toISOString().split('T')[0];
          productSalesVelocity[pid].dailySales[orderDay] = (productSalesVelocity[pid].dailySales[orderDay] || 0) + qty;
        }
      }

      const inventoryStockForecast = [];
      let imminentStockoutCount = 0;
      let lowStockCount = 0;

      for (const prod of products) {
        const currentStock = await this.getProductStock(prod.id);
        const stockConfig = prod.stockLevels?.[0] || null;
        const minLevel = stockConfig ? Number(stockConfig.minLevel || 0) : Number(prod.alertLevel || 0);
        const maxLevel = stockConfig ? Number(stockConfig.maxLevel || 0) : minLevel * 4 || 100;
        const configuredRop = stockConfig ? Number(stockConfig.reorderPoint || 0) : minLevel;

        const velData = productSalesVelocity[prod.id];
        const historicalUnits = velData ? velData.totalSold : 0;
        // Standard period of 60 days
        let dailyVelocity = historicalUnits > 0 ? Number((historicalUnits / 60).toFixed(3)) : 0;

        // If no past orders, check pending orders
        if (dailyVelocity === 0) {
          const pendingForProd = customerOrders
            .filter(o => !['Delivered', 'Cancelled'].includes(o.status))
            .reduce((sum, o) => sum + o.items.filter(i => i.productId === prod.id).reduce((s, i) => s + Number(i.quantity || 0), 0), 0);
          dailyVelocity = pendingForProd > 0 ? Number((pendingForProd / horizonDays).toFixed(3)) : 0;
        }

        // Standard lead time calculation from stages (days)
        let totalStageDays = 0;
        if (prod.stages && prod.stages.length > 0) {
          for (const st of prod.stages) {
            totalStageDays += Number(st.months || 0) * 30 + Number(st.days || 0) + Number(st.hours || 0) / 24 + Number(st.minutes || 0) / 1440;
          }
        }
        const leadTimeDays = Math.max(1, Math.ceil(totalStageDays) || 1);

        // Standard Deviation of Demand and Lead Time
        const sigmaD = Math.max(0.1, Number((dailyVelocity * 0.25).toFixed(2)));
        const sigmaL = 1.0;
        const zScore = 1.645; // 95% service level

        // Safety Stock = Z * sqrt(L * sigmaD^2 + Vd^2 * sigmaL^2)
        const varianceTerm = (leadTimeDays * Math.pow(sigmaD, 2)) + (Math.pow(dailyVelocity, 2) * Math.pow(sigmaL, 2));
        const safetyStock = Math.max(minLevel, Math.ceil(zScore * Math.sqrt(varianceTerm)));
        const reorderPoint = Math.max(configuredRop, Math.ceil((dailyVelocity * leadTimeDays) + safetyStock));

        // Days of inventory remaining
        const dir = dailyVelocity > 0 ? Number((currentStock / dailyVelocity).toFixed(1)) : (currentStock > 0 ? 999 : 0);

        let stockStatus = 'Balanced';
        let projectedStockoutDate = null;

        if (currentStock === 0 || dir <= 0) {
          stockStatus = 'Stockout Imminent';
          imminentStockoutCount++;
          projectedStockoutDate = now.toISOString().split('T')[0];
        } else if (dir <= leadTimeDays) {
          stockStatus = 'Stockout Imminent';
          imminentStockoutCount++;
          const stockoutDate = new Date(now.getTime() + dir * 24 * 60 * 60 * 1000);
          projectedStockoutDate = stockoutDate.toISOString().split('T')[0];
        } else if (currentStock <= reorderPoint) {
          stockStatus = 'Low Stock';
          lowStockCount++;
          const stockoutDate = new Date(now.getTime() + dir * 24 * 60 * 60 * 1000);
          projectedStockoutDate = stockoutDate.toISOString().split('T')[0];
        } else if (maxLevel > 0 && currentStock > maxLevel) {
          stockStatus = 'Overstocked';
        }

        // Recommended reorder quantity
        const recommendedReorderQuantity = Math.max(0, maxLevel > 0 ? Math.ceil(maxLevel - currentStock) : Math.ceil(reorderPoint * 1.5 - currentStock));

        // Register calendar milestone if stockout is predicted within horizon
        if (projectedStockoutDate && dir <= horizonDays) {
          calendarMilestones.push({
            date: projectedStockoutDate,
            type: 'stockout',
            title: `⚠️ Stockout Risk: ${prod.name}`,
            description: `Remaining stock (${currentStock} ${prod.unit?.abbreviation || 'units'}) will deplete in ${dir} days at ${dailyVelocity}/day velocity.`,
            severity: stockStatus === 'Stockout Imminent' ? 'critical' : 'warning',
            entityId: prod.id
          });
        }

        inventoryStockForecast.push({
          productId: prod.id,
          skuCode: prod.code,
          skuName: prod.name,
          categoryName: prod.category?.name || 'Standard',
          unit: prod.unit?.abbreviation || 'pcs',
          currentStock,
          dailyVelocity,
          leadTimeDays,
          safetyStockRecommended: safetyStock,
          reorderPointCalculated: reorderPoint,
          daysOfInventoryRemaining: dir,
          projectedStockoutDate,
          stockStatus,
          recommendedReorderQuantity,
          salePrice: Number(prod.salePrice || 0),
          totalCost: Number(prod.totalCost || 0)
        });
      }

      // =========================================================================
      // DOMAIN 2: WORKFORCE & CAPACITY FORECASTING
      // =========================================================================
      const pendingOrders = customerOrders.filter(o => !['Delivered', 'Cancelled'].includes(o.status));
      let totalWorkloadHours = 0;
      const stageWorkloadMap = {};

      for (const order of pendingOrders) {
        for (const item of order.items) {
          const prod = products.find(p => p.id === item.productId);
          if (!prod) continue;
          const qty = Number(item.quantity || 0);

          if (prod.stages && prod.stages.length > 0) {
            for (const st of prod.stages) {
              const sHours = Number(st.months || 0) * 720 + Number(st.days || 0) * 24 + Number(st.hours || 0) + Number(st.minutes || 0) / 60;
              const stageTotal = sHours * qty;
              totalWorkloadHours += stageTotal;

              const stageName = st.stage?.name || 'Production Stage';
              if (!stageWorkloadMap[stageName]) {
                stageWorkloadMap[stageName] = { standardHours: 0, projectedHours: 0, orderCount: 0 };
              }
              stageWorkloadMap[stageName].standardHours += sHours;
              stageWorkloadMap[stageName].projectedHours += stageTotal;
              stageWorkloadMap[stageName].orderCount++;
            }
          } else {
            // Default 1.5 standard hours per finished unit
            totalWorkloadHours += qty * 1.5;
          }
        }
      }

      // Available labor hours
      const productionStaff = users.filter(u => ['PRODUCTION_STAFF', 'LAB_ASSISTANT', 'SUPERVISOR'].includes(u.role));
      const workdaysInHorizon = Math.round(horizonDays * (5 / 7));
      const shiftHoursPerDay = 8;
      const operatorEfficiency = 0.88;
      const availableStaffHours = Number((productionStaff.length * workdaysInHorizon * shiftHoursPerDay * operatorEfficiency).toFixed(1));

      const capacityUtilizationPercent = availableStaffHours > 0
        ? Number(((totalWorkloadHours / availableStaffHours) * 100).toFixed(1))
        : 100;

      const staffShortfallOrSurplus = Number((availableStaffHours - totalWorkloadHours).toFixed(1));

      const recommendedShiftCoverage = [
        {
          role: 'PRODUCTION_STAFF',
          currentHeadcount: users.filter(u => u.role === 'PRODUCTION_STAFF').length,
          requiredHeadcount: Math.max(1, Math.ceil((totalWorkloadHours * 0.65) / (workdaysInHorizon * shiftHoursPerDay * operatorEfficiency)))
        },
        {
          role: 'LAB_ASSISTANT',
          currentHeadcount: users.filter(u => u.role === 'LAB_ASSISTANT').length,
          requiredHeadcount: Math.max(1, Math.ceil((totalWorkloadHours * 0.15) / (workdaysInHorizon * shiftHoursPerDay * operatorEfficiency)))
        },
        {
          role: 'SUPERVISOR',
          currentHeadcount: users.filter(u => u.role === 'SUPERVISOR').length,
          requiredHeadcount: Math.max(1, Math.ceil((totalWorkloadHours * 0.20) / (workdaysInHorizon * shiftHoursPerDay * operatorEfficiency)))
        }
      ];

      const stageBottlenecks = Object.keys(stageWorkloadMap).map(sName => {
        const item = stageWorkloadMap[sName];
        const riskLevel = item.projectedHours > availableStaffHours * 0.4 ? 'HIGH' : (item.projectedHours > availableStaffHours * 0.2 ? 'MEDIUM' : 'LOW');
        return {
          stageName: sName,
          standardHours: Number(item.standardHours.toFixed(1)),
          projectedHours: Number(item.projectedHours.toFixed(1)),
          orderCount: item.orderCount,
          riskLevel
        };
      }).sort((a, b) => b.projectedHours - a.projectedHours);

      // =========================================================================
      // DOMAIN 3: CASH FLOW / RECEIVABLES & PAYABLES FORECASTING
      // =========================================================================
      let projectedInflowsReceivables = 0;
      let projectedOutflowsPayables = 0;
      const weeklyBuckets = {};

      const weeksCount = Math.ceil(horizonDays / 7);
      for (let w = 1; w <= weeksCount; w++) {
        weeklyBuckets[`Week ${w}`] = { week: `Week ${w}`, expectedInflows: 0, expectedPayables: 0, scheduledOpEx: 0, netCashFlow: 0 };
      }

      // 1. Receivables from Customer Orders
      const topAtRiskAccounts = [];
      for (const order of customerOrders) {
        const grandTotal = Number(order.grandTotal || 0);
        const creditDays = Number(order.customer?.paymentTermsDays || 0);
        const orderDate = new Date(order.deliveryDate || order.createdAt);
        const expectedCollectionDate = new Date(orderDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

        // Aging probability realization factor
        const daysPastDue = Math.max(0, Math.floor((now.getTime() - expectedCollectionDate.getTime()) / (1000 * 60 * 60 * 24)));
        let realizationFactor = 0.98;
        if (daysPastDue > 90) realizationFactor = 0.45;
        else if (daysPastDue > 60) realizationFactor = 0.75;
        else if (daysPastDue > 30) realizationFactor = 0.90;

        const collectibleAmount = Number((grandTotal * realizationFactor).toFixed(2));

        if (expectedCollectionDate >= now && expectedCollectionDate <= forecastEnd) {
          projectedInflowsReceivables += collectibleAmount;
          const diffDays = Math.max(0, Math.floor((expectedCollectionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const weekIdx = Math.min(weeksCount, Math.floor(diffDays / 7) + 1);
          if (weeklyBuckets[`Week ${weekIdx}`]) {
            weeklyBuckets[`Week ${weekIdx}`].expectedInflows += collectibleAmount;
          }

          // Calendar Milestone for significant collection
          if (collectibleAmount > 500) {
            calendarMilestones.push({
              date: expectedCollectionDate.toISOString().split('T')[0],
              type: 'cash_inflow',
              title: `💵 Receivables Inflow: ₹${collectibleAmount.toLocaleString('en-IN')}`,
              description: `Expected collection from ${order.customer?.name || 'Customer'} (Ref: ${order.referenceNo})`,
              severity: 'success',
              entityId: order.id,
              ref: order.referenceNo || null
            });
          }
        }

        if (daysPastDue > 30) {
          topAtRiskAccounts.push({
            partyName: order.customer?.name || 'Unknown Customer',
            type: 'Customer',
            referenceNo: order.referenceNo,
            balance: grandTotal,
            dueDays: daysPastDue,
            riskStatus: daysPastDue > 60 ? 'Severe Delinquency' : 'Overdue'
          });
        }
      }

      // 2. Scheduled Payables from RawMaterialPOs
      for (const po of purchaseOrders) {
        const unpaid = Math.max(0, Number(po.grandTotal || po.amount || 0) - Number(po.paidAmount || 0));
        if (unpaid <= 0) continue;

        const poDate = new Date(po.expectedDelivery || po.createdAt);
        const creditDays = 30; // standard supplier credit period
        const paymentDueDate = new Date(poDate.getTime() + creditDays * 24 * 60 * 60 * 1000);

        if (paymentDueDate >= now && paymentDueDate <= forecastEnd) {
          projectedOutflowsPayables += unpaid;
          const diffDays = Math.max(0, Math.floor((paymentDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const weekIdx = Math.min(weeksCount, Math.floor(diffDays / 7) + 1);
          if (weeklyBuckets[`Week ${weekIdx}`]) {
            weeklyBuckets[`Week ${weekIdx}`].expectedPayables += unpaid;
          }

          calendarMilestones.push({
            date: paymentDueDate.toISOString().split('T')[0],
            type: 'cash_outflow',
            title: `💸 Supplier Payable Due: ₹${unpaid.toLocaleString('en-IN')}`,
            description: `Payment due to ${po.supplier?.name || 'Supplier'} for PO ${po.referenceNo}`,
            severity: 'info',
            entityId: po.id,
            ref: po.referenceNo || null
          });
        }
      }

      // 3. Operating Expenses Run-rate from live database
      const recentExpensesSum = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const dailyOpEx = recentExpensesSum > 0 ? recentExpensesSum / 90 : 0;
      const projectedOperatingExpenses = Number((dailyOpEx * horizonDays).toFixed(2));

      // Spread OpEx into weekly buckets
      Object.keys(weeklyBuckets).forEach(k => {
        const b = weeklyBuckets[k];
        b.scheduledOpEx = Number((dailyOpEx * 7).toFixed(2));
        b.netCashFlow = Number((b.expectedInflows - b.expectedPayables - b.scheduledOpEx).toFixed(2));
        b.expectedInflows = Number(b.expectedInflows.toFixed(2));
        b.expectedPayables = Number(b.expectedPayables.toFixed(2));
      });

      const netLiquidityImpact = Number((projectedInflowsReceivables - projectedOutflowsPayables - projectedOperatingExpenses).toFixed(2));
      const cashDeficitRisk = netLiquidityImpact < 0;

      // =========================================================================
      // DOMAIN 4: VENDOR & LEAD-TIME FORECASTING
      // =========================================================================
      const vendorStats = {};
      for (const po of purchaseOrders) {
        const sId = po.supplierId || (po.supplier?.id);
        const sName = po.supplier?.name || 'Standard Supplier';
        if (!vendorStats[sName]) {
          vendorStats[sName] = {
            supplierName: sName,
            totalPOs: 0,
            onTimePOs: 0,
            totalLeadTimeDays: 0,
            totalPromisedDays: 0,
            totalReceivedQty: 0,
            totalAcceptedQty: 0,
            shortDeliveryCount: 0
          };
        }
        const st = vendorStats[sName];
        st.totalPOs++;

        const created = new Date(po.createdAt);
        const promised = new Date(po.expectedDelivery || po.createdAt);
        const promisedDays = Math.max(1, Math.round((promised.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
        st.totalPromisedDays += promisedDays;

        // Register incoming PO delivery milestones
        if (promised >= now && promised <= forecastEnd) {
          calendarMilestones.push({
            date: promised.toISOString().split('T')[0],
            type: 'po_arrival',
            title: `📦 Inbound PO Delivery: ${po.name || 'Raw Materials'}`,
            description: `Expected arrival from ${sName} (PO: ${po.referenceNo || 'N/A'}, Qty: ${po.quantity})`,
            severity: 'info',
            entityId: po.id,
            ref: po.referenceNo || null
          });
        }

        // Find linked GRN
        const linkedGrn = grnList.find(g => g.poId === po.id);
        if (linkedGrn) {
          const received = new Date(linkedGrn.receivedDate);
          const actualDays = Math.max(1, Math.round((received.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
          st.totalLeadTimeDays += actualDays;

          if (received <= promised) {
            st.onTimePOs++;
          }
          if (linkedGrn.isShortDelivery) {
            st.shortDeliveryCount++;
          }

          if (linkedGrn.items && linkedGrn.items.length > 0) {
            for (const item of linkedGrn.items) {
              const rec = Number(item.actualReceivedQty || 0);
              const rej = Number(item.rejectedQty || 0);
              st.totalReceivedQty += rec;
              st.totalAcceptedQty += Math.max(0, rec - rej);
            }
          }
        }
      }

      const vendorLeadTimeForecast = Object.values(vendorStats).map(v => {
        const avgLeadTime = v.totalPOs > 0 && v.totalLeadTimeDays > 0 ? Number((v.totalLeadTimeDays / v.totalPOs).toFixed(1)) : 0.0;
        const avgPromised = v.totalPOs > 0 ? Number((v.totalPromisedDays / v.totalPOs).toFixed(1)) : 0.0;
        const bias = Number((avgLeadTime - avgPromised).toFixed(1));
        const otd = v.totalPOs > 0 ? Number(((v.onTimePOs / v.totalPOs) * 100).toFixed(1)) : 0.0;
        const qar = v.totalReceivedQty > 0 ? Number(((v.totalAcceptedQty / v.totalReceivedQty) * 100).toFixed(1)) : (v.totalPOs > 0 ? 100.0 : 0.0);
        const vri = Number(((1 - otd / 100) * 0.4 + (1 - qar / 100) * 0.4 + (v.shortDeliveryCount / Math.max(1, v.totalPOs)) * 0.2).toFixed(2));
        const buffer = Math.max(0, Math.ceil(bias > 0 ? bias : 0));

        return {
          supplierName: v.supplierName,
          totalPOsTracked: v.totalPOs,
          historicalAvgLeadTimeDays: avgLeadTime,
          promisedAvgLeadTimeDays: avgPromised,
          leadTimeVarianceDays: bias,
          onTimeDeliveryRatePercent: otd,
          qualityAcceptanceRatePercent: qar,
          vendorRiskScore: vri,
          recommendedLeadTimeBufferDays: buffer
        };
      });

      // =========================================================================
      // DOMAIN 5: MANUFACTURING & PRODUCTION FORECASTING
      // =========================================================================
      let historicalYieldSum = 0;
      let completedBatchCount = 0;
      let cycleTimeHoursSum = 0;

      for (const batch of productionBatches) {
        if (batch.status === 'Completed' || batch.status === 'qc_passed') {
          completedBatchCount++;
          const planned = Number(batch.quantity || 0);
          const actual = Number(batch.actualOutput || planned);
          if (planned > 0) {
            historicalYieldSum += (actual / planned) * 100;
          }
          if (batch.startDate && batch.completeDate) {
            const durationHrs = Math.max(1, (new Date(batch.completeDate).getTime() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60));
            cycleTimeHoursSum += durationHrs;
          }
        }

        // Active production milestones on calendar
        if (batch.status === 'In Progress' || batch.status === 'Planned') {
          const compDate = batch.completeDate ? new Date(batch.completeDate) : new Date(new Date(batch.startDate).getTime() + 48 * 60 * 60 * 1000);
          if (compDate >= now && compDate <= forecastEnd) {
            calendarMilestones.push({
              date: compDate.toISOString().split('T')[0],
              type: 'batch_complete',
              title: `⚙️ Batch Target Complete: ${batch.referenceNo}`,
              description: `Batch for ${batch.product?.name || 'Finished Product'} (${batch.quantity} units)`,
              severity: 'info',
              entityId: batch.id,
              ref: batch.referenceNo || null
            });
          }
        }
      }

      const avgHistoricalYield = completedBatchCount > 0 ? Number((historicalYieldSum / completedBatchCount).toFixed(2)) : 0.0;
      const avgWipCycleTimeHours = completedBatchCount > 0 && cycleTimeHoursSum > 0 ? Number((cycleTimeHoursSum / completedBatchCount).toFixed(1)) : 0.0;

      // Component sufficiency explosion for all pending customer order units
      const rmDemandMap = {};
      for (const order of pendingOrders) {
        for (const item of order.items) {
          const prod = products.find(p => p.id === item.productId);
          if (!prod || !prod.bom) continue;
          const orderQty = Number(item.quantity || 0);

          for (const b of prod.bom) {
            const rId = b.rmId;
            const perUnit = Number(b.consumptionPerUnit || 0);
            const reqTotal = perUnit * orderQty;

            if (!rmDemandMap[rId]) {
              const matchedRM = rawMaterials.find(rm => rm.id === rId);
              rmDemandMap[rId] = {
                rawMaterialId: rId,
                rawMaterialName: matchedRM?.name || 'Raw Material',
                code: matchedRM?.code || '',
                currentStock: Number(matchedRM?.currentStock || 0),
                unitRate: Number(matchedRM?.ratePerUnit || 0),
                requiredForOrders: 0,
                unit: matchedRM?.uoms?.[0]?.abbreviation || 'kg'
              };
            }
            rmDemandMap[rId].requiredForOrders += reqTotal;
          }
        }
      }

      const componentSufficiencyAnalysis = Object.values(rmDemandMap).map(rm => {
        const required = Number(rm.requiredForOrders.toFixed(2));
        const current = Number(rm.currentStock.toFixed(2));
        const deficit = Math.max(0, Number((required - current).toFixed(2)));
        const sufficiency = deficit === 0 ? 'Sufficient' : 'Shortage';
        const estimatedPurchaseCost = Number((deficit * rm.unitRate).toFixed(2));

        return {
          rawMaterialId: rm.rawMaterialId,
          rawMaterialName: rm.rawMaterialName,
          code: rm.code,
          unit: rm.unit,
          currentStock: current,
          requiredForBatch: required,
          deficit,
          sufficiency,
          estimatedPurchaseCost
        };
      }).sort((a, b) => b.deficit - a.deficit);

      const manufacturingProductionForecast = products.slice(0, 15).map(p => {
        const baseCycle = p.stages?.reduce((sum, st) => sum + Number(st.hours || 0) + Number(st.minutes || 0) / 60, 0) || avgWipCycleTimeHours;
        return {
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          projectedWIPCycleTimeHours: Number(baseCycle.toFixed(1)),
          projectedYieldPercent: avgHistoricalYield,
          plannedOutputQuantity: Number(p.currentStock || 0),
          expectedRawMaterialVarianceCost: Number((Number(p.totalRawMaterialCost || 0) * (avgHistoricalYield > 0 && avgHistoricalYield < 100 ? (100 - avgHistoricalYield) / 100 : 0)).toFixed(2)),
          bomComponentsCount: p.bom?.length || 0
        };
      });

      // =========================================================================
      // DOMAIN 6: WHAT-IF SCENARIO SENSITIVITY ENGINE (BASELINES)
      // =========================================================================
      let baselineRevenue = customerOrders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
      let baselineTotalCost = customerOrders.reduce((sum, o) => sum + Number(o.totalCost || 0), 0);
      if (baselineTotalCost <= 0) {
        for (const o of customerOrders) {
          for (const item of o.items) {
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
              baselineTotalCost += Number(prod.totalCost || 0) * Number(item.quantity || 0);
            }
          }
        }
      }
      const baselineGrossProfit = baselineRevenue - baselineTotalCost;
      const baselineGrossMarginPct = baselineRevenue > 0 ? Number(((baselineGrossProfit / baselineRevenue) * 100).toFixed(2)) : 0.0;

      const whatIfScenarioForecasts = [
        {
          scenarioName: 'Price Optimization (+10% Price Surge)',
          parametersChanged: { factor: 'Price', variationPercent: '+10%' },
          projectedRevenue: Number((baselineRevenue * 1.10 * 0.95).toFixed(2)), // -5% volume due to elasticity
          projectedGrossProfit: Number(((baselineRevenue * 1.10 * 0.95) - (baselineTotalCost * 0.95)).toFixed(2)),
          projectedGrossMarginImpactPercent: Number((((baselineRevenue * 1.10 * 0.95 - baselineTotalCost * 0.95) / (baselineRevenue * 1.10 * 0.95)) * 100 - baselineGrossMarginPct).toFixed(2)),
          recommendation: 'Net positive margin expansion. Feasible without major volume drop.'
        },
        {
          scenarioName: 'Promotional Festival Campaign (+25% Demand Lift)',
          parametersChanged: { factor: 'Demand Volume', variationPercent: '+25%' },
          projectedRevenue: Number((baselineRevenue * 1.25).toFixed(2)),
          projectedGrossProfit: Number(((baselineRevenue * 1.25) - (baselineTotalCost * 1.25)).toFixed(2)),
          projectedGrossMarginImpactPercent: 0.0,
          recommendation: 'Requires advance procurement of 25% extra raw materials to prevent stockouts.'
        },
        {
          scenarioName: 'Raw Material Cost Inflation (+15% Input Cost Shock)',
          parametersChanged: { factor: 'RM Rates', variationPercent: '+15%' },
          projectedRevenue: Number(baselineRevenue.toFixed(2)),
          projectedGrossProfit: Number((baselineRevenue - (baselineTotalCost * 1.15)).toFixed(2)),
          projectedGrossMarginImpactPercent: Number((((baselineRevenue - baselineTotalCost * 1.15) / baselineRevenue) * 100 - baselineGrossMarginPct).toFixed(2)),
          recommendation: 'Gross margin compresses significantly. Recommend triggering dynamic pricing adjustment.'
        }
      ];

      // =========================================================================
      // DOMAIN 7: RETURNS & REVERSE LOGISTICS FORECASTING
      // =========================================================================
      const totalSalesReturnUnits = salesReturns.reduce((sum, sr) => sum + sr.items.reduce((s, i) => s + Number(i.quantity || 0), 0), 0);
      const totalPurchaseReturnUnits = purchaseReturns.reduce((sum, pr) => sum + Number(pr.returnQty || 0), 0);
      const totalReturnedValue = salesReturns.reduce((sum, sr) => sum + sr.items.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.rate || 0)), 0), 0);

      const projectedSalesReturnRatePercent = totalUnitsSoldAll > 0
        ? Number(((totalSalesReturnUnits / totalUnitsSoldAll) * 100).toFixed(2))
        : 0.0;
      const projectedSalesReturnUnits = totalUnitsSoldAll > 0 ? Math.ceil(totalUnitsSoldAll * (projectedSalesReturnRatePercent / 100)) : 0;
      const estimatedRefundLiabilityAmount = Number(totalReturnedValue.toFixed(2));

      let resaleableCount = 0;
      let damagedCount = 0;
      let scrapCount = 0;
      for (const sr of salesReturns) {
        for (const item of sr.items) {
          const q = Number(item.quantity || 0);
          const cond = (item.condition || sr.reason || '').toLowerCase();
          if (cond.includes('scrap') || cond.includes('destroy')) scrapCount += q;
          else if (cond.includes('damage') || cond.includes('defect')) damagedCount += q;
          else resaleableCount += q;
        }
      }
      const totalScrutinized = resaleableCount + damagedCount + scrapCount;
      const salvageConditionBreakdown = totalScrutinized > 0 ? {
        resaleablePercent: Number(((resaleableCount / totalScrutinized) * 100).toFixed(1)),
        damagedDiscountedPercent: Number(((damagedCount / totalScrutinized) * 100).toFixed(1)),
        destroyedScrapPercent: Number(((scrapCount / totalScrutinized) * 100).toFixed(1))
      } : {
        resaleablePercent: 0.0,
        damagedDiscountedPercent: 0.0,
        destroyedScrapPercent: 0.0
      };

      const returnsReverseLogisticsForecast = {
        projectedSalesReturnRatePercent,
        projectedSalesReturnUnits,
        projectedPurchaseReturnRatePercent: purchaseOrders.length > 0 ? Number(((totalPurchaseReturnUnits / Math.max(1, purchaseOrders.length)) * 100).toFixed(1)) : 0.0,
        estimatedRefundLiabilityAmount,
        salvageConditionBreakdown,
        primaryRejectionDrivers: [
          'Microbial / Lab QA test mismatch (SNF/Fat variance)',
          'Transit damage / cold-chain temperature deviations',
          'Customer order cancellation or short expiry request'
        ]
      };

      // Sort calendar milestones chronologically
      calendarMilestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Return unified response
      res.json({
        success: true,
        forecastHorizon: {
          generatedAt: now.toISOString(),
          horizonDays,
          startDate: forecastStart.toISOString().split('T')[0],
          endDate: forecastEnd.toISOString().split('T')[0]
        },
        executiveKPIs: {
          projectedNetCashFlow: netLiquidityImpact,
          cashDeficitRisk,
          capacityUtilizationPercent,
          imminentStockoutCount,
          lowStockCount,
          avgVendorOTDPercent: vendorLeadTimeForecast.length > 0
            ? Number((vendorLeadTimeForecast.reduce((s, v) => s + v.onTimeDeliveryRatePercent, 0) / vendorLeadTimeForecast.length).toFixed(1))
            : 0.0,
          projectedProductionYieldPercent: avgHistoricalYield,
          totalWorkloadHours: Number(totalWorkloadHours.toFixed(1)),
          availableStaffHours
        },
        inventoryStockForecast,
        workforceCapacityForecast: {
          projectedWorkloadHours: Number(totalWorkloadHours.toFixed(1)),
          availableStaffHours,
          capacityUtilizationPercent,
          staffShortfallOrSurplus,
          recommendedShiftCoverage,
          stageBottlenecks
        },
        cashFlowForecast: {
          projectedInflowsReceivables: Number(projectedInflowsReceivables.toFixed(2)),
          projectedOutflowsPayables: Number(projectedOutflowsPayables.toFixed(2)),
          projectedOperatingExpenses,
          netLiquidityImpact,
          cashDeficitRisk,
          weeklyBreakdown: Object.values(weeklyBuckets),
          topOverdueOrAtRiskAccounts: topAtRiskAccounts
        },
        vendorLeadTimeForecast,
        manufacturingProductionForecast: {
          summary: {
            averageYieldPercent: avgHistoricalYield,
            averageCycleTimeHours: avgWipCycleTimeHours,
            totalActiveBatches: productionBatches.filter(b => !['Completed', 'Cancelled'].includes(b.status)).length
          },
          batches: manufacturingProductionForecast,
          componentSufficiency: componentSufficiencyAnalysis
        },
        whatIfScenarioForecasts: {
          baselines: {
            revenue: Number(baselineRevenue.toFixed(2)),
            totalCost: Number(baselineTotalCost.toFixed(2)),
            grossProfit: Number(baselineGrossProfit.toFixed(2)),
            grossMarginPercent: baselineGrossMarginPct
          },
          scenarios: whatIfScenarioForecasts
        },
        returnsReverseLogisticsForecast,
        calendarMilestones
      });

    } catch (error) {
      console.error('Error running comprehensive forecast:', error);
      next(error);
    }
  }

  /**
   * POST /api/forecasting/what-if
   * Interactive dynamic what-if simulation
   */
  async simulateWhatIf(req, res, next) {
    try {
      const { priceChangePercent = 0, demandLiftPercent = 0, rmInflationPercent = 0 } = req.body;

      const pDelta = Number(priceChangePercent) / 100;
      const dDelta = Number(demandLiftPercent) / 100;
      const cDelta = Number(rmInflationPercent) / 100;

      // Price elasticity assumption: -1.2
      const elasticityVolumeChange = -1.2 * pDelta;
      const netVolumeMultiplier = Math.max(0.1, 1 + elasticityVolumeChange + dDelta);

      const [products, customerOrders] = await Promise.all([
        prisma.finishedProduct.findMany({ where: { deletedAt: null } }),
        prisma.customerOrder.findMany({ where: { deletedAt: null }, include: { items: true } })
      ]);

      const prodOrderQtyMap = {};
      for (const o of customerOrders) {
        for (const item of o.items) {
          prodOrderQtyMap[item.productId] = (prodOrderQtyMap[item.productId] || 0) + Number(item.quantity || 0);
        }
      }

      let simulatedRevenue = 0;
      let simulatedCost = 0;

      for (const p of products) {
        const basePrice = Number(p.salePrice || 0);
        const baseCost = Number(p.totalCost || 0);
        const rmCost = Number(p.totalRawMaterialCost || (baseCost > 0 ? baseCost * 0.75 : 0));
        const nonRmCost = Math.max(0, baseCost - rmCost);
        const actualSold = prodOrderQtyMap[p.id] || 0;
        const volume = (actualSold > 0 ? actualSold : 1) * netVolumeMultiplier;

        const newPrice = basePrice * (1 + pDelta);
        const newCost = (rmCost * (1 + cDelta)) + nonRmCost;

        simulatedRevenue += newPrice * volume;
        simulatedCost += newCost * volume;
      }

      const grossProfit = simulatedRevenue - simulatedCost;
      const grossMarginPercent = simulatedRevenue > 0 ? Number(((grossProfit / simulatedRevenue) * 100).toFixed(2)) : 0;

      res.json({
        success: true,
        simulation: {
          priceChangePercent,
          demandLiftPercent,
          rmInflationPercent,
          netVolumeMultiplier: Number(netVolumeMultiplier.toFixed(3)),
          simulatedRevenue: Number(simulatedRevenue.toFixed(2)),
          simulatedCost: Number(simulatedCost.toFixed(2)),
          grossProfit: Number(grossProfit.toFixed(2)),
          grossMarginPercent
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ForecastingController();
