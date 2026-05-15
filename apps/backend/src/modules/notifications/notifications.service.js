const prisma = require('../../database/prisma');
const sse = require('./notifications.sse');

class NotificationService {
  async createNotification(data, prismaClient = prisma) {
    const {
      type,
      recipient_roles,
      sender_role,
      sender_id,
      reference_type,
      reference_id,
      event_at,
      message,
      metadata
    } = data;

    const notification = await prismaClient.notification.create({
      data: {
        type,
        recipientRoles: recipient_roles,
        senderRole: sender_role,
        senderId: sender_id,
        referenceType: reference_type,
        referenceId: reference_id,
        eventAt: event_at || new Date(),
        message,
        metadata
      }
    });

    sse.broadcastToRoles(recipient_roles, type, notification);

    return notification;
  }

  async markAsSeen(id, userId, prismaClient = prisma) {
    return prismaClient.notification.update({
      where: { id },
      data: {
        seenAt: new Date(),
        seenBy: userId
      }
    });
  }
}

module.exports = new NotificationService();
