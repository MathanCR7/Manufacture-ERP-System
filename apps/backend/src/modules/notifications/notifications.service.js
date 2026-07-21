const prisma = require('../../database/prisma');
const sse = require('./notifications.sse');
const { NOTIFICATION_ROLE_MAP } = require('./notifications.config');

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

    let finalSenderId = sender_id;

    // Verify senderId exists in the user table to prevent FK violation on Notification_senderId_fkey
    let senderExists = false;
    if (finalSenderId && finalSenderId !== 'system') {
      try {
        const user = await prismaClient.user.findUnique({
          where: { id: finalSenderId },
          select: { id: true }
        });
        if (user) {
          senderExists = true;
        }
      } catch (err) {
        console.error('Error verifying notification sender ID:', err);
      }
    }

    if (!senderExists) {
      try {
        const fallbackUser = await prismaClient.user.findFirst({
          where: { role: 'MAIN_MASTER' },
          select: { id: true }
        }) || await prismaClient.user.findFirst({
          select: { id: true }
        });

        if (fallbackUser) {
          finalSenderId = fallbackUser.id;
        }
      } catch (err) {
        console.error('Error finding fallback user for notification:', err);
      }
    }

    const notification = await prismaClient.notification.create({
      data: {
        type,
        recipientRoles: recipient_roles,
        senderRole: sender_role,
        senderId: finalSenderId,
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

  async markAllAsSeen(role, userId, prismaClient = prisma) {
    return prismaClient.notification.updateMany({
      where: {
        recipientRoles: {
          has: role
        },
        seenAt: null
      },
      data: {
        seenAt: new Date(),
        seenBy: userId
      }
    });
  }

  async checkProductStockAlerts(productId, prismaClient = prisma) {
    // 1. Calculate current stock
    const sumIn = await prismaClient.productStockMovement.aggregate({
      where: { productId, direction: 1 },
      _sum: { quantity: true }
    });
    const sumOut = await prismaClient.productStockMovement.aggregate({
      where: { productId, direction: -1 },
      _sum: { quantity: true }
    });
    const currentStock = Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);

    // 2. Fetch product and stock levels
    const product = await prismaClient.finishedProduct.findUnique({
      where: { id: productId },
      include: { stockLevels: true }
    });
    if (!product || !product.stockLevels || product.stockLevels.length === 0) return;

    const stockLevel = product.stockLevels[0];
    const minLevel = Number(stockLevel.minLevel || 0);
    const reorderPoint = Number(stockLevel.reorderPoint || 0);

    // 3. Trigger Min Level critical alert (Red)
    if (currentStock < minLevel) {
      await this.createNotification({
        type: 'STOCK_CRITICAL',
        recipient_roles: NOTIFICATION_ROLE_MAP.STOCK_CRITICAL,
        sender_role: 'SYSTEM',
        sender_id: 'system',
        reference_type: 'PRODUCT_ALERT',
        reference_id: productId,
        message: `${product.name} CRITICAL: stock at ${currentStock} units — below minimum level of ${minLevel}. Immediate production required.`,
        metadata: { productId, productName: product.name, currentStock, minLevel }
      }, prismaClient);
    }
    // 4. Trigger Reproduction alert (Amber) and write warning audit log
    else if (currentStock < reorderPoint) {
      await this.createNotification({
        type: 'STOCK_REPRODUCTION',
        recipient_roles: NOTIFICATION_ROLE_MAP.STOCK_REPRODUCTION,
        sender_role: 'SYSTEM',
        sender_id: 'system',
        reference_type: 'PRODUCT_ALERT',
        reference_id: productId,
        message: `${product.name} stock at ${currentStock} units — below reproduction point of ${reorderPoint}. Schedule reproduction.`,
        metadata: { productId, productName: product.name, currentStock, reproductionPoint: reorderPoint }
      }, prismaClient);

      // Create Warning Audit Log
      await prismaClient.auditLog.create({
        data: {
          userId: 'system',
          action: 'STOCK_REPRODUCTION_ALERT',
          tableName: 'finished_products',
          recordId: productId,
          oldValue: {},
          newValue: { productName: product.name, currentStock, reproductionPoint: reorderPoint },
          ip: 'system'
        }
      });
    }
  }
}

module.exports = new NotificationService();
