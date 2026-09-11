const prisma = require('../../database/prisma');
const notificationService = require('../notifications/notifications.service');

// Create Expense (handles single or bulk automatically)
const createExpense = async (req, res, next) => {
  try {
    // If an array or { expenses: [...] } is passed, route to bulk creation
    if (Array.isArray(req.body) || (req.body.expenses && Array.isArray(req.body.expenses))) {
      return createBulkExpenses(req, res, next);
    }

    const { title, amount, category, date, notes } = req.body;
    const userId = req.user.id;

    if (!title || amount === undefined || !category || !date) {
      return res.status(400).json({ error: 'Title, amount, category, and date are required.' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        amount: numericAmount,
        category,
        date: new Date(date),
        notes: notes ? String(notes).trim() : null,
        createdBy: userId
      }
    });

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
        metadata: { expenseId: expense.id, title, amount: numericAmount, category }
      });
    } catch (notifErr) {
      console.error('Failed to trigger notification for expense creation:', notifErr);
    }

    res.status(201).json({ success: true, expense });
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
      if (!item.title || item.amount === undefined || !item.category || !item.date) {
        return res.status(400).json({
          error: `Row #${i + 1} is missing required fields (Title, Amount, Category, or Date).`
        });
      }
      const numAmt = parseFloat(item.amount);
      if (isNaN(numAmt) || numAmt <= 0) {
        return res.status(400).json({
          error: `Row #${i + 1} amount must be a positive number.`
        });
      }
      validExpenses.push({
        title: item.title.trim(),
        amount: numAmt,
        category: item.category,
        date: new Date(item.date),
        notes: item.notes ? String(item.notes).trim() : null,
        createdBy: userId
      });
    }

    let totalBulkAmount = 0;
    validExpenses.forEach(e => { totalBulkAmount += e.amount; });

    const createdList = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of validExpenses) {
        const exp = await tx.expense.create({
          data: item
        });
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

    res.status(201).json({ success: true, count: createdList.length, expenses: createdList });
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

    const deleteResult = await prisma.expense.deleteMany({
      where: { id: { in: ids } }
    });

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

// Get Expenses list with optional filtering (supports multiple categories)
const getExpenses = async (req, res, next) => {
  try {
    const { search, category, categories, startDate, endDate } = req.query;

    const where = {};

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
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(expenses);
  } catch (err) {
    next(err);
  }
};

// Update Expense
const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, amount, category, date, notes } = req.body;
    const userId = req.user.id;

    if (!title || amount === undefined || !category || !date) {
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

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        title,
        amount: numericAmount,
        category,
        date: new Date(date),
        notes: notes || null
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
        metadata: { expenseId: id, title, amount: numericAmount, category }
      });
    } catch (notifErr) {
      console.error('Failed to trigger notification for expense update:', notifErr);
    }

    res.json({ success: true, expense });
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

    res.json({ success: true, message: 'Expense deleted successfully.' });
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
      recent: recentExpenses
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
  getExpensesSummary
};
