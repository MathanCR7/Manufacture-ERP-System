const prisma = require('../../database/prisma');
const stockReservationService = require('../../services/stockReservation.service');
const notificationService = require('../notifications/notifications.service');

/**
 * Service to execute atomic "Complete Production" transaction:
 * - Postings for: Header, Dates (MFD, Expiry), RM Consumption & Tolerance Variance,
 *   Labour Log, Machine & Utilities (EB kWh reading), Output/Scrap/Yield %,
 *   Inventory Postings (Quarantine vs Available stock based on Lab Test decision),
 *   Batch Costing, and Audit Log.
 */
class ProductionCompletionService {
  /**
   * Execute Complete Production
   * @param {string} batchId - Batch UUID
   * @param {Object} data - Completion payload
   * @param {Object} user - Authenticated user object
   */
  async completeProduction(batchId, data, user) {
    if (!batchId) throw new Error('Batch ID is required.');

    const userIdentifier = user?.name || user?.email || 'Supervisor';
    const userId = user?.id;

    // Fetch batch with all current associations
    const batch = await prisma.productionBatchNew.findUnique({
      where: { id: batchId },
      include: {
        product: { include: { unit: true, category: true } },
        rmUsages: { include: { rawMaterial: true } },
        order: true
      }
    });

    if (!batch) throw new Error(`Batch not found with ID ${batchId}`);

    if (batch.status === 'Completed' || batch.status === 'qc_passed') {
      throw new Error(`Batch #${batch.referenceNo} is already completed.`);
    }

    if (batch.status === 'Cancelled' || batch.status === 'qc_failed') {
      throw new Error(`Cannot complete cancelled or failed batch #${batch.referenceNo}.`);
    }

    // 1. Validate required fields
    const actualOutput = data.actualOutput !== undefined && data.actualOutput !== null 
      ? Number(data.actualOutput) 
      : Number(batch.quantity);

    if (actualOutput <= 0) {
      throw new Error('Actual production output quantity must be greater than zero.');
    }

    // Lab Test Decision:
    // If user clicked "Lab Test Required" -> labTestRequired = true
    // If user clicked "Lab Test Not Required" (Exempt) -> labTestRequired = false (DEFAULT)
    const labTestRequired = Boolean(data.labTestRequired);

    // Dates
    const completionDate = data.completeDate ? new Date(data.completeDate) : new Date();
    const mfd = completionDate;
    const shelfLifeDays = parseInt(data.shelfLifeDays, 10) || batch.expiryDays || 365;
    const expiryDate = new Date(mfd.getTime() + shelfLifeDays * 24 * 60 * 60 * 1000);

    // Theoretical planned quantity
    const theoreticalQty = Number(batch.quantity || 1);
    const goodQty = actualOutput;
    const rejectedQty = Number(data.rejectedQty || 0);
    const reworkQty = Number(data.reworkQty || 0);
    const scrapQty = Number(data.scrapQty || 0);
    const scrapReason = data.scrapReason || null;
    const yieldPercentage = theoreticalQty > 0 
      ? Number(((goodQty / theoreticalQty) * 100).toFixed(2)) 
      : 100.00;

    // Machine & EB Utilities
    const ebStart = Number(data.ebStartReading || 0);
    const ebEnd = Number(data.ebEndReading || 0);
    const ebUnitsKwh = ebEnd >= ebStart ? Number((ebEnd - ebStart).toFixed(2)) : Number(data.ebUnitsKwh || 0);
    const ebRate = Number(data.ebRatePerUnit || 8.50);
    const ebCost = Number((ebUnitsKwh * ebRate).toFixed(2));

    const waterQty = Number(data.waterQuantity || 0);
    const waterCost = Number(data.waterCost || 0);
    const fuelQty = Number(data.fuelQuantity || 0);
    const fuelCost = Number(data.fuelCost || 0);
    const dieselQty = Number(data.generatorDieselQty || 0);
    const dieselCost = Number(data.generatorDieselCost || 0);
    const utilityTotalCost = Number((ebCost + waterCost + fuelCost + dieselCost).toFixed(2));

    // Labour
    const labourLogs = Array.isArray(data.labourLogs) ? data.labourLogs : [];
    let labourTotalCost = 0;
    labourLogs.forEach(l => {
      const normalH = Number(l.normalHours || 8);
      const otH = Number(l.otHours || 0);
      const rate = Number(l.ratePerHour || 0);
      const lineCost = Number(((normalH + otH * 1.5) * rate).toFixed(2));
      l.calculatedCost = lineCost;
      labourTotalCost += lineCost;
    });

    // Determine target statuses based on lab test requirement
    const targetStatus = labTestRequired ? 'Lab Test In Progress' : 'Completed';
    const targetApprovalStatus = labTestRequired ? 'QC_PENDING' : 'QC_EXEMPT';
    const targetQcStatus = labTestRequired ? 'ON_HOLD' : 'EXEMPT';

    // ──────────────── ATOMIC DATABASE TRANSACTION ────────────────
    const transactionResult = await prisma.$transaction(async (tx) => {
      // A. Update ProductionBatchNew header record
      const updatedBatch = await tx.productionBatchNew.update({
        where: { id: batchId },
        data: {
          status: targetStatus,
          completeDate: completionDate,
          actualOutput: goodQty,
          remainingQty: goodQty,
          expiryDate: expiryDate,
          note: data.note || batch.note
        }
      });

      // B. Update extended columns in production_batches
      await tx.$executeRawUnsafe(`
        UPDATE "production_batches" SET
          approval_status = $1,
          qc_status = $2,
          lab_test_required = $3,
          mfd = $4,
          shelf_life_days = $5,
          quarantine_stock = $6,
          good_quantity = $7,
          rejected_quantity = $8,
          scrap_quantity = $9,
          scrap_reason = $10,
          yield_percentage = $11,
          eb_start_reading = $12,
          eb_end_reading = $13,
          eb_units_kwh = $14,
          eb_rate_per_unit = $15,
          eb_total_cost = $16,
          labour_total_cost = $17,
          completed_by = $18,
          completed_at = $19
        WHERE id = $20
      `,
        targetApprovalStatus,
        targetQcStatus,
        labTestRequired,
        mfd,
        shelfLifeDays,
        labTestRequired ? goodQty : 0, // Quarantine stock if QC required
        goodQty,
        rejectedQty,
        scrapQty,
        scrapReason,
        yieldPercentage,
        ebStart,
        ebEnd,
        ebUnitsKwh,
        ebRate,
        ebCost,
        labourTotalCost,
        userIdentifier,
        completionDate,
        batchId
      );

      // C. Process Raw Material Consumption & Backflush Stock Deductions
      let totalMaterialCost = 0;
      const latestRatios = [];

      for (const usage of batch.rmUsages) {
        const customRm = Array.isArray(data.rmUsages) ? data.rmUsages.find(r => r.rmId === usage.rmId) : null;
        const consumedQty = customRm?.actualUsedQty !== undefined 
          ? Number(customRm.actualUsedQty) 
          : Number(usage.actualUsedQty || usage.requiredQty || 0);

        const standardQty = Number(usage.requiredQty || 0);
        const varianceQty = Number((consumedQty - standardQty).toFixed(4));
        const variancePct = standardQty > 0 ? Number(((varianceQty / standardQty) * 100).toFixed(2)) : 0;
        const lineTotalCost = Number((consumedQty * Number(usage.unitCost || 0)).toFixed(2));
        totalMaterialCost += lineTotalCost;

        // Ratio per single unit output
        const singlePieceRatio = goodQty > 0 ? Number((consumedQty / goodQty).toFixed(6)) : 0;
        latestRatios.push({
          rmId: usage.rmId,
          consumedQty,
          singlePieceRatio
        });

        // Update RM usage record
        await tx.productionBatchRMUsage.update({
          where: { id: usage.id },
          data: {
            actualUsedQty: consumedQty,
            totalCost: lineTotalCost
          }
        });

        // Deduct from RawMaterial main stock table
        if (usage.rmId && consumedQty > 0) {
          await tx.rawMaterial.update({
            where: { id: usage.rmId },
            data: {
              currentStock: { decrement: consumedQty }
            }
          });
        }

        // Deduct from allocated InventoryBatch lots (FEFO)
        const allocations = await tx.$queryRawUnsafe(
          `SELECT inventory_batch_id, allocated_qty FROM "production_batch_allocations" WHERE usage_id = $1`,
          usage.id
        );

        for (const alloc of allocations) {
          if (alloc.inventory_batch_id && Number(alloc.allocated_qty) > 0) {
            try {
              await tx.inventoryBatch.updateMany({
                where: { id: alloc.inventory_batch_id },
                data: {
                  netQty: { decrement: Number(alloc.allocated_qty) }
                }
              });
            } catch (allocErr) {
              console.warn('InventoryBatch decrement non-fatal warning:', allocErr.message);
            }
          }
        }
      }

      // D. Insert Output Details Log
      await tx.$executeRawUnsafe(`
        INSERT INTO "production_output_details" (
          "id", "batch_id", "good_qty", "rejected_qty", "rework_qty", "scrap_qty",
          "scrap_reason", "by_product_name", "by_product_qty", "qc_sample_qty",
          "retention_sample_qty", "theoretical_qty", "yield_percentage", "created_at"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
      `,
        batchId,
        goodQty,
        rejectedQty,
        reworkQty,
        scrapQty,
        scrapReason,
        data.byProductName || null,
        Number(data.byProductQty || 0),
        Number(data.qcSampleQty || 0),
        Number(data.retentionSampleQty || 0),
        theoreticalQty,
        yieldPercentage
      );

      // E. Insert Utility Logs
      await tx.$executeRawUnsafe(`
        INSERT INTO "production_utility_logs" (
          "id", "batch_id", "eb_start_reading", "eb_end_reading", "eb_units_kwh",
          "eb_rate_per_unit", "eb_cost", "water_quantity", "water_cost", "fuel_quantity",
          "fuel_cost", "generator_diesel_qty", "generator_diesel_cost", "created_at"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
      `,
        batchId, ebStart, ebEnd, ebUnitsKwh, ebRate, ebCost,
        waterQty, waterCost, fuelQty, fuelCost, dieselQty, dieselCost
      );

      // F. Insert Labour Logs if present
      for (const log of labourLogs) {
        await tx.$executeRawUnsafe(`
          INSERT INTO "production_labour_logs" (
            "id", "batch_id", "employee_id", "employee_name", "employee_type",
            "contractor_name", "work_centre", "normal_hours", "ot_hours",
            "rate_per_hour", "total_cost", "created_at"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
          )
        `,
          batchId,
          log.employeeId || null,
          log.employeeName || 'Operator',
          log.employeeType || 'Permanent',
          log.contractorName || null,
          log.workCentre || 'Floor',
          Number(log.normalHours || 8),
          Number(log.otHours || 0),
          Number(log.ratePerHour || 0),
          log.calculatedCost || 0
        );
      }

      // G. Insert Batch Costing
      const totalOverhead = Number(data.overheadCost || (batch.totalCost ? Number(batch.totalCost) * 0.1 : 0));
      const grandBatchCost = Number((totalMaterialCost + labourTotalCost + utilityTotalCost + totalOverhead).toFixed(2));
      const costPerUnit = goodQty > 0 ? Number((grandBatchCost / goodQty).toFixed(4)) : 0;

      await tx.$executeRawUnsafe(`
        INSERT INTO "production_batch_costing" (
          "id", "batch_id", "material_cost", "packing_cost", "labour_cost",
          "machine_cost", "utility_cost", "overhead_cost", "total_batch_cost",
          "cost_per_unit", "standard_cost_per_unit", "variance_cost", "created_at"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
        )
      `,
        batchId,
        totalMaterialCost,
        Number(data.packingCost || 0),
        labourTotalCost,
        Number(data.machineCost || 0),
        utilityTotalCost,
        totalOverhead,
        grandBatchCost,
        costPerUnit,
        Number(data.standardCostPerUnit || costPerUnit),
        Number((grandBatchCost - (goodQty * Number(data.standardCostPerUnit || costPerUnit))).toFixed(2))
      );

      // H. INVENTORY POSTING (THE CORE RULE):
      // - If LAB TEST IS EXEMPT (!labTestRequired): Update Available Finished Goods Stock IMMEDIATELY
      // - If LAB TEST IS REQUIRED: Do NOT increment available stock (stays in Quarantine until QC approves in /production/qc-queue)
      if (!labTestRequired && batch.productId) {
        // 1. Increment Available Finished Goods stock
        await tx.finishedProduct.update({
          where: { id: batch.productId },
          data: {
            currentStock: { increment: goodQty }
          }
        });

        // 2. Insert Stock Movement
        await tx.productStockMovement.create({
          data: {
            productId: batch.productId,
            batchId: batchId,
            type: 'production_in',
            quantity: goodQty,
            direction: 1,
            note: `Production completed (Lab Exempt) — Batch #${batch.batchNo || batch.referenceNo}`,
            createdBy: userId || batch.createdBy
          }
        });

        // 3. Auto-allocate newly produced stock to waiting sales orders (linked order first, then FIFO backlog)
        try {
          await stockReservationService.allocateStockToWaitingOrders(batch.productId, goodQty, batch.orderId, tx);
        } catch (resErr) {
          console.warn('Stock reservation allocation note:', resErr.message);
        }

        // 4. Check low stock alerts
        try {
          await notificationService.checkProductStockAlerts(batch.productId, tx);
        } catch (alertErr) {
          console.warn('Alerts check note:', alertErr.message);
        }
      }

      // I. Save latest actual per-piece ratio learning into product specifications
      if (batch.productId && latestRatios.length > 0) {
        try {
          const currentProd = await tx.finishedProduct.findUnique({
            where: { id: batch.productId },
            select: { specifications: true }
          });
          const currentSpecs = currentProd?.specifications && typeof currentProd.specifications === 'object'
            ? currentProd.specifications
            : {};

          await tx.finishedProduct.update({
            where: { id: batch.productId },
            data: {
              specifications: {
                ...currentSpecs,
                latestActualFormulation: latestRatios,
                latestActualYield: goodQty,
                lastBatchReference: batch.referenceNo,
                lastBatchNo: batch.batchNo,
                lastProductionDate: completionDate.toISOString()
              }
            }
          });
        } catch (learnErr) {
          console.warn('Learning ratio note:', learnErr.message);
        }
      }

      // J. Audit Log
      await tx.auditLog.create({
        data: {
          userId: userId || batch.createdBy,
          action: labTestRequired ? 'COMPLETE_PRODUCTION_SENT_TO_QC' : 'COMPLETE_PRODUCTION_LAB_EXEMPT',
          tableName: 'production_batches',
          recordId: batchId,
          oldValue: { status: batch.status },
          newValue: {
            status: targetStatus,
            actualYield: goodQty,
            labTestRequired,
            mfd,
            expiryDate
          },
          ip: user?.ip || '127.0.0.1'
        }
      });

      return {
        batch: updatedBatch,
        actualYield: goodQty,
        labTestRequired,
        targetStatus,
        mfd,
        expiryDate,
        costPerUnit,
        grandBatchCost
      };
    }, {
      maxWait: 15000,
      timeout: 25000
    });

    // Post-transaction notifications
    if (labTestRequired) {
      await notificationService.createNotification({
        type: 'QC_INSPECTION_REQUIRED',
        recipient_roles: ['LAB_ASSISTANT', 'MAIN_MASTER', 'SUPERVISOR'],
        sender_role: user?.role || 'SYSTEM',
        sender_id: userId || 'system',
        reference_type: 'PRODUCTION_BATCH',
        reference_id: batchId,
        message: `Lab Test Required: ${batch.product?.name} (Batch: ${batch.batchNo || batch.referenceNo}) — Actual Yield ${goodQty} ${batch.product?.unit?.abbreviation || 'units'} waiting in QC Queue.`,
        metadata: {
          batchId,
          batchNo: batch.batchNo || batch.referenceNo,
          productName: batch.product?.name,
          actualYield: goodQty
        }
      });
    } else {
      await notificationService.createNotification({
        type: 'PRODUCTION_COMPLETED',
        recipient_roles: ['SALES_TEAM', 'MAIN_MASTER', 'PRODUCTION_STAFF'],
        sender_role: user?.role || 'SYSTEM',
        sender_id: userId || 'system',
        reference_type: 'PRODUCTION_BATCH',
        reference_id: batchId,
        message: `Production Completed (Lab Exempt): ${batch.product?.name} — ${goodQty} ${batch.product?.unit?.abbreviation || 'units'} added to available stock.`,
        metadata: {
          batchId,
          batchNo: batch.batchNo || batch.referenceNo,
          productName: batch.product?.name,
          quantity: goodQty
        }
      });
    }

    return transactionResult;
  }
}

module.exports = new ProductionCompletionService();
