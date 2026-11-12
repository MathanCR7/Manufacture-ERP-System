const fs = require('fs');
const path = require('path');
const prisma = require('../../database/prisma');
const notificationService = require('../notifications/notifications.service');
const expenseStorage = require('../../utils/expenseFileStorage');
const paymentStorage = require('../../utils/paymentFileStorage');

const parseFloatOrDefault = (val, fallback = 0) => {
  if (val === undefined || val === null || val === '') return fallback;
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : fallback;
};

const pickDefinedField = (source, fallback, key) => {
  if (source && source[key] !== undefined) return source[key];
  if (fallback && fallback[key] !== undefined) return fallback[key];
  return undefined;
};

const resolveExpensePaymentImage = (rawImage, existingImage, expenseNumber, uniqueKey) => {
  if (rawImage === undefined) return existingImage || null;
  if (!rawImage || typeof rawImage !== 'string' || !rawImage.trim()) {
    if (existingImage) {
      paymentStorage.deletePaymentImageFromDisk(existingImage);
    }
    return null;
  }
  const trimmed = rawImage.trim();
  if (trimmed.startsWith('data:')) {
    return paymentStorage.savePaymentImageToDisk(trimmed, expenseNumber || 'EXP', existingImage || null, uniqueKey);
  }
  return trimmed;
};

const buildExpenseChargesAndPayment = (source, { fallback = {}, existing = null, expenseNumber = 'EXP', totalAmount = 0, uniqueKey = null } = {}) => {
  const get = (key) => pickDefinedField(source, fallback, key);
  const resolvedStatus = get('paymentStatus') ?? existing?.paymentStatus ?? 'PAID';
  const resolvedMode = get('paymentMode') ?? existing?.paymentMode ?? 'CASH';
  const rawPaid = get('paidAmount');
  const resolvedPaid = rawPaid !== undefined
    ? parseFloatOrDefault(rawPaid, resolvedStatus === 'PAID' ? totalAmount : 0)
    : (existing ? parseFloatOrDefault(existing.paidAmount, 0) : (resolvedStatus === 'PAID' ? totalAmount : 0));

  const rawRef = get('paymentRef');
  const rawNotes = get('paymentNotes');
  const rawOtherLabel = get('otherChargesLabel');

  return {
    paymentMode: resolvedMode || 'CASH',
    paymentStatus: resolvedStatus || 'PAID',
    paidAmount: resolvedPaid,
    paymentRef: rawRef !== undefined ? (rawRef ? String(rawRef).trim() : null) : (existing?.paymentRef ?? null),
    paymentImage: resolveExpensePaymentImage(get('paymentImage'), existing?.paymentImage || null, expenseNumber, uniqueKey),
    paymentNotes: rawNotes !== undefined ? (rawNotes ? String(rawNotes).trim() : null) : (existing?.paymentNotes ?? null),
    shippingAmount: parseFloatOrDefault(get('shippingAmount'), existing ? parseFloatOrDefault(existing.shippingAmount, 0) : 0),
    shippingGstApplicable: get('shippingGstApplicable') !== undefined ? Boolean(get('shippingGstApplicable')) : Boolean(existing?.shippingGstApplicable),
    shippingGstRate: parseFloatOrDefault(get('shippingGstRate'), existing?.shippingGstRate != null ? parseFloatOrDefault(existing.shippingGstRate, 18) : 18),
    packingAmount: parseFloatOrDefault(get('packingAmount'), existing ? parseFloatOrDefault(existing.packingAmount, 0) : 0),
    packingGstApplicable: get('packingGstApplicable') !== undefined ? Boolean(get('packingGstApplicable')) : Boolean(existing?.packingGstApplicable),
    packingGstRate: parseFloatOrDefault(get('packingGstRate'), existing?.packingGstRate != null ? parseFloatOrDefault(existing.packingGstRate, 18) : 18),
    loadingAmount: parseFloatOrDefault(get('loadingAmount'), existing ? parseFloatOrDefault(existing.loadingAmount, 0) : 0),
    loadingGstApplicable: get('loadingGstApplicable') !== undefined ? Boolean(get('loadingGstApplicable')) : Boolean(existing?.loadingGstApplicable),
    loadingGstRate: parseFloatOrDefault(get('loadingGstRate'), existing?.loadingGstRate != null ? parseFloatOrDefault(existing.loadingGstRate, 18) : 18),
    otherCharges: parseFloatOrDefault(get('otherCharges'), existing ? parseFloatOrDefault(existing.otherCharges, 0) : 0),
    otherChargesLabel: rawOtherLabel !== undefined ? (rawOtherLabel ? String(rawOtherLabel).trim() : null) : (existing?.otherChargesLabel ?? null),
    otherChargesGstApplicable: get('otherChargesGstApplicable') !== undefined ? Boolean(get('otherChargesGstApplicable')) : Boolean(existing?.otherChargesGstApplicable),
    otherChargesGstRate: parseFloatOrDefault(get('otherChargesGstRate'), existing?.otherChargesGstRate != null ? parseFloatOrDefault(existing.otherChargesGstRate, 18) : 18),
    discountAmount: parseFloatOrDefault(get('discountAmount'), existing ? parseFloatOrDefault(existing.discountAmount, 0) : 0),
    roundOff: parseFloatOrDefault(get('roundOff'), existing ? parseFloatOrDefault(existing.roundOff, 0) : 0)
  };
};

// Helper to resolve category name and foreign key categoryId
const resolveCategoryData = async (catInput, catIdInput) => {
  let categoryId = catIdInput || null;
  let categoryName = (typeof catInput === 'string' ? catInput.trim() : '') || '';

  if (categoryId) {
    const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId } });
    if (cat) {
      return { categoryId: cat.id, category: cat.name };
    }
  }

  if (categoryName) {
    const cat = await prisma.expenseCategory.findFirst({
      where: {
        OR: [
          { name: { equals: categoryName, mode: 'insensitive' } },
          { code: { equals: categoryName, mode: 'insensitive' } }
        ]
      }
    });
    if (cat) {
      return { categoryId: cat.id, category: cat.name };
    }
  }

  return { categoryId, category: categoryName };
};

// Helper to get the next running sequential expense number (e.g. EXP-000001, EXP-000002)
const generateNextExpenseNumber = async (txOrPrisma = prisma) => {
  try {
    const query = `SELECT "expenseNumber" FROM "Expense" WHERE "expenseNumber" LIKE 'EXP-%' ORDER BY "expenseNumber" DESC LIMIT 1`;
    const result = await txOrPrisma.$queryRawUnsafe(query);
    const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

    if (!lastRecord || !lastRecord.expenseNumber) {
      return 'EXP-000001';
    }

    const parts = lastRecord.expenseNumber.split('-');
    const lastNumber = parseInt(parts[1], 10);
    if (isNaN(lastNumber)) {
      return 'EXP-000001';
    }
    const nextNumber = lastNumber + 1;
    return `EXP-${String(nextNumber).padStart(6, '0')}`;
  } catch (err) {
    console.error('Error generating next expense number:', err);
    return `EXP-${Date.now().toString().slice(-6)}`;
  }
};

// API Endpoint to peek next running expense number
const getNextExpenseNumber = async (req, res, next) => {
  try {
    const nextNumber = await generateNextExpenseNumber(prisma);
    res.json({ success: true, nextNumber });
  } catch (err) {
    next(err);
  }
};

// Formats expense record ensuring attachments is always an array
const formatExpenseResponse = (exp) => {
  if (!exp) return exp;
  let parsedAttachments = [];
  if (exp.attachments) {
    if (Array.isArray(exp.attachments)) {
      parsedAttachments = exp.attachments;
    } else if (typeof exp.attachments === 'string') {
      try {
        parsedAttachments = JSON.parse(exp.attachments);
      } catch (_) {
        parsedAttachments = [];
      }
    }
  }
  return {
    ...exp,
    attachments: parsedAttachments
  };
};

// Upload multi-file attachments (PDF / Images) into dedicated expense folders
const uploadExpenseAttachments = async (req, res, next) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload.' });
    }

    const expenseId = req.body.expenseId || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { dir, safeId } = expenseStorage.getExpenseDir(expenseId);

    const savedFiles = [];
    for (const f of files) {
      const ext = path.extname(f.originalname) || '';
      const base = path.basename(f.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${base}${ext}`;
      const filePath = path.join(dir, uniqueName);

      fs.writeFileSync(filePath, f.buffer);

      const fileObj = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: f.originalname,
        originalName: f.originalname,
        url: `/uploads/expenses/${safeId}/${uniqueName}`,
        size: f.size,
        type: f.mimetype,
        uploadedAt: new Date().toISOString()
      };
      savedFiles.push(fileObj);
    }

    // If an existing expense was provided, append to its database record
    if (req.body.expenseId && !req.body.expenseId.startsWith('temp_')) {
      const existing = await prisma.expense.findUnique({ where: { id: req.body.expenseId } });
      if (existing) {
        let currentAttachments = [];
        if (existing.attachments) {
          try {
            currentAttachments = JSON.parse(existing.attachments);
          } catch (_) {}
        }
        const updated = [...currentAttachments, ...savedFiles];
        await prisma.expense.update({
          where: { id: req.body.expenseId },
          data: { attachments: JSON.stringify(updated) }
        });
      }
    }

    res.json({
      success: true,
      files: savedFiles,
      expenseId: safeId
    });
  } catch (err) {
    next(err);
  }
};

// Remove single attachment file permanently from server storage
const removeExpenseAttachmentFile = async (req, res, next) => {
  try {
    const { expenseId, url, fileId } = req.body;
    if (!url && !fileId) {
      return res.status(400).json({ error: 'File URL or File ID is required.' });
    }

    let deletedFromDisk = false;
    if (url) {
      deletedFromDisk = expenseStorage.deleteExpenseAttachmentFile(url);
    }

    if (expenseId && !expenseId.startsWith('temp_')) {
      const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
      if (existing && existing.attachments) {
        try {
          let currentList = JSON.parse(existing.attachments);
          if (Array.isArray(currentList)) {
            const target = currentList.find(it => (url && it.url === url) || (fileId && it.id === fileId));
            if (target && !deletedFromDisk) {
              expenseStorage.deleteExpenseAttachmentFile(target.url);
            }
            const filtered = currentList.filter(it => !((url && it.url === url) || (fileId && it.id === fileId)));
            await prisma.expense.update({
              where: { id: expenseId },
              data: { attachments: filtered.length > 0 ? JSON.stringify(filtered) : null }
            });
          }
        } catch (_) {}
      }
    }

    res.json({ success: true, message: 'Attachment permanently deleted from server storage.' });
  } catch (err) {
    next(err);
  }
};

// Create Expense (handles single or bulk automatically)
const createExpense = async (req, res, next) => {
  try {
    // If an array or { expenses: [...] } is passed, route to bulk creation
    if (Array.isArray(req.body) || (req.body.expenses && Array.isArray(req.body.expenses))) {
      return createBulkExpenses(req, res, next);
    }

    const {
      expenseNumber,
      title, amount, category, categoryId, date, notes, attachments,
      isSupplierExpense, supplierId, supplierName, supplierGstin,
      invoiceNo, invoiceDate, taxableAmount, gstPercentage,
      cgstAmount, sgstAmount, igstAmount, totalAmount, isInterState, hsnSacCode,
      // Payment fields
      paymentMode, paymentStatus, paidAmount, paymentRef, paymentImage, paymentNotes,
      // Breakdown charges with individual tax rates
      shippingAmount, shippingGstApplicable, shippingGstRate,
      packingAmount, packingGstApplicable, packingGstRate,
      loadingAmount, loadingGstApplicable, loadingGstRate,
      otherCharges, otherChargesGstApplicable, otherChargesGstRate,
      discountAmount
    } = req.body;
    const userId = req.user.id;

    if (!title || amount === undefined || (!category && !categoryId) || !date) {
      return res.status(400).json({ error: 'Title, amount, category, and date are required.' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const { categoryId: resolvedCatId, category: resolvedCatName } = await resolveCategoryData(category, categoryId);

    let finalSupplierName = supplierName ? String(supplierName).trim() : null;
    let finalSupplierGstin = supplierGstin ? String(supplierGstin).trim() : null;
    if (supplierId && (!finalSupplierName || !finalSupplierGstin)) {
      try {
        const sup = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (sup) {
          finalSupplierName = sup.name;
          finalSupplierGstin = sup.gstin || null;
        }
      } catch (_) {}
    }

    const numTaxable = (taxableAmount !== undefined && taxableAmount !== null && taxableAmount !== '')
      ? parseFloat(taxableAmount)
      : numericAmount;
    const numGstPct = (gstPercentage !== undefined && gstPercentage !== null && gstPercentage !== '')
      ? parseFloat(gstPercentage)
      : 0;
    const numCgst = (cgstAmount !== undefined && cgstAmount !== null && cgstAmount !== '')
      ? parseFloat(cgstAmount)
      : 0;
    const numSgst = (sgstAmount !== undefined && sgstAmount !== null && sgstAmount !== '')
      ? parseFloat(sgstAmount)
      : 0;
    const numIgst = (igstAmount !== undefined && igstAmount !== null && igstAmount !== '')
      ? parseFloat(igstAmount)
      : 0;
    const numTotal = (totalAmount !== undefined && totalAmount !== null && totalAmount !== '')
      ? parseFloat(totalAmount)
      : (numericAmount || (numTaxable + numCgst + numSgst + numIgst));

    let parsedAttachments = [];
    if (attachments) {
      parsedAttachments = Array.isArray(attachments)
        ? attachments
        : (typeof attachments === 'string' ? JSON.parse(attachments) : []);
    }

    // Running Expense Number (e.g. EXP-000001)
    const finalExpenseNumber = (expenseNumber && String(expenseNumber).trim())
      ? String(expenseNumber).trim()
      : await generateNextExpenseNumber(prisma);

    const resolvedTotal = numTotal || numericAmount;
    const chargesAndPayment = buildExpenseChargesAndPayment(req.body, {
      expenseNumber: finalExpenseNumber,
      totalAmount: resolvedTotal,
      uniqueKey: Date.now().toString()
    });

    const expense = await prisma.expense.create({
      data: {
        expenseNumber: finalExpenseNumber,
        title: title.trim(),
        amount: resolvedTotal,
        category: resolvedCatName,
        categoryId: resolvedCatId,
        date: new Date(date),
        notes: notes ? String(notes).trim() : null,
        attachments: parsedAttachments.length > 0 ? JSON.stringify(parsedAttachments) : null,
        isSupplierExpense: Boolean(isSupplierExpense || supplierId),
        supplierId: supplierId || null,
        supplierName: finalSupplierName,
        supplierGstin: finalSupplierGstin,
        invoiceNo: invoiceNo ? String(invoiceNo).trim() : null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        taxableAmount: numTaxable,
        gstPercentage: numGstPct,
        cgstAmount: numCgst,
        sgstAmount: numSgst,
        igstAmount: numIgst,
        totalAmount: numTotal,
        isInterState: Boolean(isInterState),
        hsnSacCode: hsnSacCode ? String(hsnSacCode).trim() : null,
        ...chargesAndPayment,
        createdBy: userId
      },
      include: {
        expenseCategory: { select: { id: true, name: true, code: true } }
      }
    });

    // Re-organize temporary uploaded files into dedicated expenseId directory
    if (parsedAttachments.length > 0) {
      const relocated = expenseStorage.organizeAttachmentsForExpense(expense.id, parsedAttachments);
      await prisma.expense.update({
        where: { id: expense.id },
        data: { attachments: JSON.stringify(relocated) }
      });
      expense.attachments = relocated;
    } else {
      expense.attachments = [];
    }

    // Write Audit Log
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        tableName: 'Expense',
        recordId: expense.id,
        oldValue: {},
        newValue: expense,
        ip: clientIp
      }
    });

    // Send Notification
    try {
      await notificationService.createNotification({
        type: 'EXPENSE_CREATED',
        recipient_roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'],
        sender_role: req.user.role,
        sender_id: userId,
        reference_type: 'EXPENSE',
        reference_id: expense.id,
        event_at: new Date(),
        message: `New expense of ₹${numericAmount.toLocaleString('en-IN')} for "${title}" recorded by ${req.user.name || 'Accountant'}.`,
        metadata: { expenseId: expense.id, title, amount: numericAmount, category: resolvedCatName }
      });
    } catch (notifErr) {
      console.error('Failed to trigger notification for expense creation:', notifErr);
    }

    res.status(201).json({ success: true, expense: formatExpenseResponse(expense) });
  } catch (err) {
    next(err);
  }
};

// Create Multiple Expenses in Batch
const createBulkExpenses = async (req, res, next) => {
  try {
    const rawList = req.body.expenses || (Array.isArray(req.body) ? req.body : []);
    const userId = req.user.id;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return res.status(400).json({ error: 'No expenses provided in bulk list.' });
    }

    // Determine sequential running numbers starting from next available
    const startNextNumStr = await generateNextExpenseNumber(prisma);
    const startSeq = parseInt(startNextNumStr.split('-')[1], 10) || 1;

    const validExpenses = [];
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item.title || item.amount === undefined || (!item.category && !item.categoryId) || !item.date) {
        return res.status(400).json({
          error: `Row #${i + 1} is missing required fields (Date, Category, Title, or Amount).`
        });
      }
      const numAmt = parseFloat(item.amount);
      if (isNaN(numAmt) || numAmt <= 0) {
        return res.status(400).json({
          error: `Row #${i + 1} amount must be a positive number.`
        });
      }

      const { categoryId: resolvedCatId, category: resolvedCatName } = await resolveCategoryData(item.category, item.categoryId);

      let atts = [];
      if (item.attachments) {
        atts = Array.isArray(item.attachments)
          ? item.attachments
          : (typeof item.attachments === 'string' ? JSON.parse(item.attachments) : []);
      }

      const numTaxable = (item.taxableAmount !== undefined && item.taxableAmount !== null && item.taxableAmount !== '')
        ? parseFloat(item.taxableAmount)
        : numAmt;
      const numGstPct = (item.gstPercentage !== undefined && item.gstPercentage !== null && item.gstPercentage !== '')
        ? parseFloat(item.gstPercentage)
        : 0;
      const numCgst = (item.cgstAmount !== undefined && item.cgstAmount !== null && item.cgstAmount !== '')
        ? parseFloat(item.cgstAmount)
        : 0;
      const numSgst = (item.sgstAmount !== undefined && item.sgstAmount !== null && item.sgstAmount !== '')
        ? parseFloat(item.sgstAmount)
        : 0;
      const numIgst = (item.igstAmount !== undefined && item.igstAmount !== null && item.igstAmount !== '')
        ? parseFloat(item.igstAmount)
        : 0;
      const numTotal = (item.totalAmount !== undefined && item.totalAmount !== null && item.totalAmount !== '')
        ? parseFloat(item.totalAmount)
        : (numAmt || (numTaxable + numCgst + numSgst + numIgst));

      const rowExpenseNumber = (item.expenseNumber && String(item.expenseNumber).trim())
        ? String(item.expenseNumber).trim()
        : `EXP-${String(startSeq + i).padStart(6, '0')}`;

      const rowChargesAndPayment = buildExpenseChargesAndPayment(item, {
        fallback: req.body,
        expenseNumber: rowExpenseNumber,
        totalAmount: numTotal,
        uniqueKey: `row_${i}_${Date.now()}`
      });

      validExpenses.push({
        expenseNumber: rowExpenseNumber,
        title: item.title.trim(),
        amount: numTotal || numAmt,
        category: resolvedCatName,
        categoryId: resolvedCatId,
        date: new Date(item.date),
        notes: item.notes ? String(item.notes).trim() : null,
        attachments: atts.length > 0 ? JSON.stringify(atts) : null,
        rawAttachments: atts,
        isSupplierExpense: Boolean(item.isSupplierExpense || item.supplierId),
        supplierId: item.supplierId || null,
        supplierName: item.supplierName ? String(item.supplierName).trim() : null,
        supplierGstin: item.supplierGstin ? String(item.supplierGstin).trim() : null,
        invoiceNo: item.invoiceNo ? String(item.invoiceNo).trim() : null,
        invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : null,
        taxableAmount: numTaxable,
        gstPercentage: numGstPct,
        cgstAmount: numCgst,
        sgstAmount: numSgst,
        igstAmount: numIgst,
        totalAmount: numTotal,
        isInterState: Boolean(item.isInterState),
        hsnSacCode: item.hsnSacCode ? String(item.hsnSacCode).trim() : null,
        ...rowChargesAndPayment,
        createdBy: userId
      });
    }

    let totalBulkAmount = 0;
    validExpenses.forEach(e => { totalBulkAmount += e.amount; });

    const createdList = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of validExpenses) {
        const { rawAttachments, ...dbData } = item;
        const exp = await tx.expense.create({
          data: dbData,
          include: { expenseCategory: { select: { id: true, name: true, code: true } } }
        });

        if (rawAttachments && rawAttachments.length > 0) {
          const relocated = expenseStorage.organizeAttachmentsForExpense(exp.id, rawAttachments);
          await tx.expense.update({
            where: { id: exp.id },
            data: { attachments: JSON.stringify(relocated) }
          });
          exp.attachments = relocated;
        } else {
          exp.attachments = [];
        }

        results.push(exp);
      }
      return results;
    });

    // Write Audit Log
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        tableName: 'Expense',
        recordId: `BULK_${createdList.length}`,
        oldValue: {},
        newValue: { count: createdList.length, totalAmount: totalBulkAmount },
        ip: clientIp
      }
    });

    // Send Notification
    try {
      await notificationService.createNotification({
        type: 'EXPENSE_CREATED',
        recipient_roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'],
        sender_role: req.user.role,
        sender_id: userId,
        reference_type: 'EXPENSE',
        reference_id: createdList[0]?.id || 'BULK',
        event_at: new Date(),
        message: `Batch of ${createdList.length} expenses totaling ₹${totalBulkAmount.toLocaleString('en-IN')} recorded by ${req.user.name || 'Accountant'}.`,
        metadata: { count: createdList.length, totalAmount: totalBulkAmount }
      });
    } catch (notifErr) {
      console.error('Failed to trigger notification for bulk expense creation:', notifErr);
    }

    res.status(201).json({
      success: true,
      count: createdList.length,
      expenses: createdList.map(formatExpenseResponse)
    });
  } catch (err) {
    next(err);
  }
};

// Delete Multiple Expenses in Batch
const deleteBulkExpenses = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of expense IDs to delete.' });
    }

    const existingExpenses = await prisma.expense.findMany({
      where: { id: { in: ids } },
      select: { id: true, attachments: true, paymentImage: true }
    });

    const deleteResult = await prisma.expense.deleteMany({
      where: { id: { in: ids } }
    });

    // Storage Management: Permanently delete folders, attachment files, and payment images from disk
    for (const exp of existingExpenses) {
      expenseStorage.deleteExpenseFolder(exp.id);
      if (exp.attachments) {
        expenseStorage.deleteExpenseAttachmentFile(exp.attachments);
      }
      if (exp.paymentImage) {
        paymentStorage.deletePaymentImageFromDisk(exp.paymentImage);
      }
    }

    // Audit log
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        tableName: 'Expense',
        recordId: `BULK_${deleteResult.count}`,
        oldValue: { ids },
        newValue: {},
        ip: clientIp
      }
    });

    res.json({ success: true, count: deleteResult.count, message: `${deleteResult.count} expenses deleted successfully.` });
  } catch (err) {
    next(err);
  }
};

// Get Expenses list with optional filtering
const getExpenses = async (req, res, next) => {
  try {
    const { search, category, categories, categoryId, startDate, endDate } = req.query;

    const where = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Support single or multiple categories
    const rawCat = categories || category;
    if (rawCat) {
      const catList = Array.isArray(rawCat)
        ? rawCat
        : String(rawCat).split(',').map(c => c.trim()).filter(Boolean);
      if (catList.length === 1) {
        where.category = catList[0];
      } else if (catList.length > 1) {
        where.category = { in: catList };
      }
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { expenseNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { supplierGstin: { contains: search, mode: 'insensitive' } },
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { paymentMode: { contains: search, mode: 'insensitive' } },
        { paymentRef: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (req.query.supplierId) {
      where.supplierId = req.query.supplierId;
    }
    if (req.query.isSupplierExpense !== undefined && req.query.isSupplierExpense !== '') {
      where.isSupplierExpense = req.query.isSupplierExpense === 'true' || req.query.isSupplierExpense === true;
    }
    if (req.query.paymentStatus) {
      where.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.paymentMode) {
      where.paymentMode = req.query.paymentMode;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        expenseCategory: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(expenses.map(formatExpenseResponse));
  } catch (err) {
    next(err);
  }
};

// Update Expense
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      expenseNumber,
      title, amount, category, categoryId, date, notes, attachments,
      isSupplierExpense, supplierId, supplierName, supplierGstin,
      invoiceNo, invoiceDate, taxableAmount, gstPercentage,
      cgstAmount, sgstAmount, igstAmount, totalAmount, isInterState, hsnSacCode,
      // Payment fields
      paymentMode, paymentStatus, paidAmount, paymentRef, paymentImage, paymentNotes,
      // Breakdown charges
      shippingAmount, shippingGstApplicable, shippingGstRate,
      packingAmount, packingGstApplicable, packingGstRate,
      loadingAmount, loadingGstApplicable, loadingGstRate,
      otherCharges, otherChargesGstApplicable, otherChargesGstRate,
      discountAmount
    } = req.body;
    const userId = req.user.id;

    if (!title || amount === undefined || (!category && !categoryId) || !date) {
      return res.status(400).json({ error: 'Title, amount, category, and date are required.' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    let finalSupplierName = supplierName !== undefined ? (supplierName ? String(supplierName).trim() : null) : existing.supplierName;
    let finalSupplierGstin = supplierGstin !== undefined ? (supplierGstin ? String(supplierGstin).trim() : null) : existing.supplierGstin;
    const targetSupplierId = supplierId !== undefined ? (supplierId || null) : existing.supplierId;

    if (targetSupplierId && (!finalSupplierName || !finalSupplierGstin)) {
      try {
        const sup = await prisma.supplier.findUnique({ where: { id: targetSupplierId } });
        if (sup) {
          finalSupplierName = sup.name;
          finalSupplierGstin = sup.gstin || null;
        }
      } catch (_) {}
    }

    const numTaxable = (taxableAmount !== undefined && taxableAmount !== null && taxableAmount !== '')
      ? parseFloat(taxableAmount)
      : (existing.taxableAmount ? parseFloat(existing.taxableAmount) : numericAmount);
    const numGstPct = (gstPercentage !== undefined && gstPercentage !== null && gstPercentage !== '')
      ? parseFloat(gstPercentage)
      : (existing.gstPercentage ? parseFloat(existing.gstPercentage) : 0);
    const numCgst = (cgstAmount !== undefined && cgstAmount !== null && cgstAmount !== '')
      ? parseFloat(cgstAmount)
      : (existing.cgstAmount ? parseFloat(existing.cgstAmount) : 0);
    const numSgst = (sgstAmount !== undefined && sgstAmount !== null && sgstAmount !== '')
      ? parseFloat(sgstAmount)
      : (existing.sgstAmount ? parseFloat(existing.sgstAmount) : 0);
    const numIgst = (igstAmount !== undefined && igstAmount !== null && igstAmount !== '')
      ? parseFloat(igstAmount)
      : (existing.igstAmount ? parseFloat(existing.igstAmount) : 0);
    const numTotal = (totalAmount !== undefined && totalAmount !== null && totalAmount !== '')
      ? parseFloat(totalAmount)
      : (numericAmount || (numTaxable + numCgst + numSgst + numIgst));

    // Storage Management: Prune removed attachments from disk to free up space
    let incomingAttachments = [];
    if (attachments !== undefined) {
      incomingAttachments = Array.isArray(attachments)
        ? attachments
        : (typeof attachments === 'string' ? JSON.parse(attachments) : []);
      expenseStorage.pruneOrphanedExpenseAttachments(existing.attachments, incomingAttachments);
    } else {
      try {
        incomingAttachments = existing.attachments ? JSON.parse(existing.attachments) : [];
      } catch (_) {}
    }

    // Reorganize files into expense folder
    const finalAttachments = expenseStorage.organizeAttachmentsForExpense(id, incomingAttachments);

    const { categoryId: resolvedCatId, category: resolvedCatName } = await resolveCategoryData(category, categoryId);

    const resolvedTotal = numTotal || numericAmount;
    const resolvedExpenseNo = expenseNumber !== undefined
      ? (expenseNumber ? String(expenseNumber).trim() : existing.expenseNumber)
      : existing.expenseNumber;
    const chargesAndPayment = buildExpenseChargesAndPayment(req.body, {
      existing,
      expenseNumber: resolvedExpenseNo || existing.id,
      totalAmount: resolvedTotal,
      uniqueKey: Date.now().toString()
    });

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        expenseNumber: expenseNumber !== undefined ? (expenseNumber ? String(expenseNumber).trim() : null) : existing.expenseNumber,
        title: title.trim(),
        amount: resolvedTotal,
        category: resolvedCatName,
        categoryId: resolvedCatId,
        date: new Date(date),
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
        attachments: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : null,
        isSupplierExpense: isSupplierExpense !== undefined ? Boolean(isSupplierExpense || targetSupplierId) : existing.isSupplierExpense,
        supplierId: targetSupplierId,
        supplierName: finalSupplierName,
        supplierGstin: finalSupplierGstin,
        invoiceNo: invoiceNo !== undefined ? (invoiceNo ? String(invoiceNo).trim() : null) : existing.invoiceNo,
        invoiceDate: invoiceDate !== undefined ? (invoiceDate ? new Date(invoiceDate) : null) : existing.invoiceDate,
        taxableAmount: numTaxable,
        gstPercentage: numGstPct,
        cgstAmount: numCgst,
        sgstAmount: numSgst,
        igstAmount: numIgst,
        totalAmount: numTotal,
        isInterState: isInterState !== undefined ? Boolean(isInterState) : existing.isInterState,
        hsnSacCode: hsnSacCode !== undefined ? (hsnSacCode ? String(hsnSacCode).trim() : null) : existing.hsnSacCode,
        ...chargesAndPayment
      },
      include: {
        expenseCategory: { select: { id: true, name: true, code: true, status: true, expenseWithSupplier: true, defaultGstRate: true, hsnSacCode: true } },
        user: { select: { id: true, name: true, email: true } }
      }
    });

    // Write Audit Log
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        tableName: 'Expense',
        recordId: id,
        oldValue: existing,
        newValue: expense,
        ip: clientIp
      }
    });

    // Send Notification
    try {
      await notificationService.createNotification({
        type: 'EXPENSE_UPDATED',
        recipient_roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'],
        sender_role: req.user.role,
        sender_id: userId,
        reference_type: 'EXPENSE',
        reference_id: id,
        event_at: new Date(),
        message: `Expense "${title}" updated to ₹${numericAmount.toLocaleString('en-IN')} by ${req.user.name || 'Accountant'}.`,
        metadata: { expenseId: id, title, amount: numericAmount, category: resolvedCatName }
      });
    } catch (notifErr) {
      console.error('Failed to trigger notification for expense update:', notifErr);
    }

    res.json({ success: true, expense: formatExpenseResponse(expense) });
  } catch (err) {
    next(err);
  }
};

// Delete Expense
const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    await prisma.expense.delete({ where: { id } });

    // Storage Management: Permanently delete entire directory, attachments, and payment proof from disk
    expenseStorage.deleteExpenseFolder(id);
    if (existing.attachments) {
      expenseStorage.deleteExpenseAttachmentFile(existing.attachments);
    }
    if (existing.paymentImage) {
      paymentStorage.deletePaymentImageFromDisk(existing.paymentImage);
    }

    // Write Audit Log
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        tableName: 'Expense',
        recordId: id,
        oldValue: existing,
        newValue: {},
        ip: clientIp
      }
    });

    // Send Notification
    try {
      await notificationService.createNotification({
        type: 'EXPENSE_DELETED',
        recipient_roles: ['MAIN_MASTER', 'PURCHASE_ACCOUNTANT'],
        sender_role: req.user.role,
        sender_id: userId,
        reference_type: 'EXPENSE',
        reference_id: id,
        event_at: new Date(),
        message: `Expense "${existing.title}" of ₹${parseFloat(existing.amount).toLocaleString('en-IN')} was deleted by ${req.user.name || 'Accountant'}.`,
        metadata: { expenseId: id, title: existing.title, amount: parseFloat(existing.amount) }
      });
    } catch (notifErr) {
      console.error('Failed to trigger notification for expense deletion:', notifErr);
    }

    res.json({ success: true, message: 'Expense and all associated attachments deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// Get Expenses Summary
const getExpensesSummary = async (req, res, next) => {
  try {
    // Total expenses (all time)
    const totalAgg = await prisma.expense.aggregate({
      _sum: { amount: true }
    });
    const totalExpenses = totalAgg._sum.amount ? parseFloat(totalAgg._sum.amount) : 0;

    // Monthly expenses (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyAgg = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: { gte: startOfMonth } }
    });
    const monthlyExpenses = monthlyAgg._sum.amount ? parseFloat(monthlyAgg._sum.amount) : 0;

    // Group by category to see breakdown
    const categoryGroup = await prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true }
    });

    const categoryBreakdown = categoryGroup.map(item => ({
      category: item.category,
      amount: item._sum.amount ? parseFloat(item._sum.amount) : 0
    }));

    // Recent 5 expenses
    const recentExpenses = await prisma.expense.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        expenseCategory: {
          select: { id: true, name: true, code: true }
        },
        user: {
          select: {
            name: true
          }
        }
      }
    });

    res.json({
      total: totalExpenses,
      monthly: monthlyExpenses,
      categoryBreakdown,
      recent: recentExpenses.map(formatExpenseResponse)
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNextExpenseNumber,
  createExpense,
  createBulkExpenses,
  deleteBulkExpenses,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpensesSummary,
  uploadExpenseAttachments,
  removeExpenseAttachmentFile
};
