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
        rawMaterial: { include: { unit: true, category: true } },
        order: { select: { id: true, docNo: true, referenceNo: true, deliveryDate: true, customer: { select: { name: true } } } }
      }
    });

    const grouped = {};
    for (const it of openOrderItems) {
      const pid = it.productId || it.rawMaterialId || it.productName || it.id;
      const itemName = it.product?.name || it.rawMaterial?.name || it.productName || 'Unnamed Item';
      const itemCode = it.product?.code || it.rawMaterial?.code || it.hsnCode || 'ITEM';
      const itemCategory = it.product?.category?.name || it.rawMaterial?.category?.name || (it.itemType === 'RAW_MATERIAL' ? 'Packaging & Material' : 'Finished Goods');
      const itemUnit = it.uomName || it.product?.unit?.abbreviation || it.rawMaterial?.unit?.abbreviation || 'pcs';

      if (!grouped[pid]) {
        grouped[pid] = {
          productId: it.productId,
          rawMaterialId: it.rawMaterialId,
          itemType: it.itemType || (it.productId ? 'PRODUCT' : 'RAW_MATERIAL'),
          productCode: itemCode,
          productName: itemName,
          category: itemCategory,
          unit: itemUnit,
          totalShortfall: 0,
          earliestDeliveryDate: it.order?.deliveryDate || new Date(),
          ordersInvolved: []
        };
      }
      grouped[pid].totalShortfall += Number(it.shortfallQty);
      if (it.order?.deliveryDate && new Date(it.order.deliveryDate) < new Date(grouped[pid].earliestDeliveryDate)) {
        grouped[pid].earliestDeliveryDate = it.order.deliveryDate;
      }
      grouped[pid].ordersInvolved.push({
        orderId: it.order?.id,
        docNo: it.order?.docNo || it.order?.referenceNo,
        customerName: it.order?.customer?.name || 'Customer',
        shortfall: Number(it.shortfallQty),
        deliveryDate: it.order?.deliveryDate
      });
    }

    const results = [];
    for (const pid of Object.keys(grouped)) {
      const itemData = grouped[pid];
      let inProduction = 0;
      if (itemData.productId) {
        const activeBatches = await prisma.productionBatchNew.findMany({
          where: {
            productId: itemData.productId,
            status: { in: ['Planned', 'In Progress'] },
            deletedAt: null
          },
          select: { quantity: true, partiallyDoneQty: true }
        });
        inProduction = activeBatches.reduce((s, b) => s + (Number(b.quantity) - Number(b.partiallyDoneQty || 0)), 0);
      }
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
    if (invoiceChild || order.status === 'Delivered' || order.status === 'Invoiced') {
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
      order.status === 'Invoiced' ||
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
        items: { include: { product: true, rawMaterial: true } },
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
            rawMaterial: {
              include: {
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

// GET /api/orders/raw-materials/:id/available-batches - Batches for FEFO & manual picking for raw materials
router.get('/raw-materials/:id/available-batches', authenticateToken, async (req, res, next) => {
  try {
    const batches = await batchAllocationService.getAvailableRMBatches(req.params.id);
    res.json(batches);
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
            rawMaterial: {
              include: {
                category: true
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

    let paymentDetails = null;
    let termsAndConditions = order.quotationNote || null;
    if (order.internalNote && order.internalNote.includes('[[PAYMENT_DETAILS:')) {
      try {
        const m = order.internalNote.match(/\[\[PAYMENT_DETAILS:(.*?)\]\]/s);
        if (m && m[1]) paymentDetails = JSON.parse(m[1]);
      } catch (e) {}
    }
    if (order.internalNote && order.internalNote.includes('[[TERMS_AND_CONDITIONS:')) {
      try {
        const m = order.internalNote.match(/\[\[TERMS_AND_CONDITIONS:(.*?)\]\]/s);
        if (m && m[1]) termsAndConditions = m[1];
      } catch (e) {}
    }

    let ancillaryTaxCodes = null;
    if (order.internalNote && order.internalNote.includes('[[ANCILLARY_TAX_CODES:')) {
      try {
        const m = order.internalNote.match(/\[\[ANCILLARY_TAX_CODES:(.*?)\]\]/s);
        if (m && m[1]) ancillaryTaxCodes = JSON.parse(m[1]);
      } catch (e) {}
    }

    const isInterState = String(order.sellerStateCode || '33') !== String(order.placeOfSupply || order.buyerStateCode || '33') || order.taxType === 'Inter-State' || order.taxType === 'INTER_STATE';
    const defaultTaxCode = isInterState ? 'IGST18' : 'SCG18';

    const freightTaxCode = ancillaryTaxCodes?.freightTaxCode || (order.freightGst ? defaultTaxCode : 'EXEMPT');
    const loadingTaxCode = ancillaryTaxCodes?.loadingTaxCode || (order.loadingGst ? defaultTaxCode : 'EXEMPT');
    const packingTaxCode = ancillaryTaxCodes?.packingTaxCode || (order.packingGst ? defaultTaxCode : 'EXEMPT');
    const otherTaxCode = ancillaryTaxCodes?.otherTaxCode || (order.otherGst ? defaultTaxCode : 'EXEMPT');

    res.json({
      ...order,
      paymentDetails,
      termsAndConditions,
      freightTaxCode,
      loadingTaxCode,
      packingTaxCode,
      otherTaxCode,
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
            rawMaterial: {
              include: {
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
      companyName: company?.companyName || taxSettings?.companyName || 'LEONEX',
      companyAddress: company?.companyAddress || taxSettings?.companyAddress || 'Factory / Registered Office Address',
      companyGstin: company?.companyGstin || taxSettings?.companyGstin || '33AAWCS2781F1ZZ',
      companyPan: company?.companyPan || taxSettings?.companyPan || 'AAWCS2781F',
      companyMobile: company?.companyMobile || taxSettings?.companyMobile || '+91 99404 54154',
      companyEmail: company?.email || company?.companyEmail || taxSettings?.companyEmail || '',
      stateCode: company?.stateCode || taxSettings?.stateCode || '33',
      bankName: company?.bankName || taxSettings?.bankName || '',
      bankAccountNo: company?.bankAccountNo || company?.bankAccountNumber || taxSettings?.bankAccountNo || taxSettings?.bankAccountNumber || '',
      bankIfsc: company?.bankIfsc || company?.bankIfscCode || taxSettings?.bankIfsc || taxSettings?.bankIfscCode || '',
      bankBranch: company?.bankBranch || taxSettings?.bankBranch || '',
      termsAndConditions: company?.termsAndConditions || company?.invoiceTerms || taxSettings?.termsAndConditions || taxSettings?.invoiceTerms
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
        productId: z.string().optional().nullable(),
        rawMaterialId: z.string().optional().nullable(),
        itemType: z.string().optional().default('PRODUCT'),
        isPackingCharge: z.boolean().optional().default(false),
        productName: z.string().optional(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().min(0).default(0),
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

    const order = await prisma.$transaction(async (tx) => {
      // 1. Lock and generate reference
      const referenceNo = await generateOrderReference(tx);

      // 2. Fetch products and raw materials details to calculate cost & profit
      let totalSubtotal = 0;
      let totalCost = 0;
      let totalProfit = 0;
      const orderItemsData = [];

      for (const item of data.items) {
        const isRawMaterial = item.itemType === 'RAW_MATERIAL' || Boolean(item.rawMaterialId);
        const rawMatId = item.rawMaterialId || (isRawMaterial ? item.productId : null);
        let prod = null;
        let rm = null;
        let costPerUnit = 0;
        let name = item.productName || '';
        let hsn = item.hsnCode || '';
        let gst = item.gstRate !== undefined ? Number(item.gstRate) : 18;
        let uom = item.uomName || 'pcs';

        if (isRawMaterial) {
          rm = await tx.rawMaterial.findUnique({ where: { id: rawMatId } });
          if (!rm) throw new Error(`Raw Material not found: ${rawMatId}`);
          costPerUnit = Number(rm.ratePerUnit || 0);
          name = name || rm.name;
          hsn = hsn || rm.hsnCode || '21069099';
          gst = item.gstRate !== undefined ? Number(item.gstRate) : (rm.gstRate !== undefined ? Number(rm.gstRate) : 18);
          uom = uom || rm.unitId || 'kg';
        } else {
          prod = await tx.finishedProduct.findUnique({
            where: { id: item.productId },
            include: { unit: true }
          });
          if (!prod) throw new Error(`Product not found: ${item.productId}`);
          costPerUnit = Number(prod.totalCost || 0);
          name = name || prod.name;
          hsn = hsn || prod.hsnCode || '21050000';
          gst = item.gstRate !== undefined ? Number(item.gstRate) : (prod.gstRate !== undefined ? Number(prod.gstRate) : 5);
          uom = uom || prod.unit?.abbreviation || prod.unit?.name || 'pcs';
        }

        const itemSubtotal = (Number(item.unitPrice) - Number(item.discount)) * item.quantity;
        const itemCost = costPerUnit * item.quantity;
        const itemProfit = itemSubtotal - itemCost;

        totalSubtotal += itemSubtotal;
        totalCost += itemCost;
        totalProfit += itemProfit;

        orderItemsData.push({
          productId: isRawMaterial ? null : item.productId,
          rawMaterialId: isRawMaterial ? rawMatId : null,
          itemType: isRawMaterial ? 'RAW_MATERIAL' : 'PRODUCT',
          isPackingCharge: Boolean(item.isPackingCharge),
          productName: name,
          hsnCode: hsn,
          gstRate: gst,
          uomName: uom,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent || 0,
          subtotal: itemSubtotal,
          cost: itemCost,
          profit: itemProfit,
          deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : new Date()
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
          rawMaterialId: it.rawMaterialId,
          itemType: it.itemType,
          isPackingCharge: it.isPackingCharge,
          productName: it.productName,
          hsnCode: it.hsnCode,
          gstRate: it.gstRate,
          uomName: it.uomName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          discountPercent: it.discountPercent,
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
        include: { customer: true, items: { include: { product: true, rawMaterial: true, batchAllocations: true } } }
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
      const isDocNoValid = data.docNo && 
                           data.docNo !== 'NaN' && 
                           !String(data.docNo).includes('NaN') && 
                           data.docNo !== 'Assigned on posting';
      let candidateAvailable = false;
      if (isDocNoValid) {
        const candidateStr = String(data.docNo).trim();
        // Check if candidate referenceNo or docNo is already taken in customerOrder
        const existingOrder = await tx.customerOrder.findFirst({
          where: {
            OR: [
              { referenceNo: candidateStr },
              { docNo: candidateStr }
            ]
          },
          select: { id: true }
        });
        if (!existingOrder) {
          candidateAvailable = true;
          docNo = candidateStr;
          referenceNo = candidateStr;
          // Synchronize document series so sequence stays ahead
          await documentSeriesService.syncDocumentNumber(candidateStr, tx);
        }
      }

      if (!candidateAvailable) {
        const seriesResult = await documentSeriesService.getNextNumber(seriesPrefix, tx);
        docNo = seriesResult.docNo;
        referenceNo = seriesResult.docNo;
        documentSeries = seriesResult.prefix;
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
      const isRawMaterial = item.itemType === 'RAW_MATERIAL' || Boolean(item.rawMaterialId && !item.productId);
      const rawMatId = item.rawMaterialId || (isRawMaterial ? item.productId : null);
      let prod = null;
      let rm = null;

      if (isRawMaterial) {
        rm = await tx.rawMaterial.findUnique({
          where: { id: rawMatId },
          include: { category: true }
        });
        if (!rm) throw new Error(`Raw Material not found: ${rawMatId}`);
      } else {
        prod = await tx.finishedProduct.findUnique({
          where: { id: item.productId },
          include: { unit: true }
        });
        if (!prod) throw new Error(`Product not found: ${item.productId}`);
      }

      const qty = Number(item.quantity);
      const unitPrice = isRawMaterial
        ? Number(item.unitPrice !== undefined ? item.unitPrice : (rm.ratePerUnit || 0))
        : Number(item.unitPrice !== undefined ? item.unitPrice : prod.salePrice);
      const discPercent = Number(item.discountPercent || 0);
      const discAmt = Number(item.discount || (unitPrice * (discPercent / 100)));
      const subtotal = Math.max(0, (unitPrice - discAmt) * qty);
      const cost = isRawMaterial
        ? Number(rm.ratePerUnit || 0) * qty
        : Number(prod.totalCost || 0) * qty;
      const profit = subtotal - cost;

      totalCost += cost;
      totalProfit += profit;

      let reservedQty = 0;
      let shortfallQty = 0;
      let isStockItem = isRawMaterial ? true : prod.isStockItem !== false;

      if (isRawMaterial) {
        const rmStock = Number(rm.currentStock || 0);
        // STRICT ATOMIC STOCK CHECK FOR INVOICES & POS
        if (docType === 'Invoice' || docType === 'POS') {
          if (qty > rmStock) {
            const shortage = qty - rmStock;
            throw new Error(`Insufficient stock for Raw Material "${rm.name}" (${rm.code || rm.id}): Required ${qty}, Available ${rmStock}, Short ${shortage}. Invoice cannot be posted without stock.`);
          }
        } else if (docType === 'Sales Order') {
          reservedQty = Math.min(qty, rmStock);
          shortfallQty = 0; // Raw materials are purchased items; they do not go to production
        }
      } else {
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
      }

      // Handle batch allocations from client or auto-FEFO
      const clientAllocations = Array.isArray(item.batchAllocationsData) && item.batchAllocationsData.length > 0
        ? item.batchAllocationsData
        : (Array.isArray(item.allocations) && item.allocations.length > 0 ? item.allocations : []);

      let allocations = clientAllocations;
      let batchId = item.batchId || (clientAllocations[0]?.batchId || clientAllocations[0]?.id) || null;
      let batchNo = item.batchNo || (clientAllocations[0]?.batchNo || clientAllocations[0]?.batchNumber) || null;
      let mfgDate = item.mfgDate ? new Date(item.mfgDate) : (clientAllocations[0]?.mfgDate ? new Date(clientAllocations[0].mfgDate) : null);
      let expiryDate = item.expiryDate ? new Date(item.expiryDate) : (clientAllocations[0]?.expiryDate ? new Date(clientAllocations[0].expiryDate) : null);

      if (allocations.length === 0 && (docType === 'Invoice' || docType === 'POS' || isRawMaterial) && isStockItem) {
        if (item.batchId) {
          allocations = [{
            batchId: item.batchId,
            batchNo: item.batchNo || 'BATCH',
            quantity: qty,
            expiryDate: item.expiryDate
          }];
        } else if (isRawMaterial) {
          // FEFO auto-allocation for raw material
          const rmFefo = await batchAllocationService.allocateRMFEFO(rawMatId, qty, tx);
          if (rmFefo && rmFefo.allocations && rmFefo.allocations.length > 0) {
            allocations = rmFefo.allocations;
            batchId = allocations[0].batchId;
            batchNo = allocations[0].batchNo;
            mfgDate = allocations[0].mfgDate ? new Date(allocations[0].mfgDate) : null;
            expiryDate = allocations[0].expiryDate ? new Date(allocations[0].expiryDate) : null;
          }
        } else if (docType === 'Invoice' || docType === 'POS') {
          // FEFO auto-allocation for finished goods
          const fefoResult = await batchAllocationService.allocateFEFO(item.productId, qty, tx);
          if (fefoResult && fefoResult.allocations && fefoResult.allocations.length > 0) {
            allocations = fefoResult.allocations;
            batchId = allocations[0].batchId;
            batchNo = allocations[0].batchNo;
            mfgDate = allocations[0].mfgDate ? new Date(allocations[0].mfgDate) : null;
            expiryDate = allocations[0].expiryDate ? new Date(allocations[0].expiryDate) : null;
          }
        }
      }

      itemsPrepared.push({
        productId: isRawMaterial ? null : item.productId,
        rawMaterialId: isRawMaterial ? rawMatId : null,
        itemType: isRawMaterial ? 'RAW_MATERIAL' : 'PRODUCT',
        isPackingCharge: Boolean(item.isPackingCharge),
        productName: isRawMaterial ? (item.productName || rm.name) : prod.name,
        hsnCode: item.hsnCode || (isRawMaterial ? (rm.hsnCode || '21069099') : (prod.hsnCode || '21050000')),
        gstRate: item.gstRate !== undefined ? Number(item.gstRate) : (isRawMaterial ? (rm.gstRate !== undefined ? Number(rm.gstRate) : 18) : (prod.gstRate !== undefined ? Number(prod.gstRate) : 18)),
        uomName: item.uomName || (isRawMaterial ? (rm.unitId || 'kg') : (prod.unit?.abbreviation || prod.unit?.name || 'pcs')),
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
    // Detect if packing charges are already present as line items (isPackingCharge: true)
    const packingLinesAmount = itemsPrepared
      .filter(it => it.isPackingCharge)
      .reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);
    const rawPackingCharges = Number(data.packingCharges || 0);
    const extraPackingCharges = Math.max(0, rawPackingCharges - packingLinesAmount);

    const ancCodes = {
      freightTaxCode: data.freightTaxCode || (data.freightGst ? (isInterState ? 'IGST18' : 'SCG18') : 'EXEMPT'),
      loadingTaxCode: data.loadingTaxCode || (data.loadingGst ? (isInterState ? 'IGST18' : 'SCG18') : 'EXEMPT'),
      packingTaxCode: data.packingTaxCode || (data.packingGst ? (isInterState ? 'IGST18' : 'SCG18') : 'EXEMPT'),
      otherTaxCode: data.otherTaxCode || (data.otherGst ? (isInterState ? 'IGST18' : 'SCG18') : 'EXEMPT')
    };

    const freightRate = gstEngine.getTaxRateFromCode(data.freightTaxCode || ancCodes.freightTaxCode, data.freightRate !== undefined ? Number(data.freightRate) : (data.freightGst ? 18 : 0));
    const packingItemRate = itemsPrepared.find(it => it.isPackingCharge)?.gstRate;
    const packingRate = gstEngine.getTaxRateFromCode(data.packingTaxCode || ancCodes.packingTaxCode, data.packingRate !== undefined ? Number(data.packingRate) : (packingItemRate !== undefined ? Number(packingItemRate) : (data.packingGst ? 18 : 0)));
    const loadingRate = gstEngine.getTaxRateFromCode(data.loadingTaxCode || ancCodes.loadingTaxCode, data.loadingRate !== undefined ? Number(data.loadingRate) : (data.loadingGst ? 18 : 0));
    const otherRate = gstEngine.getTaxRateFromCode(data.otherTaxCode || ancCodes.otherTaxCode, data.otherRate !== undefined ? Number(data.otherRate) : (data.otherGst ? 18 : 0));

    const gstResult = gstEngine.calculateGST({
      items: itemsPrepared.map(it => ({
        productId: it.productId || it.rawMaterialId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        discountPercent: it.discountPercent,
        gstRate: it.gstRate
      })),
      additionalCharges: {
        freight: Number(data.freight || 0),
        loading: Number(data.loadingCharges || 0),
        packing: extraPackingCharges,
        insurance: Number(data.insurance || 0),
        other: Number(data.otherCharges || 0),
      },
      chargeTaxRates: {
        freightRate,
        loadingRate,
        packingRate,
        otherRate,
        freightGst: freightRate > 0,
        loadingGst: loadingRate > 0,
        packingGst: packingRate > 0,
        insuranceGst: Boolean(data.insuranceGst),
        otherGst: otherRate > 0,
      },
      invoiceDiscount: Number(data.discountValue || data.invoiceDiscount || 0),
      tdsDeduction: Number(data.tdsDeduction || 0),
      sellerStateCode,
      buyerStateCode,
      isInterState
    });

    // 7. Payment & Order Status calculation
    const amountPaid = Number(data.amountPaid || (docType === 'POS' ? gstResult.grandTotal : 0));
    const isPaid = String(data.paymentTerms).toUpperCase() === 'PAID' || 
                   String(data.paymentStatus).toUpperCase() === 'PAID' || 
                   (amountPaid >= gstResult.grandTotal && gstResult.grandTotal > 0);
    let paymentStatus = isPaid ? 'PAID' : (amountPaid > 0 ? 'PARTIAL' : 'PENDING');

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

    let finalInternalNote = data.internalNote || data.note || '';
    if (data.paymentDetails) {
      finalInternalNote = finalInternalNote.replace(/\[\[PAYMENT_DETAILS:.*?\]\]/gs, '').trim();
      finalInternalNote += `\n[[PAYMENT_DETAILS:${JSON.stringify(data.paymentDetails)}]]`;
    }
    if (data.termsAndConditions) {
      finalInternalNote = finalInternalNote.replace(/\[\[TERMS_AND_CONDITIONS:.*?\]\]/gs, '').trim();
      finalInternalNote += `\n[[TERMS_AND_CONDITIONS:${data.termsAndConditions}]]`;
    }

    finalInternalNote = finalInternalNote.replace(/\[\[ANCILLARY_TAX_CODES:.*?\]\]/gs, '').trim();
    finalInternalNote += `\n[[ANCILLARY_TAX_CODES:${JSON.stringify(ancCodes)}]]`;
    if (data.attachmentUrl && !finalInternalNote.includes(data.attachmentUrl)) {
      finalInternalNote += `\n[Attachment]: ${data.attachmentUrl}`;
    }

    // 8. Create CustomerOrder record (with guaranteed collision prevention on referenceNo)
    let finalReferenceNo = referenceNo;
    let finalDocNo = docNo;

    // Safety check: ensure referenceNo is not already taken
    const collisionCheck = await tx.customerOrder.findFirst({
      where: { referenceNo: finalReferenceNo },
      select: { id: true }
    });
    if (collisionCheck) {
      const freshSeries = await documentSeriesService.getNextNumber(seriesPrefix || 'SO', tx);
      finalReferenceNo = freshSeries.docNo;
      finalDocNo = freshSeries.docNo;
      referenceNo = finalReferenceNo;
      docNo = finalDocNo;
      documentSeries = freshSeries.prefix;
    }

    const createdOrder = await tx.customerOrder.create({
      data: {
        referenceNo: finalReferenceNo,
        docNo: finalDocNo,
        documentSeries,
        sourceOrderId: data.sourceOrderId || null,
        customerId: customer.id,
        type: docType,
        status: orderStatus,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : new Date(),
        createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
        deliveryAddress: data.shipToAddress || data.deliveryAddress || (docType === 'POS' ? 'Over the Counter POS' : customer.address || 'Standard Delivery'),
        quotationNote: data.termsAndConditions || data.quotationNote || null,
        internalNote: finalInternalNote.trim() || null,
        paymentTerms: data.paymentTerms || (isPaid ? 'PAID' : (docType === 'POS' ? (data.paymentMode || 'Cash') : 'Net 30')),
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
        freightGst: freightRate > 0,
        loadingCharges: gstResult.charges?.loadingCharges || gstResult.charges?.loading || 0,
        loadingGst: loadingRate > 0,
        packingCharges: rawPackingCharges > 0 ? rawPackingCharges : (packingLinesAmount > 0 ? packingLinesAmount : (gstResult.charges?.packingCharges || gstResult.charges?.packing || 0)),
        packingGst: packingRate > 0,
        insurance: gstResult.charges?.insurance || 0,
        insuranceGst: Boolean(data.insuranceGst),
        otherCharges: gstResult.charges?.otherCharges || gstResult.charges?.other || 0,
        otherGst: otherRate > 0,
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
          productId: item.productId || null,
          rawMaterialId: item.rawMaterialId || null,
          itemType: item.itemType || 'PRODUCT',
          isPackingCharge: Boolean(item.isPackingCharge),
          batchAllocationsData: item.allocations && item.allocations.length > 0 ? item.allocations : null,
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
            where: {
              orderId: data.sourceOrderId,
              OR: [
                ...(item.productId ? [{ productId: item.productId }] : []),
                ...(item.rawMaterialId ? [{ rawMaterialId: item.rawMaterialId }] : [])
              ]
            }
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
      include: { customer: true, items: { include: { product: true, rawMaterial: true, batchAllocations: true } } }
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
      include: { customer: true, items: { include: { product: true, rawMaterial: true } } }
    });

    if (!sourceOrder) {
      return res.status(404).json({ error: 'Source order not found' });
    }

    if (sourceOrder.status === 'Invoiced' || sourceOrder.status === 'Delivered') {
      return res.status(400).json({ error: 'Order has already been fully invoiced' });
    }

    const itemsToBill = req.body.items && req.body.items.length > 0 
      ? req.body.items.map(it => {
          const matchSourceItem = sourceOrder.items.find(si => (si.productId && si.productId === it.productId) || (si.rawMaterialId && si.rawMaterialId === it.rawMaterialId));
          return {
            ...it,
            rawMaterialId: it.rawMaterialId || matchSourceItem?.rawMaterialId || null,
            itemType: it.itemType || matchSourceItem?.itemType || (it.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
            isPackingCharge: it.isPackingCharge !== undefined ? Boolean(it.isPackingCharge) : Boolean(matchSourceItem?.isPackingCharge),
            batchAllocationsData: it.batchAllocationsData || it.allocations || matchSourceItem?.batchAllocationsData || null,
            sourceOrderItemId: it.sourceOrderItemId || matchSourceItem?.id || null
          };
        })
      : sourceOrder.items.map(it => ({
          productId: it.productId,
          rawMaterialId: it.rawMaterialId,
          itemType: it.itemType || (it.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
          isPackingCharge: Boolean(it.isPackingCharge),
          batchAllocationsData: it.batchAllocationsData,
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
      include: { customer: true, items: { include: { product: true, rawMaterial: true } } }
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
        rawMaterialId: it.rawMaterialId,
        itemType: it.itemType || (it.rawMaterialId ? 'RAW_MATERIAL' : 'PRODUCT'),
        isPackingCharge: Boolean(it.isPackingCharge),
        batchAllocationsData: it.batchAllocationsData,
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

    const existingOrder = await prisma.customerOrder.findUnique({
      where: { id },
      select: { internalNote: true, quotationNote: true }
    });

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
    if (status !== undefined) dataToUpdate.status = status;
    if (attachmentUrl !== undefined) dataToUpdate.attachmentUrl = attachmentUrl;

    if (quotationNote !== undefined) dataToUpdate.quotationNote = quotationNote;
    if (req.body.termsAndConditions !== undefined) {
      dataToUpdate.quotationNote = req.body.termsAndConditions;
    }

    let note = internalNote !== undefined ? (internalNote || '') : (existingOrder?.internalNote || '');
    if (req.body.paymentDetails !== undefined) {
      note = note.replace(/\[\[PAYMENT_DETAILS:.*?\]\]/gs, '').trim();
      if (req.body.paymentDetails) {
        note += `\n[[PAYMENT_DETAILS:${JSON.stringify(req.body.paymentDetails)}]]`;
      }
    }
    if (req.body.termsAndConditions !== undefined) {
      note = note.replace(/\[\[TERMS_AND_CONDITIONS:.*?\]\]/gs, '').trim();
      if (req.body.termsAndConditions) {
        note += `\n[[TERMS_AND_CONDITIONS:${req.body.termsAndConditions}]]`;
      }
    }
    if (internalNote !== undefined || req.body.paymentDetails !== undefined || req.body.termsAndConditions !== undefined) {
      dataToUpdate.internalNote = note.trim() || null;
    }

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

    let parsedPaymentDetails = null;
    let parsedTerms = updated.quotationNote || null;
    if (updated.internalNote && updated.internalNote.includes('[[PAYMENT_DETAILS:')) {
      try {
        const m = updated.internalNote.match(/\[\[PAYMENT_DETAILS:(.*?)\]\]/s);
        if (m && m[1]) parsedPaymentDetails = JSON.parse(m[1]);
      } catch (e) {}
    }
    if (updated.internalNote && updated.internalNote.includes('[[TERMS_AND_CONDITIONS:')) {
      try {
        const m = updated.internalNote.match(/\[\[TERMS_AND_CONDITIONS:(.*?)\]\]/s);
        if (m && m[1]) parsedTerms = m[1];
      } catch (e) {}
    }

    res.json({
      ...updated,
      paymentDetails: parsedPaymentDetails,
      termsAndConditions: parsedTerms
    });
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
      freightTaxCode: z.string().optional(),
      freightGst: z.boolean().optional().default(false),
      loadingCharges: z.coerce.number().optional().default(0),
      loadingTaxCode: z.string().optional(),
      loadingGst: z.boolean().optional().default(false),
      packingCharges: z.coerce.number().optional().default(0),
      packingTaxCode: z.string().optional(),
      packingGst: z.boolean().optional().default(false),
      insurance: z.coerce.number().optional().default(0),
      insuranceGst: z.boolean().optional().default(false),
      otherCharges: z.coerce.number().optional().default(0),
      otherTaxCode: z.string().optional(),
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
      paymentDetails: z.any().optional(),
      termsAndConditions: z.string().optional(),
      shipToAddress: z.string().optional(),
      skipStockDeduction: z.boolean().optional().default(false),
      items: z.array(z.object({
        productId: z.string().optional().nullable(),
        rawMaterialId: z.string().optional().nullable(),
        itemType: z.string().optional().default('PRODUCT'),
        isPackingCharge: z.boolean().optional().default(false),
        batchAllocationsData: z.any().optional(),
        batchAllocations: z.any().optional(),
        batchId: z.string().optional().nullable(),
        batchNo: z.string().optional().nullable(),
        mfgDate: z.any().optional(),
        expiryDate: z.any().optional(),
        productName: z.string().optional(),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce.number().min(0).default(0),
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
        const isRawMaterial = item.itemType === 'RAW_MATERIAL' || Boolean(item.rawMaterialId);
        const rawMatId = item.rawMaterialId || (isRawMaterial ? item.productId : null);
        let prod = null;
        let rm = null;
        let costPerUnit = 0;
        let name = item.productName || '';
        let hsn = item.hsnCode || '';
        let gst = item.gstRate !== undefined ? Number(item.gstRate) : 18;
        let uom = item.uomName || 'pcs';

        if (isRawMaterial) {
          rm = await tx.rawMaterial.findUnique({ where: { id: rawMatId } });
          if (!rm) throw new Error(`Raw Material not found: ${rawMatId}`);
          costPerUnit = Number(rm.ratePerUnit || 0);
          name = name || rm.name;
          hsn = hsn || rm.hsnCode || '21069099';
          gst = item.gstRate !== undefined ? Number(item.gstRate) : (rm.gstRate !== undefined ? Number(rm.gstRate) : 18);
          uom = uom || rm.unitId || 'kg';
        } else {
          prod = await tx.finishedProduct.findUnique({
            where: { id: item.productId },
            include: { unit: true }
          });
          if (!prod) throw new Error(`Product not found: ${item.productId}`);
          costPerUnit = Number(prod.totalCost || 0);
          name = name || prod.name;
          hsn = hsn || prod.hsnCode || '21050000';
          gst = item.gstRate !== undefined ? Number(item.gstRate) : (prod.gstRate !== undefined ? Number(prod.gstRate) : 5);
          uom = uom || prod.unit?.abbreviation || prod.unit?.name || 'pcs';
        }

        const itemSubtotal = (Number(item.unitPrice) - Number(item.discount)) * item.quantity;
        const itemCost = costPerUnit * item.quantity;
        const itemProfit = itemSubtotal - itemCost;

        totalSubtotal += itemSubtotal;
        totalCost += itemCost;
        totalProfit += itemProfit;

        const batchAlloc = Array.isArray(item.batchAllocationsData) && item.batchAllocationsData.length > 0
          ? item.batchAllocationsData
          : (Array.isArray(item.batchAllocations) && item.batchAllocations.length > 0 ? item.batchAllocations : null);

        const primaryBatchId = item.batchId || (batchAlloc ? (batchAlloc[0]?.batchId || batchAlloc[0]?.id) : null);
        const primaryBatchNo = item.batchNo || (batchAlloc ? (batchAlloc[0]?.batchNo || batchAlloc[0]?.batchNumber) : null);
        const primaryMfgDate = item.mfgDate ? new Date(item.mfgDate) : (batchAlloc && batchAlloc[0]?.mfgDate ? new Date(batchAlloc[0].mfgDate) : null);
        const primaryExpDate = item.expiryDate ? new Date(item.expiryDate) : (batchAlloc && batchAlloc[0]?.expiryDate ? new Date(batchAlloc[0].expiryDate) : null);

        orderItemsData.push({
          productId: isRawMaterial ? null : item.productId,
          rawMaterialId: isRawMaterial ? rawMatId : null,
          itemType: isRawMaterial ? 'RAW_MATERIAL' : 'PRODUCT',
          isPackingCharge: Boolean(item.isPackingCharge),
          batchAllocationsData: batchAlloc,
          batchId: primaryBatchId,
          batchNo: primaryBatchNo,
          mfgDate: primaryMfgDate,
          expiryDate: primaryExpDate,
          productName: name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          discountPercent: item.discountPercent || 0,
          gstRate: gst,
          hsnCode: hsn,
          uomName: uom,
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
          deliveryAddress: data.shipToAddress || data.deliveryAddress || existing.deliveryAddress,
          billToAddress: data.billToAddress || existing.billToAddress,
          shippingMethod: data.shippingMethod || existing.shippingMethod || 'Road Transport',
          customerRefNo: data.customerRefNo || existing.customerRefNo,
          counterId: data.counterId !== undefined ? data.counterId : existing.counterId,
          cashierName: data.cashierName !== undefined ? data.cashierName : existing.cashierName,
          customerName: data.customerName !== undefined ? data.customerName : existing.customerName,
          customerPhone: data.customerPhone !== undefined ? data.customerPhone : existing.customerPhone,
          salesEmployee: data.salesEmployee || existing.salesEmployee || '-No Sales Employee-',
          paymentMode: data.paymentMode || existing.paymentMode,
          orderMode: data.orderMode || (data.type === 'Invoice' || existing.type === 'Invoice' || existing.orderMode === 'INVOICE' ? 'INVOICE' : (data.status === 'Waiting for Production' ? 'NEED_PLANNING' : (existing.orderMode || 'STANDARD'))),
          attachmentUrl: data.attachmentUrl !== undefined ? data.attachmentUrl : existing.attachmentUrl,
          placeOfSupply: data.placeOfSupply || existing.placeOfSupply,
          paymentStatus: (String(data.paymentTerms).toUpperCase() === 'PAID' || String(data.paymentStatus).toUpperCase() === 'PAID') ? 'PAID' : (data.paymentStatus || existing.paymentStatus),
          amountPaid: data.amountPaid !== undefined ? data.amountPaid : existing.amountPaid,
          transporterName: data.transporterName !== undefined ? data.transporterName : existing.transporterName,
          vehicleNo: data.vehicleNo !== undefined ? data.vehicleNo : existing.vehicleNo,
          lrNo: data.lrNo !== undefined ? data.lrNo : existing.lrNo,
          ewayBillNo: data.ewayBillNo !== undefined ? data.ewayBillNo : existing.ewayBillNo,
          ewayBillDate: data.ewayBillDate ? new Date(data.ewayBillDate) : existing.ewayBillDate,
          quotationNote: data.termsAndConditions || data.quotationNote || existing.quotationNote,
          internalNote: (() => {
            let note = data.internalNote !== undefined ? (data.internalNote || '') : (existing.internalNote || '');
            if (data.paymentDetails) {
              note = note.replace(/\[\[PAYMENT_DETAILS:.*?\]\]/gs, '').trim();
              note += `\n[[PAYMENT_DETAILS:${JSON.stringify(data.paymentDetails)}]]`;
            }
            if (data.termsAndConditions) {
              note = note.replace(/\[\[TERMS_AND_CONDITIONS:.*?\]\]/gs, '').trim();
              note += `\n[[TERMS_AND_CONDITIONS:${data.termsAndConditions}]]`;
            }
            const ancCodes = {
              freightTaxCode: data.freightTaxCode || (data.freightGst ? 'SCG18' : 'EXEMPT'),
              loadingTaxCode: data.loadingTaxCode || (data.loadingGst ? 'SCG18' : 'EXEMPT'),
              packingTaxCode: data.packingTaxCode || (data.packingGst ? 'SCG18' : 'EXEMPT'),
              otherTaxCode: data.otherTaxCode || (data.otherGst ? 'SCG18' : 'EXEMPT')
            };
            note = note.replace(/\[\[ANCILLARY_TAX_CODES:.*?\]\]/gs, '').trim();
            note += `\n[[ANCILLARY_TAX_CODES:${JSON.stringify(ancCodes)}]]`;
            return note.trim() || null;
          })(),
          status: data.status,
          paymentTerms: data.paymentTerms || existing.paymentTerms,
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
          rawMaterialId: it.rawMaterialId,
          itemType: it.itemType,
          isPackingCharge: it.isPackingCharge,
          batchAllocationsData: it.batchAllocationsData,
          batchId: it.batchId,
          batchNo: it.batchNo,
          mfgDate: it.mfgDate,
          expiryDate: it.expiryDate,
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
          if (item.productId) {
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
        }
      } else {
        // If orderMode is INVOICE, Quotation, or unallocated, clear any stock allocations
        await tx.productStockMovement.deleteMany({ where: { orderId: id, type: 'order_allocation' } });
      }

      // Check stock alerts for all items involved
      for (const item of orderItemsData) {
        if (item.productId) {
          await notificationService.checkProductStockAlerts(item.productId, tx);
        }
      }

      return existing;
    }, { maxWait: 15000, timeout: 60000 });

    if (updated && data.type === 'Invoice') {
      prisma.customerOrder.findUnique({
        where: { id: id },
        include: { customer: true, items: { include: { product: true, rawMaterial: true, batchAllocations: true } } }
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

/**
 * GET /api/orders/:id/batch-cost-audit
 * Calculates line-level landed procurement cost for each allocated batch, 
 * fetching exact purchase amounts from source POs to provide true gross profit and margin.
 */
router.get('/:id/batch-cost-audit', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await prisma.customerOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
            rawMaterial: true,
            batchAllocations: true
          }
        }
      }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    let totalOrderCost = 0;
    let totalOrderRevenue = 0;

    const itemsAudit = await Promise.all((order.items || []).map(async (item) => {
      const isRM = Boolean(item.rawMaterialId || item.itemType === 'RAW_MATERIAL');
      const qty = Number(item.quantity || 1);
      const rate = Number(item.unitPrice || 0);
      const subtotal = Number(item.subtotal || (qty * rate));
      totalOrderRevenue += subtotal;

      let lineLandedCost = 0;
      let batchDetails = [];

      const batches = Array.isArray(item.batchAllocationsData) ? item.batchAllocationsData : [];

      if (batches.length > 0) {
        for (const b of batches) {
          const bQty = Number(b.quantity || b.quantityAllocated || 0);
          let bUnitRate = Number(b.unitCost || b.batchPurchaseRate || b.unitPrice || 0);
          let poRef = b.sourcePoReference || b.poReference || '-';
          let supplier = b.supplierName || '-';

          // If rate missing, query InventoryBatch
          if (bUnitRate === 0 && b.batchId) {
            const invBatch = await prisma.inventoryBatch.findFirst({
              where: {
                OR: [{ id: b.batchId }, { batchNumber: b.batchNo || b.batchId }]
              },
              include: { po: { include: { supplier: true } } }
            }).catch(() => null);

            if (invBatch) {
              if (invBatch.po) {
                const poQty = Number(invBatch.po.quantity || 1);
                const poAmt = Number(invBatch.po.amount || 0);
                bUnitRate = poQty > 0 ? Number((poAmt / poQty).toFixed(2)) : 0;
                poRef = invBatch.po.referenceNo || 'PO';
                supplier = invBatch.po.supplier?.name || '-';
              }
            }
          }

          const batchCost = Number((bQty * bUnitRate).toFixed(2));
          lineLandedCost += batchCost;
          batchDetails.push({
            batchNo: b.batchNo || b.batchNumber || 'Batch',
            quantity: bQty,
            unitRate: bUnitRate,
            totalCost: batchCost,
            poReference: poRef,
            supplier
          });
        }
      } else {
        lineLandedCost = Number(item.cost || (isRM ? (item.rawMaterial?.ratePerUnit || 0) * qty : (item.product?.totalCost || 0) * qty));
      }

      totalOrderCost += lineLandedCost;
      const grossProfit = Number((subtotal - lineLandedCost).toFixed(2));
      const marginPct = subtotal > 0 ? Number(((grossProfit / subtotal) * 100).toFixed(2)) : 0;

      return {
        itemId: item.id,
        itemType: isRM ? 'RAW_MATERIAL' : 'PRODUCT',
        itemName: item.productName || (isRM ? item.rawMaterial?.name : item.product?.name) || 'Item',
        itemCode: isRM ? item.rawMaterial?.code : item.product?.code,
        quantity: qty,
        unitPrice: rate,
        subtotal,
        landedCost: Number(lineLandedCost.toFixed(2)),
        grossProfit,
        marginPercent: marginPct,
        batches: batchDetails
      };
    }));

    const orderProfit = Number((totalOrderRevenue - totalOrderCost).toFixed(2));
    const orderMarginPct = totalOrderRevenue > 0 ? Number(((orderProfit / totalOrderRevenue) * 100).toFixed(2)) : 0;

    res.json({
      success: true,
      orderId: order.id,
      docNo: order.docNo || order.referenceNo,
      totalRevenue: Number(totalOrderRevenue.toFixed(2)),
      totalLandedCost: Number(totalOrderCost.toFixed(2)),
      grossProfit: orderProfit,
      marginPercent: orderMarginPct,
      items: itemsAudit
    });
  } catch (err) {
    next(err);
  }
});

router.getOrderPdfHandler = getOrderPdfHandler;

module.exports = router;

