const prisma = require('../database/prisma');

/**
 * Stock Reservation & Backlog Allocation Engine
 * Manages Free Stock, Order Item Reservations, Shortfalls, and Auto-Allocation upon Production Complete.
 */
class StockReservationService {
  constructor() {
    this.getProductStockSummary = this.getProductStockSummary.bind(this);
    this.getAvailableForInvoice = this.getAvailableForInvoice.bind(this);
    this.allocateStockToWaitingOrders = this.allocateStockToWaitingOrders.bind(this);
    this.releaseReservationForOrder = this.releaseReservationForOrder.bind(this);
    this.checkAndUpdateOrderStatus = this.checkAndUpdateOrderStatus.bind(this);
  }

  /**
   * Calculates real-time On-Hand, Total Reserved, and Free Stock for a product.
   */
  async getProductStockSummary(productId, tx = prisma) {
    const product = await tx.finishedProduct.findUnique({
      where: { id: productId },
      select: { id: true, name: true, code: true, currentStock: true, isStockItem: true }
    });

    if (!product) return { onHand: 0, totalReserved: 0, freeStock: 0, isStockItem: true };

    if (product.isStockItem === false) {
      return { onHand: 999999, totalReserved: 0, freeStock: 999999, isStockItem: false };
    }

    // Sum active reservations across all open sales orders (not Quotations, not fully Invoiced/Delivered/Cancelled)
    const reservedAgg = await tx.customerOrderItem.aggregate({
      where: {
        productId,
        order: {
          type: 'Sales Order',
          status: { notIn: ['Invoiced', 'Delivered', 'Cancelled', 'Quotation'] },
          deletedAt: null
        }
      },
      _sum: { reservedQty: true }
    });

    const onHand = Number(product.currentStock || 0);
    const totalReserved = Number(reservedAgg._sum.reservedQty || 0);
    const freeStock = Math.max(0, onHand - totalReserved);

    return {
      productId,
      productName: product.name,
      productCode: product.code,
      onHand,
      totalReserved,
      freeStock,
      isStockItem: true
    };
  }

  /**
   * Evaluates available stock for an invoice row:
   * - If converted from a Standard Order: row's reservedQty + Free Stock
   * - If direct invoice: Free Stock only
   */
  async getAvailableForInvoice(productId, sourceOrderItemId = null, tx = prisma) {
    const summary = await this.getProductStockSummary(productId, tx);
    if (!summary.isStockItem) {
      return { available: 999999, freeStock: 999999, reservedForLine: 0, isStockItem: false };
    }

    let reservedForLine = 0;
    if (sourceOrderItemId) {
      const sourceItem = await tx.customerOrderItem.findUnique({
        where: { id: sourceOrderItemId }
      });
      if (sourceItem) {
        reservedForLine = Number(sourceItem.reservedQty || 0);
      }
    }

    const available = reservedForLine + summary.freeStock;
    return {
      available,
      freeStock: summary.freeStock,
      reservedForLine,
      isStockItem: true
    };
  }

  /**
   * Automatically allocates newly finished/received stock to waiting orders:
   * 1. Priority 1: Linked Order (if preferredOrderId is provided)
   * 2. Priority 2: Oldest open waiting orders (FIFO by CustomerOrder.createdAt)
   * 3. Remainder flows to free stock
   */
  async allocateStockToWaitingOrders(productId, newlyAvailableQty, preferredOrderId = null, tx = prisma) {
    let unallocated = Number(newlyAvailableQty || 0);
    if (unallocated <= 0) return;

    // 1. If a preferred order is linked, fulfill its shortfall first
    if (preferredOrderId) {
      const linkedItems = await tx.customerOrderItem.findMany({
        where: {
          orderId: preferredOrderId,
          productId,
          shortfallQty: { gt: 0 }
        }
      });

      for (const item of linkedItems) {
        if (unallocated <= 0) break;
        const deficit = Number(item.shortfallQty);
        const alloc = Math.min(unallocated, deficit);

        await tx.customerOrderItem.update({
          where: { id: item.id },
          data: {
            reservedQty: { increment: alloc },
            shortfallQty: { decrement: alloc }
          }
        });
        unallocated -= alloc;
      }

      await this.checkAndUpdateOrderStatus(preferredOrderId, tx);
    }

    // 2. FIFO allocation across other open waiting orders
    if (unallocated > 0) {
      const waitingItems = await tx.customerOrderItem.findMany({
        where: {
          productId,
          shortfallQty: { gt: 0 },
          order: {
            type: 'Sales Order',
            status: { in: ['Shortage (Production Required)', 'In Production', 'Waiting for Production', 'Partly Invoiced'] },
            deletedAt: null
          }
        },
        include: { order: true },
        orderBy: { order: { createdAt: 'asc' } }
      });

      for (const item of waitingItems) {
        if (unallocated <= 0) break;
        const deficit = Number(item.shortfallQty);
        const alloc = Math.min(unallocated, deficit);

        await tx.customerOrderItem.update({
          where: { id: item.id },
          data: {
            reservedQty: { increment: alloc },
            shortfallQty: { decrement: alloc }
          }
        });
        unallocated -= alloc;

        await this.checkAndUpdateOrderStatus(item.orderId, tx);
      }
    }
  }

  /**
   * Releases reservations for an order (e.g. upon cancellation or item quantity decrement)
   * and automatically reallocates the freed stock to the next waiting orders.
   */
  async releaseReservationForOrder(orderId, tx = prisma) {
    const items = await tx.customerOrderItem.findMany({
      where: { orderId }
    });

    for (const item of items) {
      const releasedQty = Number(item.reservedQty || 0);
      if (releasedQty > 0) {
        await tx.customerOrderItem.update({
          where: { id: item.id },
          data: {
            reservedQty: 0,
            shortfallQty: Number(item.quantity) - Number(item.invoicedQty || 0)
          }
        });

        // Reallocate the released quantity to the next oldest waiting orders
        await this.allocateStockToWaitingOrders(item.productId, releasedQty, null, tx);
      }
    }
  }

  /**
   * Checks if an order's items all have shortfall 0 and updates its status to 'Ready to Invoice'.
   */
  async checkAndUpdateOrderStatus(orderId, tx = prisma) {
    const order = await tx.customerOrder.findUnique({
      where: { id: orderId },
      include: { items: true }
    });

    if (!order || order.type !== 'Sales Order') return;
    if (['Invoiced', 'Delivered', 'Cancelled'].includes(order.status)) return;

    const totalShortfall = order.items.reduce((s, it) => s + Number(it.shortfallQty || 0), 0);
    const totalInvoiced = order.items.reduce((s, it) => s + Number(it.invoicedQty || 0), 0);
    const totalOrdered = order.items.reduce((s, it) => s + Number(it.quantity || 0), 0);

    if (totalInvoiced >= totalOrdered && totalOrdered > 0) {
      await tx.customerOrder.update({
        where: { id: orderId },
        data: { status: 'Invoiced' }
      });
    } else if (totalInvoiced > 0) {
      await tx.customerOrder.update({
        where: { id: orderId },
        data: { status: totalShortfall === 0 ? 'Ready to Invoice' : 'Partly Invoiced' }
      });
    } else if (totalShortfall === 0) {
      await tx.customerOrder.update({
        where: { id: orderId },
        data: { status: 'Ready to Invoice' }
      });
    } else {
      await tx.customerOrder.update({
        where: { id: orderId },
        data: { status: 'Shortage (Production Required)' }
      });
    }
  }
}

module.exports = new StockReservationService();
