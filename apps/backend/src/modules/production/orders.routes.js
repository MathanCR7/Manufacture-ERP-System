const express = require('express');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');
const notificationService = require('../notifications/notifications.service');
const { sendSalesInvoiceDual, resendDocument, generateInvoicePDFBuffer } = require('../../utils/communication');
const { getTaxSettingsData } = require('../setup/tax.controller');
const documentSeriesService = require('../../services/documentSeries.service');
const batchAllocationService = require('../../services/batchAllocation.service');
const stockReservationService = require('../../services/stockReservation.service');
const gstEngine = require('../../utils/gstEngine');
const multer = require('multer');
const { saveOrderAttachmentToDisk, saveOrderAttachmentBufferToDisk, UPLOADS_DIR } = require('../../utils/paymentFileStorage');

const uploadAttachment = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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

// POST /api/orders/check-stock - Live stock status (On-Hand, Free, Reserved, Shortfall)
router.post('/check-stock', authenticateToken, async (req, res, next) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
        sourceOrderItemId: z.string().optional().nullable()
      }))
    });

    const data = schema.parse(req.body);
    const results = [];

    for (const item of data.items) {
      const summary = await stockReservationService.getProductStockSummary(item.productId);
      const availableCheck = await stockReservationService.getAvailableForInvoice(item.productId, item.sourceOrderItemId);

      const isSufficient = availableCheck.available >= item.quantity;
      const shortage = isSufficient ? 0 : item.quantity - availableCheck.available;

      results.push({
        productId: item.productId,
        productName: summary.productName,
        productCode: summary.productCode,
        onHand: summary.onHand,
        totalReserved: summary.totalReserved,
        freeStock: summary.freeStock,
        reservedForLine: availableCheck.reservedForLine,
        availableForInvoice: availableCheck.available,
        status: isSufficient ? 'Sufficient' : 'Insufficient',
        shortage
      });
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/production-requirements - Aggregated demand & shortfalls from open Standard Orders
router.get('/production-requirements', authenticateToken, async (req, res, next) => {
  try {
    const openOrderItems = await prisma.customerOrderItem.findMany({
      where: {
        shortfallQty: { gt: 0 },
        order: {
          type: 'Sales Order',
          status: { in: ['Shortage (Production Required)', 'In Production', 'Waiting for Production', 'Partly Invoiced'] },
          deletedAt: null
        }
      },
      include: {
        product: { include: { unit: true, category: true } },
        order: { select: { id: true, docNo: true, referenceNo: true, deliveryDate: true, customer: { select: { name: true } } } }
      }
    });

    const grouped = {};
    for (const it of openOrderItems) {
      const pid = it.productId;
      if (!grouped[pid]) {
        grouped[pid] = {
          productId: pid,
          productCode: it.product?.code || 'NO-CODE',
          productName: it.product?.name || 'Unnamed Product',
          category: it.product?.category?.name || 'General',
          unit: it.uomName || it.product?.unit?.abbreviation || 'pcs',
          totalShortfall: 0,
          earliestDeliveryDate: it.order?.deliveryDate || new Date(),
          ordersInvolved: []
        };
      }
      grouped[pid].totalShortfall += Number(it.shortfallQty);
      if (new Date(it.order.deliveryDate) < new Date(grouped[pid].earliestDeliveryDate)) {
        grouped[pid].earliestDeliveryDate = it.order.deliveryDate;
      }
      grouped[pid].ordersInvolved.push({
        orderId: it.order.id,
        docNo: it.order.docNo || it.order.referenceNo,
        customerName: it.order.customer?.name,
        shortfall: Number(it.shortfallQty),
        deliveryDate: it.order.deliveryDate
      });
    }

    const results = [];
    for (const pid of Object.keys(grouped)) {
      const itemData = grouped[pid];
      const activeBatches = await prisma.productionBatchNew.findMany({
        where: {
          productId: pid,
          status: { in: ['Planned', 'In Progress'] },
          deletedAt: null
        },
        select: { quantity: true, partiallyDoneQty: true }
      });
      const inProduction = activeBatches.reduce((s, b) => s + (Number(b.quantity) - Number(b.partiallyDoneQty || 0)), 0);
      const netToProduce = Math.max(0, itemData.totalShortfall - inProduction);

      results.push({
        ...itemData,
        inProduction,
        netToProduce
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
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

/**
 * Strict Document Immutability Check:
 * - Converted Quotation: CANNOT be changed, edited, updated, or deleted.
 * - Invoiced Sales Order: CANNOT be changed, edited, updated, or deleted.
 * - Only the downstream Tax Invoice (or draft un-converted records) can be edited, updated, or deleted.
 */
async function checkOrderImmutability(orderId, tx = prisma) {
  const order = await tx.customerOrder.findUnique({
    where: { id: orderId },
    include: {
      childOrders: {
        where: { deletedAt: null },
        select: { id: true, docNo: true, referenceNo: true, type: true, status: true }
      }
    }
  });

  if (!order) return { order: null, isLocked: false };

  // Rule 1: Quotation converted to Sales Order
  if (order.type === 'Quotation') {
    const isConverted = order.status === 'Converted' || (order.childOrders && order.childOrders.length > 0);
    if (isConverted) {
      const child = order.childOrders?.[0];
      return {
        order,
        isLocked: true,
        reason: `Quotation #${order.docNo || order.referenceNo} has already been converted to Sales Order #${child?.docNo || 'SO'} and is permanently locked. Converted quotations cannot be changed, edited, or deleted.`,
        convertedDocNo: child?.docNo
      };
    }
  }

  // Rule 2: Sales Order converted to Tax Invoice
  if (order.type === 'Sales Order') {
    const invoiceChild = order.childOrders?.find(c => c.type === 'Invoice') || (order.childOrders && order.childOrders.length > 0 ? order.childOrders[0] : null);
    if (invoiceChild || order.status === 'Delivered') {
      return {
        order,
        isLocked: true,
        reason: `Sales Order #${order.docNo || order.referenceNo} has already been converted to Tax Invoice #${invoiceChild?.docNo || 'INV'} and is permanently locked. Converted sales orders cannot be changed, edited, or deleted. Only the downstream invoice can be edited or deleted.`,
        convertedDocNo: invoiceChild?.docNo
      };
    }
  }

  return { order, isLocked: false };
}

/**
 * Builds chronological linked document flow (Quotation -> Standard Order -> Tax Invoice)
 * Groups connected transaction documents by shared rootOrderId and tracks conversion links.
 */
function buildDocumentChainsHelper(orders) {
  const byId = new Map(orders.map(o => [o.id, o]));
  const childrenMap = new Map();
  orders.forEach(o => {
    if (o.sourceOrderId) {
      if (!childrenMap.has(o.sourceOrderId)) childrenMap.set(o.sourceOrderId, []);
      childrenMap.get(o.sourceOrderId).push(o);
    }
  });

  return orders.map(order => {
    // 1. Follow sourceOrderId up to root document
    let root = order;
    const visitedUp = new Set([root.id]);
    while (root.sourceOrderId && byId.has(root.sourceOrderId)) {
      if (visitedUp.has(root.sourceOrderId)) break;
      visitedUp.add(root.sourceOrderId);
      root = byId.get(root.sourceOrderId);
    }

    // 2. Collect all connected documents in this group/chain
    const chainDocs = [];
    const queue = [root];
    const visitedDown = new Set();
    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr || visitedDown.has(curr.id)) continue;
      visitedDown.add(curr.id);
      chainDocs.push({
        id: curr.id,
        docNo: curr.docNo || curr.referenceNo,
        referenceNo: curr.referenceNo,
        type: curr.type,
        orderMode: curr.orderMode,
        status: curr.status,
        grandTotal: Number(curr.grandTotal || curr.totalSubtotal || 0),
        paymentStatus: curr.paymentStatus,
        createdAt: curr.createdAt,
        deliveryDate: curr.deliveryDate,
        isCurrent: curr.id === order.id
      });
      const children = childrenMap.get(curr.id) || [];
      queue.push(...children);
    }

    // Sort chain chronologically: Quotation -> Sales Order -> Invoice
    chainDocs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Resolve immediate parent
    const parentDoc = order.sourceOrderId && byId.has(order.sourceOrderId) ? {
      id: byId.get(order.sourceOrderId).id,
      docNo: byId.get(order.sourceOrderId).docNo || byId.get(order.sourceOrderId).referenceNo,
      referenceNo: byId.get(order.sourceOrderId).referenceNo,
      type: byId.get(order.sourceOrderId).type,
      status: byId.get(order.sourceOrderId).status,
      grandTotal: Number(byId.get(order.sourceOrderId).grandTotal || 0),
      createdAt: byId.get(order.sourceOrderId).createdAt
    } : null;

    // Resolve immediate children
    const childDocs = (childrenMap.get(order.id) || []).map(c => ({
      id: c.id,
      docNo: c.docNo || c.referenceNo,
      referenceNo: c.referenceNo,
      type: c.type,
      status: c.status,
      grandTotal: Number(c.grandTotal || 0),
      createdAt: c.createdAt
    }));

    // Status / Conversion helper flags
    const isConvertedQuote = order.type === 'Quotation' && (order.status === 'Converted' || childDocs.length > 0);
    const convertedToOrder = isConvertedQuote && childDocs.length > 0 ? childDocs[0] : null;

    const isInvoicedOrder = order.type === 'Sales Order' && (
      order.status === 'Delivered' || 
      childDocs.some(c => c.type === 'Invoice') ||
      chainDocs.some(d => d.type === 'Invoice' && d.id !== order.id)
    );
    const invoicedToOrder = isInvoicedOrder 
      ? (childDocs.find(c => c.type === 'Invoice') || chainDocs.find(d => d.type === 'Invoice' && d.id !== order.id)) 
      : null;

    const isLockedDocument = isConvertedQuote || isInvoicedOrder;
    const lockReason = isConvertedQuote
      ? `Quotation #${order.docNo || order.referenceNo} has already been converted to Sales Order #${convertedToOrder?.docNo || 'SO'} and cannot be changed, edited, or deleted.`
      : isInvoicedOrder
      ? `Sales Order #${order.docNo || order.referenceNo} has already been converted to Tax Invoice #${invoicedToOrder?.docNo || 'INV'} and cannot be changed, edited, or deleted.`
      : null;

    const chainSummary = chainDocs.map(c => c.docNo).join(' → ');

    return {
      ...order,
      rootOrderId: root.id,
      documentChain: chainDocs,
      chainSummary,
      parentDoc,
      childDocs,
      sourceOrder: parentDoc,
      childOrders: childDocs,
      isConvertedQuote,
      convertedToOrder,
      isInvoicedOrder,
      invoicedToOrder,
      isLockedDocument,
      lockReason
    };
  });
}

// GET /api/orders - list all orders with linked document chains
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
    const enriched = buildDocumentChainsHelper(orders);
    res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/next-invoice-number - Live next receipt number & daily serving queue token
router.get('/next-invoice-number', authenticateToken, async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.customerOrder.count({
      where: { createdAt: { gte: todayStart }, deletedAt: null }
    });

    const rawPrefix = (req.query.prefix || req.query.type || 'INV').toUpperCase();
    const posResult = await documentSeriesService.peekNextNumber('POS');
    const invResult = await documentSeriesService.peekNextNumber('INVOICE');
    const soResult = await documentSeriesService.peekNextNumber('SALES_ORDER');
    const qtResult = await documentSeriesService.peekNextNumber('QUOTATION');
    const plResult = await documentSeriesService.peekNextNumber('PL');

    // Live serving queue token: calculated dynamically from today's orders count + 1
    const servingVal = Math.max(1, todayCount + 1);
    const servingNumber = `A-${String(servingVal).padStart(3, '0')}`;

    let chosenResult = invResult;
    if (rawPrefix.includes('POS')) chosenResult = posResult;
    else if (rawPrefix.includes('SO') || rawPrefix.includes('STANDARD')) chosenResult = soResult;
    else if (rawPrefix.includes('QT') || rawPrefix.includes('QUOTATION')) chosenResult = qtResult;
    else if (rawPrefix.includes('PL') || rawPrefix.includes('PLANNING')) chosenResult = plResult;
    else if (rawPrefix.includes('INV') || rawPrefix.includes('INVOICE')) chosenResult = invResult;

    res.json({
      receiptNumber: chosenResult.docNo,
      posReceiptNumber: posResult.docNo,
      invoiceReceiptNumber: invResult.docNo,
      soReceiptNumber: soResult.docNo,
      qtReceiptNumber: qtResult.docNo,
      plReceiptNumber: plResult.docNo,
      servingNumber,
      todayCount,
      financialYear: chosenResult.financialYear,
      month: chosenResult.month,
      prefix: chosenResult.prefix,
      sequenceNo: chosenResult.sequenceNo
    });
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
        items: {
          include: {
            product: {
              include: {
                unit: true,
                category: true,
                subcategory: true
              }
            },
            batchAllocations: true
          }
        },
        deliveries: true,
        productionBatches: true,
        creator: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Attach document chain graph
    const allOrders = await prisma.customerOrder.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        docNo: true,
        referenceNo: true,
        type: true,
        status: true,
        orderMode: true,
        sourceOrderId: true,
        grandTotal: true,
        createdAt: true,
        deliveryDate: true
      }
    });
    const enriched = buildDocumentChainsHelper(allOrders);
    const matched = enriched.find(o => o.id === order.id);

    res.json({
      ...order,
      rootOrderId: matched?.rootOrderId || order.id,
      documentChain: matched?.documentChain || [],
      chainSummary: matched?.chainSummary || (order.docNo || order.referenceNo),
      parentDoc: matched?.parentDoc || null,
      childDocs: matched?.childDocs || [],
      sourceOrder: matched?.sourceOrder || null,
      childOrders: matched?.childOrders || [],
      isConvertedQuote: matched?.isConvertedQuote || false,
      convertedToOrder: matched?.convertedToOrder || null,
      isInvoicedOrder: matched?.isInvoicedOrder || false,
      invoicedToOrder: matched?.invoicedToOrder || null,
      isLockedDocument: matched?.isLockedDocument || false,
      lockReason: matched?.lockReason || null
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id/document-flow - Comprehensive transaction lifecycle map (QT -> SO -> INV)
router.get('/:id/document-flow', authenticateToken, async (req, res, next) => {
  try {
    const targetOrder = await prisma.customerOrder.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } },
        deliveries: true
      }
    });

    if (!targetOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const allOrders = await prisma.customerOrder.findMany({
      where: { deletedAt: null },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    const enriched = buildDocumentChainsHelper(allOrders);
    const matched = enriched.find(o => o.id === targetOrder.id);

    const timeline = [];
    if (matched?.documentChain && matched.documentChain.length > 0) {
      matched.documentChain.forEach((doc, idx) => {
        let action = 'Document Created';
        if (doc.type === 'Quotation') {
          action = doc.status === 'Converted' ? 'Quotation Accepted & Converted' : 'Quotation Issued to Client';
        } else if (doc.type === 'Sales Order') {
          action = idx > 0 ? `Converted to Standard Sales Order from ${matched.documentChain[idx - 1]?.docNo}` : 'Direct Standard Sales Order Created';
        } else if (doc.type === 'Invoice') {
          action = `Tax Invoice Posted & Stock Deducted from ${matched.documentChain[idx - 1]?.docNo || 'Order'}`;
        }

        timeline.push({
          step: idx + 1,
          docId: doc.id,
          docNo: doc.docNo,
          referenceNo: doc.referenceNo,
          type: doc.type,
          status: doc.status,
          date: doc.createdAt,
          grandTotal: doc.grandTotal,
          paymentStatus: doc.paymentStatus,
          action,
          isCurrent: doc.id === targetOrder.id
        });
      });
    }

    const documentsWithDetails = (matched?.documentChain || []).map(c => {
      const fullDoc = allOrders.find(o => o.id === c.id);
      return {
        ...c,
        customerName: fullDoc?.customer?.name || fullDoc?.customerName,
        customerPhone: fullDoc?.customer?.phone || fullDoc?.customerPhone,
        itemsCount: fullDoc?.items?.length || 0,
        items: (fullDoc?.items || []).map(it => ({
          productName: it.productName || it.product?.name,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          subtotal: Number(it.subtotal),
          reservedQty: Number(it.reservedQty || 0),
          invoicedQty: Number(it.invoicedQty || 0),
          shortfallQty: Number(it.shortfallQty || 0)
        }))
      };
    });

    res.json({
      targetId: targetOrder.id,
      rootOrderId: matched?.rootOrderId || targetOrder.id,
      chainSummary: matched?.chainSummary || (targetOrder.docNo || targetOrder.referenceNo),
      chain: matched?.documentChain || [],
      timeline,
      documents: documentsWithDetails
    });
  } catch (error) {
    next(error);
  }
});

// PDF Handler for Customer Order Tax Invoice (A4 Statutory PDF)
const getOrderPdfHandler = async (req, res, next) => {
  try {
    const id = req.params.id || req.query.id || req.query.orderId || req.query.docNo;
    if (!id) {
      return res.status(400).send('Order identifier is required');
    }

    const order = await prisma.customerOrder.findFirst({
      where: {
        OR: [
          { id: id },
          { docNo: id },
          { referenceNo: id }
        ],
        deletedAt: null
      },
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
      return res.status(404).send('Invoice or order document not found');
    }

    const company = await prisma.companyDetails.findFirst();
    const taxSettings = await getTaxSettingsData();

    const mergedSettings = {
      companyName: company?.companyName || taxSettings?.companyName || 'ANTIGRAVITY DAIRY & FOODS PRIVATE LIMITED',
      companyAddress: company?.companyAddress || taxSettings?.companyAddress || 'Plot 42, SIDCO Industrial Estate, Salem, Tamil Nadu, 636004',
      companyGstin: company?.companyGstin || taxSettings?.companyGstin || '33AABCA1234F1Z8',
      companyMobile: company?.companyMobile || taxSettings?.companyMobile || '+91 94433 12345',
      companyEmail: company?.companyEmail || taxSettings?.companyEmail || 'billing@antigravitydairy.com',
      bankName: company?.bankName || taxSettings?.bankName || 'State Bank of India',
      bankAccountNumber: company?.bankAccountNumber || taxSettings?.bankAccountNumber || '123456789012',
      bankIfscCode: company?.bankIfscCode || taxSettings?.bankIfscCode || 'SBIN0001234',
      bankBranch: company?.bankBranch || taxSettings?.bankBranch || 'Salem Main Branch',
      invoiceTerms: company?.invoiceTerms || taxSettings?.invoiceTerms
    };

    const pdfBuffer = await generateInvoicePDFBuffer(order, mergedSettings);
    const docNo = order.docNo || order.referenceNo || 'Tax_Invoice';
    const safeFilename = `Tax_Invoice_${docNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error('[Order PDF Generator] Error generating PDF:', error);
    next(error);
  }
};

// GET /api/orders/:id/pdf - Stream statutory Tax Invoice PDF (authenticated route)
router.get('/:id/pdf', authenticateToken, getOrderPdfHandler);


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
      orderMode: z.string().optional().nullable(),
      skipStockDeduction: z.boolean().optional().default(false),
      docNo: z.string().optional().nullable(),
      documentSeries: z.string().optional().nullable(),
      placeOfSupply: z.string().optional().nullable(),
      sellerStateCode: z.string().optional().nullable(),
      buyerStateCode: z.string().optional().nullable(),
      salesEmployee: z.string().optional().nullable(),
      paymentMode: z.string().optional().nullable(),
      customerRefNo: z.string().optional().nullable(),
      billToAddress: z.string().optional().nullable(),
      shippingMethod: z.string().optional().nullable(),
      attachmentUrl: z.string().optional().nullable(),
      transporterName: z.string().optional().nullable(),
      vehicleNo: z.string().optional().nullable(),
      lrNo: z.string().optional().nullable(),
      ewayBillNo: z.string().optional().nullable(),
      amountPaid: z.coerce.number().optional().default(0),
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
          docNo: data.docNo || null,
          documentSeries: data.documentSeries || null,
          orderMode: data.orderMode || (data.type === 'Invoice' ? 'INVOICE' : (data.status === 'Waiting for Production' ? 'NEED_PLANNING' : 'STANDARD')),
          customerRefNo: data.customerRefNo || null,
          billToAddress: data.billToAddress || null,
          shippingMethod: data.shippingMethod || 'Road Transport',
          salesEmployee: data.salesEmployee || '-No Sales Employee-',
          paymentMode: data.paymentMode || null,
          attachmentUrl: data.attachmentUrl || null,
          placeOfSupply: data.placeOfSupply || null,
          sellerStateCode: data.sellerStateCode || null,
          buyerStateCode: data.buyerStateCode || null,
          amountPaid: data.amountPaid || 0,
          transporterName: data.transporterName || null,
          vehicleNo: data.vehicleNo || null,
          lrNo: data.lrNo || null,
          ewayBillNo: data.ewayBillNo || null,
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
      const isAllocated = (ALLOCATED_STATUSES.includes(data.status) || 
                          data.type === 'Invoice' || 
                          data.type === 'POS') && data.orderMode !== 'INVOICE' && !data.skipStockDeduction;

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
    }, { maxWait: 15000, timeout: 60000 });

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
    // 0. Resolve canonical document mode & type
    let docType = type;
    if (data.orderMode === 'QUOTATION' || type === 'Quotation') {
      docType = 'Quotation';
    } else if (data.orderMode === 'INVOICE' || type === 'Invoice') {
      docType = 'Invoice';
    } else if (type === 'POS') {
      docType = 'POS';
    } else {
      docType = 'Sales Order';
    }

    const seriesPrefix = docType === 'Quotation' ? 'QT' : (docType === 'Invoice' ? 'INV' : (docType === 'POS' ? 'POS' : 'SO'));

    // 1. Resolve Document Number:
    // IMPORTANT: For Invoices, do NOT issue sequence number here! Check stock availability first to prevent gaps.
    let docNo = null;
    let referenceNo = null;
    let documentSeries = seriesPrefix;

    if (docType !== 'Invoice') {
      const isDocNoValid = data.docNo && data.docNo !== 'NaN' && !String(data.docNo).includes('NaN');
      if (isDocNoValid) {
        docNo = data.docNo;
        referenceNo = data.docNo;
      } else {
        const seriesResult = await documentSeriesService.getNextNumber(seriesPrefix, tx);
        docNo = seriesResult.docNo;
        referenceNo = seriesResult.docNo;
      }
    }

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
    if (docType === 'Invoice' && customer.customerType === 'DISTRIBUTOR') {
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

    // 5. Pre-fetch Product Details, Stock Checks & Calculations
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

      let reservedQty = 0;
      let shortfallQty = 0;
      let isStockItem = prod.isStockItem !== false;

      // ─── STRICT ATOMIC STOCK CHECK FOR INVOICES ───
      if (docType === 'Invoice') {
        if (isStockItem) {
          let sourceItemId = item.sourceOrderItemId || null;
          if (!sourceItemId && data.sourceOrderId) {
            const matchedSourceItem = await tx.customerOrderItem.findFirst({
              where: { orderId: data.sourceOrderId, productId: item.productId }
            });
            if (matchedSourceItem) sourceItemId = matchedSourceItem.id;
          }
          const check = await stockReservationService.getAvailableForInvoice(
            item.productId,
            sourceItemId,
            tx
          );
          if (qty > check.available) {
            const shortage = qty - check.available;
            throw new Error(`Insufficient stock for "${prod.name}" (${prod.code}): Required ${qty}, Available ${check.available}, Short ${shortage}. Invoice cannot be posted without stock.`);
          }
        }
      } else if (docType === 'Sales Order') {
        // ─── STANDARD ORDER: NEVER BLOCK; RESERVE AVAILABLE FREE STOCK & TRACK SHORTAGE ───
        if (isStockItem) {
          const stockSummary = await stockReservationService.getProductStockSummary(item.productId, tx);
          reservedQty = Math.min(qty, stockSummary.freeStock);
          shortfallQty = Math.max(0, qty - reservedQty);
        }
      } else if (docType === 'POS') {
        if (isStockItem) {
          const stockSummary = await stockReservationService.getProductStockSummary(item.productId, tx);
          if (qty > stockSummary.onHand || stockSummary.onHand <= 0) {
            throw new Error(`Stock Unavailable: Cannot complete POS sale for "${prod.name}" (Required: ${qty}, In Stock: ${stockSummary.onHand}).`);
          }
        }
      }

      // Handle batch assignments (manual or FEFO) for Invoices and POS
      let allocations = [];
      let batchId = item.batchId || null;
      let batchNo = item.batchNo || null;
      let mfgDate = item.mfgDate ? new Date(item.mfgDate) : null;
      let expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;

      if ((docType === 'Invoice' || docType === 'POS') && isStockItem) {
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
        allocations,
        reservedQty,
        shortfallQty,
        isStockItem,
        sourceOrderItemId: item.sourceOrderItemId || null
      });
    }

    // ─── PHASE 2: ATOMIC INVOICE NUMBER ISSUANCE (ONLY AFTER ALL STOCK CHECKS PASS) ───
    if (docType === 'Invoice') {
      const seriesResult = await documentSeriesService.getNextNumber('INV', tx);
      docNo = seriesResult.docNo;
      referenceNo = seriesResult.docNo;
      documentSeries = seriesResult.prefix;
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

    // 7. Payment & Order Status calculation
    const amountPaid = Number(data.amountPaid || (docType === 'POS' ? gstResult.grandTotal : 0));
    let paymentStatus = 'PENDING';
    if (amountPaid >= gstResult.grandTotal && gstResult.grandTotal > 0) {
      paymentStatus = 'PAID';
    } else if (amountPaid > 0) {
      paymentStatus = 'PARTIAL';
    }

    let orderStatus = data.status || defaultStatus;
    if (docType === 'Sales Order') {
      const anyShortage = itemsPrepared.some(it => Number(it.shortfallQty || 0) > 0);
      orderStatus = anyShortage ? 'Shortage (Production Required)' : 'Ready to Invoice';
    } else if (docType === 'Invoice' || docType === 'POS') {
      orderStatus = 'Delivered';
    } else if (docType === 'Quotation') {
      orderStatus = 'Quotation';
    } else if (!orderStatus) {
      orderStatus = 'Confirmed';
    }

    let finalInternalNote = data.attachmentUrl
      ? (data.internalNote ? `${data.internalNote}\n[Attachment]: ${data.attachmentUrl}` : `[Attachment]: ${data.attachmentUrl}`)
      : (data.internalNote || data.note || null);

    // 8. Create CustomerOrder record
    const createdOrder = await tx.customerOrder.create({
      data: {
        referenceNo,
        docNo,
        documentSeries,
        sourceOrderId: data.sourceOrderId || null,
        customerId: customer.id,
        type: docType,
        status: orderStatus,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date(),
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        deliveryAddress: data.deliveryAddress || (docType === 'POS' ? 'Over the Counter POS' : customer.address || 'Standard Delivery'),
        quotationNote: data.quotationNote || null,
        internalNote: finalInternalNote,
        paymentTerms: data.paymentTerms || (docType === 'POS' ? (data.paymentMode || 'Cash') : 'Net 30'),
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
        customerName: data.customerName || (docType === 'POS' ? (data.customerName || 'Walk-in Customer') : customer?.name || null),
        customerPhone: data.customerPhone || customer?.phone || null,
        transporterName: data.transporterName || data.transportMode || null,
        vehicleNo: data.vehicleNo || data.vehicleNumber || null,
        lrNo: data.lrNo || data.lrNumber || null,
        ewayBillNo: data.ewayBillNo || data.eWayBillNumber || null,
        ewayBillDate: data.ewayBillDate ? new Date(data.ewayBillDate) : null,
        customerRefNo: data.customerRefNo || null,
        billToAddress: data.billToAddress || null,
        shippingMethod: data.shippingMethod || 'Road Transport',
        salesEmployee: data.salesEmployee || '-No Sales Employee-',
        paymentMode: data.paymentMethod || data.paymentMode || null,
        orderMode: docType === 'Quotation' ? 'QUOTATION' : (docType === 'Invoice' ? 'INVOICE' : 'STANDARD'),
        allowPartialDelivery: Boolean(data.allowPartialDelivery),
        attachmentUrl: data.attachmentUrl || null,
        createdBy: req.user.id
      }
    });

    // 9. Create Order Items with Snapshots & Stock Balances
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
          deliveryDate: item.deliveryDate,
          invoicedQty: 0,
          reservedQty: item.reservedQty || 0,
          shortfallQty: item.shortfallQty || 0,
          isStockItem: item.isStockItem,
          expectedDate: item.expectedDate ? new Date(item.expectedDate) : null
        }
      });

      item.orderItemId = createdItem.id;
    }

    // 10. Commit Stock Decrements IF AND ONLY IF Invoice or POS
    if ((docType === 'Invoice' || docType === 'POS')) {
      const stockItemsToDeduct = itemsPrepared.filter(it => it.isStockItem);
      if (stockItemsToDeduct.length > 0) {
        await batchAllocationService.commitDecrements(stockItemsToDeduct, createdOrder, req.user.id, tx);
      }

      // If converted from a source Standard Order: consume reservation, update invoicedQty & parent status
      if (data.sourceOrderId) {
        for (const item of itemsPrepared) {
          const sourceItem = await tx.customerOrderItem.findFirst({
            where: { orderId: data.sourceOrderId, productId: item.productId }
          });
          if (sourceItem) {
            const consumedRes = Math.min(Number(item.quantity), Number(sourceItem.reservedQty || 0));
            const newInvoiced = Number(sourceItem.invoicedQty || 0) + Number(item.quantity);
            const remainingBalance = Math.max(0, Number(sourceItem.quantity) - newInvoiced);
            const remainingReserved = Math.max(0, Number(sourceItem.reservedQty || 0) - consumedRes);
            const newShortfall = Math.max(0, remainingBalance - remainingReserved);

            await tx.customerOrderItem.update({
              where: { id: sourceItem.id },
              data: {
                reservedQty: remainingReserved,
                invoicedQty: newInvoiced,
                shortfallQty: newShortfall
              }
            });
          }
        }
        await stockReservationService.checkAndUpdateOrderStatus(data.sourceOrderId, tx);
      }
    }

    // 11. Delivery log
    await tx.customerOrderDelivery.create({
      data: {
        orderId: createdOrder.id,
        deliveryDate: createdOrder.deliveryDate,
        quantity: itemsPrepared.reduce((s, it) => s + it.quantity, 0),
        status: orderStatus === 'Delivered' ? 'Delivered' : 'Pending',
        note: `${docType} generated #${docNo}. Payment: ${paymentStatus}`
      }
    });

    // 12. Audit Log
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: `CREATE_${docType.toUpperCase().replace(/\s+/g, '_')}`,
        tableName: 'customer_orders',
        recordId: createdOrder.id,
        oldValue: null,
        newValue: {
          docNo,
          type: docType,
          customerName: customer.name,
          grandTotal: createdOrder.grandTotal,
          paymentStatus: createdOrder.paymentStatus
        },
        ip: req.ip || '127.0.0.1'
      }
    });

    return createdOrder;
  }, { maxWait: 15000, timeout: 60000 });
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

// POST /api/orders/pos-instant - Instant POS counter endpoint alias
router.post('/pos-instant', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
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

// POST /api/orders/sales-order - Commercial Order creation (Standard Order, Quotation, or Invoice)
router.post('/sales-order', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const isQuotation = req.body.orderMode === 'QUOTATION' || req.body.type === 'Quotation';
    const isInvoiceMode = req.body.orderMode === 'INVOICE' || req.body.type === 'Invoice';

    let docType = 'Sales Order';
    if (isInvoiceMode) docType = 'Invoice';
    else if (isQuotation) docType = 'Quotation';

    const order = await processBillingOrder({
      req,
      type: docType,
      data: req.body,
      defaultStatus: isInvoiceMode ? 'Delivered' : (isQuotation ? 'Quotation' : 'Confirmed')
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/upload-attachment - Upload camera/gallery image to UPLOADS_DIR named with orderId
router.post('/upload-attachment', authenticateToken, uploadAttachment.single('file'), async (req, res, next) => {
  try {
    const orderId = req.body?.orderId || req.query?.orderId || 'ORDER';
    const oldFileUrl = req.body?.oldFileUrl || req.body?.oldPath || null;
    const cleanOrderId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '_');

    // Clean up previous attachment file from disk if replacing
    if (oldFileUrl) {
      deletePaymentImageFromDisk(oldFileUrl);
    }

    let fileUrl = null;
    if (req.file) {
      fileUrl = saveOrderAttachmentBufferToDisk(req.file.buffer, req.file.originalname, cleanOrderId, oldFileUrl);
    } else if (req.body?.imageData) {
      fileUrl = saveOrderAttachmentToDisk(req.body.imageData, cleanOrderId, oldFileUrl);
    }

    if (!fileUrl) {
      return res.status(400).json({ error: 'Valid image file or base64 image data is required' });
    }

    const filename = fileUrl.split('?')[0].split('/').pop();
    res.json({
      success: true,
      url: fileUrl,
      filename,
      orderId: cleanOrderId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/delete-attachment - Remove attachment from server uploads directory & sync database
router.post('/delete-attachment', authenticateToken, async (req, res, next) => {
  try {
    const { fileUrl, filename, orderId, orderDocNo } = req.body;
    const targetFile = fileUrl || filename;
    if (!targetFile) {
      return res.status(400).json({ error: 'fileUrl or filename is required to delete attachment' });
    }

    const deleted = deletePaymentImageFromDisk(targetFile);

    // If orderId or orderDocNo is provided, sync database record
    if (orderId || orderDocNo) {
      try {
        const order = await prisma.customerOrder.findFirst({
          where: {
            OR: [
              ...(orderId ? [{ id: orderId }] : []),
              ...(orderDocNo ? [{ docNo: String(orderDocNo) }, { referenceNo: String(orderDocNo) }] : [])
            ]
          }
        });

        if (order) {
          const baseName = path.basename(String(targetFile).split('?')[0]);
          let updatedAttachmentUrl = order.attachmentUrl;
          if (order.attachmentUrl) {
            const list = order.attachmentUrl.split(',').map(u => u.trim()).filter(Boolean);
            const filtered = list.filter(u => !u.includes(baseName));
            updatedAttachmentUrl = filtered.length > 0 ? filtered.join(', ') : null;
          }

          let updatedInternalNote = order.internalNote;
          if (order.internalNote && order.internalNote.includes('[[ATTACHMENT:')) {
            const match = order.internalNote.match(/\[\[ATTACHMENT:(.*?)\]\]/);
            if (match && match[1]) {
              try {
                const parsed = JSON.parse(match[1]);
                if (Array.isArray(parsed)) {
                  const filteredAtts = parsed.filter(a => !a.url?.includes(baseName) && a.filename !== baseName);
                  const attJson = filteredAtts.length > 0 ? `[[ATTACHMENT:${JSON.stringify(filteredAtts)}]]` : '';
                  updatedInternalNote = order.internalNote.replace(/\[\[ATTACHMENT:.*?\]\]/g, '').trim() + (attJson ? ' ' + attJson : '');
                }
              } catch (e) {}
            }
          }

          await prisma.customerOrder.update({
            where: { id: order.id },
            data: {
              attachmentUrl: updatedAttachmentUrl,
              internalNote: updatedInternalNote
            }
          });
        }
      } catch (dbErr) {
        console.error('Error syncing order in db after attachment delete:', dbErr);
      }
    }

    res.json({
      success: true,
      deleted,
      filename: path.basename(String(targetFile).split('?')[0]),
      message: `Attachment file ${deleted ? 'deleted from' : 'removed'} uploads directory.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    if (sourceOrder.status === 'Invoiced' || sourceOrder.status === 'Delivered') {
      return res.status(400).json({ error: 'Order has already been fully invoiced' });
    }

    const itemsToBill = req.body.items && req.body.items.length > 0 
      ? req.body.items.map(it => {
          const matchSourceItem = sourceOrder.items.find(si => si.productId === it.productId);
          return {
            ...it,
            sourceOrderItemId: it.sourceOrderItemId || matchSourceItem?.id || null
          };
        })
      : sourceOrder.items.map(it => ({
          productId: it.productId,
          sourceOrderItemId: it.id,
          quantity: Number(it.quantity) - Number(it.invoicedQty || 0),
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountPercent: it.discountPercent,
          gstRate: it.gstRate,
          hsnCode: it.hsnCode,
          uomName: it.uomName
        })).filter(it => it.quantity > 0);

    if (itemsToBill.length === 0) {
      return res.status(400).json({ error: 'All items on this order have already been invoiced' });
    }

    const invoicePayload = {
      customerId: sourceOrder.customerId,
      sourceOrderId: sourceOrder.id,
      deliveryAddress: req.body.deliveryAddress || sourceOrder.deliveryAddress,
      billToAddress: req.body.billToAddress || sourceOrder.billToAddress,
      paymentTerms: req.body.paymentTerms || sourceOrder.paymentTerms || 'Net 30',
      paymentMode: req.body.paymentMode || sourceOrder.paymentMode,
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
      orderMode: 'INVOICE',
      items: itemsToBill
    };

    const newInvoice = await processBillingOrder({
      req,
      type: 'Invoice',
      data: invoicePayload,
      defaultStatus: 'Delivered'
    });

    res.status(201).json(newInvoice);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/resend - Resend invoice via Email & WhatsApp
router.post('/:id/resend', authenticateToken, async (req, res, next) => {
  try {
    const { targetEmail } = req.body || {};
    const result = await resendDocument('SALES_INVOICE', req.params.id, null, targetEmail);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/orders/:id/convert-to-order - Convert Quotation to Standard Sales Order
router.post('/:id/convert-to-order', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SALES_TEAM', 'SUPERVISOR']), async (req, res, next) => {
  try {
    const quotation = await prisma.customerOrder.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: { include: { product: true } } }
    });
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (quotation.status === 'Converted') {
      const existingChild = await prisma.customerOrder.findFirst({
        where: { sourceOrderId: quotation.id, deletedAt: null }
      });
      return res.status(400).json({
        error: 'Quotation has already been converted to an order',
        message: `Quotation ${quotation.docNo || quotation.referenceNo} has already been converted to Sales Order #${existingChild?.docNo || existingChild?.referenceNo || 'SO'}`,
        alreadyConverted: true,
        convertedOrderId: existingChild?.id,
        convertedDocNo: existingChild?.docNo || existingChild?.referenceNo
      });
    }

    // Build payload for new Standard Order linked to this quotation
    const orderPayload = {
      customerId: quotation.customerId,
      sourceOrderId: quotation.id,
      deliveryAddress: quotation.deliveryAddress,
      billToAddress: quotation.billToAddress,
      paymentTerms: quotation.paymentTerms || 'Net 30',
      paymentMode: quotation.paymentMode,
      amountPaid: 0,
      freight: quotation.freight,
      freightGst: quotation.freightGst,
      loadingCharges: quotation.loadingCharges,
      loadingGst: quotation.loadingGst,
      packingCharges: quotation.packingCharges,
      packingGst: quotation.packingGst,
      insurance: quotation.insurance,
      insuranceGst: quotation.insuranceGst,
      otherCharges: quotation.otherCharges,
      otherGst: quotation.otherGst,
      discountValue: quotation.discountValue,
      tdsDeduction: quotation.tdsDeduction,
      orderMode: 'STANDARD',
      customerRefNo: quotation.customerRefNo,
      salesEmployee: quotation.salesEmployee,
      items: quotation.items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        discountPercent: it.discountPercent,
        gstRate: it.gstRate,
        hsnCode: it.hsnCode,
        uomName: it.uomName
      }))
    };

    const newOrder = await processBillingOrder({
      req,
      type: 'Sales Order',
      data: orderPayload,
      defaultStatus: 'Confirmed'
    });

    // Mark Quotation as Converted
    await prisma.customerOrder.update({
      where: { id: quotation.id },
      data: { status: 'Converted' }
    });

    res.status(201).json(newOrder);
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
    const id = req.params.id;
    const check = await checkOrderImmutability(id);
    if (check.isLocked) {
      return res.status(403).json({ error: check.reason, isLocked: true });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findUnique({
        where: { id },
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
    const check = await checkOrderImmutability(id);
    if (check.isLocked) {
      return res.status(403).json({ error: check.reason, isLocked: true });
    }

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

// PATCH /api/orders/:id/update-details - Update order logistics, payment status, transport, and notes
router.patch('/:id/update-details', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'MATERIALS_RECEIVER', 'LAB_ASSISTANT']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const check = await checkOrderImmutability(id);
    if (check.isLocked) {
      return res.status(403).json({ error: check.reason, isLocked: true });
    }

    const {
      deliveryAddress,
      billToAddress,
      shippingMethod,
      transporterName,
      vehicleNo,
      lrNo,
      ewayBillNo,
      ewayBillDate,
      customerRefNo,
      salesEmployee,
      paymentTerms,
      paymentStatus,
      paymentMode,
      amountPaid,
      placeOfSupply,
      taxRegNo,
      internalNote,
      quotationNote,
      status,
      attachmentUrl
    } = req.body;

    const dataToUpdate = {};
    if (deliveryAddress !== undefined) dataToUpdate.deliveryAddress = deliveryAddress;
    if (billToAddress !== undefined) dataToUpdate.billToAddress = billToAddress;
    if (shippingMethod !== undefined) dataToUpdate.shippingMethod = shippingMethod;
    if (transporterName !== undefined) dataToUpdate.transporterName = transporterName;
    if (vehicleNo !== undefined) dataToUpdate.vehicleNo = vehicleNo;
    if (lrNo !== undefined) dataToUpdate.lrNo = lrNo;
    if (ewayBillNo !== undefined) dataToUpdate.ewayBillNo = ewayBillNo;
    if (ewayBillDate !== undefined) dataToUpdate.ewayBillDate = ewayBillDate ? new Date(ewayBillDate) : null;
    if (customerRefNo !== undefined) dataToUpdate.customerRefNo = customerRefNo;
    if (salesEmployee !== undefined) dataToUpdate.salesEmployee = salesEmployee;
    if (paymentTerms !== undefined) dataToUpdate.paymentTerms = paymentTerms;
    if (paymentStatus !== undefined) dataToUpdate.paymentStatus = paymentStatus;
    if (paymentMode !== undefined) dataToUpdate.paymentMode = paymentMode;
    if (amountPaid !== undefined) dataToUpdate.amountPaid = Number(amountPaid);
    if (placeOfSupply !== undefined) dataToUpdate.placeOfSupply = placeOfSupply;
    if (taxRegNo !== undefined) dataToUpdate.taxRegNo = taxRegNo;
    if (internalNote !== undefined) dataToUpdate.internalNote = internalNote;
    if (quotationNote !== undefined) dataToUpdate.quotationNote = quotationNote;
    if (status !== undefined) dataToUpdate.status = status;
    if (attachmentUrl !== undefined) dataToUpdate.attachmentUrl = attachmentUrl;

    const updated = await prisma.customerOrder.update({
      where: { id },
      data: dataToUpdate,
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { unit: true, category: true, subcategory: true }
            },
            batchAllocations: true
          }
        },
        deliveries: true,
        productionBatches: true,
        creator: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/orders/:id - Update Order
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'MATERIALS_RECEIVER', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF', 'SALES_TEAM']), async (req, res, next) => {
  try {
    const id = req.params.id;
    const check = await checkOrderImmutability(id);
    if (check.isLocked) {
      return res.status(403).json({ error: check.reason, isLocked: true });
    }

    const schema = z.object({
      customerId: z.string().optional().nullable(),
      type: z.enum(['Quotation', 'Sales Order', 'Invoice', 'POS']),
      deliveryDate: z.string().optional(),
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
      totalSubtotal: z.coerce.number().optional(),
      invoiceDiscount: z.coerce.number().optional(),
      customerRefNo: z.string().optional().nullable(),
      counterId: z.string().optional().nullable(),
      cashierName: z.string().optional().nullable(),
      customerName: z.string().optional().nullable(),
      customerPhone: z.string().optional().nullable(),
      billToAddress: z.string().optional().nullable(),
      shippingMethod: z.string().optional().nullable(),
      salesEmployee: z.string().optional().nullable(),
      paymentMode: z.string().optional().nullable(),
      orderMode: z.string().optional().nullable(),
      attachmentUrl: z.string().optional().nullable(),
      placeOfSupply: z.string().optional().nullable(),
      paymentStatus: z.string().optional(),
      amountPaid: z.coerce.number().optional().default(0),
      transporterName: z.string().optional().nullable(),
      vehicleNo: z.string().optional().nullable(),
      lrNo: z.string().optional().nullable(),
      ewayBillNo: z.string().optional().nullable(),
      ewayBillDate: z.string().optional().nullable(),
      skipStockDeduction: z.boolean().optional().default(false),
      items: z.array(z.object({
        productId: z.string().min(1),
        productName: z.string().optional(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().positive(),
        discount: z.coerce.number().default(0),
        discountPercent: z.coerce.number().optional().default(0),
        gstRate: z.coerce.number().optional(),
        hsnCode: z.string().optional(),
        uomName: z.string().optional(),
        deliveryDate: z.string().optional()
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
        const itemCost = Number(prod.totalCost || 0) * item.quantity;
        const itemProfit = itemSubtotal - itemCost;

        totalSubtotal += itemSubtotal;
        totalCost += itemCost;
        totalProfit += itemProfit;

        orderItemsData.push({
          productId: item.productId,
          productName: item.productName || prod.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent || 0,
          gstRate: item.gstRate !== undefined ? Number(item.gstRate) : (prod.gstRate !== undefined ? Number(prod.gstRate) : 5),
          hsnCode: item.hsnCode || prod.hsnCode || '21050000',
          uomName: item.uomName || prod.unit?.abbreviation || prod.unit?.name || 'pcs',
          subtotal: itemSubtotal,
          cost: itemCost,
          profit: itemProfit,
          deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : (data.deliveryDate ? new Date(data.deliveryDate) : new Date())
        });
      }

      // 3. Update customer order record
      await tx.customerOrder.update({
        where: { id },
        data: {
          customerId: data.customerId || existing.customerId,
          type: data.type || existing.type,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : existing.deliveryDate,
          createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
          deliveryAddress: data.deliveryAddress || null,
          billToAddress: data.billToAddress || null,
          shippingMethod: data.shippingMethod || 'Road Transport',
          customerRefNo: data.customerRefNo || null,
          counterId: data.counterId !== undefined ? data.counterId : existing.counterId,
          cashierName: data.cashierName !== undefined ? data.cashierName : existing.cashierName,
          customerName: data.customerName !== undefined ? data.customerName : existing.customerName,
          customerPhone: data.customerPhone !== undefined ? data.customerPhone : existing.customerPhone,
          salesEmployee: data.salesEmployee || '-No Sales Employee-',
          paymentMode: data.paymentMode || null,
          orderMode: data.orderMode || (data.type === 'Invoice' || existing.type === 'Invoice' || existing.orderMode === 'INVOICE' ? 'INVOICE' : (data.status === 'Waiting for Production' ? 'NEED_PLANNING' : (existing.orderMode || 'STANDARD'))),
          attachmentUrl: data.attachmentUrl || null,
          placeOfSupply: data.placeOfSupply || null,
          paymentStatus: data.paymentStatus || existing.paymentStatus,
          amountPaid: data.amountPaid !== undefined ? data.amountPaid : existing.amountPaid,
          transporterName: data.transporterName || null,
          vehicleNo: data.vehicleNo || null,
          lrNo: data.lrNo || null,
          ewayBillNo: data.ewayBillNo || null,
          ewayBillDate: data.ewayBillDate ? new Date(data.ewayBillDate) : null,
          quotationNote: data.quotationNote || null,
          internalNote: data.internalNote || null,
          status: data.status,
          paymentTerms: data.paymentTerms || null,
          totalSubtotal: data.totalSubtotal !== undefined ? data.totalSubtotal : Math.max(0, totalSubtotal - (data.discountValue || 0)),
          totalCost,
          totalProfit,
          collectTax: data.collectTax,
          taxRegNo: data.taxRegNo || null,
          taxType: data.taxType || null,
          discountValue: data.discountValue,
          invoiceDiscount: data.discountValue,
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

      // Clean up any removed attachment files from server uploads disk
      if (existing.attachmentUrl && data.attachmentUrl !== undefined) {
        const oldUrls = existing.attachmentUrl.split(',').map(u => u.trim()).filter(Boolean);
        const newUrls = (data.attachmentUrl || '').split(',').map(u => u.trim()).filter(Boolean);
        const removedUrls = oldUrls.filter(oldU => !newUrls.some(newU => path.basename(newU.split('?')[0]) === path.basename(oldU.split('?')[0])));
        for (const remUrl of removedUrls) {
          deletePaymentImageFromDisk(remUrl);
        }
      }

      // 4. Recreate order items
      await tx.customerOrderItem.deleteMany({ where: { orderId: id } });
      await tx.customerOrderItem.createMany({
        data: orderItemsData.map(it => ({
          orderId: id,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountPercent: it.discountPercent,
          gstRate: it.gstRate,
          hsnCode: it.hsnCode,
          uomName: it.uomName,
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
      const isAllocated = (ALLOCATED_STATUSES.includes(data.status) || 
                          data.type === 'Invoice' || 
                          data.type === 'POS') && 
                          data.orderMode !== 'INVOICE' && 
                          existing.orderMode !== 'INVOICE' &&
                          !data.skipStockDeduction;
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
        // If orderMode is INVOICE, Quotation, or unallocated, clear any stock allocations
        await tx.productStockMovement.deleteMany({ where: { orderId: id, type: 'order_allocation' } });
      }

      // Check stock alerts for all items involved
      for (const item of orderItemsData) {
        await notificationService.checkProductStockAlerts(item.productId, tx);
      }

      return existing;
    }, { maxWait: 15000, timeout: 60000 });

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
    const check = await checkOrderImmutability(id);
    if (check.isLocked) {
      return res.status(403).json({ error: check.reason, isLocked: true });
    }

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

router.getOrderPdfHandler = getOrderPdfHandler;

module.exports = router;

