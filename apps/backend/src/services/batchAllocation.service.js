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

    const formatExpiry = (exp) => {
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
      return { alertLevel, isExpired, daysRemaining };
    };

    // 1. Multi-Day / Multi-Product Sellable Stock Lots (Day 1 pushed stock even while Day 2 runs)
    let lotRows = [];
    try {
      lotRows = await prisma.$queryRawUnsafe(`
        SELECT l.*, pb.status AS batch_status
        FROM finished_product_stock_lots l
        LEFT JOIN production_batches pb ON pb.id = l.batch_id
        WHERE l.product_id = $1
          AND l.is_sellable = TRUE
          AND l.remaining_qty > 0
          AND (pb.deleted_at IS NULL)
        ORDER BY l.expiry_date ASC NULLS LAST, l.created_at ASC;
      `, productId);
    } catch (_) {
      lotRows = [];
    }

    const coveredBatchIds = new Set();
    const mappedLots = (lotRows || []).map(l => {
      coveredBatchIds.add(l.batch_id);
      const exp = l.expiry_date ? new Date(l.expiry_date) : null;
      const { alertLevel, isExpired, daysRemaining } = formatExpiry(exp);
      return {
        id: l.batch_id, // Keeps FK BatchAllocation.batchId -> production_batches(id) valid
        lotId: l.id,
        dayId: l.day_id,
        dayOutputId: l.day_output_id,
        dayNo: Number(l.day_no || 1),
        batchNo: l.product_batch_no,
        productSerialNo: l.product_serial_no,
        referenceNo: l.reference_no,
        mfgDate: l.mfg_date || l.created_at,
        expiryDate: l.expiry_date,
        remainingQty: Number(l.remaining_qty),
        actualOutput: Number(l.initial_qty),
        status: l.batch_status || 'Completed',
        daysRemaining,
        isExpired,
        alertLevel,
      };
    });

    // 2. Legacy single-product batches that don't have rows in finished_product_stock_lots
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

    const mappedLegacy = batches
      .filter(b => !coveredBatchIds.has(b.id))
      .map(b => {
        const exp = b.expiryDate ? new Date(b.expiryDate) : null;
        const { alertLevel, isExpired, daysRemaining } = formatExpiry(exp);
        return {
          id: b.id,
          lotId: null,
          dayNo: 1,
          batchNo: b.batchNo || b.referenceNo,
          productSerialNo: null,
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

    return [...mappedLots, ...mappedLegacy].sort((a, b) => {
      const ea = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const eb = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ea - eb;
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
        grnNumber: b.grn?.referenceNo || b.grn?.grnNumber || (b.adjustmentId ? `ADJ-${b.adjustmentId.slice(0, 8).toUpperCase()}` : 'N/A'),
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
          lotId: batch.lotId || null,
          batchNo: batch.batchNo,
          productSerialNo: batch.productSerialNo || null,
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
        // Finished Goods stock decrement (supports both finished_product_stock_lots and legacy productionBatchNew)
        if (allocations && allocations.length > 0) {
          for (const alloc of allocations) {
            let decrementedViaLot = false;

            if (alloc.lotId || (alloc.batchId && alloc.batchNo && productId)) {
              try {
                const lotQuery = alloc.lotId
                  ? await tx.$queryRawUnsafe(`SELECT * FROM finished_product_stock_lots WHERE id = $1::uuid LIMIT 1;`, alloc.lotId)
                  : await tx.$queryRawUnsafe(`
                      SELECT * FROM finished_product_stock_lots
                      WHERE batch_id = $1 AND product_id = $2 AND product_batch_no = $3 AND is_sellable = TRUE
                      ORDER BY created_at ASC LIMIT 1;
                    `, alloc.batchId, productId, alloc.batchNo);

                if (lotQuery && lotQuery.length > 0) {
                  const lot = lotQuery[0];
                  if (Number(lot.remaining_qty || 0) < Number(alloc.quantity || 0)) {
                    throw new Error(`Insufficient stock in Lot ${lot.product_batch_no}. Available: ${lot.remaining_qty}, Requested: ${alloc.quantity}`);
                  }
                  await tx.$executeRawUnsafe(`
                    UPDATE finished_product_stock_lots
                    SET remaining_qty = GREATEST(0, remaining_qty - $1), updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2::uuid;
                  `, Number(alloc.quantity || 0), lot.id);

                  await tx.$executeRawUnsafe(`
                    UPDATE production_batches
                    SET remaining_quantity = GREATEST(0, COALESCE(remaining_quantity, 0) - $1), updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2;
                  `, Number(alloc.quantity || 0), lot.batch_id).catch(() => {});
                  decrementedViaLot = true;
                }
              } catch (lotErr) {
                if (lotErr.message && lotErr.message.startsWith('Insufficient stock in Lot')) {
                  throw lotErr;
                }
              }
            }

            if (!decrementedViaLot) {
              // 1. Legacy single-batch decrement remainingQty
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
            }

            // 2. Record BatchAllocation entry (alloc.batchId always points to production_batches.id)
            if (orderItemId && alloc.batchId) {
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
            let restoredViaLot = false;
            try {
              if (item.productId && alloc.batchNo) {
                const updatedLots = await tx.$executeRawUnsafe(`
                  UPDATE finished_product_stock_lots
                  SET remaining_qty = remaining_qty + $1, updated_at = CURRENT_TIMESTAMP
                  WHERE batch_id = $2 AND product_id = $3 AND product_batch_no = $4;
                `, Number(alloc.quantity || 0), alloc.batchId, item.productId, alloc.batchNo);
                if (Number(updatedLots) > 0) restoredViaLot = true;
              }
            } catch (_) {}

            await tx.productionBatchNew.update({
              where: { id: alloc.batchId },
              data: {
                remainingQty: { increment: alloc.quantity }
              }
            }).catch(() => {});
          }
        } else if (item.batchId) {
          try {
            if (item.productId && item.batchNo) {
              await tx.$executeRawUnsafe(`
                UPDATE finished_product_stock_lots
                SET remaining_qty = remaining_qty + $1, updated_at = CURRENT_TIMESTAMP
                WHERE batch_id = $2 AND product_id = $3 AND product_batch_no = $4;
              `, Number(item.quantity || 0), item.batchId, item.productId, item.batchNo);
            }
          } catch (_) {}
          await tx.productionBatchNew.update({
            where: { id: item.batchId },
            data: {
              remainingQty: { increment: item.quantity }
            }
          }).catch(() => {});
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
