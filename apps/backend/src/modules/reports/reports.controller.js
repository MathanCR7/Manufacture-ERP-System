const prisma = require('../../database/prisma');
const { resolveDateRange } = require('../../utils/dateRangePresets');

class ReportsController {
  // ============================================================================
  // 1. RAW MATERIAL CONSUMPTION REPORT
  // ============================================================================
  async getRMConsumptionReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, rmId, batchId, categoryId, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const whereClause = {
        batch: {
          startDate: {
            gte: rangeStart,
            lte: rangeEnd
          }
        }
      };

      if (rmId) whereClause.rmId = rmId;
      if (batchId) whereClause.batchId = batchId;
      if (categoryId) {
        whereClause.rawMaterial = {
          categoryId: categoryId
        };
      }

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

      const [totalRecords, items, allAggregates] = await Promise.all([
        prisma.productionBatchRMUsage.count({ where: whereClause }),
        prisma.productionBatchRMUsage.findMany({
          where: whereClause,
          include: {
            rawMaterial: {
              include: { category: true }
            },
            batch: {
              select: {
                id: true,
                referenceNo: true,
                batchNo: true,
                startDate: true,
                status: true,
                product: {
                  select: { id: true, name: true, code: true }
                }
              }
            }
          },
          orderBy: {
            batch: {
              startDate: 'desc'
            }
          },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.productionBatchRMUsage.findMany({
          where: whereClause,
          select: {
            actualUsedQty: true,
            requiredQty: true,
            totalCost: true,
            unitCost: true
          }
        })
      ]);

      let totalQuantityConsumed = 0;
      let totalCostConsumed = 0;
      let varianceCount = 0;
      let totalUnitCostSum = 0;

      for (const row of allAggregates) {
        const actual = Number(row.actualUsedQty || 0);
        const reqQty = Number(row.requiredQty || 0);
        const cost = Number(row.totalCost || 0);
        const unitCost = Number(row.unitCost || 0);

        totalQuantityConsumed += actual;
        totalCostConsumed += cost;
        totalUnitCostSum += unitCost;
        if (Math.abs(actual - reqQty) > 0.001) {
          varianceCount++;
        }
      }

      const avgUnitCost = allAggregates.length > 0 ? totalUnitCostSum / allAggregates.length : 0;

      // Scrap & Loss aggregation for the same period
      const lossRecords = await prisma.productionLossMaterial.findMany({
        where: {
          loss: {
            date: {
              gte: rangeStart,
              lte: rangeEnd
            }
          }
        },
        select: {
          lossQty: true,
          lossAmount: true
        }
      });

      const totalScrapQty = lossRecords.reduce((sum, r) => sum + Number(r.lossQty || 0), 0);
      const totalScrapCost = lossRecords.reduce((sum, r) => sum + Number(r.lossAmount || 0), 0);
      const scrapLossPercentage = (totalQuantityConsumed + totalScrapQty) > 0
        ? ((totalScrapQty / (totalQuantityConsumed + totalScrapQty)) * 100).toFixed(2)
        : 0;

      res.json({
        data: items,
        aggregates: {
          totalQuantityConsumed: totalQuantityConsumed.toFixed(2),
          totalCostConsumed: totalCostConsumed.toFixed(2),
          varianceCount,
          avgUnitCost: avgUnitCost.toFixed(2),
          totalScrapQty: totalScrapQty.toFixed(2),
          totalScrapCost: totalScrapCost.toFixed(2),
          scrapLossPercentage: Number(scrapLossPercentage)
        },
        pagination: {
          page: p,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 2. PRODUCTION BATCH REPORT
  // ============================================================================
  async getProductionBatchesReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, status, productId, productionType, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const whereClause = {
        startDate: {
          gte: rangeStart,
          lte: rangeEnd
        }
      };

      if (status && status !== 'All') whereClause.status = status;
      if (productId) whereClause.productId = productId;
      if (productionType && productionType !== 'All') whereClause.productionType = productionType;

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

      const [totalRecords, batches, allBatchesForAggs] = await Promise.all([
        prisma.productionBatchNew.count({ where: whereClause }),
        prisma.productionBatchNew.findMany({
          where: whereClause,
          include: {
            product: {
              include: { category: true, unit: true }
            },
            currentStage: true,
            creator: {
              select: { id: true, name: true, email: true, role: true }
            },
            rmUsages: {
              select: { id: true, totalCost: true }
            },
            losses: {
              select: { id: true, totalLoss: true }
            }
          },
          orderBy: { startDate: 'desc' },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.productionBatchNew.findMany({
          where: whereClause,
          select: {
            status: true,
            quantity: true,
            actualOutput: true,
            totalCost: true,
            startDate: true,
            completeDate: true
          }
        })
      ]);

      const data = batches.map(b => {
        const planned = Number(b.quantity || 0);
        const actual = b.actualOutput != null ? Number(b.actualOutput) : null;
        const yieldPercent = (actual != null && planned > 0) ? ((actual / planned) * 100).toFixed(2) : null;
        const totalCost = Number(b.totalCost || 0);
        const costPerUnit = (actual != null && actual > 0) ? (totalCost / actual).toFixed(2) : (planned > 0 ? (totalCost / planned).toFixed(2) : 0);

        let cycleTimeHours = null;
        if (b.startDate && b.completeDate) {
          const diffMs = new Date(b.completeDate) - new Date(b.startDate);
          cycleTimeHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
        }

        return {
          ...b,
          yieldPercent: yieldPercent ? Number(yieldPercent) : null,
          costPerUnit: Number(costPerUnit),
          cycleTimeHours: cycleTimeHours ? Number(cycleTimeHours) : null
        };
      });

      const statusCounts = {};
      let totalYieldSum = 0;
      let yieldCount = 0;
      let totalBatchCost = 0;
      let totalPlannedOutput = 0;
      let totalActualOutput = 0;

      for (const b of allBatchesForAggs) {
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
        totalBatchCost += Number(b.totalCost || 0);
        totalPlannedOutput += Number(b.quantity || 0);

        if (b.actualOutput != null && Number(b.quantity || 0) > 0) {
          const actual = Number(b.actualOutput);
          totalActualOutput += actual;
          totalYieldSum += (actual / Number(b.quantity)) * 100;
          yieldCount++;
        }
      }

      const avgYieldPercent = yieldCount > 0 ? (totalYieldSum / yieldCount).toFixed(2) : 100;

      res.json({
        data,
        aggregates: {
          totalBatches: allBatchesForAggs.length,
          statusCounts,
          avgYieldPercent: Number(avgYieldPercent),
          totalBatchCost: totalBatchCost.toFixed(2),
          totalPlannedOutput: totalPlannedOutput.toFixed(2),
          totalActualOutput: totalActualOutput.toFixed(2)
        },
        pagination: {
          page: p,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 3. PRODUCT STOCK REPORT
  // ============================================================================
  async getProductStockReport(req, res, next) {
    try {
      const { categoryId, stockStatus, search, page = 1, pageSize = 20 } = req.query;

      const whereClause = {
        deletedAt: null
      };

      if (categoryId && categoryId !== 'All') {
        whereClause.categoryId = categoryId;
      }

      if (search && search.trim()) {
        const query = search.trim();
        whereClause.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } }
        ];
      }

      const products = await prisma.finishedProduct.findMany({
        where: whereClause,
        include: {
          category: true,
          unit: true,
          stockLevels: true
        },
        orderBy: { name: 'asc' }
      });

      const enriched = products.map(p => {
        const currentStock = Number(p.currentStock || 0);
        const alertLevel = Number(p.alertLevel || 0);
        const totalCost = Number(p.totalCost || 0);
        const salePrice = Number(p.salePrice || 0);
        const stockLevel = (p.stockLevels && p.stockLevels[0]) || null;
        const reorderPoint = stockLevel ? Number(stockLevel.reorderPoint || 0) : alertLevel;
        const maxLevel = stockLevel ? Number(stockLevel.maxLevel || 0) : 0;

        let healthStatus = 'In Stock';
        if (currentStock === 0) {
          healthStatus = 'Out of Stock';
        } else if (currentStock <= alertLevel) {
          healthStatus = 'Low Stock';
        } else if (maxLevel > 0 && currentStock > maxLevel) {
          healthStatus = 'Overstocked';
        }

        const stockValueAtCost = currentStock * totalCost;
        const stockValueAtSale = currentStock * salePrice;
        const reorderQty = Math.max(0, reorderPoint - currentStock);

        return {
          ...p,
          currentStock,
          alertLevel,
          totalCost,
          salePrice,
          stockValueAtCost: Number(stockValueAtCost.toFixed(2)),
          stockValueAtSale: Number(stockValueAtSale.toFixed(2)),
          healthStatus,
          reorderQty: Number(reorderQty.toFixed(2))
        };
      });

      // Filter by stockStatus if requested
      const filtered = stockStatus && stockStatus !== 'All'
        ? enriched.filter(p => p.healthStatus === stockStatus)
        : enriched;

      let totalInventoryCostValue = 0;
      let totalPotentialSalesValue = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      let inStockCount = 0;

      for (const p of enriched) {
        totalInventoryCostValue += p.stockValueAtCost;
        totalPotentialSalesValue += p.stockValueAtSale;
        if (p.healthStatus === 'Low Stock') lowStockCount++;
        if (p.healthStatus === 'Out of Stock') outOfStockCount++;
        if (p.healthStatus === 'In Stock') inStockCount++;
      }

      const pNum = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
      const totalRecords = filtered.length;
      const paginatedData = filtered.slice((pNum - 1) * ps, pNum * ps);

      res.json({
        data: paginatedData,
        aggregates: {
          totalProducts: enriched.length,
          totalInventoryCostValue: totalInventoryCostValue.toFixed(2),
          totalPotentialSalesValue: totalPotentialSalesValue.toFixed(2),
          lowStockCount,
          outOfStockCount,
          inStockCount
        },
        pagination: {
          page: pNum,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 4. SALES SUMMARY REPORT
  // ============================================================================
  async getSalesSummaryReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, customerId, status, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const whereClause = {
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      };

      if (customerId) whereClause.customerId = customerId;
      if (status && status !== 'All') whereClause.status = status;

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

      const [totalRecords, orders, allOrders] = await Promise.all([
        prisma.customerOrder.count({ where: whereClause }),
        prisma.customerOrder.findMany({
          where: whereClause,
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, code: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.customerOrder.findMany({
          where: whereClause,
          select: {
            grandTotal: true,
            createdAt: true,
            items: {
              select: { quantity: true, unitPrice: true }
            }
          }
        })
      ]);

      let totalRevenue = 0;
      let totalUnitsSold = 0;
      const trendMap = {};

      for (const ord of allOrders) {
        const rev = Number(ord.grandTotal || 0);
        totalRevenue += rev;

        const dayKey = new Date(ord.createdAt).toISOString().split('T')[0];
        trendMap[dayKey] = (trendMap[dayKey] || 0) + rev;

        if (ord.items && ord.items.length > 0) {
          for (const item of ord.items) {
            totalUnitsSold += Number(item.quantity || 0);
          }
        }
      }

      const totalOrders = allOrders.length;
      const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

      // Convert trendMap to sorted array for chart
      const trend = Object.keys(trendMap).sort().map(d => ({
        date: d,
        revenue: Number(trendMap[d].toFixed(2))
      }));

      res.json({
        data: orders,
        aggregates: {
          totalOrders,
          totalRevenue: totalRevenue.toFixed(2),
          totalUnitsSold: totalUnitsSold.toFixed(2),
          avgOrderValue: Number(avgOrderValue)
        },
        trend,
        pagination: {
          page: p,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 5. TOP & LEAST SELLING PRODUCT PERFORMANCE REPORT
  // ============================================================================
  async getProductPerformanceReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, sortBy = 'quantity', limit = 10 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);
      const topLimit = Math.max(3, Math.min(50, parseInt(limit, 10) || 10));

      // Fetch all finished products
      const allProducts = await prisma.finishedProduct.findMany({
        where: { deletedAt: null },
        include: { category: true, unit: true }
      });

      // Fetch sales items in date range
      const orderItems = await prisma.customerOrderItem.findMany({
        where: {
          order: {
            createdAt: {
              gte: rangeStart,
              lte: rangeEnd
            }
          }
        },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          discount: true
        }
      });

      // Aggregate by product
      const productSalesMap = {};
      let overallTotalRevenue = 0;
      let overallTotalUnits = 0;

      for (const item of orderItems) {
        const pid = item.productId;
        const qty = Number(item.quantity || 0);
        const rate = Number(item.unitPrice || 0);
        const disc = Number(item.discount || 0);
        const rev = (rate - disc) * qty;

        overallTotalRevenue += rev;
        overallTotalUnits += qty;

        if (!productSalesMap[pid]) {
          productSalesMap[pid] = { unitsSold: 0, revenue: 0 };
        }
        productSalesMap[pid].unitsSold += qty;
        productSalesMap[pid].revenue += rev;
      }

      const performanceList = allProducts.map(p => {
        const stats = productSalesMap[p.id] || { unitsSold: 0, revenue: 0 };
        const shareOfSales = overallTotalRevenue > 0
          ? ((stats.revenue / overallTotalRevenue) * 100).toFixed(2)
          : 0;

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          categoryName: p.category?.name || 'General',
          unitSymbol: p.unit?.symbol || 'Units',
          currentStock: Number(p.currentStock || 0),
          salePrice: Number(p.salePrice || 0),
          unitsSold: Number(stats.unitsSold.toFixed(2)),
          revenue: Number(stats.revenue.toFixed(2)),
          shareOfSales: Number(shareOfSales)
        };
      });

      // Sort by chosen metric
      const sortField = sortBy === 'revenue' ? 'revenue' : 'unitsSold';

      const sortedDesc = [...performanceList].sort((a, b) => b[sortField] - a[sortField]);
      const topSelling = sortedDesc.slice(0, topLimit).map((item, idx) => ({ ...item, rank: idx + 1 }));

      const sortedAsc = [...performanceList].sort((a, b) => a[sortField] - b[sortField]);
      const leastSelling = sortedAsc.slice(0, topLimit).map((item, idx) => ({ ...item, rank: idx + 1 }));

      res.json({
        topSelling,
        leastSelling,
        aggregates: {
          totalProducts: allProducts.length,
          overallTotalRevenue: overallTotalRevenue.toFixed(2),
          overallTotalUnits: overallTotalUnits.toFixed(2),
          sortBy
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 6. PURCHASE & VENDOR REPORT
  // ============================================================================
  async getPurchaseVendorReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, supplierId, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const whereClause = {
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      };

      if (supplierId) whereClause.supplierId = supplierId;

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

      const [totalRecords, poList, allPOs] = await Promise.all([
        prisma.rawMaterialPO.count({ where: whereClause }),
        prisma.rawMaterialPO.findMany({
          where: whereClause,
          include: {
            supplier: true
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.rawMaterialPO.findMany({
          where: whereClause,
          include: {
            supplier: { select: { id: true, name: true } }
          }
        })
      ]);

      let totalPurchaseValue = 0;
      const vendorSpendMap = {};

      for (const po of allPOs) {
        const val = Number(po.totalAmount || po.grandTotal || 0);
        totalPurchaseValue += val;

        const sName = po.supplier?.name || 'Unknown Vendor';
        vendorSpendMap[sName] = (vendorSpendMap[sName] || 0) + val;
      }

      const topVendors = Object.keys(vendorSpendMap)
        .map(name => ({ name, spend: Number(vendorSpendMap[name].toFixed(2)) }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

      res.json({
        data: poList,
        aggregates: {
          totalOrders: allPOs.length,
          totalPurchaseValue: totalPurchaseValue.toFixed(2),
          activeVendorsCount: Object.keys(vendorSpendMap).length,
          topVendors
        },
        pagination: {
          page: p,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 7. QC / LAB TEST REPORT
  // ============================================================================
  async getQCLabReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, status, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const whereClause = {
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      };

      if (status && status !== 'All') whereClause.status = status;

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

      const [totalRecords, tests, allTests] = await Promise.all([
        prisma.labProductionTestNew.count({ where: whereClause }),
        prisma.labProductionTestNew.findMany({
          where: whereClause,
          include: {
            batch: {
              select: {
                referenceNo: true,
                batchNo: true,
                product: { select: { name: true, code: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.labProductionTestNew.findMany({
          where: whereClause,
          select: { status: true, defectReason: true }
        })
      ]);

      let passedCount = 0;
      let failedCount = 0;
      let pendingCount = 0;
      const failureReasons = {};

      for (const t of allTests) {
        const s = (t.status || '').toUpperCase();
        if (s === 'PASSED' || s === 'QC_PASSED') passedCount++;
        else if (s === 'FAILED' || s === 'QC_FAILED') {
          failedCount++;
          const reason = t.defectReason || 'Unspecified Defect';
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        } else {
          pendingCount++;
        }
      }

      const totalEvaluated = passedCount + failedCount;
      const passRate = totalEvaluated > 0 ? ((passedCount / totalEvaluated) * 100).toFixed(1) : 100;
      const failRate = totalEvaluated > 0 ? ((failedCount / totalEvaluated) * 100).toFixed(1) : 0;

      res.json({
        data: tests,
        aggregates: {
          totalTests: allTests.length,
          passedCount,
          failedCount,
          pendingCount,
          passRate: Number(passRate),
          failRate: Number(failRate),
          failureReasons
        },
        pagination: {
          page: p,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 8. WASTAGE & LOSS REPORT
  // ============================================================================
  async getWastageLossReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const whereClause = {
        loss: {
          date: {
            gte: rangeStart,
            lte: rangeEnd
          }
        }
      };

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));

      const [totalRecords, items, allLosses] = await Promise.all([
        prisma.productionLossMaterial.count({ where: whereClause }),
        prisma.productionLossMaterial.findMany({
          where: whereClause,
          include: {
            rawMaterial: true,
            loss: {
              include: {
                batch: {
                  select: { referenceNo: true, batchNo: true }
                },
                responsiblePerson: {
                  select: { name: true }
                }
              }
            }
          },
          orderBy: { loss: { date: 'desc' } },
          skip: (p - 1) * ps,
          take: ps
        }),
        prisma.productionLossMaterial.findMany({
          where: whereClause,
          include: {
            rawMaterial: { select: { name: true } }
          }
        })
      ]);

      let totalLossQty = 0;
      let totalLossAmount = 0;
      const rmLossMap = {};

      for (const row of allLosses) {
        const qty = Number(row.lossQty || 0);
        const amt = Number(row.lossAmount || 0);
        totalLossQty += qty;
        totalLossAmount += amt;

        const name = row.rawMaterial?.name || 'Raw Material';
        rmLossMap[name] = (rmLossMap[name] || 0) + amt;
      }

      const topLossRMs = Object.keys(rmLossMap)
        .map(name => ({ name, lossValue: Number(rmLossMap[name].toFixed(2)) }))
        .sort((a, b) => b.lossValue - a.lossValue)
        .slice(0, 5);

      res.json({
        data: items,
        aggregates: {
          totalLossIncidents: allLosses.length,
          totalLossQty: totalLossQty.toFixed(2),
          totalLossAmount: totalLossAmount.toFixed(2),
          topLossRMs
        },
        pagination: {
          page: p,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 9. STOCK AGING REPORT
  // ============================================================================
  async getStockAgingReport(req, res, next) {
    try {
      const { categoryId, page = 1, pageSize = 20 } = req.query;

      const whereClause = { deletedAt: null };
      if (categoryId && categoryId !== 'All') whereClause.categoryId = categoryId;

      const products = await prisma.finishedProduct.findMany({
        where: whereClause,
        include: {
          category: true,
          unit: true,
          stockMovements: {
            where: { direction: 1 },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { name: 'asc' }
      });

      const now = new Date();
      const buckets = {
        '0-30': { count: 0, totalValuation: 0, items: [] },
        '31-60': { count: 0, totalValuation: 0, items: [] },
        '61-90': { count: 0, totalValuation: 0, items: [] },
        '90+': { count: 0, totalValuation: 0, items: [] }
      };

      const agedProducts = products.map(p => {
        const currentStock = Number(p.currentStock || 0);
        const totalCost = Number(p.totalCost || 0);
        const stockValuation = currentStock * totalCost;

        // Calculate age from latest production stock addition or creation date
        const latestIn = p.stockMovements && p.stockMovements[0];
        const refDate = latestIn ? new Date(latestIn.createdAt) : new Date(p.createdAt);
        const ageDays = Math.max(0, Math.floor((now - refDate) / (1000 * 60 * 60 * 24)));

        let bucketKey = '0-30';
        if (ageDays > 90) bucketKey = '90+';
        else if (ageDays > 60) bucketKey = '61-90';
        else if (ageDays > 30) bucketKey = '31-60';

        if (currentStock > 0) {
          buckets[bucketKey].count++;
          buckets[bucketKey].totalValuation += stockValuation;
        }

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category?.name || 'General',
          currentStock,
          totalCost,
          stockValuation: Number(stockValuation.toFixed(2)),
          ageDays,
          agingBucket: bucketKey,
          lastProductionDate: refDate.toISOString()
        };
      });

      // Filter to items with stock > 0 for aging display
      const inStockAged = agedProducts.filter(p => p.currentStock > 0).sort((a, b) => b.ageDays - a.ageDays);

      const pNum = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
      const totalRecords = inStockAged.length;
      const paginatedData = inStockAged.slice((pNum - 1) * ps, pNum * ps);

      res.json({
        data: paginatedData,
        buckets: {
          '0-30': { count: buckets['0-30'].count, totalValuation: Number(buckets['0-30'].totalValuation.toFixed(2)) },
          '31-60': { count: buckets['31-60'].count, totalValuation: Number(buckets['31-60'].totalValuation.toFixed(2)) },
          '61-90': { count: buckets['61-90'].count, totalValuation: Number(buckets['61-90'].totalValuation.toFixed(2)) },
          '90+': { count: buckets['90+'].count, totalValuation: Number(buckets['90+'].totalValuation.toFixed(2)) }
        },
        pagination: {
          page: pNum,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 10. OPERATOR PRODUCTIVITY REPORT
  // ============================================================================
  async getOperatorProductivityReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const batches = await prisma.productionBatchNew.findMany({
        where: {
          startDate: {
            gte: rangeStart,
            lte: rangeEnd
          }
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true, role: true }
          }
        }
      });

      const operatorMap = {};

      for (const b of batches) {
        const opId = b.createdBy || 'unknown';
        const opName = b.creator?.name || 'Unknown Operator';

        if (!operatorMap[opId]) {
          operatorMap[opId] = {
            operatorId: opId,
            operatorName: opName,
            operatorEmail: b.creator?.email || '',
            role: b.creator?.role || 'Staff',
            batchesHandled: 0,
            completedBatches: 0,
            totalPlannedQty: 0,
            totalActualOutput: 0,
            yieldSum: 0,
            yieldCount: 0,
            totalCycleTimeHours: 0,
            cycleCount: 0
          };
        }

        const op = operatorMap[opId];
        op.batchesHandled++;
        op.totalPlannedQty += Number(b.quantity || 0);

        if (b.status === 'Completed' || b.status === 'qc_passed') {
          op.completedBatches++;
        }

        if (b.actualOutput != null) {
          const actual = Number(b.actualOutput);
          op.totalActualOutput += actual;
          if (Number(b.quantity || 0) > 0) {
            op.yieldSum += (actual / Number(b.quantity)) * 100;
            op.yieldCount++;
          }
        }

        if (b.startDate && b.completeDate) {
          const diffHours = (new Date(b.completeDate) - new Date(b.startDate)) / (1000 * 60 * 60);
          op.totalCycleTimeHours += diffHours;
          op.cycleCount++;
        }
      }

      const leaderboard = Object.values(operatorMap).map(op => {
        const avgYield = op.yieldCount > 0 ? (op.yieldSum / op.yieldCount).toFixed(1) : 100;
        const avgCycleTime = op.cycleCount > 0 ? (op.totalCycleTimeHours / op.cycleCount).toFixed(1) : 0;

        return {
          operatorId: op.operatorId,
          operatorName: op.operatorName,
          operatorEmail: op.operatorEmail,
          role: op.role,
          batchesHandled: op.batchesHandled,
          completedBatches: op.completedBatches,
          totalPlannedQty: Number(op.totalPlannedQty.toFixed(2)),
          totalActualOutput: Number(op.totalActualOutput.toFixed(2)),
          avgYieldPercent: Number(avgYield),
          avgCycleTimeHours: Number(avgCycleTime)
        };
      }).sort((a, b) => b.totalActualOutput - a.totalActualOutput);

      res.json({
        data: leaderboard,
        aggregates: {
          totalOperators: leaderboard.length,
          totalBatches: batches.length
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ============================================================================
  // 11. PROFITABILITY REPORT
  // ============================================================================
  async getProfitabilityReport(req, res, next) {
    try {
      const { datePreset, startDate, endDate, page = 1, pageSize = 20 } = req.query;
      const { startDate: rangeStart, endDate: rangeEnd, preset, label } = resolveDateRange(datePreset, startDate, endDate);

      const allProducts = await prisma.finishedProduct.findMany({
        where: { deletedAt: null },
        include: { category: true }
      });

      const orderItems = await prisma.customerOrderItem.findMany({
        where: {
          order: {
            createdAt: {
              gte: rangeStart,
              lte: rangeEnd
            }
          }
        },
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          discount: true
        }
      });

      const productSales = {};
      for (const item of orderItems) {
        const pid = item.productId;
        const qty = Number(item.quantity || 0);
        const rate = Number(item.unitPrice || 0);
        const disc = Number(item.discount || 0);
        const lineRev = (rate - disc) * qty;

        if (!productSales[pid]) {
          productSales[pid] = { unitsSold: 0, revenue: 0 };
        }
        productSales[pid].unitsSold += qty;
        productSales[pid].revenue += lineRev;
      }

      let totalRevenueSum = 0;
      let totalCostSum = 0;
      let totalGrossProfitSum = 0;

      const profitabilityData = allProducts.map(p => {
        const sales = productSales[p.id] || { unitsSold: 0, revenue: 0 };
        const unitCost = Number(p.totalCost || 0);
        const unitsSold = sales.unitsSold;
        const totalRevenue = sales.revenue;
        const totalCOGS = unitsSold * unitCost; // Cost of Goods Sold
        const grossProfit = totalRevenue - totalCOGS;
        const grossMarginPercent = totalRevenue > 0
          ? ((grossProfit / totalRevenue) * 100).toFixed(1)
          : (p.profitMargin != null ? Number(p.profitMargin) : 0);

        totalRevenueSum += totalRevenue;
        totalCostSum += totalCOGS;
        totalGrossProfitSum += grossProfit;

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          categoryName: p.category?.name || 'General',
          salePrice: Number(p.salePrice || 0),
          unitCost,
          unitsSold,
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalCOGS: Number(totalCOGS.toFixed(2)),
          grossProfit: Number(grossProfit.toFixed(2)),
          grossMarginPercent: Number(grossMarginPercent)
        };
      }).sort((a, b) => b.grossProfit - a.grossProfit);

      const overallGrossMargin = totalRevenueSum > 0
        ? ((totalGrossProfitSum / totalRevenueSum) * 100).toFixed(1)
        : 0;

      const pNum = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
      const totalRecords = profitabilityData.length;
      const paginatedData = profitabilityData.slice((pNum - 1) * ps, pNum * ps);

      res.json({
        data: paginatedData,
        aggregates: {
          totalProducts: allProducts.length,
          totalRevenue: totalRevenueSum.toFixed(2),
          totalCOGS: totalCostSum.toFixed(2),
          totalGrossProfit: totalGrossProfitSum.toFixed(2),
          overallGrossMargin: Number(overallGrossMargin),
          topProduct: profitabilityData[0] ? profitabilityData[0].name : 'N/A'
        },
        pagination: {
          page: pNum,
          pageSize: ps,
          totalRecords,
          totalPages: Math.ceil(totalRecords / ps)
        },
        filterInfo: {
          preset,
          label,
          startDate: rangeStart.toISOString(),
          endDate: rangeEnd.toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportsController();
