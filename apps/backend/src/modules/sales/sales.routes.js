const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const notificationService = require('../notifications/notifications.service');

const router = express.Router();

// Helper to generate invoice reference (CO-XXXXXX)
const generateInvoiceReference = async (tx) => {
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

// Helper to generate return reference (SR-XXXXXX)
const generateReturnReference = async (tx) => {
  const result = await tx.$queryRaw`
    SELECT return_no FROM sales_returns 
    ORDER BY return_no DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.return_no) {
    return 'SR-000001';
  }

  const lastNumberStr = lastRecord.return_no.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = lastNumber + 1;
  return `SR-${String(nextNumber).padStart(6, '0')}`;
};

// FIFO Allocation Helper Function
const allocateFIFOStock = async (productId, quantity, tx) => {
  // Find all QC-passed batches for this product ordered by expiry date (oldest first)
  const batches = await tx.productionBatchNew.findMany({
    where: {
      productId,
      status: 'qc_passed',
      deletedAt: null
    },
    orderBy: {
      expiryDate: 'asc'
    }
  });

  const allocations = [];
  let remainingToAllocate = Number(quantity);

  for (const batch of batches) {
    if (remainingToAllocate <= 0) break;

    // Calculate net stock in this batch
    const sumIn = await tx.productStockMovement.aggregate({
      where: { productId, batchId: batch.id, direction: 1 },
      _sum: { quantity: true }
    });
    const sumOut = await tx.productStockMovement.aggregate({
      where: { productId, batchId: batch.id, direction: -1 },
      _sum: { quantity: true }
    });

    const batchIn = Number(sumIn._sum.quantity || 0);
    const batchOut = Number(sumOut._sum.quantity || 0);
    const batchAvailable = batchIn - batchOut;

    if (batchAvailable > 0) {
      const allocateQty = Math.min(batchAvailable, remainingToAllocate);
      allocations.push({
        batchId: batch.id,
        quantity: allocateQty,
        referenceNo: batch.referenceNo
      });
      remainingToAllocate -= allocateQty;
    }
  }

  if (remainingToAllocate > 0) {
    throw new Error(`Insufficient stock in QC-passed batches for product. Shortfall: ${remainingToAllocate} units.`);
  }

  return allocations;
};

// POST /api/sales/pos - POS checkout endpoint
router.post('/pos', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM']), async (req, res, next) => {
  try {
    const schema = z.object({
      customerId: z.string().uuid().optional(),
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().positive(),
        discount: z.coerce.number().default(0)
      })),
      paymentMode: z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit', 'Complimentary', 'Split']),
      amountPaid: z.coerce.number().nonnegative(),
      taxType: z.string().default('Exclusive'),
      taxRegNo: z.string().optional(),
      
      // Extended properties
      isComplimentary: z.boolean().optional(),
      complimentaryReason: z.string().optional(),
      complimentaryIssuedTo: z.string().optional(),
      managerPin: z.string().optional(),
      splitCash: z.coerce.number().optional(),
      splitDigital: z.coerce.number().optional(),
      deliveryDetails: z.object({
        deliveryDate: z.string(),
        deliveryAddress: z.string(),
        deliveryCharge: z.coerce.number().default(0),
        driverName: z.string().optional(),
        specialNotes: z.string().optional()
      }).optional(),
      discountReason: z.string().optional(),
      loyaltyPointsRedeemed: z.coerce.number().optional()
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Find customer (or default to walk-in)
      let customer = null;
      if (data.customerId) {
        customer = await tx.customer.findUnique({ where: { id: data.customerId } });
      }

      if (!customer) {
        // Fallback or find generic customer
        customer = await tx.customer.findFirst({ where: { customerType: 'RETAIL', status: 'ACTIVE' } });
        if (!customer) {
          throw new Error('Please configure at least one Retail Customer in settings first.');
        }
      }

      // If credit purchase, enforce limits
      if (data.paymentMode === 'Credit') {
        if (customer.customerType === 'RETAIL') {
          throw new Error('Credit payment is only allowed for registered Trade Distributors.');
        }
        const activeInvoices = await tx.customerOrder.findMany({
          where: { customerId: customer.id, type: 'Invoice', deletedAt: null }
        });
        const outstanding = activeInvoices.reduce((sum, o) => sum + Number(o.totalSubtotal), 0);
        if (outstanding + totalSubtotal > Number(customer.creditLimit)) {
          throw new Error(`Credit limit exceeded! Customer outstanding is ₹${outstanding.toFixed(2)}, limit is ₹${Number(customer.creditLimit).toFixed(2)}.`);
        }
      }

      // If complimentary, verify PIN
      if (data.paymentMode === 'Complimentary') {
        if (!data.managerPin || data.managerPin !== '9999') {
          throw new Error('Manager PIN required for complimentary issue.');
        }
      }

      const referenceNo = await generateInvoiceReference(tx);
      let totalSubtotal = 0;
      let totalCost = 0;
      let totalProfit = 0;
      const invoiceItems = [];

      // Perform FIFO stock allocations and pricing aggregates
      for (const item of data.items) {
        const prod = await tx.finishedProduct.findUnique({ where: { id: item.productId } });
        if (!prod) throw new Error(`Product not found for ID: ${item.productId}`);

        // Allocate using FIFO
        const allocations = await allocateFIFOStock(item.productId, item.quantity, tx);

        // Record stock movements for each batch allocation
        for (const alloc of allocations) {
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              batchId: alloc.batchId,
              type: 'order_allocation',
              quantity: alloc.quantity,
              direction: -1,
              note: `POS sale checkout (Batch ${alloc.referenceNo})`,
              createdBy: req.user.id
            }
          });

          // Subtract stock counter
          await tx.finishedProduct.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: alloc.quantity } }
          });
        }

        const itemSubtotal = data.paymentMode === 'Complimentary' ? 0 : (item.unitPrice - item.discount) * item.quantity;
        const itemCost = Number(prod.totalCost) * item.quantity;
        const itemProfit = itemSubtotal - itemCost;

        totalSubtotal += itemSubtotal;
        totalCost += itemCost;
        totalProfit += itemProfit;

        invoiceItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: data.paymentMode === 'Complimentary' ? 0 : item.unitPrice,
          discount: data.paymentMode === 'Complimentary' ? 0 : item.discount,
          subtotal: itemSubtotal,
          cost: itemCost,
          profit: itemProfit,
          deliveryDate: new Date()
        });
      }

      // Setup notes
      let finalNotes = data.paymentMode === 'Complimentary' 
        ? `Complimentary Issue. Authorized by Manager PIN. Reason: ${data.complimentaryReason || 'N/A'}. Recipient: ${data.complimentaryIssuedTo || 'N/A'}`
        : data.note || '';

      if (data.paymentMode === 'Split') {
        finalNotes += ` (Split Pay: Cash ₹${data.splitCash || 0}, Digital ₹${data.splitDigital || 0})`;
      }

      if (data.discountReason) {
        finalNotes += ` (Discount Reason: ${data.discountReason})`;
      }

      // Create Customer Order representing POS invoice
      const invoice = await tx.customerOrder.create({
        data: {
          referenceNo,
          customerId: customer.id,
          type: data.deliveryDetails ? 'Sales Order' : 'Invoice',
          deliveryDate: data.deliveryDetails ? new Date(data.deliveryDetails.deliveryDate) : new Date(),
          deliveryAddress: data.deliveryDetails 
            ? `${data.deliveryDetails.deliveryAddress}${data.deliveryDetails.driverName ? ` (Driver: ${data.deliveryDetails.driverName})` : ''}` 
            : 'Walk-In Customer Store Pickup',
          status: data.deliveryDetails ? 'Confirmed' : 'Delivered',
          totalSubtotal,
          totalCost,
          totalProfit,
          internalNote: finalNotes,
          createdBy: req.user.id
        }
      });

      // Save invoice items
      await tx.customerOrderItem.createMany({
        data: invoiceItems.map(it => ({
          orderId: invoice.id,
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

      // Save delivery log
      await tx.customerOrderDelivery.create({
        data: {
          orderId: invoice.id,
          deliveryDate: new Date(),
          quantity: invoiceItems.reduce((sum, i) => sum + i.quantity, 0),
          status: data.deliveryDetails ? 'Pending' : 'Delivered',
          note: `POS Checkout via ${data.paymentMode}. Paid ₹${data.amountPaid}`
        }
      });

      // Update customer loyalty points using Raw SQL to avoid schema generation locks on active node processes
      if (customer.customerType !== 'DISTRIBUTOR') {
        const pointsEarned = Math.floor(totalSubtotal / 100);
        let netPoints = pointsEarned;
        if (data.loyaltyPointsRedeemed) {
          netPoints -= Number(data.loyaltyPointsRedeemed);
        }
        await tx.$executeRaw`
          UPDATE customers 
          SET loyalty_points = COALESCE(loyalty_points, 0) + ${netPoints}
          WHERE id = ${customer.id}
        `;
      }

      // Log transaction to audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_POS_SALE',
          tableName: 'customer_orders',
          recordId: invoice.id,
          oldValue: null,
          newValue: { referenceNo, totalSubtotal, paymentMode: data.paymentMode, amountPaid: data.amountPaid },
          ip: req.ip || '127.0.0.1'
        }
      });

      // Check if discount exceeds set limit (e.g. 5%) and alert manager if so
      const originalSub = data.items.reduce((s, item) => s + (item.unitPrice * item.quantity), 0);
      const totalDisc = originalSub - totalSubtotal;
      const discountPercent = originalSub > 0 ? (totalDisc / originalSub) * 100 : 0;
      if (discountPercent > 5) {
        await tx.notification.create({
          data: {
            title: 'High POS Discount Applied',
            message: `Discount of ${discountPercent.toFixed(1)}% applied on POS Bill #${referenceNo} by staff. Reason: ${data.discountReason || 'N/A'}.`,
            type: 'SYSTEM',
            status: 'UNREAD'
          }
        });
      }

      // If complimentary issue, log separate notification to manager
      if (data.paymentMode === 'Complimentary') {
        await tx.notification.create({
          data: {
            title: 'Complimentary Issue Created',
            message: `Complimentary issue of ${invoiceItems.reduce((s, i) => s + i.quantity, 0)} pieces created by staff. Reason: ${data.complimentaryReason || 'N/A'}.`,
            type: 'SYSTEM',
            status: 'UNREAD'
          }
        });
      }

      return {
        id: invoice.id,
        referenceNo,
        customerName: customer.name,
        total: totalSubtotal,
        amountPaid: data.amountPaid,
        balance: Math.max(0, data.amountPaid - totalSubtotal),
        paymentMode: data.paymentMode
      };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(400).json({ error: error.message });
  }
});

// GET /api/sales/customer-loyalty/:customerId - Retrieves raw loyalty points
router.get('/customer-loyalty/:customerId', authenticateToken, async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const result = await prisma.$queryRaw`
      SELECT id, name, COALESCE(loyalty_points, 0) as loyalty_points 
      FROM customers 
      WHERE id = ${customerId}
    `;
    const cust = Array.isArray(result) && result.length > 0 ? result[0] : null;
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    res.json({
      id: cust.id,
      name: cust.name,
      loyaltyPoints: Number(cust.loyalty_points || 0)
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/sales/check-overdue - Checks credit details for B2B order
router.get('/check-credit/:customerId', authenticateToken, async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // Find all outstanding credit invoices (CustomerOrder type = Invoice, status != Delivered or unpaid)
    // For this ERP, let's look at all orders where payment is credit and check due dates
    const orders = await prisma.customerOrder.findMany({
      where: {
        customerId,
        type: 'Invoice',
        deletedAt: null,
        status: { notIn: ['Cancelled'] }
      }
    });

    // Compute outstanding amount
    const totalOutstanding = orders.reduce((sum, order) => sum + Number(order.totalSubtotal), 0);
    const creditLimit = Number(customer.creditLimit);
    const limitExceeded = totalOutstanding > creditLimit;

    // Check for overdue payments
    const today = new Date();
    let hasOverdue = false;
    const overdueDetails = [];

    orders.forEach(o => {
      // Calculate due date based on customer's paymentTermsDays
      const dueDate = new Date(o.createdAt);
      dueDate.setDate(dueDate.getDate() + customer.paymentTermsDays);

      if (dueDate < today) {
        hasOverdue = true;
        overdueDetails.push({
          referenceNo: o.referenceNo,
          amount: Number(o.totalSubtotal),
          dueDate
        });
      }
    });

    res.json({
      customerName: customer.name,
      creditLimit,
      totalOutstanding,
      limitExceeded,
      hasOverdue,
      overdueDetails
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales/returns - Return / Replacement Sale (Type 4)
router.post('/returns', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM']), async (req, res, next) => {
  try {
    const schema = z.object({
      invoiceNo: z.string().min(1), // original invoice
      reason: z.enum(['Damaged', 'Wrong Product', 'Quality Issue', 'Expiry Concern', 'Customer Preference']),
      refundMethod: z.enum(['Cash Refund', 'Credit Note', 'Replacement']),
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        condition: z.enum(['Resaleable', 'Damaged', 'Destroy'])
      }))
    });

    const data = schema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Validate original invoice
      const invoice = await tx.customerOrder.findFirst({
        where: { referenceNo: data.invoiceNo, deletedAt: null },
        include: { items: true }
      });
      if (!invoice) throw new Error(`Original invoice ${data.invoiceNo} not found.`);

      const returnNo = await generateReturnReference(tx);

      // Create return log
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNo,
          invoiceId: invoice.id,
          reason: data.reason,
          refundMethod: data.refundMethod,
          status: 'Completed'
        }
      });

      // Process items
      for (const item of data.items) {
        // Log in return items
        await tx.salesReturnItem.create({
          data: {
            returnId: salesReturn.id,
            productId: item.productId,
            quantity: item.quantity,
            condition: item.condition
          }
        });

        // FIFO or Stock adjust
        if (item.condition === 'Resaleable') {
          // Add back to available inventory
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              type: 'order_return',
              quantity: item.quantity,
              direction: 1,
              note: `Returned from invoice ${data.invoiceNo} (Resaleable)`,
              createdBy: req.user.id
            }
          });

          await tx.finishedProduct.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } }
          });
        } else {
          // Record wastage/loss
          await tx.productWastage.create({
            data: {
              referenceNo: `RW-${returnNo.split('-')[1]}`,
              productId: item.productId,
              quantity: item.quantity,
              note: `Sales Return ${returnNo} Damaged/Destroy: ${data.reason}`,
              createdBy: req.user.id
            }
          });

          // Stock movement for damaged/destroy (does not return to sellable inventory)
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              type: 'adjustment',
              quantity: item.quantity,
              direction: -1,
              note: `Sales Return ${returnNo} Damaged/Wasted`,
              createdBy: req.user.id
            }
          });
        }
      }

      // Write audit log
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_SALES_RETURN',
          tableName: 'sales_returns',
          recordId: salesReturn.id,
          oldValue: { invoiceNo: data.invoiceNo },
          newValue: { returnNo, reason: data.reason, refundMethod: data.refundMethod },
          ip: req.ip || '127.0.0.1'
        }
      });

      return salesReturn;
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(400).json({ error: error.message });
  }
});

// Campaigns Endpoints (Type 3 Seasonal pre-sale campaigns)
router.post('/campaigns', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      productId: z.string().uuid(),
      targetQuantity: z.coerce.number().positive(),
      price: z.coerce.number().positive(),
      minDepositPercent: z.coerce.number().min(0).max(100).default(10),
      startDate: z.string(),
      endDate: z.string()
    });

    const data = schema.parse(req.body);
    const campaign = await prisma.salesCampaign.create({
      data: {
        name: data.name,
        productId: data.productId,
        targetQuantity: data.targetQuantity,
        price: data.price,
        minDepositPercent: data.minDepositPercent,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate)
      }
    });

    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

router.get('/campaigns', authenticateToken, async (req, res, next) => {
  try {
    const campaigns = await prisma.salesCampaign.findMany({
      include: {
        product: true,
        preOrders: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

router.post('/campaigns/:campaignId/book', authenticateToken, async (req, res, next) => {
  try {
    const schema = z.object({
      customerName: z.string().min(1),
      quantity: z.coerce.number().positive(),
      depositPaid: z.coerce.number().nonnegative()
    });

    const data = schema.parse(req.body);
    const campaignId = req.params.campaignId;

    const campaign = await prisma.salesCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const totalCost = Number(campaign.price) * data.quantity;
    const balanceDue = totalCost - data.depositPaid;

    const preOrder = await prisma.salesCampaignOrder.create({
      data: {
        campaignId,
        customerName: data.customerName,
        quantity: data.quantity,
        depositPaid: data.depositPaid,
        balanceDue,
        status: 'Booked'
      }
    });

    res.status(201).json(preOrder);
  } catch (error) {
    next(error);
  }
});

// Manager Dashboard Reports (Reports List Table)
router.get('/reports/dashboard', authenticateToken, async (req, res, next) => {
  try {
    // 1. Daily Sales Summary
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaySales = await prisma.customerOrder.aggregate({
      where: {
        type: 'Invoice',
        createdAt: { gte: startOfToday },
        deletedAt: null
      },
      _sum: { totalSubtotal: true, totalCost: true, totalProfit: true },
      _count: { id: true }
    });

    // 2. Product-wise sales
    const productSales = await prisma.$queryRaw`
      SELECT p.id, p.name, SUM(oi.quantity)::float as qty_sold, SUM(oi.subtotal)::float as revenue
      FROM customer_order_items oi
      JOIN customer_orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.type = 'Invoice' AND o.deleted_at IS NULL
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
    `;

    // 3. Distributor Outstanding
    const distributorList = await prisma.customer.findMany({
      where: { customerType: 'DISTRIBUTOR', status: 'ACTIVE' }
    });

    const outstandings = [];
    for (const dist of distributorList) {
      const orders = await prisma.customerOrder.aggregate({
        where: {
          customerId: dist.id,
          type: 'Invoice',
          deletedAt: null
        },
        _sum: { totalSubtotal: true }
      });
      const outstandingVal = Number(orders._sum.totalSubtotal || 0);

      outstandings.push({
        id: dist.id,
        name: dist.name,
        creditLimit: Number(dist.creditLimit),
        outstanding: outstandingVal,
        paymentTermsDays: dist.paymentTermsDays
      });
    }

    // 4. Returns summary
    const totalReturns = await prisma.salesReturn.count();

    // 5. Expiry & Aging reports
    const batches = await prisma.productionBatchNew.findMany({
      where: { status: 'qc_passed', deletedAt: null },
      include: { product: true }
    });

    const aging = [];
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    batches.forEach(b => {
      const isExpired = b.expiryDate && b.expiryDate < new Date();
      const expiresSoon = b.expiryDate && b.expiryDate >= new Date() && b.expiryDate <= sevenDaysFromNow;
      
      aging.push({
        batchId: b.id,
        referenceNo: b.referenceNo,
        productName: b.product.name,
        qty: Number(b.quantity),
        expiryDate: b.expiryDate,
        isExpired,
        expiresSoon
      });
    });

    res.json({
      dailySales: {
        revenue: Number(todaySales._sum.totalSubtotal || 0),
        cost: Number(todaySales._sum.totalCost || 0),
        profit: Number(todaySales._sum.totalProfit || 0),
        count: todaySales._count.id
      },
      productSales,
      distributors: outstandings,
      totalReturns,
      inventoryAging: aging
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/returns - list returns
router.get('/returns', authenticateToken, async (req, res, next) => {
  try {
    const returnsList = await prisma.salesReturn.findMany({
      include: {
        order: { include: { customer: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(returnsList);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
