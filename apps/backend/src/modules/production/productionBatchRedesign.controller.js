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
                  b.started_by, b.started_at, b.pause_history, b.sop_guide, b.timeline_stages,
                  b.pause_reason, b.cancelled_reason, b.cancelled_by, b.cancelled_at,
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
          startedBy: extra.started_by || (b.status === 'In Progress' || b.status === 'Completed' ? (b.creator?.name || 'Production Staff') : null),
          startedAt: extra.started_at || (b.status === 'In Progress' || b.status === 'Completed' ? b.startDate : null),
          pauseHistory: Array.isArray(extra.pause_history) ? extra.pause_history : (typeof extra.pause_history === 'string' ? JSON.parse(extra.pause_history || '[]') : []),
          sopGuide: extra.sop_guide || null,
          timelineStages: Array.isArray(extra.timeline_stages) ? extra.timeline_stages : (typeof extra.timeline_stages === 'string' ? JSON.parse(extra.timeline_stages || '[]') : []),
          pauseReason: extra.pause_reason || null,
          cancelledReason: extra.cancelled_reason || null,
          cancelledBy: extra.cancelled_by || null,
          cancelledAt: extra.cancelled_at || null,
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

  // GET /api/production/batches-redesign/:id
  async getBatchById(req, res, next) {
    try {
      const { id } = req.params;
      const batch = await prisma.productionBatchNew.findUnique({
        where: { id },
        include: {
          product: { include: { unit: true, category: true, subcategory: true } },
          order: { include: { customer: true } },
          creator: { select: { id: true, name: true, email: true } },
          rmUsages: {
            include: {
              rawMaterial: { include: { category: true } }
            }
          }
        }
      });
      if (!batch) return res.status(404).json({ error: 'Production batch not found' });

      // Fetch extended details
      const rows = await prisma.$queryRawUnsafe(
        `SELECT b.id, b.base_id, b.template_id, b.shift, b.machine_line,
                b.adjustment_reason, b.adjustment_reference,
                b.sub_total, b.wastage_amt, b.overhead_amt, b.grand_total, b.cost_per_unit,
                b.started_by, b.started_at, b.pause_history, b.sop_guide, b.timeline_stages,
                b.pause_reason, b.cancelled_reason, b.cancelled_by, b.cancelled_at,
                bm.name as base_name, pt.name as template_name
         FROM "production_batches" b
         LEFT JOIN "base_master" bm ON b.base_id = bm.id
         LEFT JOIN "production_templates" pt ON b.template_id = pt.id
         WHERE b.id = $1`,
        id
      );
      const extra = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};

      // Fetch allocations for raw materials
      let allocations = [];
      try {
        allocations = await prisma.$queryRawUnsafe(
          `SELECT * FROM "production_batch_allocations" WHERE batch_id = $1`,
          id
        );
      } catch (e) {
        allocations = [];
      }

      // Compute per-piece ratios
      const batchQty = Number(batch.quantity || 1);
      const actualYield = batch.actualOutput ? Number(batch.actualOutput) : null;

      const enrichedUsages = (batch.rmUsages || []).map(u => {
        const reqQty = Number(u.requiredQty || 0);
        const actQty = u.actualUsedQty !== null ? Number(u.actualUsedQty) : null;
        const allocs = (allocations || []).filter(a => a.usage_id === u.id);
        return {
          ...u,
          requiredQty: reqQty,
          actualUsedQty: actQty,
          perPieceQty: batchQty > 0 ? Number((reqQty / batchQty).toFixed(6)) : 0,
          actualPerPieceQty: actualYield && actualYield > 0 && actQty !== null ? Number((actQty / actualYield).toFixed(6)) : null,
          allocations: allocs
        };
      });

      res.json({
        id: batch.id,
        referenceNo: batch.referenceNo,
        batchNo: batch.batchNo || batch.referenceNo,
        productionType: batch.productionType,
        startDate: batch.startDate,
        completeDate: batch.completeDate,
        status: batch.status,
        quantity: Number(batch.quantity),
        actualOutput: actualYield,
        productUom: batch.product?.unit?.abbreviation || batch.product?.unit?.name || 'pcs',
        totalCost: Number(extra.grand_total || batch.totalCost || 0),
        subTotal: Number(extra.sub_total || 0),
        wastageAmt: Number(extra.wastage_amt || 0),
        overheadAmt: Number(extra.overhead_amt || 0),
        costPerUnit: Number(extra.cost_per_unit || (batchQty > 0 ? (Number(extra.grand_total || batch.totalCost || 0) / batchQty) : 0)),
        product: batch.product,
        order: batch.order,
        creator: batch.creator,
        baseName: extra.base_name || 'Ice Cream Base',
        templateName: extra.template_name || 'Standard Formula',
        shift: extra.shift || 'General',
        machineLine: extra.machine_line || 'Main Line',
        startedBy: extra.started_by || (batch.status === 'In Progress' || batch.status === 'Completed' ? (batch.creator?.name || 'Production Staff') : null),
        startedAt: extra.started_at || (batch.status === 'In Progress' || batch.status === 'Completed' ? batch.startDate : null),
        pauseHistory: Array.isArray(extra.pause_history) ? extra.pause_history : (typeof extra.pause_history === 'string' ? JSON.parse(extra.pause_history || '[]') : []),
        sopGuide: extra.sop_guide || null,
        timelineStages: Array.isArray(extra.timeline_stages) ? extra.timeline_stages : (typeof extra.timeline_stages === 'string' ? JSON.parse(extra.timeline_stages || '[]') : []),
        pauseReason: extra.pause_reason || null,
        cancelledReason: extra.cancelled_reason || null,
        cancelledBy: extra.cancelled_by || null,
        cancelledAt: extra.cancelled_at || null,
        rmUsages: enrichedUsages,
        createdAt: batch.createdAt
      });
    } catch (err) {
      console.error('Get batch by ID error:', err);
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
        const defaultUser = await tx.user.findFirst();
        const safeUserId = req.user?.id || defaultUser?.id;

        const batch = await tx.productionBatchNew.create({
          data: {
            referenceNo,
            productId: finalBatchProductId,
            productionType: data.productionType,
            status: batchStatus,
            startDate: new Date(data.startDate),
            batchNo,
            expiryDays: parseInt(data.expiryDays, 10) || 365,
            expiryDate: expDate,
            quantity: Number(data.quantity || 1),
            remainingQty: Number(data.quantity || 1),
            totalCost: Number(data.grandTotal || 0),
            note: data.note || null,
            orderId: data.orderId || null,
            createdBy: safeUserId
          }
        });

        // 2. Update extended columns in production_batches
        const startedAtVal = data.status === 'In Progress' ? new Date() : null;
        const startedByVal = data.status === 'In Progress' ? (req.user?.name || req.user?.email || 'Supervisor') : null;
        const stagesJson = JSON.stringify(data.timelineStages || []);

        const safeUuid = (val) => (typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) ? val : null;

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
            approval_status = $12,
            timeline_stages = $13::jsonb,
            started_at = $14,
            started_by = $15
          WHERE id = $16`,
          safeUuid(data.baseId),
          safeUuid(data.templateId),
          data.shift || null,
          data.machineLine || null,
          data.adjustmentReason || null,
          data.adjustmentReference || null,
          Number(data.subTotal || 0),
          Number(data.wastageAmt || 0),
          Number(data.overheadAmt || 0),
          Number(data.grandTotal || 0),
          Number(data.costPerUnit || 0),
          data.status,
          stagesJson,
          startedAtVal,
          startedByVal,
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
            Number(p.plannedQty || 1),
            Number(p.factor || 1.0),
            Number(data.costPerUnit || 0)
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

          let rmRecord = null;
          // If still not matched, create a fallback active raw material record so FK is satisfied
          if (!finalRmId) {
            let defaultCat = await tx.rMCategory.findFirst();
            if (!defaultCat) {
              defaultCat = await tx.rMCategory.create({
                data: { name: 'Raw Materials', code: 'CAT-DEFAULT' }
              });
            }
            const fallbackCode = `RM-${Date.now().toString().slice(-6)}`;
            const created = await tx.rawMaterial.create({
              data: {
                name: rm.rmName || 'Raw Material',
                code: fallbackCode,
                categoryId: defaultCat.id,
                currentStock: 0,
                ratePerUnit: Number(rm.unitRate || 0),
                unitId: rm.selectedUom || 'Kg',
                consumptionUnit: rm.selectedUom || 'Kg'
              }
            });
            finalRmId = created.id;
            rmRecord = created;
          } else {
            rmRecord = await tx.rawMaterial.findUnique({
              where: { id: finalRmId },
              include: { category: true }
            });
          }

          const firstAlloc = rm.allocatedBatches?.[0];
          const combinedBatchSummary = rm.allocatedBatches?.length > 1
            ? rm.allocatedBatches.map(b => `${b.lotNumber} (${b.allocatedQty} ${rm.selectedUom})`).join(' + ')
            : firstAlloc?.lotNumber || null;

          const usage = await tx.productionBatchRMUsage.create({
            data: {
              batchId: batch.id,
              rmId: finalRmId,
              requiredQty: Number(rm.requiredQty || rm.inputQty || 0),
              availableQtyAtTime: Number(rm.availableQtyAtTime || rm.requiredQty || 0),
              actualUsedQty: Number(rm.actualUsedQty || rm.requiredQty || 0),
              unitCost: Number(rm.unitRate || 0),
              totalCost: Number(rm.totalCost || 0),
              selectedUom: rm.selectedUom || rmRecord?.unitId || 'Kg',
              inputQty: Number(rm.inputQty || rm.requiredQty || 0),
              allocatedBatchId: firstAlloc?.batchId || null,
              internalBatchNo: combinedBatchSummary
            }
          });

          // Insert granular batch allocations with proportional PO division
          if (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0) {
            for (const alloc of rm.allocatedBatches) {
              let targetBatchId = alloc.batchId;

              // Check if lot exists in InventoryBatch or needs auto-creation
              const batchNum = alloc.lotNumber || `BATCH-MANUAL-${Date.now().toString().slice(-6)}`;
              let existingLot = null;

              if (targetBatchId && isUuid(targetBatchId)) {
                existingLot = await tx.inventoryBatch.findUnique({ where: { id: targetBatchId } });
              }
              if (!existingLot && batchNum) {
                existingLot = await tx.inventoryBatch.findFirst({
                  where: {
                    rawMaterialId: finalRmId,
                    batchNumber: batchNum
                  }
                });
              }

              if (existingLot) {
                targetBatchId = existingLot.id;
              } else {
                // Determine if we need to auto-persist lot so warehouse inventory tracking has it
                const isManualOrOpening = !targetBatchId || targetBatchId.startsWith('manual-') || targetBatchId.startsWith('wh-') || alloc.isManualOverride;
                if (isManualOrOpening) {
                  const defaultUom = await tx.uOM.findFirst({ where: { isActive: true } });
                  let resolvedUomId = rmRecord?.unitId;
                  if (!resolvedUomId || !isUuid(resolvedUomId)) {
                    const matchUom = await tx.uOM.findFirst({
                      where: {
                        OR: [
                          { abbreviation: { equals: alloc.uom || rm.selectedUom || 'Kg', mode: 'insensitive' } },
                          { name: { equals: alloc.uom || rm.selectedUom || 'Kg', mode: 'insensitive' } }
                        ]
                      }
                    });
                    resolvedUomId = matchUom?.id || defaultUom?.id;
                  }

                  const initialStock = Number(alloc.availableQty || alloc.allocatedQty || 100);
                  const mDate = alloc.mfgDate ? new Date(alloc.mfgDate) : new Date();
                  const eDate = alloc.expiryDate ? new Date(alloc.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

                  let uniqueBatchNum = batchNum;
                  let counter = 1;
                  while (await tx.inventoryBatch.findUnique({ where: { batchNumber: uniqueBatchNum } })) {
                    uniqueBatchNum = `${batchNum}-${counter++}`;
                  }

                  try {
                    const newLot = await tx.inventoryBatch.create({
                      data: {
                        batchNumber: uniqueBatchNum,
                        rawMaterialId: finalRmId,
                        rawMaterialName: rmRecord?.name || rm.rmName || 'Raw Material',
                        rmCategory: rmRecord?.category?.name || null,
                        receivedQty: initialStock,
                        sampleQty: 0,
                        netQty: initialStock,
                        wastedQty: 0,
                        uomId: resolvedUomId,
                        storageLocation: alloc.storageLocation || 'Primary Warehouse',
                        mfgDate: mDate,
                        expiryDate: eDate,
                        weight: alloc.weight || '25 kg / 50',
                        mfgBatchNo: alloc.mfgBatchNo || alloc.supplierBatchNo || 'BATCH-01',
                        status: 'AVAILABLE',
                        addedBy: safeUserId
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
                  } catch (lotErr) {
                    console.warn('InventoryBatch auto-create warning (non-fatal):', lotErr.message);
                    targetBatchId = targetBatchId || alloc.lotNumber || `MANUAL-${Date.now()}`;
                  }
                }
              }

              const poOrigQty = Number(alloc.poOriginalQty || alloc.allocatedQty || 1);
              const poTotAmt = Number(alloc.poTotalAmount || (Number(alloc.allocatedQty || 0) * Number(alloc.unitRate || rm.unitRate || 0)));
              // Proportional math: (allocated / original) * total
              const propFactor = poOrigQty > 0 ? (Number(alloc.allocatedQty || 0) / poOrigQty) : 1;
              const propAmount = Number((poTotAmt * propFactor).toFixed(2));

              await tx.$executeRawUnsafe(
                `INSERT INTO "production_batch_allocations" (
                  batch_id, usage_id, inventory_batch_id, lot_number,
                  allocated_qty, po_original_qty, po_total_amount,
                  allocated_amount, unit_rate, uom
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                batch.id,
                usage.id,
                targetBatchId ? String(targetBatchId) : null,
                alloc.lotNumber || 'WAREHOUSE-LOT',
                Number(alloc.allocatedQty || 0),
                poOrigQty,
                poTotAmt,
                propAmount,
                Number(alloc.unitRate || rm.unitRate || 0),
                alloc.uom || rm.selectedUom || 'Kg'
              );
            }
          }
        }

        // 5. If STOCK_UPDATE and status is Approved/Completed, apply immediate inventory adjustments
        if (data.productionType === 'STOCK_UPDATE' && (data.status === 'Approved' || data.status === 'Completed')) {
          await tx.finishedProduct.update({
            where: { id: finalBatchProductId },
            data: {
              currentStock: { increment: Number(data.quantity || 1) }
            }
          });

          for (const rm of data.rawMaterials) {
            for (const alloc of (rm.allocatedBatches || [])) {
              if (alloc.batchId && !alloc.batchId.startsWith('wh-')) {
                try {
                  await tx.inventoryBatch.updateMany({
                    where: { id: alloc.batchId, netQty: { gte: Number(alloc.allocatedQty || 0) } },
                    data: {
                      netQty: { decrement: Number(alloc.allocatedQty || 0) }
                    }
                  });
                } catch (e) {
                  console.warn('InventoryBatch stock update decrement error:', e.message);
                }
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
      return res.status(500).json({
        error: err.message || 'Failed to create production batch',
        details: err.message
      });
    }
  }

  // PATCH /api/production/batches-redesign/:id/status
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, actualOutput, rmUsages, note, reason } = req.body;
      const userIdentifier = req.user?.name || req.user?.email || 'Floor Supervisor';

      const batch = await prisma.productionBatchNew.findUnique({
        where: { id },
        include: {
          rmUsages: true,
          product: { include: { unit: true } }
        }
      });
      if (!batch) return res.status(404).json({ error: 'Production batch not found' });

      // Load existing pause history from extended production_batches table
      const batchRows = await prisma.$queryRawUnsafe(
        `SELECT started_at, started_by, pause_history, pause_reason, timeline_stages FROM "production_batches" WHERE id = $1`,
        id
      );
      const batchExtra = Array.isArray(batchRows) && batchRows.length > 0 ? batchRows[0] : {};
      let pauseHistory = [];
      try {
        pauseHistory = Array.isArray(batchExtra.pause_history)
          ? batchExtra.pause_history
          : JSON.parse(batchExtra.pause_history || '[]');
      } catch (e) {
        pauseHistory = [];
      }

      let startedAt = batchExtra.started_at;
      let startedBy = batchExtra.started_by;
      let pauseReason = batchExtra.pause_reason;

      // Handle lifecycle state transitions
      if (status === 'In Progress') {
        if (!startedAt || batch.status === 'Planned' || batch.status === 'Draft') {
          startedAt = new Date();
          startedBy = userIdentifier;
        } else if (batch.status === 'Paused') {
          // Resumed from pause
          const openIdx = pauseHistory.findIndex(p => !p.resumedAt);
          if (openIdx !== -1) {
            const pausedAtDate = new Date(pauseHistory[openIdx].pausedAt);
            const now = new Date();
            const durMs = now - pausedAtDate;
            pauseHistory[openIdx].resumedAt = now.toISOString();
            pauseHistory[openIdx].resumedBy = userIdentifier;
            pauseHistory[openIdx].durationMins = Math.max(1, Math.round(durMs / (1000 * 60)));
          }
          pauseReason = null;
        }
      } else if (status === 'Paused') {
        pauseReason = note || reason || 'Production floor paused';
        pauseHistory.push({
          pausedAt: new Date().toISOString(),
          pausedBy: userIdentifier,
          reason: pauseReason
        });
      } else if (status === 'Cancelled') {
        pauseReason = null;
      }

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

        // Update approval status, actual yield, pause history, timestamps in extended table
        await tx.$executeRawUnsafe(
          `UPDATE "production_batches" SET 
            approval_status = $1,
            actual_output = $2,
            started_at = $3,
            started_by = $4,
            pause_history = $5::jsonb,
            pause_reason = $6,
            cancelled_at = $7,
            cancelled_by = $8,
            cancelled_reason = $9
          WHERE id = $10`,
          status,
          finalYield,
          startedAt,
          startedBy,
          JSON.stringify(pauseHistory),
          pauseReason,
          status === 'Cancelled' ? new Date() : null,
          status === 'Cancelled' ? userIdentifier : null,
          status === 'Cancelled' ? (note || reason || 'Cancelled') : null,
          id
        );

        // When completing production: Reduce RM Stock and increment Finished Goods stock
        if (status === 'Completed') {
          // 1. Increment Finished Product stock by actual yield (with Product UOM)
          if (batch.productId) {
            await tx.finishedProduct.update({
              where: { id: batch.productId },
              data: {
                currentStock: { increment: finalYield }
              }
            });
          }

          // 2. Reduce consumed quantities from Raw Material Stock and allocated inventory batches
          const latestRatios = [];

          for (const usage of batch.rmUsages) {
            const customRm = Array.isArray(rmUsages) ? rmUsages.find(r => r.rmId === usage.rmId) : null;
            const consumedQty = customRm?.actualUsedQty !== undefined 
              ? Number(customRm.actualUsedQty) 
              : Number(usage.actualUsedQty || usage.requiredQty || 0);

            // Compute per-piece consumption ratio (consumption per single unit)
            const singlePieceRatio = finalYield > 0 ? Number((consumedQty / finalYield).toFixed(6)) : 0;
            latestRatios.push({
              rmId: usage.rmId,
              consumedQty,
              singlePieceRatio
            });

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
                try {
                  await tx.inventoryBatch.updateMany({
                    where: { id: alloc.inventory_batch_id },
                    data: {
                      netQty: { decrement: Number(alloc.allocated_qty) }
                    }
                  });
                } catch (allocErr) {
                  console.warn('InventoryBatch decrement warning (non-fatal):', allocErr.message);
                }
              }
            }
          }

          // 3. Auto-learn & update product template with latest actual formulation ratio
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
                    latestActualYield: finalYield,
                    lastBatchReference: batch.referenceNo,
                    lastProductionDate: new Date().toISOString()
                  }
                }
              });
            } catch (err) {
              console.warn('Failed to auto-update product template ratio:', err.message);
            }
          }
        }

        return updated;
      });

      res.json({
        message: status === 'Completed' 
          ? `Production completed! Actual yield (${finalYield} ${batch.product?.unit?.abbreviation || 'pcs'}) added to product stock and raw material inventory reduced.`
          : `Batch status updated to ${status}`,
        batch: result,
        actualYield: finalYield,
        productUom: batch.product?.unit?.abbreviation || batch.product?.unit?.name || 'pcs'
      });
    } catch (err) {
      console.error('Update batch status error:', err);
      next(err);
    }
  }
}

module.exports = new ProductionBatchRedesignController();
