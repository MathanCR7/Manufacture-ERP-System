const fs = require('fs');
const path = require('path');
const prisma = require('../../database/prisma');
const notificationService = require('../notifications/notifications.service');
const expenseStorage = require('../../utils/expenseFileStorage');

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

    const { title, amount, category, categoryId, date, notes, attachments } = req.body;
    const userId = req.user.id;

    if (!title || amount === undefined || (!category && !categoryId) || !date) {
      return res.status(400).json({ error: 'Title, amount, category, and date are required.' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const { categoryId: resolvedCatId, category: resolvedCatName } = await resolveCategoryData(category, categoryId);

    let parsedAttachments = [];
    if (attachments) {
      parsedAttachments = Array.isArray(attachments)
        ? attachments
        : (typeof attachments === 'string' ? JSON.parse(attachments) : []);
    }

    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        amount: numericAmount,
        category: resolvedCatName,
        categoryId: resolvedCatId,
        date: new Date(date),
        notes: notes ? String(notes).trim() : null,
        attachments: parsedAttachments.length > 0 ? JSON.stringify(parsedAttachments) : null,
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

      validExpenses.push({
        title: item.title.trim(),
        amount: numAmt,
        category: resolvedCatName,
        categoryId: resolvedCatId,
        date: new Date(item.date),
        notes: item.notes ? String(item.notes).trim() : null,
        attachments: atts.length > 0 ? JSON.stringify(atts) : null,
        rawAttachments: atts,
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
      select: { id: true, attachments: true }
    });

    const deleteResult = await prisma.expense.deleteMany({
      where: { id: { in: ids } }
    });

    // Storage Management: Permanently delete folders and attachment files from disk
    for (const exp of existingExpenses) {
      expenseStorage.deleteExpenseFolder(exp.id);
      if (exp.attachments) {
        expenseStorage.deleteExpenseAttachmentFile(exp.attachments);
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
        { title: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } }
      ];
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
    const { title, amount, category, categoryId, date, notes, attachments } = req.body;
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

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        title: title.trim(),
        amount: numericAmount,
        category: resolvedCatName,
        categoryId: resolvedCatId,
        date: new Date(date),
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
        attachments: finalAttachments.length > 0 ? JSON.stringify(finalAttachments) : null
      },
      include: {
        expenseCategory: { select: { id: true, name: true, code: true } },
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

    // Storage Management: Permanently delete entire directory and attachments from disk
    expenseStorage.deleteExpenseFolder(id);
    if (existing.attachments) {
      expenseStorage.deleteExpenseAttachmentFile(existing.attachments);
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
