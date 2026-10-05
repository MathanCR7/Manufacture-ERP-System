const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const notificationService = require('../notifications/notifications.service');
const { sendSalesInvoiceDual, resendDocument } = require('../../utils/communication');
const documentSeriesService = require('../../services/documentSeries.service');
const batchAllocationService = require('../../services/batchAllocation.service');
const gstEngine = require('../../utils/gstEngine');

const router = express.Router();

const ALLOCATED_STATUSES = ['Confirmed', 'Ready for Shipment', 'Delivered'];

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

// GET /api/orders/:id/details - Rich snapshot details for PDF & dual billing
router.get('/:id/details', authenticateToken, async (req, res, next) => {
  try {
    const order = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
                category: true
              }
            },
            batchAllocations: true
          }
        },
        deliveries: true,
        creator: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Include company profile for invoice header and bank account
    const company = await prisma.companyDetails.findFirst();

    // If order was converted from a parent order, fetch brief source info
    let sourceOrder = null;
    if (order.sourceOrderId) {
      sourceOrder = await prisma.customerOrder.findUnique({
        where: { id: order.sourceOrderId },
        select: { id: true, referenceNo: true, docNo: true, type: true, createdAt: true }
      });
    }

    res.json({
      ...order,
      sourceOrder,
      company: company || {
        companyName: 'Manufacturing ERP',
        companyAddress: 'Industrial Area, Salem, Tamil Nadu',
        companyGstin: '33AAAAA0000A1Z5',
        companyMobile: '9876543210',
        stateCode: '33',
        bankName: 'State Bank of India',
        bankAccountNumber: '123456789012',
        bankIfscCode: 'SBIN0001234',
        bankBranch: 'Main Branch'
      }
    });
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
      collectTax: z.boolean().optional().default(false),
      taxRegNo: z.string().optional().nullable(),
      taxType: z.string().optional().nullable(),
      discountValue: z.coerce.number().optional().default(0),
      tdsDeduction: z.coerce.number().optional().default(0),
      freight: z.coerce.number().optional().default(0),
      freightGst: z.boolean().optional().default(false),
      loadingCharges: z.coerce.number().optional().default(0),
      loadingGst: z.boolean().optional().default(false),
      packingCharges: z.coerce.number().optional().default(0),
      packingGst: z.boolean().optional().default(false),
      insurance: z.coerce.number().optional().default(0),
      insuranceGst: z.boolean().optional().default(false),
      otherCharges: z.coerce.number().optional().default(0),
      otherGst: z.boolean().optional().default(false),
      cgst: z.coerce.number().optional().default(0),
      sgst: z.coerce.number().optional().default(0),
      igst: z.coerce.number().optional().default(0),
      roundOff: z.coerce.number().optional().default(0),
      grandTotal: z.coerce.number().optional().default(0),
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
          collectTax: data.collectTax,
          taxRegNo: data.taxRegNo || null,
          taxType: data.taxType || null,
          discountValue: data.discountValue,
          tdsDeduction: data.tdsDeduction,
          freight: data.freight,
          freightGst: data.freightGst,
          loadingCharges: data.loadingCharges,
          loadingGst: data.loadingGst,
          packingCharges: data.packingCharges,
          packingGst: data.packingGst,
          insurance: data.insurance,
          insuranceGst: data.insuranceGst,
          otherCharges: data.otherCharges,
          otherGst: data.otherGst,
          cgst: data.cgst,
          sgst: data.sgst,
          igst: data.igst,
          roundOff: data.roundOff,
          grandTotal: data.grandTotal,
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

      // 4b. Handle stock allocation if order is confirmed/invoiced immediately
      const isAllocated = ALLOCATED_STATUSES.includes(data.status) || 
                          data.type === 'Invoice' || 
                          data.type === 'POS';

      if (isAllocated) {
        for (const item of orderItemsData) {
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              orderId: newOrder.id,
              type: 'order_allocation',
              quantity: item.quantity,
              direction: -1,
              note: `Stock allocated for Order ${newOrder.referenceNo} (Created)`,
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
          const productWithLevels = await tx.finishedProduct.findUnique({
            where: { id: item.productId },
            include: { stockLevels: true }
          });
          const stockLevel = productWithLevels?.stockLevels?.[0];
          const minLevel = stockLevel ? Number(stockLevel.minLevel) : 0;

          if (currentStock < minLevel) {
            // Trigger critical notification
            await notificationService.createNotification({
              type: 'STOCK_CRITICAL_ORDER',
              recipient_roles: ['PRODUCTION_STAFF', 'MAIN_MASTER'],
              sender_role: 'SYSTEM',
              sender_id: 'system',
              reference_type: 'ORDER_ALERT',
              reference_id: newOrder.id,
              message: `Order ${newOrder.referenceNo} for ${productWithLevels?.name || 'Product'} × ${item.quantity} will reduce stock to ${currentStock} — below minimum. Review production schedule.`,
              metadata: {
                orderId: newOrder.id,
                referenceNo: newOrder.referenceNo,
                productName: productWithLevels?.name || 'Product',
                quantity: item.quantity,
                currentStock
              }
            }, tx);
          }

          // Trigger standard reorder/critical alert checks
          await notificationService.checkProductStockAlerts(item.productId, tx);
        }
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

/**
 * Shared Billing Engine for POS, Invoices, Quotations, and Sales Orders
 */
async function processBillingOrder({ req, type, data, defaultStatus }) {
  return await prisma.$transaction(async (tx) => {
    // 1. Generate Document Series & Legacy Reference
    const seriesResult = await documentSeriesService.getNextNumber(type, tx);
    const referenceNo = seriesResult.docNo;
    const docNo = seriesResult.docNo;
    const documentSeries = seriesResult.prefix;

    // 2. Resolve Customer (or Walk-In for Retail POS)
    let customer = null;
    if (data.customerId) {
      customer = await tx.customer.findUnique({ where: { id: data.customerId } });
    }
    if (!customer) {
      customer = await tx.customer.findFirst({
        where: { customerType: 'RETAIL', status: 'ACTIVE' }
      });
      if (!customer) {
        customer = await tx.customer.findFirst();
      }
    }
    if (!customer) {
      throw new Error('No customer configured. Please add at least one customer.');
    }

    // 3. Resolve Company & State Codes for GST
    const company = await tx.companyDetails.findFirst();
    const sellerStateCode = company?.stateCode || (company?.gstin ? company.gstin.substring(0, 2) : '33');
    let buyerStateCode = data.buyerStateCode;
    if (!buyerStateCode && customer?.gstin) {
      buyerStateCode = customer.gstin.trim().replace(/^GSTIN-/, '').substring(0, 2);
    }
    if (!buyerStateCode) {
      buyerStateCode = sellerStateCode; // Default walk-in to intra-state
    }
    const isInterState = String(sellerStateCode) !== String(buyerStateCode);

    // 4. Validate Credit Limit for B2B Invoices
    if (type === 'Invoice' && customer.customerType === 'DISTRIBUTOR') {
      const activeInvoices = await tx.customerOrder.findMany({
        where: { customerId: customer.id, type: 'Invoice', deletedAt: null, paymentStatus: { not: 'PAID' } }
      });
      const outstanding = activeInvoices.reduce((sum, o) => sum + Number(o.grandTotal || o.totalSubtotal), 0);
      const newEstimatedTotal = data.grandTotal || data.items.reduce((s, it) => s + (Number(it.unitPrice) * Number(it.quantity)), 0);
      if (Number(customer.creditLimit) > 0 && (outstanding + newEstimatedTotal) > Number(customer.creditLimit)) {
        if (!data.overrideCreditLimit) {
          throw new Error(`Credit limit of ₹${Number(customer.creditLimit).toLocaleString('en-IN')} exceeded! Current unpaid outstanding: ₹${outstanding.toLocaleString('en-IN')}.`);
        }
      }
    }

    // 5. Pre-fetch Product Details & Calculate Subtotals
    let totalCost = 0;
    let totalProfit = 0;
    const itemsPrepared = [];

    for (const item of data.items) {
      const prod = await tx.finishedProduct.findUnique({
        where: { id: item.productId },
        include: { unit: true }
      });
      if (!prod) throw new Error(`Product not found: ${item.productId}`);

      const qty = Number(item.quantity);
      const unitPrice = Number(item.unitPrice !== undefined ? item.unitPrice : prod.salePrice);
      const discPercent = Number(item.discountPercent || 0);
      const discAmt = Number(item.discount || (unitPrice * (discPercent / 100)));
      const subtotal = Math.max(0, (unitPrice - discAmt) * qty);
      const cost = Number(prod.totalCost || 0) * qty;
      const profit = subtotal - cost;

      totalCost += cost;
      totalProfit += profit;

      // Handle batch assignments (manual or FEFO)
      let allocations = [];
      let batchId = item.batchId || null;
      let batchNo = item.batchNo || null;
      let mfgDate = item.mfgDate ? new Date(item.mfgDate) : null;
      let expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;

      if (type === 'Invoice' || type === 'POS') {
        if (item.allocations && item.allocations.length > 0) {
          allocations = item.allocations;
          batchId = allocations[0].batchId;
          batchNo = allocations[0].batchNo;
          expiryDate = allocations[0].expiryDate ? new Date(allocations[0].expiryDate) : null;
        } else if (item.batchId) {
          allocations = [{
            batchId: item.batchId,
            batchNo: item.batchNo || 'BATCH',
            quantity: qty,
            expiryDate: item.expiryDate
          }];
        } else {
          // FEFO auto-allocation
          const fefoResult = await batchAllocationService.allocateFEFO(item.productId, qty, tx);
          allocations = fefoResult.allocations;
          if (allocations.length > 0) {
            batchId = allocations[0].batchId;
            batchNo = allocations[0].batchNo;
            mfgDate = allocations[0].mfgDate ? new Date(allocations[0].mfgDate) : null;
            expiryDate = allocations[0].expiryDate ? new Date(allocations[0].expiryDate) : null;
          }
        }
      }

      itemsPrepared.push({
        productId: item.productId,
        productName: prod.name,
        hsnCode: item.hsnCode || prod.hsnCode || '21050000',
        gstRate: item.gstRate !== undefined ? Number(item.gstRate) : (prod.gstRate !== undefined ? Number(prod.gstRate) : 18),
        uomName: item.uomName || prod.unit?.abbreviation || prod.unit?.name || 'pcs',
        quantity: qty,
        unitPrice,
        discount: discAmt,
        discountPercent: discPercent,
        subtotal,
        cost,
        profit,
        deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : new Date(),
        batchId,
        batchNo,
        mfgDate,
        expiryDate,
        allocations
      });
    }

    // 6. Precise GST Engine calculation
    const gstResult = gstEngine.calculateGST({
      items: itemsPrepared.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        discountPercent: it.discountPercent,
        gstRate: it.gstRate
      })),
      additionalCharges: {
        freight: Number(data.freight || 0),
        loading: Number(data.loadingCharges || 0),
        packing: Number(data.packingCharges || 0),
        insurance: Number(data.insurance || 0),
        other: Number(data.otherCharges || 0),
      },
      chargeTaxRates: {
        freightGst: Boolean(data.freightGst),
        loadingGst: Boolean(data.loadingGst),
        packingGst: Boolean(data.packingGst),
        insuranceGst: Boolean(data.insuranceGst),
        otherGst: Boolean(data.otherGst),
      },
      invoiceDiscount: Number(data.discountValue || data.invoiceDiscount || 0),
      tdsDeduction: Number(data.tdsDeduction || 0),
      sellerStateCode,
      buyerStateCode,
      isInterState
    });

    // 7. Payment status calculation
    const amountPaid = Number(data.amountPaid || (type === 'POS' ? gstResult.grandTotal : 0));
    let paymentStatus = 'PENDING';
    if (amountPaid >= gstResult.grandTotal && gstResult.grandTotal > 0) {
      paymentStatus = 'PAID';
    } else if (amountPaid > 0) {
      paymentStatus = 'PARTIAL';
    }

    const orderStatus = data.status || defaultStatus || (type === 'Invoice' || type === 'POS' ? 'Delivered' : (type === 'Sales Order' ? 'Confirmed' : 'Quotation'));

    // 8. Create CustomerOrder record
    const createdOrder = await tx.customerOrder.create({
      data: {
        referenceNo,
        docNo,
        documentSeries,
        sourceOrderId: data.sourceOrderId || null,
        customerId: customer.id,
        type,
        status: orderStatus,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date(),
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        deliveryAddress: data.deliveryAddress || (type === 'POS' ? 'Over the Counter POS' : customer.address || 'Standard Delivery'),
        quotationNote: data.quotationNote || null,
        internalNote: data.internalNote || data.note || null,
        paymentTerms: data.paymentTerms || (type === 'POS' ? (data.paymentMode || 'Cash') : 'Net 30'),
        paymentStatus,
        amountPaid,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        collectTax: true,
        taxRegNo: customer.gstin || null,
        taxType: isInterState ? 'Inter-State' : 'Intra-State',
        sellerStateCode,
        buyerStateCode,
        placeOfSupply: data.placeOfSupply || buyerStateCode,
        totalSubtotal: gstResult.taxableSubtotal || gstResult.netTaxableSubtotal || 0,
        totalCost,
        totalProfit,
        discountValue: Number(data.discountValue || data.invoiceDiscount || 0),
        invoiceDiscount: Number(data.discountValue || data.invoiceDiscount || 0),
        tdsDeduction: Number(data.tdsDeduction || 0),
        freight: gstResult.charges?.freight || 0,
        freightGst: Boolean(data.freightGst),
        loadingCharges: gstResult.charges?.loadingCharges || gstResult.charges?.loading || 0,
        loadingGst: Boolean(data.loadingGst),
        packingCharges: gstResult.charges?.packingCharges || gstResult.charges?.packing || 0,
        packingGst: Boolean(data.packingGst),
        insurance: gstResult.charges?.insurance || 0,
        insuranceGst: Boolean(data.insuranceGst),
        otherCharges: gstResult.charges?.otherCharges || gstResult.charges?.other || 0,
        otherGst: Boolean(data.otherGst),
        cgst: gstResult.cgst ?? gstResult.taxBreakdown?.cgst ?? 0,
        sgst: gstResult.sgst ?? gstResult.taxBreakdown?.sgst ?? 0,
        igst: gstResult.igst ?? gstResult.taxBreakdown?.igst ?? 0,
        roundOff: gstResult.roundOff || 0,
        grandTotal: gstResult.grandTotal || 0,
        counterId: data.counterId || 'COUNTER-1',
        cashierName: data.cashierName || req.user.name || 'Sales Staff',
        customerName: data.customerName || (type === 'POS' ? (data.customerName || 'Walk-in Customer') : customer?.name || null),
        customerPhone: data.customerPhone || customer?.phone || null,
        transporterName: data.transporterName || data.transportMode || null,
        vehicleNo: data.vehicleNo || data.vehicleNumber || null,
        lrNo: data.lrNo || data.lrNumber || null,
        ewayBillNo: data.ewayBillNo || data.eWayBillNumber || null,
        ewayBillDate: data.ewayBillDate ? new Date(data.ewayBillDate) : null,
        createdBy: req.user.id
      }
    });

    // 9. Create Order Items with Snapshots
    for (const item of itemsPrepared) {
      const createdItem = await tx.customerOrderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: item.productId,
          batchId: item.batchId,
          batchNo: item.batchNo,
          mfgDate: item.mfgDate,
          expiryDate: item.expiryDate,
          hsnCode: item.hsnCode,
          gstRate: item.gstRate,
          uomName: item.uomName,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent,
          subtotal: item.subtotal,
          cost: item.cost,
          profit: item.profit,
          deliveryDate: item.deliveryDate
        }
      });

      item.orderItemId = createdItem.id;
    }

    // 10. Commit Stock Decrements if Invoice or POS
    if (type === 'Invoice' || type === 'POS') {
      await batchAllocationService.commitDecrements(itemsPrepared, createdOrder, req.user.id, tx);
    }

    // 11. Delivery log
    await tx.customerOrderDelivery.create({
      data: {
        orderId: createdOrder.id,
        deliveryDate: createdOrder.deliveryDate,
        quantity: itemsPrepared.reduce((s, it) => s + it.quantity, 0),
        status: orderStatus === 'Delivered' ? 'Delivered' : 'Pending',
        note: `${type} generated #${docNo}. Payment: ${paymentStatus}`
      }
    });

    // 12. Audit Log
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: `CREATE_${type.toUpperCase().replace(/\s+/g, '_')}`,
        tableName: 'customer_orders',
        recordId: createdOrder.id,
        oldValue: null,
        newValue: {
          docNo,
          type,
          customerName: customer.name,
          grandTotal: createdOrder.grandTotal,
          paymentStatus: createdOrder.paymentStatus
        },
        ip: req.ip || '127.0.0.1'
      }
    });

    return createdOrder;
  });
}

// POST /api/orders/pos - Fast counter retail billing
router.post('/pos', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const order = await processBillingOrder({
      req,
      type: 'POS',
      data: req.body,
      defaultStatus: 'Delivered'
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/invoice - B2B Distributor / Professional Sales Billing
router.post('/invoice', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const order = await processBillingOrder({
      req,
      type: 'Invoice',
      data: req.body,
      defaultStatus: 'Delivered'
    });

    // Background dual invoice communication
    prisma.customerOrder.findUnique({
      where: { id: order.id },
      include: { customer: true, items: { include: { product: true } } }
    }).then(orderWithDetails => {
      if (orderWithDetails) sendSalesInvoiceDual(orderWithDetails);
    }).catch(err => console.error('Failed to trigger sales invoice dual send:', err));

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/quotation - Quotation generation
router.post('/quotation', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const order = await processBillingOrder({
      req,
      type: 'Quotation',
      data: req.body,
      defaultStatus: 'Quotation'
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/sales-order - Sales Order creation
router.post('/sales-order', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const order = await processBillingOrder({
      req,
      type: 'Sales Order',
      data: req.body,
      defaultStatus: 'Confirmed'
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/convert-to-invoice - Quotation/Sales Order to Invoice conversion (supports partial quantities)
router.post('/:id/convert-to-invoice', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const sourceOrderId = req.params.id;
    const sourceOrder = await prisma.customerOrder.findUnique({
      where: { id: sourceOrderId },
      include: { customer: true, items: { include: { product: true } } }
    });

    if (!sourceOrder) {
      return res.status(404).json({ error: 'Source order not found' });
    }

    if (sourceOrder.type === 'Invoice') {
      return res.status(400).json({ error: 'Order is already an Invoice' });
    }

    const itemsToBill = req.body.items && req.body.items.length > 0 
      ? req.body.items 
      : sourceOrder.items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountPercent: it.discountPercent,
          gstRate: it.gstRate,
          hsnCode: it.hsnCode,
          uomName: it.uomName
        }));

    const invoicePayload = {
      customerId: sourceOrder.customerId,
      sourceOrderId: sourceOrder.id,
      deliveryAddress: req.body.deliveryAddress || sourceOrder.deliveryAddress,
      paymentTerms: req.body.paymentTerms || sourceOrder.paymentTerms || 'Net 30',
      paymentMode: req.body.paymentMode,
      amountPaid: req.body.amountPaid || 0,
      freight: req.body.freight !== undefined ? req.body.freight : sourceOrder.freight,
      freightGst: req.body.freightGst !== undefined ? req.body.freightGst : sourceOrder.freightGst,
      loadingCharges: req.body.loadingCharges !== undefined ? req.body.loadingCharges : sourceOrder.loadingCharges,
      loadingGst: req.body.loadingGst !== undefined ? req.body.loadingGst : sourceOrder.loadingGst,
      packingCharges: req.body.packingCharges !== undefined ? req.body.packingCharges : sourceOrder.packingCharges,
      packingGst: req.body.packingGst !== undefined ? req.body.packingGst : sourceOrder.packingGst,
      insurance: req.body.insurance !== undefined ? req.body.insurance : sourceOrder.insurance,
      insuranceGst: req.body.insuranceGst !== undefined ? req.body.insuranceGst : sourceOrder.insuranceGst,
      otherCharges: req.body.otherCharges !== undefined ? req.body.otherCharges : sourceOrder.otherCharges,
      otherGst: req.body.otherGst !== undefined ? req.body.otherGst : sourceOrder.otherGst,
      discountValue: req.body.discountValue !== undefined ? req.body.discountValue : sourceOrder.discountValue,
      tdsDeduction: req.body.tdsDeduction !== undefined ? req.body.tdsDeduction : sourceOrder.tdsDeduction,
      items: itemsToBill
    };

    const newInvoice = await processBillingOrder({
      req,
      type: 'Invoice',
      data: invoicePayload,
      defaultStatus: 'Delivered'
    });

    // Update parent order status to Delivered
    await prisma.customerOrder.update({
      where: { id: sourceOrderId },
      data: { status: 'Delivered' }
    });

    res.status(201).json(newInvoice);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/resend - Resend invoice via Email & WhatsApp
router.post('/:id/resend', authenticateToken, async (req, res, next) => {
  try {
    const result = await resendDocument('SALES_INVOICE', req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/convert-to-order - Convert Quotation to Confirmed Sales Order
router.post('/:id/convert-to-order', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const order = await prisma.customerOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const updated = await prisma.customerOrder.update({
      where: { id: req.params.id },
      data: {
        type: 'Sales Order',
        status: 'Confirmed'
      },
      include: { customer: true, items: { include: { product: true } } }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/start-production - Move order to 'In Production'
router.post('/:id/start-production', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const order = await prisma.customerOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    const updated = await prisma.customerOrder.update({
      where: { id: req.params.id },
      data: {
        status: 'In Production'
      },
      include: { customer: true, items: { include: { product: true } } }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/payments - Record payment against order
router.post('/:id/payments', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT']), async (req, res, next) => {
  try {
    const { amount, paymentMode, reference } = req.body;
    const addAmt = Number(amount);
    if (isNaN(addAmt) || addAmt <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findUnique({ where: { id: req.params.id } });
      if (!order) throw new Error('Order not found');

      const currentPaid = Number(order.amountPaid || 0);
      const newPaid = currentPaid + addAmt;
      const grandTotal = Number(order.grandTotal || 0);

      let paymentStatus = 'PENDING';
      if (newPaid >= grandTotal) {
        paymentStatus = 'PAID';
      } else if (newPaid > 0) {
        paymentStatus = 'PARTIAL';
      }

      const noteSuffix = ` [Payment received: ₹${addAmt} via ${paymentMode || 'Cash'}${reference ? ` Ref: ${reference}` : ''}]`;
      const updatedOrder = await tx.customerOrder.update({
        where: { id: req.params.id },
        data: {
          amountPaid: newPaid,
          paymentStatus,
          internalNote: (order.internalNote || '') + noteSuffix
        }
      });

      return updatedOrder;
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/cancel - Cancel order and restore stock
router.post('/:id/cancel', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findUnique({
        where: { id: req.params.id },
        include: { items: true }
      });
      if (!order) throw new Error('Order not found');
      if (order.status === 'Cancelled') throw new Error('Order is already cancelled');

      // If stock was allocated, restore it
      if (order.type === 'Invoice' || order.type === 'POS' || ALLOCATED_STATUSES.includes(order.status)) {
        await batchAllocationService.restoreStock(order.id, req.user.id, tx);
      }

      const cancelled = await tx.customerOrder.update({
        where: { id: req.params.id },
        data: { status: 'Cancelled' }
      });

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CANCEL_ORDER',
          tableName: 'customer_orders',
          recordId: order.id,
          oldValue: { status: order.status },
          newValue: { status: 'Cancelled' },
          ip: req.ip || '127.0.0.1'
        }
      });

      return cancelled;
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
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

      // Check if new status requires stock allocation and old status did not, or vice versa
      const isOldAllocated = ALLOCATED_STATUSES.includes(order.status) || order.type === 'Invoice' || order.type === 'POS';
      const isNewAllocated = ALLOCATED_STATUSES.includes(data.status) || order.type === 'Invoice' || order.type === 'POS';

      if (isNewAllocated && !isOldAllocated) {
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
      } else if (!isNewAllocated && isOldAllocated) {
        // Clear stock allocation
        await tx.productStockMovement.deleteMany({
          where: { orderId: id, type: 'order_allocation' }
        });
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
      collectTax: z.boolean().optional().default(false),
      taxRegNo: z.string().optional().nullable(),
      taxType: z.string().optional().nullable(),
      discountValue: z.coerce.number().optional().default(0),
      tdsDeduction: z.coerce.number().optional().default(0),
      freight: z.coerce.number().optional().default(0),
      freightGst: z.boolean().optional().default(false),
      loadingCharges: z.coerce.number().optional().default(0),
      loadingGst: z.boolean().optional().default(false),
      packingCharges: z.coerce.number().optional().default(0),
      packingGst: z.boolean().optional().default(false),
      insurance: z.coerce.number().optional().default(0),
      insuranceGst: z.boolean().optional().default(false),
      otherCharges: z.coerce.number().optional().default(0),
      otherGst: z.boolean().optional().default(false),
      cgst: z.coerce.number().optional().default(0),
      sgst: z.coerce.number().optional().default(0),
      igst: z.coerce.number().optional().default(0),
      roundOff: z.coerce.number().optional().default(0),
      grandTotal: z.coerce.number().optional().default(0),
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
          totalProfit,
          collectTax: data.collectTax,
          taxRegNo: data.taxRegNo || null,
          taxType: data.taxType || null,
          discountValue: data.discountValue,
          tdsDeduction: data.tdsDeduction,
          freight: data.freight,
          freightGst: data.freightGst,
          loadingCharges: data.loadingCharges,
          loadingGst: data.loadingGst,
          packingCharges: data.packingCharges,
          packingGst: data.packingGst,
          insurance: data.insurance,
          insuranceGst: data.insuranceGst,
          otherCharges: data.otherCharges,
          otherGst: data.otherGst,
          cgst: data.cgst,
          sgst: data.sgst,
          igst: data.igst,
          roundOff: data.roundOff,
          grandTotal: data.grandTotal
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

      // 6. Manage stock adjustments
      const isAllocated = ALLOCATED_STATUSES.includes(data.status) || data.type === 'Invoice' || data.type === 'POS';
      if (isAllocated) {
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
        // If status changed away from allocated status, clear allocations
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
