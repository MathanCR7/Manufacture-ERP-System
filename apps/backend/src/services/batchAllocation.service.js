const prisma = require('../database/prisma');

/**
 * Batch & Expiry Management Service (Auto-FEFO & Manual Allocation)
 */
class BatchAllocationService {
  /**
   * Fetches eligible production batches for a finished product, sorted by FEFO (earliest expiry first).
   */
  async getAvailableBatches(productId) {
    const now = new Date();

    const batches = await prisma.productionBatchNew.findMany({
      where: {
        productId,
        status: { in: ['Completed', 'qc_passed'] },
        remainingQty: { gt: 0 },
        deletedAt: null,
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return batches.map(b => {
      const exp = b.expiryDate ? new Date(b.expiryDate) : null;
      let alertLevel = 'GOOD';
      let isExpired = false;
      let daysRemaining = null;

      if (exp) {
        const diffMs = exp.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 0) {
          isExpired = true;
          alertLevel = 'EXPIRED';
        } else if (daysRemaining <= 30) {
          alertLevel = 'CRITICAL_30_DAYS';
        } else if (daysRemaining <= 60) {
          alertLevel = 'WARNING_60_DAYS';
        } else if (daysRemaining <= 90) {
          alertLevel = 'NOTICE_90_DAYS';
        }
      }

      return {
        id: b.id,
        batchNo: b.batchNo || b.referenceNo,
        referenceNo: b.referenceNo,
        mfgDate: b.startDate,
        expiryDate: b.expiryDate,
        remainingQty: Number(b.remainingQty),
        actualOutput: Number(b.actualOutput || b.quantity),
        status: b.status,
        daysRemaining,
        isExpired,
        alertLevel,
      };
    });
  }

  /**
   * Fetches eligible inventory batches for a raw material, sorted by FEFO (earliest expiry first).
   */
  async getAvailableRMBatches(rawMaterialId, tx = prisma) {
    const now = new Date();

    const batches = await tx.inventoryBatch.findMany({
      where: {
        rawMaterialId,
        netQty: { gt: 0 }
      },
      include: {
        po: {
          include: {
            supplier: true
          }
        },
        grn: true,
        uom: true
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return batches.map(b => {
      const exp = b.expiryDate ? new Date(b.expiryDate) : null;
      let alertLevel = 'GOOD';
      let isExpired = false;
      let daysRemaining = null;

      if (exp) {
        const diffMs = exp.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 0) {
          isExpired = true;
          alertLevel = 'EXPIRED';
        } else if (daysRemaining <= 30) {
          alertLevel = 'CRITICAL_30_DAYS';
        } else if (daysRemaining <= 60) {
          alertLevel = 'WARNING_60_DAYS';
        } else if (daysRemaining <= 90) {
          alertLevel = 'NOTICE_90_DAYS';
        }
      }

      return {
        id: b.id,
        batchId: b.id,
        batchNo: b.batchNumber,
        referenceNo: b.batchNumber,
        mfgBatchNo: b.mfgBatchNo,
        mfgDate: b.mfgDate,
        expiryDate: b.expiryDate,
        remainingQty: Number(b.netQty),
        receivedQty: Number(b.receivedQty),
        uom: b.uom ? (b.uom.abbreviation || b.uom.name) : 'kg',
        supplierName: b.po?.supplier?.name || 'Standard Supplier',
        grnNumber: b.grn?.grnNumber || b.grn?.referenceNo || 'N/A',
        poReferenceNo: b.po?.referenceNo || 'N/A',
        storageLocation: b.storageLocation || 'Main Warehouse',
        daysRemaining,
        isExpired,
        alertLevel,
      };
    });
  }

  /**
   * Automatically allocates required quantity using FEFO logic across available RM batches.
   */
  async allocateRMFEFO(rawMaterialId, requestedQty, tx = prisma) {
    const batches = await this.getAvailableRMBatches(rawMaterialId, tx);
    const validBatches = batches.filter(b => !b.isExpired);

    let needed = Number(requestedQty) || 0;
    const allocations = [];

    for (const batch of validBatches) {
      if (needed <= 0) break;
      const take = Math.min(needed, batch.remainingQty);
      if (take > 0) {
        allocations.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          mfgDate: batch.mfgDate,
          expiryDate: batch.expiryDate,
          quantity: take,
          supplierName: batch.supplierName,
          grnNumber: batch.grnNumber
        });
        needed -= take;
      }
    }

    return {
      fulfilled: needed === 0,
      shortage: Math.max(0, needed),
      allocations,
      primaryBatch: allocations[0] || null,
    };
  }

  /**
   * Automatically allocates required quantity using FEFO logic across available batches.
   */
  async allocateFEFO(productId, requestedQty, tx = prisma) {
    const batches = await this.getAvailableBatches(productId);
    const validBatches = batches.filter(b => !b.isExpired);

    let needed = Number(requestedQty) || 0;
    const allocations = [];

    for (const batch of validBatches) {
      if (needed <= 0) break;
      const take = Math.min(needed, batch.remainingQty);
      if (take > 0) {
        allocations.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          mfgDate: batch.mfgDate,
          expiryDate: batch.expiryDate,
          quantity: take,
        });
        needed -= take;
      }
    }

    return {
      fulfilled: needed === 0,
      shortage: Math.max(0, needed),
      allocations,
      primaryBatch: allocations[0] || null,
    };
  }

  /**
   * Commits batch decrements and creates stock movements inside a Prisma transaction.
   */
  async commitDecrements(itemsWithAllocations, order, userId, tx) {
    for (const item of itemsWithAllocations) {
      const { orderItemId, productId, rawMaterialId, itemType, allocations, fallbackBatchNo, fallbackExpiryDate } = item;
      const isRawMaterial = itemType === 'RAW_MATERIAL' || (rawMaterialId && !productId);

      if (isRawMaterial) {
        const effectiveRmId = rawMaterialId || productId;
        const totalItemQty = allocations && allocations.length > 0
          ? allocations.reduce((s, a) => s + Number(a.quantity || a.allocatedQty || 0), 0)
          : Number(item.quantity || 0);

        // 1. Decrement specific inventory batch lots if allocated
        if (allocations && allocations.length > 0) {
          for (const alloc of allocations) {
            const allocQty = Number(alloc.quantity || alloc.allocatedQty || 0);
            const lotId = alloc.id || alloc.batchId;
            if (lotId && allocQty > 0) {
              const invBatch = await tx.inventoryBatch.findUnique({ where: { id: lotId } });
              if (invBatch) {
                await tx.inventoryBatch.update({
                  where: { id: lotId },
                  data: {
                    netQty: { decrement: allocQty }
                  }
                });
              }
            }
          }
        }

        // 2. Decrement RawMaterial currentStock
        await tx.rawMaterial.update({
          where: { id: effectiveRmId },
          data: {
            currentStock: { decrement: totalItemQty }
          }
        });

        // 3. Record RMStockAdjustment audit entry
        await tx.rMStockAdjustment.create({
          data: {
            rawMaterialId: effectiveRmId,
            type: 'SUBTRACTION',
            quantity: totalItemQty,
            notes: `Sold / Dispatched in ${order.type} #${order.docNo || order.referenceNo} (Customer: ${order.customerName || 'Customer'}${item.isPackingCharge ? ' • Packing Item' : ''})`,
            batches: allocations && allocations.length > 0 ? allocations : null,
            createdBy: userId
          }
        });
      } else {
        // Finished Goods stock decrement
        if (allocations && allocations.length > 0) {
          for (const alloc of allocations) {
            // 1. Decrement batch remainingQty
            const batch = await tx.productionBatchNew.findUnique({
              where: { id: alloc.batchId }
            });

            if (!batch || Number(batch.remainingQty) < alloc.quantity) {
              throw new Error(`Insufficient batch stock for Batch ${alloc.batchNo}. Available: ${batch?.remainingQty || 0}, Requested: ${alloc.quantity}`);
            }

            await tx.productionBatchNew.update({
              where: { id: alloc.batchId },
              data: {
                remainingQty: { decrement: alloc.quantity }
              }
            });

            // 2. Record BatchAllocation entry
            if (orderItemId) {
              await tx.batchAllocation.create({
                data: {
                  orderItemId,
                  batchId: alloc.batchId,
                  batchNo: alloc.batchNo,
                  quantity: alloc.quantity,
                  expiryDate: alloc.expiryDate ? new Date(alloc.expiryDate) : null,
                }
              });
            }
          }
        }

        // 3. Decrement FinishedProduct.currentStock
        const totalItemQty = allocations && allocations.length > 0
          ? allocations.reduce((s, a) => s + Number(a.quantity), 0)
          : Number(item.quantity || 0);

        if (productId) {
          await tx.finishedProduct.update({
            where: { id: productId },
            data: {
              currentStock: { decrement: totalItemQty }
            }
          });

          // 4. Record stock movement
          await tx.productStockMovement.create({
            data: {
              productId,
              orderId: order.id,
              type: 'order_allocation',
              quantity: totalItemQty,
              direction: -1,
              note: `Billed in ${order.type} #${order.referenceNo} (Batch: ${allocations?.[0]?.batchNo || fallbackBatchNo || 'N/A'})`,
              createdBy: userId,
            }
          });
        }
      }
    }
  }

  /**
   * Restores batch stock upon invoice cancellation or return.
   */
  async restoreStock(orderId, userId, tx) {
    const orderItems = await tx.customerOrderItem.findMany({
      where: { orderId },
      include: { batchAllocations: true }
    });

    for (const item of orderItems) {
      if (item.rawMaterialId || item.itemType === 'RAW_MATERIAL') {
        const rmId = item.rawMaterialId || item.productId;
        if (rmId) {
          await tx.rawMaterial.update({
            where: { id: rmId },
            data: {
              currentStock: { increment: item.quantity }
            }
          });

          // Restore batch lot if stored
          if (item.batchAllocationsData && Array.isArray(item.batchAllocationsData)) {
            for (const alloc of item.batchAllocationsData) {
              const lotId = alloc.id || alloc.batchId;
              const allocQty = Number(alloc.quantity || alloc.allocatedQty || 0);
              if (lotId && allocQty > 0) {
                await tx.inventoryBatch.updateMany({
                  where: { id: lotId },
                  data: {
                    netQty: { increment: allocQty }
                  }
                });
              }
            }
          }

          await tx.rMStockAdjustment.create({
            data: {
              rawMaterialId: rmId,
              type: 'ADDITION',
              quantity: item.quantity,
              notes: `Stock restored from cancelled sales invoice/return #${orderId}`,
              batches: item.batchAllocationsData || null,
              createdBy: userId
            }
          });
        }
      } else {
        if (item.batchAllocations && item.batchAllocations.length > 0) {
          for (const alloc of item.batchAllocations) {
            await tx.productionBatchNew.update({
              where: { id: alloc.batchId },
              data: {
                remainingQty: { increment: alloc.quantity }
              }
            });
          }
        } else if (item.batchId) {
          await tx.productionBatchNew.update({
            where: { id: item.batchId },
            data: {
              remainingQty: { increment: item.quantity }
            }
          });
        }

        // Restore FinishedProduct currentStock
        if (item.productId) {
          await tx.finishedProduct.update({
            where: { id: item.productId },
            data: {
              currentStock: { increment: item.quantity }
            }
          });

          // Stock movement refund
          await tx.productStockMovement.create({
            data: {
              productId: item.productId,
              orderId,
              type: 'order_return',
              quantity: item.quantity,
              direction: 1,
              note: `Restored stock from cancelled order/return #${orderId}`,
              createdBy: userId,
            }
          });
        }
      }
    }
  }
}

module.exports = new BatchAllocationService();
