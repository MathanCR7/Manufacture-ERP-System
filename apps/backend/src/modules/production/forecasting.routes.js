const express = require('express');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');

const router = express.Router();

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
