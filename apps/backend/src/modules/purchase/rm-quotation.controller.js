const crypto = require('crypto');
const prisma = require('../../database/prisma');
const { sendRMQuotationRequestEmail, sendRMQuotationResponseAlert } = require('../../utils/communication');

/**
 * Generate sequential quotation number: RMQ-YYYYMMDD-XXXX
 */
const generateQuotationNo = async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RMQ-${dateStr}-`;
  
  const lastQuote = await prisma.rMQuotation.findFirst({
    where: { quotationNo: { startsWith: prefix } },
    orderBy: { quotationNo: 'desc' }
  });

  let nextSeq = 1;
  if (lastQuote) {
    const parts = lastQuote.quotationNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Sync expired status for active quotations whose expiryAt is past NOW
 */
const syncExpiredQuotations = async () => {
  try {
    const now = new Date();
    const expiredList = await prisma.rMQuotation.findMany({
      where: {
        expiryAt: { lt: now },
        status: { in: ['SENT', 'PARTIALLY_RESPONDED', 'DRAFT'] }
      }
    });

    for (const q of expiredList) {
      await prisma.rMQuotation.update({
        where: { id: q.id },
        data: { status: 'EXPIRED' }
      });
      // Mark pending suppliers as EXPIRED
      await prisma.rMQuotationSupplier.updateMany({
        where: { quotationId: q.id, status: 'PENDING' },
        data: { status: 'EXPIRED' }
      });
    }
  } catch (err) {
    console.error('[Sync Expired Quotations Error]', err);
  }
};

/**
 * GET /api/rm-quotations
 * List all internal RM quotations with filtering & supplier response breakdown
 */
const getAllQuotations = async (req, res, next) => {
  try {
    await syncExpiredQuotations();

    const { status, supplierId, search, startDate, endDate } = req.query;
    const where = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (startDate || endDate) {
      where.quotationDate = {};
      if (startDate) where.quotationDate.gte = new Date(startDate);
      if (endDate) where.quotationDate.lte = new Date(endDate);
    }

    if (supplierId) {
      where.suppliers = {
        some: { supplierId }
      };
    }

    if (search) {
      where.OR = [
        { quotationNo: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { items: { some: { materialName: { contains: search, mode: 'insensitive' } } } },
        { suppliers: { some: { supplier: { name: { contains: search, mode: 'insensitive' } } } } }
      ];
    }

    const quotations = await prisma.rMQuotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        items: true,
        suppliers: {
          include: {
            supplier: true,
            responses: {
              orderBy: { submittedAt: 'desc' },
              include: {
                items: {
                  include: {
                    quotationItem: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Format & calculate summary stats per quotation using each supplier's latest response
    const formatted = quotations.map(q => {
      const totalSent = q.suppliers.length;
      const responsesIn = q.suppliers.filter(s => s.status === 'RESPONDED' && s.responses.length > 0).length;

      // Extract each supplier's LATEST response grand total to compute lowest total
      const responseTotals = q.suppliers
        .map(s => (s.responses && s.responses.length > 0) ? Number(s.responses[0].grandTotal) : null)
        .filter(t => t !== null && !isNaN(t) && t > 0);

      const lowestTotal = responseTotals.length > 0 ? Math.min(...responseTotals) : null;

      return {
        ...q,
        totalSent,
        responsesIn,
        lowestTotal
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rm-quotations/:id
 * Get single quotation detail with latest responses
 */
const getQuotationById = async (req, res, next) => {
  try {
    await syncExpiredQuotations();

    const { id } = req.params;
    const quotation = await prisma.rMQuotation.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        items: true,
        suppliers: {
          include: {
            supplier: true,
            responses: {
              orderBy: { submittedAt: 'desc' },
              include: {
                items: {
                  include: { quotationItem: true }
                }
              }
            }
          }
        }
      }
    });

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'RM Quotation not found' });
    }

    res.json({ success: true, data: quotation });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rm-quotations
 * Create new RM Quotation Request & dispatch unique emails to selected suppliers
 */
const createQuotation = async (req, res, next) => {
  try {
    const { quotationDate, expiryAt, note, supplierIds, items } = req.body;

    if (!expiryAt) {
      return res.status(400).json({ success: false, message: 'Expiry date and time is required' });
    }

    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one supplier must be selected' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one raw material item is required' });
    }

    const quotationNo = await generateQuotationNo();
    const createdBy = req.user?.id;

    // Fetch suppliers to confirm emails
    const dbSuppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } }
    });

    if (dbSuppliers.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid suppliers found' });
    }

    // 1. Create RMQuotation Header & Items in Transaction
    const newQuotation = await prisma.$transaction(async (tx) => {
      const qHeader = await tx.rMQuotation.create({
        data: {
          quotationNo,
          quotationDate: quotationDate ? new Date(quotationDate) : new Date(),
          expiryAt: new Date(expiryAt),
          note: note || null,
          status: 'SENT',
          createdBy
        }
      });

      // Create RMQuotationItems
      for (const item of items) {
        let materialName = item.materialName || 'Raw Material';
        let materialCode = item.materialCode || null;

        if (item.materialId) {
          const rm = await tx.rawMaterial.findUnique({ where: { id: item.materialId } });
          if (rm) {
            materialName = rm.name;
            materialCode = rm.code;
          }
        }

        await tx.rMQuotationItem.create({
          data: {
            quotationId: qHeader.id,
            materialId: item.materialId,
            materialName,
            materialCode,
            quantity: item.quantity || 1,
            unit: item.unit || 'Kg',
            gstApplicable: item.gstApplicable !== undefined ? Boolean(item.gstApplicable) : true,
            gstRate: item.gstRate || 18.00
          }
        });
      }

      // Create RMQuotationSupplier records with unique tokens
      for (const sup of dbSuppliers) {
        const secureToken = crypto.randomBytes(32).toString('hex');
        await tx.rMQuotationSupplier.create({
          data: {
            quotationId: qHeader.id,
            supplierId: sup.id,
            supplierEmail: sup.email || '',
            secureToken,
            status: 'PENDING'
          }
        });
      }

      return tx.rMQuotation.findUnique({
        where: { id: qHeader.id },
        include: {
          items: true,
          suppliers: { include: { supplier: true } }
        }
      });
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    // 2. Dispatch emails to suppliers asynchronously with their unique link
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    for (const supRow of newQuotation.suppliers) {
      const linkUrl = `${frontendBaseUrl}/quote/${newQuotation.id}/${supRow.secureToken}`;
      sendRMQuotationRequestEmail({
        quotation: newQuotation,
        supplier: {
          name: supRow.supplier.name,
          supplierEmail: supRow.supplierEmail || supRow.supplier.email,
        },
        secureToken: supRow.secureToken,
        linkUrl
      }).catch(err => console.error(`[Quotation Email Error for ${supRow.supplier.name}]`, err));
    }

    res.status(201).json({
      success: true,
      message: 'Quotation request created and sent to suppliers successfully',
      data: newQuotation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rm-quotations/public/:quotationId/:token
 * Public endpoint for supplier form view (un-authenticated)
 */
const getPublicQuotation = async (req, res, next) => {
  try {
    const { quotationId, token } = req.params;

    const supplierRelation = await prisma.rMQuotationSupplier.findFirst({
      where: {
        quotationId,
        secureToken: token
      },
      include: {
        supplier: true,
        quotation: {
          include: {
            items: true
          }
        },
        responses: {
          orderBy: { submittedAt: 'desc' },
          take: 1,
          include: {
            items: true
          }
        }
      }
    });

    if (!supplierRelation) {
      return res.status(404).json({ success: false, message: 'Invalid or unguessable quotation link' });
    }

    const now = new Date();
    const isExpired = new Date(supplierRelation.quotation.expiryAt) < now;

    res.json({
      success: true,
      data: {
        quotation: supplierRelation.quotation,
        supplier: supplierRelation.supplier,
        supplierRelationId: supplierRelation.id,
        supplierRelationStatus: supplierRelation.status,
        previousResponse: supplierRelation.responses[0] || null,
        isExpired
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rm-quotations/public/:quotationId/:token/submit
 * Public endpoint for supplier price submission / resubmission (un-authenticated)
 */
const submitPublicQuotation = async (req, res, next) => {
  try {
    const { quotationId, token } = req.params;
    const { discount, shipping, otherCharges, supplierNote, items } = req.body;

    const supplierRelation = await prisma.rMQuotationSupplier.findFirst({
      where: {
        quotationId,
        secureToken: token
      },
      include: {
        supplier: true,
        quotation: {
          include: {
            items: true
          }
        }
      }
    });

    if (!supplierRelation) {
      return res.status(404).json({ success: false, message: 'Invalid or unguessable quotation link' });
    }

    const now = new Date();
    if (new Date(supplierRelation.quotation.expiryAt) < now) {
      return res.status(400).json({ success: false, message: 'This quotation request has expired. Submissions are closed.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Price inputs for requested line items are required' });
    }

    // Compute line subtotals, tax totals, and grand total
    let calculatedSubtotal = 0;
    let calculatedTaxTotal = 0;

    const processedItems = items.map(item => {
      const qItem = supplierRelation.quotation.items.find(qi => qi.id === item.quotationItemId);
      const qty = qItem ? Number(qItem.quantity) : 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const lineSubtotal = qty * unitPrice;
      
      let lineTax = 0;
      const gstRate = qItem && qItem.gstApplicable ? (Number(item.gstRate) || Number(qItem.gstRate) || 0) : 0;
      if (qItem && qItem.gstApplicable) {
        lineTax = (lineSubtotal * gstRate) / 100;
      }

      calculatedSubtotal += lineSubtotal;
      calculatedTaxTotal += lineTax;

      return {
        quotationItemId: item.quotationItemId,
        unitPrice,
        gstRate,
        lineSubtotal
      };
    });

    const discVal = Number(discount) || 0;
    const shipVal = Number(shipping) || 0;
    const otherVal = Number(otherCharges) || 0;

    const grandTotal = calculatedSubtotal + calculatedTaxTotal + shipVal + otherVal - discVal;

    // Create RMQuotationResponse header and items in transaction
    const savedResponse = await prisma.$transaction(async (tx) => {
      const responseHeader = await tx.rMQuotationResponse.create({
        data: {
          quotationSupplierId: supplierRelation.id,
          discount: discVal,
          shipping: shipVal,
          otherCharges: otherVal,
          supplierNote: supplierNote || null,
          subtotal: calculatedSubtotal,
          taxTotal: calculatedTaxTotal,
          grandTotal: Math.max(0, grandTotal),
          submittedAt: new Date()
        }
      });

      for (const pi of processedItems) {
        await tx.rMQuotationResponseItem.create({
          data: {
            responseId: responseHeader.id,
            quotationItemId: pi.quotationItemId,
            unitPrice: pi.unitPrice,
            gstRate: pi.gstRate,
            lineSubtotal: pi.lineSubtotal
          }
        });
      }

      // Update supplier status to RESPONDED
      await tx.rMQuotationSupplier.update({
        where: { id: supplierRelation.id },
        data: {
          status: 'RESPONDED',
          respondedAt: new Date()
        }
      });

      // Recalculate quotation overall status
      const allSuppliers = await tx.rMQuotationSupplier.findMany({
        where: { quotationId }
      });

      const totalSuppliersCount = allSuppliers.length;
      const respondedCount = allSuppliers.filter(s => s.status === 'RESPONDED').length;

      let newStatus = 'PARTIALLY_RESPONDED';
      if (respondedCount >= totalSuppliersCount) {
        newStatus = 'ALL_RESPONDED';
      }

      await tx.rMQuotation.update({
        where: { id: quotationId },
        data: { status: newStatus }
      });

      return tx.rMQuotationResponse.findUnique({
        where: { id: responseHeader.id },
        include: { items: true }
      });
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    // Alert internal team & send supplier confirmation email
    sendRMQuotationResponseAlert({
      quotation: supplierRelation.quotation,
      supplierName: supplierRelation.supplier.name,
      supplierEmail: supplierRelation.supplierEmail || supplierRelation.supplier.email,
      grandTotal: savedResponse.grandTotal,
      expiryAt: supplierRelation.quotation.expiryAt
    }).catch(err => console.error('[Response Alert Error]', err));

    res.json({
      success: true,
      message: 'Quotation submitted successfully.',
      data: savedResponse
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rm-quotations/public/:quotationId/:token/request-resubmission
 * Supplier requests buyer/admin for approval to resubmit/update pricing
 */
const requestResubmission = async (req, res, next) => {
  try {
    const { quotationId, token } = req.params;

    const supplierRelation = await prisma.rMQuotationSupplier.findFirst({
      where: { quotationId, secureToken: token },
      include: { supplier: true, quotation: true }
    });

    if (!supplierRelation) {
      return res.status(404).json({ success: false, message: 'Invalid quotation link' });
    }

    await prisma.rMQuotationSupplier.update({
      where: { id: supplierRelation.id },
      data: { status: 'RESUBMISSION_REQUESTED' }
    });

    res.json({
      success: true,
      message: 'Resubmission request sent to buyer/admin for approval.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rm-quotations/:id/resend-supplier-link
 * Internal Admin approves resubmission & emails access link to supplier
 */
const resendSupplierLink = async (req, res, next) => {
  try {
    const { id: quotationId } = req.params;
    const { supplierId } = req.body;

    const quotation = await prisma.rMQuotation.findUnique({
      where: { id: quotationId },
      include: { items: true }
    });

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (quotation.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'Cannot resend access link for a quotation that has already been converted into a Direct Order.' });
    }

    const supplierRelation = await prisma.rMQuotationSupplier.findFirst({
      where: { quotationId, supplierId },
      include: { supplier: true }
    });

    if (!supplierRelation) {
      return res.status(404).json({ success: false, message: 'Supplier relation not found' });
    }

    // Rate limit resend link to once per 2 hours to prevent email spamming
    const COOLDOWN_HOURS = 2;
    const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

    if (supplierRelation.sentAt && supplierRelation.status !== 'RESUBMISSION_REQUESTED') {
      const timeSinceSent = Date.now() - new Date(supplierRelation.sentAt).getTime();
      if (timeSinceSent < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - timeSinceSent;
        const remainingMins = Math.ceil(remainingMs / (60 * 1000));
        const hours = Math.floor(remainingMins / 60);
        const mins = remainingMins % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

        return res.status(429).json({
          success: false,
          message: `Access link was recently sent to ${supplierRelation.supplier?.name || 'supplier'}. Please wait ${timeStr} before re-sending again.`
        });
      }
    }

    // Reset status to PENDING and update sentAt timestamp so supplier can submit again
    await prisma.rMQuotationSupplier.update({
      where: { id: supplierRelation.id },
      data: {
        status: 'PENDING',
        sentAt: new Date()
      }
    });

    const publicAppUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    const linkUrl = `${publicAppUrl}/quote/${quotation.id}/${supplierRelation.secureToken}`;

    // Send resubmission approval email
    await sendRMQuotationRequestEmail({
      quotation,
      supplier: supplierRelation.supplier,
      secureToken: supplierRelation.secureToken,
      linkUrl
    });

    res.json({
      success: true,
      message: `Resubmission access link sent successfully to ${supplierRelation.supplier.name}.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  getPublicQuotation,
  submitPublicQuotation,
  requestResubmission,
  resendSupplierLink
};
