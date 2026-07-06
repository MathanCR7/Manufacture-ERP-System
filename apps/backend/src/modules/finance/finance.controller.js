const prisma = require('../../database/prisma');
const notificationService = require('../notifications/notifications.service');

// Create Expense
const createExpense = async (req, res, next) => {
  try {
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
        title,
        amount: numericAmount,
        category,
        date: new Date(date),
        notes: notes || null,
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

// Get Expenses list with optional filtering
const getExpenses = async (req, res, next) => {
  try {
    const { search, category, startDate, endDate } = req.query;

    const where = {};

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
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
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpensesSummary
};
