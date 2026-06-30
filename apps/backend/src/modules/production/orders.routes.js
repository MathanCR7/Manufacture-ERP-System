const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const notificationService = require('../notifications/notifications.service');
const { sendSalesInvoiceDual } = require('../../utils/communication');

const router = express.Router();

// Helper to generate unique order reference (CO-XXXXXX)
const generateOrderReference = async (tx) => {
  const result = await tx.$queryRaw`
    SELECT reference_no FROM customer_orders 
    WHERE reference_no LIKE 'CO-%' 
    ORDER BY reference_no DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.reference_no) {
    return 'CO-000001';
  }

  const lastNumberStr = lastRecord.reference_no.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;
  return `CO-${String(nextNumber).padStart(6, '0')}`;
};

// GET /api/orders/status/kanban - Grouped by status for Kanban
router.get('/status/kanban', authenticateToken, async (req, res, next) => {
  try {
    const orders = await prisma.customerOrder.findMany({
      where: { deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map order status to match Kanban columns:
    // Quotation, Waiting For Confirmation, Waiting For Production, In Production, Ready For Shipment
    const kanban = {
      'Quotation': [],
      'Waiting For Confirmation': [],
      'Waiting For Production': [],
      'In Production': [],
      'Ready For Shipment': []
    };

    orders.forEach(order => {
      // Map statuses gracefully
      let column = 'Quotation';
      if (order.status === 'Quotation') {
        column = 'Quotation';
      } else if (order.status === 'Confirmed') {
        column = 'Waiting For Confirmation';
      } else if (order.status === 'Waiting for Production') {
        column = 'Waiting For Production';
      } else if (order.status === 'In Production') {
        column = 'In Production';
      } else if (order.status === 'Ready for Shipment' || order.status === 'Delivered') {
        column = 'Ready For Shipment';
      }

      if (kanban[column]) {
        kanban[column].push({
          id: order.id,
          referenceNo: order.referenceNo,
          customerName: order.customer.name,
          products: order.items.map(it => it.product.name),
          total: Number(order.totalSubtotal),
          cost: Number(order.totalCost),
          profit: Number(order.totalProfit),
          deliveryDate: order.deliveryDate
        });
      }
    });

    res.json(kanban);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/check-stock - Check stock for multiple items
router.post('/check-stock', authenticateToken, async (req, res, next) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive()
      }))
    });

    const data = schema.parse(req.body);
    const results = [];

    for (const item of data.items) {
      const product = await prisma.finishedProduct.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        continue;
      }

      const sumIn = await prisma.productStockMovement.aggregate({
        where: { productId: item.productId, direction: 1 },
        _sum: { quantity: true }
      });
      const sumOut = await prisma.productStockMovement.aggregate({
        where: { productId: item.productId, direction: -1 },
        _sum: { quantity: true }
      });

      const currentStock = Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
      const isSufficient = currentStock >= item.quantity;
      const shortage = isSufficient ? 0 : item.quantity - currentStock;

      results.push({
        productId: item.productId,
        productName: product.name,
        currentStock,
        status: isSufficient ? 'Sufficient' : 'Insufficient',
        shortage
      });
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/estimate-cost-date - Estimate cost and completion date
router.post('/estimate-cost-date', authenticateToken, async (req, res, next) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive()
      }))
    });

    const data = schema.parse(req.body);
    let totalCost = 0;
    let maxDurationMinutes = 0;

    for (const item of data.items) {
      const product = await prisma.finishedProduct.findUnique({
        where: { id: item.productId },
        include: { stages: true }
      });

      if (!product) continue;

      totalCost += Number(product.totalCost) * item.quantity;

      // Calculate total stage duration in minutes
      let productMinutes = 0;
      product.stages.forEach(st => {
        productMinutes += Number(st.months || 0) * 30 * 24 * 60;
        productMinutes += Number(st.days || 0) * 24 * 60;
        productMinutes += Number(st.hours || 0) * 60;
        productMinutes += Number(st.minutes || 0);
      });

      // Scale duration somewhat by quantity (simplified)
      const durationForQty = productMinutes * (1 + Math.log10(item.quantity));
      if (durationForQty > maxDurationMinutes) {
        maxDurationMinutes = durationForQty;
      }
    }

    const estimatedDate = new Date();
    estimatedDate.setMinutes(estimatedDate.getMinutes() + maxDurationMinutes);

    res.json({
      totalCost,
      estimatedCompletionDate: estimatedDate,
      maxDurationMinutes
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders - list all orders
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const orders = await prisma.customerOrder.findMany({
      where: { deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        deliveries: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - detail
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const order = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        deliveries: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Create Order
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']), async (req, res, next) => {
  try {
    const schema = z.object({
      customerId: z.string().uuid(),
      type: z.enum(['Quotation', 'Sales Order', 'Invoice']),
      deliveryDate: z.string(),
      createdAt: z.string().optional(),
      deliveryAddress: z.string().optional(),
      quotationNote: z.string().optional(),
      internalNote: z.string().optional(),
      status: z.string().default('Quotation'),
      paymentTerms: z.string().optional(),
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().positive(),
        discount: z.coerce.number().default(0),
        deliveryDate: z.string()
      })),
      deliveries: z.array(z.object({
        deliveryDate: z.string(),
        quantity: z.coerce.number().positive(),
        status: z.string().default('Pending'),
        note: z.string().optional()
      })).optional()
    });

    const data = schema.parse(req.body);

    const order = await prisma.$transaction(async (tx) => {
      // 1. Lock and generate reference
      const referenceNo = await generateOrderReference(tx);

      // 2. Fetch products details to calculate cost & profit
      let totalSubtotal = 0;
      let totalCost = 0;
      let totalProfit = 0;
      const orderItemsData = [];

      for (const item of data.items) {
        const prod = await tx.finishedProduct.findUnique({
          where: { id: item.productId }
        });
        if (!prod) throw new Error(`Product not found: ${item.productId}`);

        const itemSubtotal = (Number(item.unitPrice) - Number(item.discount)) * item.quantity;
        const itemCost = Number(prod.totalCost) * item.quantity;
        const itemProfit = itemSubtotal - itemCost;

        totalSubtotal += itemSubtotal;
        totalCost += itemCost;
        totalProfit += itemProfit;

        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal: itemSubtotal,
          cost: itemCost,
          profit: itemProfit,
          deliveryDate: new Date(item.deliveryDate)
        });
      }

      // 3. Create customer order record
      const newOrder = await tx.customerOrder.create({
        data: {
          referenceNo,
          customerId: data.customerId,
          type: data.type,
          deliveryDate: new Date(data.deliveryDate),
          createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
          deliveryAddress: data.deliveryAddress || null,
          quotationNote: data.quotationNote || null,
          internalNote: data.internalNote || null,
          status: data.status,
          paymentTerms: data.paymentTerms || null,
          totalSubtotal,
          totalCost,
          totalProfit,
          createdBy: req.user.id
        }
      });

      // 4. Create order items
      await tx.customerOrderItem.createMany({
        data: orderItemsData.map(it => ({
          orderId: newOrder.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          subtotal: it.subtotal,
          cost: it.cost,
          profit: it.profit,
          deliveryDate: it.deliveryDate
        }))
      });

      // 5. Create deliveries if present
      if (data.deliveries && data.deliveries.length > 0) {
        await tx.customerOrderDelivery.createMany({
          data: data.deliveries.map(d => ({
            orderId: newOrder.id,
            deliveryDate: new Date(d.deliveryDate),
            quantity: d.quantity,
            status: d.status,
            note: d.note || null
          }))
        });
      }

      // Write Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_CUSTOMER_ORDER',
          tableName: 'customer_orders',
          recordId: newOrder.id,
          oldValue: null,
          newValue: {
            referenceNo: newOrder.referenceNo,
            customerId: newOrder.customerId,
            type: newOrder.type,
            status: newOrder.status,
            totalSubtotal: newOrder.totalSubtotal
          },
          ip: clientIp
        }
      });

      return newOrder;
    });

    if (order && order.type === 'Invoice') {
      prisma.customerOrder.findUnique({
        where: { id: order.id },
        include: { customer: true, items: { include: { product: true } } }
      }).then(orderWithDetails => {
        if (orderWithDetails) {
          sendSalesInvoiceDual(orderWithDetails);
        }
      }).catch(err => console.error('Failed to trigger sales invoice dual send:', err));
    }

    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/orders/:id/status - Update Order Status & Handle Stock Allocation
router.patch('/:id/status', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      status: z.enum(['Quotation', 'Confirmed', 'Waiting for Production', 'In Production', 'Ready for Shipment', 'Delivered', 'Cancelled'])
    });

    const data = schema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findUnique({
        where: { id },
        include: { items: { include: { product: { include: { stockLevels: true } } } } }
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // If status transitions to Confirmed:
      if (data.status === 'Confirmed' && order.status !== 'Confirmed') {
        for (const item of order.items) {
          // Log stock movement: order_allocation (direction: -1)
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              orderId: id,
              type: 'order_allocation',
              quantity: item.quantity,
              direction: -1,
              note: `Stock allocated for Order ${order.referenceNo}`,
              createdBy: req.user.id
            }
          });

          // Check if stock levels drop below min
          const sumIn = await tx.productStockMovement.aggregate({
            where: { productId: item.productId, direction: 1 },
            _sum: { quantity: true }
          });
          const sumOut = await tx.productStockMovement.aggregate({
            where: { productId: item.productId, direction: -1 },
            _sum: { quantity: true }
          });

          const currentStock = Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
          const stockLevel = item.product.stockLevels[0];
          const minLevel = stockLevel ? Number(stockLevel.minLevel) : 0;

          if (currentStock < minLevel) {
            // Trigger critical notification
            await notificationService.createNotification({
              type: 'STOCK_CRITICAL_ORDER',
              recipient_roles: ['PRODUCTION_STAFF', 'MAIN_MASTER'],
              sender_role: 'SYSTEM',
              sender_id: 'system',
              reference_type: 'ORDER_ALERT',
              reference_id: id,
              message: `Order ${order.referenceNo} for ${item.product.name} × ${item.quantity} will reduce stock to ${currentStock} — below minimum. Review production schedule.`,
              metadata: {
                orderId: id,
                referenceNo: order.referenceNo,
                productName: item.product.name,
                quantity: item.quantity,
                currentStock
              }
            }, tx);
          }

          // Trigger standard reorder/critical alert checks
          await notificationService.checkProductStockAlerts(item.productId, tx);
        }
      }

      // Update Order Status
      const record = await tx.customerOrder.update({
        where: { id },
        data: { status: data.status }
      });

      // Write Audit Log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UPDATE_ORDER_STATUS',
          tableName: 'customer_orders',
          recordId: id,
          oldValue: { status: order.status },
          newValue: { status: data.status },
          ip: clientIp
        }
      });

      return record;
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/orders/:id - Update Order
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const schema = z.object({
      customerId: z.string().min(1),
      type: z.enum(['Quotation', 'Sales Order', 'Invoice']),
      deliveryDate: z.string(),
      createdAt: z.string().optional(),
      deliveryAddress: z.string().optional(),
      quotationNote: z.string().optional(),
      internalNote: z.string().optional(),
      status: z.string().default('Quotation'),
      paymentTerms: z.string().optional(),
      items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().positive(),
        discount: z.coerce.number().default(0),
        deliveryDate: z.string()
      })),
      deliveries: z.array(z.object({
        deliveryDate: z.string(),
        quantity: z.coerce.number().positive(),
        status: z.string().default('Pending'),
        note: z.string().optional()
      })).optional()
    });

    const data = schema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Lock and find order
      const existing = await tx.customerOrder.findUnique({
        where: { id }
      });
      if (!existing) throw new Error('Order not found');

      // 2. Fetch products details to calculate cost & profit
      let totalSubtotal = 0;
      let totalCost = 0;
      let totalProfit = 0;
      const orderItemsData = [];

      for (const item of data.items) {
        const prod = await tx.finishedProduct.findUnique({
          where: { id: item.productId }
        });
        if (!prod) throw new Error(`Product not found: ${item.productId}`);

        const itemSubtotal = (Number(item.unitPrice) - Number(item.discount)) * item.quantity;
        const itemCost = Number(prod.totalCost) * item.quantity;
        const itemProfit = itemSubtotal - itemCost;

        totalSubtotal += itemSubtotal;
        totalCost += itemCost;
        totalProfit += itemProfit;

        orderItemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal: itemSubtotal,
          cost: itemCost,
          profit: itemProfit,
          deliveryDate: new Date(item.deliveryDate)
        });
      }

      // 3. Update customer order record
      await tx.customerOrder.update({
        where: { id },
        data: {
          customerId: data.customerId,
          type: data.type,
          deliveryDate: new Date(data.deliveryDate),
          createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
          deliveryAddress: data.deliveryAddress || null,
          quotationNote: data.quotationNote || null,
          internalNote: data.internalNote || null,
          status: data.status,
          paymentTerms: data.paymentTerms || null,
          totalSubtotal,
          totalCost,
          totalProfit
        }
      });

      // 4. Recreate order items
      await tx.customerOrderItem.deleteMany({ where: { orderId: id } });
      await tx.customerOrderItem.createMany({
        data: orderItemsData.map(it => ({
          orderId: id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          subtotal: it.subtotal,
          cost: it.cost,
          profit: it.profit,
          deliveryDate: it.deliveryDate
        }))
      });

      // 5. Recreate deliveries if present
      await tx.customerOrderDelivery.deleteMany({ where: { orderId: id } });
      if (data.deliveries && data.deliveries.length > 0) {
        await tx.customerOrderDelivery.createMany({
          data: data.deliveries.map(d => ({
            orderId: id,
            deliveryDate: new Date(d.deliveryDate),
            quantity: d.quantity,
            status: d.status,
            note: d.note || null
          }))
        });
      }

      // 6. Manage stock adjustments if status changed or just refresh movements if Confirmed
      if (data.status === 'Confirmed') {
        // Delete old movements for this order and recreate based on updated items
        await tx.productStockMovement.deleteMany({ where: { orderId: id, type: 'order_allocation' } });
        for (const item of orderItemsData) {
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              orderId: id,
              type: 'order_allocation',
              quantity: item.quantity,
              direction: -1,
              note: `Stock allocated for Order ${existing.referenceNo} (Updated)`,
              createdBy: req.user.id
            }
          });
        }
      } else {
        // If status changed away from Confirmed, clear allocations
        await tx.productStockMovement.deleteMany({ where: { orderId: id, type: 'order_allocation' } });
      }

      // Check stock alerts for all items involved
      for (const item of orderItemsData) {
        await notificationService.checkProductStockAlerts(item.productId, tx);
      }

      return existing;
    });

    if (updated && data.type === 'Invoice') {
      prisma.customerOrder.findUnique({
        where: { id: id },
        include: { customer: true, items: { include: { product: true } } }
      }).then(orderWithDetails => {
        if (orderWithDetails) {
          sendSalesInvoiceDual(orderWithDetails);
        }
      }).catch(err => console.error('Failed to trigger sales invoice dual send on update:', err));
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/orders/:id - Soft Delete Order and restore stock movements
router.delete('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER']), async (req, res, next) => {
  try {
    const id = req.params.id;

    await prisma.$transaction(async (tx) => {
      // Find order
      const order = await tx.customerOrder.findUnique({
        where: { id },
        include: { items: true }
      });
      if (!order) throw new Error('Order not found');

      // Soft delete order
      await tx.customerOrder.update({
        where: { id },
        data: { deletedAt: new Date() }
      });

      // Restore/Delete stock movements to perfectly manage stock!
      await tx.productStockMovement.deleteMany({
        where: { orderId: id }
      });

      // Trigger alerts to update system of stock restore
      for (const item of order.items) {
        await notificationService.checkProductStockAlerts(item.productId, tx);
      }
    });

    res.json({ message: 'Order deleted successfully and stock movements updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
