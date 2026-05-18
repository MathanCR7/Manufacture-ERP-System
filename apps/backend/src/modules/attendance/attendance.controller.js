const prisma = require('../../database/prisma');

const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const existing = await prisma.attendanceLog.findFirst({
      where: { userId, checkOut: null },
      orderBy: { checkIn: 'desc' }
    });
    if (existing) {
      return res.status(400).json({ error: 'Already checked in. Please check out first.' });
    }
    const log = await prisma.attendanceLog.create({
      data: { userId, checkIn: new Date(), ipAddress: req.ip || '127.0.0.1' }
    });
    res.status(201).json({ success: true, log });
  } catch (err) { next(err); }
};

const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { note } = req.body;
    const existing = await prisma.attendanceLog.findFirst({
      where: { userId, checkOut: null },
      orderBy: { checkIn: 'desc' }
    });
    if (!existing) {
      return res.status(400).json({ error: 'No active check-in found.' });
    }
    const checkOutTime = new Date();
    const duration = Math.round((checkOutTime - new Date(existing.checkIn)) / 60000);
    const log = await prisma.attendanceLog.update({
      where: { id: existing.id },
      data: { checkOut: checkOutTime, duration, note: note || null }
    });
    res.json({ success: true, log });
  } catch (err) { next(err); }
};

const getStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const active = await prisma.attendanceLog.findFirst({
      where: { userId, checkOut: null },
      orderBy: { checkIn: 'desc' }
    });
    res.json({ isCheckedIn: !!active, activeLog: active || null });
  } catch (err) { next(err); }
};

const getMyLogs = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fromDate, toDate } = req.query;
    const where = { userId };
    if (fromDate) where.checkIn = { ...where.checkIn, gte: new Date(fromDate) };
    if (toDate) where.checkIn = { ...where.checkIn, lte: new Date(toDate + 'T23:59:59') };
    const logs = await prisma.attendanceLog.findMany({
      where, orderBy: { checkIn: 'desc' }, take: 100,
      include: { user: { select: { name: true, role: true } } }
    });
    res.json(logs);
  } catch (err) { next(err); }
};

const getAllLogs = async (req, res, next) => {
  try {
    const role = req.user.role;
    if (role !== 'MAIN_MASTER' && role !== 'SUPERVISOR') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { fromDate, toDate, userId } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (fromDate) where.checkIn = { ...where.checkIn, gte: new Date(fromDate) };
    if (toDate) where.checkIn = { ...where.checkIn, lte: new Date(toDate + 'T23:59:59') };
    const logs = await prisma.attendanceLog.findMany({
      where, orderBy: { checkIn: 'desc' }, take: 200,
      include: { user: { select: { id: true, name: true, role: true } } }
    });
    res.json(logs);
  } catch (err) { next(err); }
};

const getAllUsers = async (req, res, next) => {
  try {
    const role = req.user.role;
    if (role !== 'MAIN_MASTER' && role !== 'SUPERVISOR') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true }
    });
    res.json(users);
  } catch (err) { next(err); }
};

module.exports = { checkIn, checkOut, getStatus, getMyLogs, getAllLogs, getAllUsers };
