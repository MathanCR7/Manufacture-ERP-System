const { z } = require('zod');
const prisma = require('../../database/prisma');

// Helper to generate unique MP-XXXXXX
async function generateBatchReference(tx) {
  const result = await tx.$queryRaw`
    SELECT reference_no FROM production_batches 
    WHERE reference_no LIKE 'MP-%' 
    ORDER BY reference_no DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  if (!lastRecord || !lastRecord.reference_no) {
    return 'MP-000001';
  }

  const lastNumberStr = lastRecord.reference_no.split('-')[1];
  const lastNumber = parseInt(lastNumberStr, 10);
  const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
  return `MP-${String(nextNumber).padStart(6, '0')}`;
}

class ProductionBatchRedesignController {
  // GET /api/production/batches
  async getBatches(req, res, next) {
    try {
      const { type, baseId, status, fromDate, toDate, search, page = 1, limit = 50 } = req.query;

      let typeFilter = undefined;
      if (type) {
        if (type === 'STANDARD') typeFilter = { in: ['STANDARD', 'Make to Stock', 'Daily', 'Regular'] };
        else if (type === 'ORDER_BASED') typeFilter = { in: ['ORDER_BASED', 'Make to Order', 'Order-Based'] };
        else if (type === 'STOCK_UPDATE') typeFilter = { in: ['STOCK_UPDATE', 'Stock Adjustment', 'Manual'] };
        else typeFilter = type;
      }

      const where = {
        deletedAt: null,
        ...(typeFilter && { productionType: typeFilter }),
        ...(status && status !== 'ALL' && { status }),
        ...(fromDate && toDate && {
          startDate: {
            gte: new Date(fromDate),
            lte: new Date(new Date(toDate).setHours(23, 59, 59, 999))
          }
        }),
        ...(search && {
          OR: [
            { referenceNo: { contains: search, mode: 'insensitive' } },
            { batchNo: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } }
          ]
        })
      };

      const [batches, total] = await Promise.all([
        prisma.productionBatchNew.findMany({
          where,
          include: {
            product: { include: { unit: true, category: true } },
            order: { include: { customer: true } },
            creator: { select: { name: true, email: true } },
            rmUsages: {
              include: {
                rawMaterial: true
              }
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit)
        }),
        prisma.productionBatchNew.count({ where })
      ]);

      // Enrich with template & base info if available
      const batchIds = batches.map(b => b.id);
      let extraDetails = {};
      if (batchIds.length > 0) {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT b.id, b.base_id, b.template_id, b.shift, b.machine_line,
                  b.adjustment_reason, b.adjustment_reference,
                  b.sub_total, b.wastage_amt, b.overhead_amt, b.grand_total, b.cost_per_unit,
                  bm.name as base_name, pt.name as template_name
           FROM "production_batches" b
           LEFT JOIN "base_master" bm ON b.base_id = bm.id
           LEFT JOIN "production_templates" pt ON b.template_id = pt.id
           WHERE b.id IN (${batchIds.map(id => `'${id}'`).join(',')})`
        );
        for (const r of rows) {
          extraDetails[r.id] = r;
        }
      }

      const formatted = batches.map(b => {
        const extra = extraDetails[b.id] || {};
        return {
          id: b.id,
          referenceNo: b.referenceNo,
          batchNo: b.batchNo || b.referenceNo,
          productionType: b.productionType,
          startDate: b.startDate,
          completeDate: b.completeDate,
          status: b.status,
          quantity: Number(b.quantity),
          actualOutput: b.actualOutput ? Number(b.actualOutput) : null,
          totalCost: Number(extra.grand_total || b.totalCost || 0),
          subTotal: Number(extra.sub_total || 0),
          wastageAmt: Number(extra.wastage_amt || 0),
          overheadAmt: Number(extra.overhead_amt || 0),
          costPerUnit: Number(extra.cost_per_unit || (b.quantity > 0 ? (b.totalCost / b.quantity) : 0)),
          product: b.product,
          order: b.order,
          creator: b.creator,
          baseName: extra.base_name || 'Ice Cream Base',
          templateName: extra.template_name || 'Standard Formula',
          shift: extra.shift || 'General',
          machineLine: extra.machine_line || 'Main Line',
          adjustmentReason: extra.adjustment_reason || null,
          adjustmentReference: extra.adjustment_reference || null,
          rawMaterialsCount: b.rmUsages?.length || 0,
          rmUsages: b.rmUsages || [],
          createdAt: b.createdAt
        };
      });

      res.json({
        batches: formatted,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/production/batches
  async createBatch(req, res, next) {
    try {
      const schema = z.object({
        productionType: z.enum(['STANDARD', 'ORDER_BASED', 'STOCK_UPDATE']).default('STANDARD'),
        baseId: z.string().uuid().optional().nullable(),
        templateId: z.string().uuid().optional().nullable(),
        productId: z.string().optional().nullable(),
        selectedProducts: z.array(z.object({
          productId: z.string().optional().nullable(),
          id: z.string().optional().nullable(),
          name: z.string().optional().nullable(),
          code: z.string().optional().nullable(),
          plannedQty: z.coerce.number().min(0).default(0),
          factor: z.coerce.number().default(1.0),
          unit: z.string().optional().nullable()
        })).optional().default([]),
        orderId: z.string().uuid().optional().nullable(),
        quantity: z.coerce.number().default(0),
        startDate: z.string().default(() => new Date().toISOString()),
        shift: z.string().optional().default('Morning'),
        machineLine: z.string().optional().default('Line 1'),
        adjustmentReason: z.string().optional().nullable(),
        adjustmentReference: z.string().optional().nullable(),
        expiryDays: z.coerce.number().default(365),
        note: z.string().optional().nullable(),
        status: z.string().default('Draft'),
        
        // Costing totals
        subTotal: z.coerce.number().optional().default(0),
        wastageAmt: z.coerce.number().optional().default(0),
        overheadAmt: z.coerce.number().optional().default(0),
        grandTotal: z.coerce.number().optional().default(0),
        costPerUnit: z.coerce.number().optional().default(0),

        // Raw material lines with batch allocations
        rawMaterials: z.array(z.object({
          rmId: z.string().optional().nullable(),
          rmCode: z.string().optional().nullable(),
          rmName: z.string().optional().nullable(),
          requiredQty: z.coerce.number().min(0).default(0),
          baseRequiredQty: z.coerce.number().optional().nullable(),
          altRequiredQty: z.coerce.number().optional().nullable(),
          selectedUom: z.string().optional().nullable().default('Kg'),
          baseUom: z.string().optional().nullable(),
          alternateUom: z.string().optional().nullable(),
          unitRate: z.coerce.number().min(0).default(0),
          baseRate: z.coerce.number().optional().nullable(),
          altRate: z.coerce.number().optional().nullable(),
          totalCost: z.coerce.number().default(0),
          rateSource: z.string().optional().default('PO_LATEST'),
          isOverhead: z.boolean().optional().default(false),
          hasAlternateUom: z.boolean().optional().default(false),
          activeEntryMode: z.string().optional().default('BASE'),
          allocatedBatches: z.array(z.object({
            batchId: z.string().optional().nullable(),
            lotNumber: z.string().optional().nullable(),
            supplierBatchNo: z.string().optional().nullable(),
            mfgBatchNo: z.string().optional().nullable(),
            batchQty: z.coerce.number().optional().nullable(),
            weight: z.string().optional().nullable(),
            mfgDate: z.any().optional().nullable(),
            expiryDate: z.any().optional().nullable(),
            grnNumber: z.string().optional().nullable(),
            poNumber: z.string().optional().nullable(),
            supplierName: z.string().optional().nullable(),
            allocatedQty: z.coerce.number().min(0).default(0),
            availableQty: z.coerce.number().optional().nullable(),
            poOriginalQty: z.coerce.number().optional().nullable(),
            poTotalAmount: z.coerce.number().optional().nullable(),
            allocatedAmount: z.coerce.number().optional().default(0),
            unitRate: z.coerce.number().optional().default(0),
            uom: z.string().optional().nullable(),
            isManualOverride: z.boolean().optional().default(false)
          })).optional().default([])
        })).min(1, 'At least one raw material line is required')
      });

      const data = schema.parse(req.body);

      // Validation for Order-Based
      if (data.productionType === 'ORDER_BASED' && !data.orderId) {
        return res.status(400).json({ error: 'Order Based Production requires a valid Sales Order link (orderId).' });
      }

      // Validation for Stock-Update
      if (data.productionType === 'STOCK_UPDATE' && !data.adjustmentReason) {
        return res.status(400).json({ error: 'Stock Update Production requires an adjustment reason.' });
      }

      const createdBatch = await prisma.$transaction(async (tx) => {
        const referenceNo = await generateBatchReference(tx);
        const batchNo = `BN-${referenceNo.replace('MP-', '')}`;
        const expDate = new Date(new Date(data.startDate).getTime() + (data.expiryDays || 365) * 24 * 60 * 60 * 1000);

        const effectiveProductId = data.productId || data.selectedProducts?.[0]?.productId || data.selectedProducts?.[0]?.id;
        let finalBatchProductId = effectiveProductId;
        if (!finalBatchProductId) {
          const fallbackProd = await tx.finishedProduct.findFirst();
          finalBatchProductId = fallbackProd?.id;
        }

        const batchStatus = (data.status === 'Draft' || data.status === 'PLANNED') ? 'Planned' : data.status;

        // 1. Create main ProductionBatchNew record
        const batch = await tx.productionBatchNew.create({
          data: {
            referenceNo,
            productId: finalBatchProductId,
            productionType: data.productionType,
            status: batchStatus,
            startDate: new Date(data.startDate),
            batchNo,
            expiryDays: data.expiryDays || 365,
            expiryDate: expDate,
            quantity: data.quantity || 1,
            remainingQty: data.quantity || 1,
            totalCost: data.grandTotal || 0,
            note: data.note || null,
            orderId: data.orderId || null,
            createdBy: req.user.id
          }
        });

        // 2. Update extended columns in production_batches
        await tx.$executeRawUnsafe(
          `UPDATE "production_batches" SET
            base_id = $1::uuid,
            template_id = $2::uuid,
            shift = $3,
            machine_line = $4,
            adjustment_reason = $5,
            adjustment_reference = $6,
            sub_total = $7,
            wastage_amt = $8,
            overhead_amt = $9,
            grand_total = $10,
            cost_per_unit = $11,
            approval_status = $12
          WHERE id = $13`,
          data.baseId || null,
          data.templateId || null,
          data.shift || null,
          data.machineLine || null,
          data.adjustmentReason || null,
          data.adjustmentReference || null,
          data.subTotal || 0,
          data.wastageAmt || 0,
          data.overheadAmt || 0,
          data.grandTotal || 0,
          data.costPerUnit || 0,
          data.status,
          batch.id
        );

        // 3. Insert Multi-Product Items
        const productsToInsert = Array.isArray(data.selectedProducts) && data.selectedProducts.length > 0
          ? data.selectedProducts.map(p => ({
              productId: p.productId || p.id || finalBatchProductId,
              plannedQty: Number(p.plannedQty || data.quantity || 1),
              factor: Number(p.factor || 1.0)
            }))
          : [{ productId: finalBatchProductId, plannedQty: Number(data.quantity || 1), factor: 1.0 }];

        for (const p of productsToInsert) {
          if (!p.productId) continue;
          await tx.$executeRawUnsafe(
            `INSERT INTO "production_batch_items" (
              batch_id, product_id, planned_qty, factor, cost_per_unit
            ) VALUES ($1, $2, $3, $4, $5)`,
            batch.id,
            p.productId,
            p.plannedQty,
            p.factor || 1.0,
            data.costPerUnit || 0
          );
        }

        // 4. Insert Raw Material Usage Lines & Lot Allocations
        for (const rm of data.rawMaterials) {
          // Overheads (Gas, EB, Rent, etc.) are tracked in overhead_amt, not as warehouse inventory items
          if (rm.isOverhead) continue;

          // Resolve rm.rmId to a valid RawMaterial UUID
          let finalRmId = null;
          const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

          if (isUuid(rm.rmId)) {
            const existing = await tx.rawMaterial.findUnique({ where: { id: rm.rmId } });
            if (existing) finalRmId = existing.id;
          }

          if (!finalRmId && rm.rmId) {
            const byCode = await tx.rawMaterial.findFirst({
              where: {
                OR: [
                  { code: { equals: rm.rmId, mode: 'insensitive' } },
                  { id: rm.rmId }
                ]
              }
            });
            if (byCode) finalRmId = byCode.id;
          }

          if (!finalRmId && rm.rmName) {
            const cleanName = rm.rmName.trim();
            const byName = await tx.rawMaterial.findFirst({
              where: {
                OR: [
                  { name: { equals: cleanName, mode: 'insensitive' } },
                  { name: { contains: cleanName, mode: 'insensitive' } }
                ]
              }
            });
            if (byName) finalRmId = byName.id;
          }

          // If still not matched, create a fallback active raw material record so FK is satisfied
          if (!finalRmId) {
            const defaultCat = await tx.rMCategory.findFirst();
            const fallbackCode = `RM-${Date.now().toString().slice(-6)}`;
            const created = await tx.rawMaterial.create({
              data: {
                name: rm.rmName || 'Raw Material',
                code: fallbackCode,
                categoryId: defaultCat?.id,
                currentStock: 0,
                ratePerUnit: rm.unitRate || 0,
                unitId: rm.selectedUom || 'Kg',
                consumptionUnit: rm.selectedUom || 'Kg'
              }
            });
            finalRmId = created.id;
          }

          const firstAlloc = rm.allocatedBatches?.[0];
          const combinedBatchSummary = rm.allocatedBatches?.length > 1
            ? rm.allocatedBatches.map(b => `${b.lotNumber} (${b.allocatedQty} ${rm.selectedUom})`).join(' + ')
            : firstAlloc?.lotNumber || null;

          const usage = await tx.productionBatchRMUsage.create({
            data: {
              batchId: batch.id,
              rmId: finalRmId,
              requiredQty: rm.requiredQty,
              availableQtyAtTime: rm.requiredQty,
              actualUsedQty: rm.requiredQty,
              unitCost: rm.unitRate,
              totalCost: rm.totalCost,
              selectedUom: rm.selectedUom,
              inputQty: rm.requiredQty,
              allocatedBatchId: firstAlloc?.batchId || null,
              internalBatchNo: combinedBatchSummary
            }
          });

          // Insert granular batch allocations with proportional PO division
          if (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0) {
            for (const alloc of rm.allocatedBatches) {
              let targetBatchId = alloc.batchId;

              // If manual override lot or warehouse lot not yet in InventoryBatch, persist to InventoryBatch
              const isManualOrOpening = !targetBatchId || targetBatchId.startsWith('manual-') || targetBatchId.startsWith('wh-') || alloc.isManualOverride;
              if (isManualOrOpening) {
                const batchNum = alloc.lotNumber || `BATCH-MANUAL-${Date.now().toString().slice(-6)}`;
                const existingLot = await tx.inventoryBatch.findFirst({
                  where: {
                    rawMaterialId: finalRmId,
                    batchNumber: batchNum
                  }
                });

                if (existingLot) {
                  targetBatchId = existingLot.id;
                } else {
                  const mDate = alloc.mfgDate ? new Date(alloc.mfgDate) : new Date();
                  const eDate = alloc.expiryDate ? new Date(alloc.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
                  const initialStock = Number(alloc.availableQty || alloc.allocatedQty || 100);

                  const newLot = await tx.inventoryBatch.create({
                    data: {
                      rawMaterialId: finalRmId,
                      batchNumber: batchNum,
                      supplierBatchNo: alloc.supplierBatchNo || alloc.mfgBatchNo || 'BATCH-01',
                      mfgBatchNo: alloc.mfgBatchNo || alloc.supplierBatchNo || 'BATCH-01',
                      mfgDate: mDate,
                      expiryDate: eDate,
                      initialQty: initialStock,
                      netQty: initialStock,
                      weight: alloc.weight || '25 kg / 50',
                      grnNumber: alloc.grnNumber || 'GRN-OPENING',
                      poNumber: alloc.poNumber || 'Manual Override',
                      storageLocation: 'Primary Warehouse',
                      status: 'AVAILABLE'
                    }
                  });
                  targetBatchId = newLot.id;

                  // Update raw material current stock so RM Stock page updates
                  await tx.rawMaterial.update({
                    where: { id: finalRmId },
                    data: {
                      currentStock: { increment: initialStock }
                    }
                  });
                }
              }

              const poOrigQty = Number(alloc.poOriginalQty || alloc.allocatedQty || 1);
              const poTotAmt = Number(alloc.poTotalAmount || (alloc.allocatedQty * alloc.unitRate));
              // Proportional math: (allocated / original) * total
              const propFactor = poOrigQty > 0 ? (Number(alloc.allocatedQty) / poOrigQty) : 1;
              const propAmount = Number((poTotAmt * propFactor).toFixed(2));

              await tx.$executeRawUnsafe(
                `INSERT INTO "production_batch_allocations" (
                  batch_id, usage_id, inventory_batch_id, lot_number,
                  allocated_qty, po_original_qty, po_total_amount,
                  allocated_amount, unit_rate, uom
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                batch.id,
                usage.id,
                targetBatchId,
                alloc.lotNumber || 'WAREHOUSE-LOT',
                alloc.allocatedQty,
                poOrigQty,
                poTotAmt,
                propAmount,
                alloc.unitRate || rm.unitRate,
                alloc.uom || rm.selectedUom
              );
            }
          }
        }

        // 5. If STOCK_UPDATE and status is Approved/Completed, apply immediate inventory adjustments
        if (data.productionType === 'STOCK_UPDATE' && (data.status === 'Approved' || data.status === 'Completed')) {
          await tx.finishedProduct.update({
            where: { id: finalBatchProductId },
            data: {
              currentStock: { increment: data.quantity }
            }
          });

          for (const rm of data.rawMaterials) {
            for (const alloc of (rm.allocatedBatches || [])) {
              if (alloc.batchId && !alloc.batchId.startsWith('wh-')) {
                await tx.inventoryBatch.updateMany({
                  where: { id: alloc.batchId, netQty: { gte: alloc.allocatedQty } },
                  data: {
                    netQty: { decrement: alloc.allocatedQty }
                  }
                });
              }
            }
          }
        }

        return batch;
      });

      res.status(201).json(createdBatch);
    } catch (err) {
      console.error('CREATE BATCH ERROR:', err);
      if (err instanceof z.ZodError) {
        const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || 'Validation error';
        return res.status(400).json({ error: msg, details: err.issues || err.errors });
      }
      next(err);
    }
  }

  // PATCH /api/production/batches-redesign/:id/status
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, actualOutput, rmUsages, note } = req.body;

      const batch = await prisma.productionBatchNew.findUnique({
        where: { id },
        include: {
          rmUsages: true
        }
      });
      if (!batch) return res.status(404).json({ error: 'Production batch not found' });

      const finalYield = actualOutput !== undefined && actualOutput !== null ? Number(actualOutput) : Number(batch.quantity);

      const result = await prisma.$transaction(async (tx) => {
        const updateData = {
          status,
          ...(status === 'Completed' ? {
            completeDate: new Date(),
            actualOutput: finalYield,
            remainingQty: finalYield
          } : {})
        };

        const updated = await tx.productionBatchNew.update({
          where: { id },
          data: updateData
        });

        // Update approval status & actual yield in extended table
        await tx.$executeRawUnsafe(
          `UPDATE "production_batches" SET 
            approval_status = $1,
            actual_output = $2
          WHERE id = $3`,
          status,
          finalYield,
          id
        );

        // When completing production: Reduce RM Stock and increment Finished Goods stock
        if (status === 'Completed') {
          // 1. Increment Finished Product stock by actual yield
          if (batch.productId) {
            await tx.finishedProduct.update({
              where: { id: batch.productId },
              data: {
                currentStock: { increment: finalYield }
              }
            });
          }

          // 2. Reduce consumed quantities from Raw Material Stock and allocated inventory batches
          for (const usage of batch.rmUsages) {
            const customRm = Array.isArray(rmUsages) ? rmUsages.find(r => r.rmId === usage.rmId) : null;
            const consumedQty = customRm?.actualUsedQty !== undefined 
              ? Number(customRm.actualUsedQty) 
              : Number(usage.actualUsedQty || usage.requiredQty || 0);

            // Update usage record with actual used quantity
            await tx.productionBatchRMUsage.update({
              where: { id: usage.id },
              data: { actualUsedQty: consumedQty }
            });

            // Decrement from RawMaterial currentStock
            if (usage.rmId && consumedQty > 0) {
              await tx.rawMaterial.update({
                where: { id: usage.rmId },
                data: {
                  currentStock: { decrement: consumedQty }
                }
              });
            }

            // Decrement from InventoryBatch lots allocated to this usage
            const allocations = await tx.$queryRawUnsafe(
              `SELECT inventory_batch_id, allocated_qty FROM "production_batch_allocations" WHERE usage_id = $1`,
              usage.id
            );

            for (const alloc of allocations) {
              if (alloc.inventory_batch_id && Number(alloc.allocated_qty) > 0) {
                await tx.inventoryBatch.updateMany({
                  where: { id: alloc.inventory_batch_id },
                  data: {
                    netQty: { decrement: Number(alloc.allocated_qty) }
                  }
                });
              }
            }
          }
        }

        return updated;
      });

      res.json({
        message: status === 'Completed' ? 'Production completed and stock successfully updated' : `Batch status updated to ${status}`,
        batch: result,
        actualYield: finalYield
      });
    } catch (err) {
      console.error('Update batch status error:', err);
      next(err);
    }
  }
}

module.exports = new ProductionBatchRedesignController();
