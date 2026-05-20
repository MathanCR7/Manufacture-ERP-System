const notificationService = require('./notifications.service');
const sse = require('./notifications.sse');
const prisma = require('../../database/prisma');

const connectSSE = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); 

  const userId = req.user.id;
  const role = req.user.role;

  sse.addClient(userId, role, res);
};

const markAsSeen = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await notificationService.markAsSeen(id, userId);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const role = req.user.role;
    const { paginated, page, limit } = req.query;

    let queryOptions = {
      where: {
        recipientRoles: {
          has: role
        }
      },
      orderBy: { eventAt: 'desc' },
    };

    if (paginated === 'true') {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 50;
      queryOptions.skip = (pageNum - 1) * limitNum;
      queryOptions.take = limitNum;

      const notifications = await prisma.notification.findMany(queryOptions);
      const total = await prisma.notification.count({
        where: {
          recipientRoles: {
            has: role
          }
        }
      });

      return res.status(200).json({
        data: notifications,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }

    const notifications = await prisma.notification.findMany({
      ...queryOptions,
      take: 50
    });
    res.status(200).json(notifications);
  } catch (err) {
    next(err);
  }
};

const markAllAsSeen = async (req, res, next) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;
    await notificationService.markAllAsSeen(role, userId);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    if (req.user.role !== 'MAIN_MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const notifications = await prisma.notification.findMany({
      include: {
        userSeenBy: { select: { name: true, role: true } }
      },
      orderBy: { eventAt: 'desc' }
    });
    res.status(200).json(notifications);
  } catch(err) {
    next(err);
  }
};

module.exports = {
  connectSSE,
  markAsSeen,
  markAllAsSeen,
  getNotifications,
  getAuditLogs
};
