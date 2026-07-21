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

const enrichNotifications = async (notifs) => {
  const grnSubscribedNotifs = notifs.filter(n => n.type === 'GRN_SUBMITTED');
  if (grnSubscribedNotifs.length === 0) return notifs;

  const grnIds = grnSubscribedNotifs
    .map(n => {
      let meta = {};
      try {
        meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {});
      } catch (e) {}
      return meta.grn_id || n.referenceId;
    })
    .filter(Boolean);

  if (grnIds.length === 0) return notifs;

  const grns = await prisma.gRNReceive.findMany({
    where: { id: { in: grnIds } },
    select: { id: true, status: true }
  });

  const statusMap = new Map(grns.map(g => [g.id, g.status]));

  return notifs.map(n => {
    if (n.type === 'GRN_SUBMITTED') {
      let meta = {};
      try {
        meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {});
      } catch (e) {}
      const grnId = meta.grn_id || n.referenceId;
      const grnStatus = statusMap.get(grnId);
      if (grnStatus && grnStatus !== 'PENDING_LAB') {
        return {
          ...n,
          metadata: {
            ...meta,
            grn_status: grnStatus,
            is_tested: true
          }
        };
      }
    }
    return n;
  });
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

    // Calculate upcoming deliveries expected today
    let upcomingNotifications = [];
    if (['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'].includes(role)) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const posToday = await prisma.rawMaterialPO.findMany({
        where: {
          status: { in: ['RECEIVED', 'APPROVED', 'ORDERED'] },
          expectedDelivery: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        include: { supplier: true }
      });

      const poIds = posToday.map(p => p.id);
      if (poIds.length > 0) {
        const existingGrns = await prisma.gRNReceive.findMany({
          where: { poId: { in: poIds } },
          select: { poId: true }
        });
        const grnPoIds = new Set(existingGrns.map(g => g.poId));
        const pendingPOs = posToday.filter(p => !grnPoIds.has(p.id));

        upcomingNotifications = pendingPOs.map(po => ({
          id: `upcoming-delivery-${po.id}`,
          type: 'UPCOMING_DELIVERY',
          title: 'Upcoming RM Delivery Today',
          message: `Raw material ${po.name} (PO: ${po.referenceNo}) is expected for delivery today.`,
          eventAt: new Date().toISOString(),
          referenceId: po.id,
          metadata: {
            po_id: po.id,
            po_ref: po.referenceNo,
            rm_id: po.rmId,
            rm_name: po.name,
            qty: po.quantity,
            supplier: po.supplier?.name || 'Unknown'
          },
          recipientRoles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
          seenBy: []
        }));
      }
    }

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

      const enriched = await enrichNotifications(notifications);
      const combined = [...upcomingNotifications, ...enriched];

      return res.status(200).json({
        data: combined,
        meta: {
          total: total + upcomingNotifications.length,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil((total + upcomingNotifications.length) / limitNum)
        }
      });
    }

    const notifications = await prisma.notification.findMany({
      ...queryOptions,
      take: 50
    });
    const enriched = await enrichNotifications(notifications);
    const combined = [...upcomingNotifications, ...enriched];
    res.status(200).json(combined);
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
