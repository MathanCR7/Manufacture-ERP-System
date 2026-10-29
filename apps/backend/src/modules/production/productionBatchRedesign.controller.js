const { randomUUID } = require('crypto');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const batchNumberService = require('./batchNumber.service');
const productionCompletionService = require('./productionCompletion.service');
const { getTaxSettingsData } = require('../setup/tax.controller');
const { ensureProductionBatchesRedesignSchema } = require('../../database/migrations/ensure_production_batches_redesign_schema');
const { generateReferenceNo } = require('../../utils/referenceGenerator');
const { getConversionFactor } = require('../../utils/uomConversion');

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Helper to analyze and parse production batch reference
// Format: PROD + year + month(10) + day(21) + - + sequence (e.g. PROD20261021-0001)
function analyzeProductionBatchNumber(batchStr, dateContext = null) {
  if (!batchStr || typeof batchStr !== 'string') return null;
  const trimmed = batchStr.trim();
  
  // Pattern 1: PROD + Year(4) + Month(2) + Day(2) + optional '-' + Sequence (e.g. PROD20261021-0001 or PROD202610210001)
  const prodMatch = trimmed.match(/^PROD(\d{4})(\d{2})(\d{2})(?:-(\d+)|\.(\d+)|_(\d+)|(\d{3,5}))?$/i);
  if (prodMatch) {
    const year = parseInt(prodMatch[1], 10);
    const month = parseInt(prodMatch[2], 10);
    const day = parseInt(prodMatch[3], 10);
    const seqStr = prodMatch[4] || prodMatch[5] || prodMatch[6] || prodMatch[7] || '1';
    const sequence = parseInt(seqStr, 10);
    const sequenceFormatted = String(sequence).padStart(4, '0');
    
    return {
      isValid: true,
      standardType: 'PROD_DATE_SEQUENCE',
      prefix: 'PROD',
      year,
      month,
      day,
      sequence,
      sequenceFormatted,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      formattedDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      formattedBatchNo: `PROD${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${sequenceFormatted}`,
      isLegacy: false
    };
  }

  // Pattern 2: Legacy MP-XXXXXX (e.g. MP-000009) -> Standardize into PRODYYYYMMDD-XXXX
  const mpMatch = trimmed.match(/^MP-(\d+)$/i);
  if (mpMatch) {
    const sequence = parseInt(mpMatch[1], 10);
    const sequenceFormatted = String(sequence).padStart(4, '0');
    const d = dateContext ? new Date(dateContext) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const year = validDate.getFullYear();
    const month = validDate.getMonth() + 1;
    const day = validDate.getDate();

    return {
      isValid: true,
      standardType: 'PROD_DATE_SEQUENCE',
      prefix: 'PROD',
      year,
      month,
      day,
      sequence,
      sequenceFormatted,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      formattedDate: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
      formattedBatchNo: `PROD${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}-${sequenceFormatted}`,
      isLegacy: false,
      legacyOriginal: trimmed
    };
  }

  return {
    isValid: false,
    standardType: 'CUSTOM',
    raw: trimmed
  };
}

// Helper to generate unique PRODYYYYMMDD-XXXX batch reference (e.g. PROD20261021-0001)
async function generateBatchReference(tx, inputDate = new Date()) {
  const d = inputDate ? new Date(inputDate) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  
  const year = validDate.getFullYear().toString();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const datePrefix = `PROD${year}${month}${day}`;
  const searchPattern = `${datePrefix}-%`;

  const result = await tx.$queryRaw`
    SELECT reference_no FROM production_batches 
    WHERE reference_no LIKE ${searchPattern}
    ORDER BY reference_no DESC 
    LIMIT 1 
    FOR UPDATE
  `;
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  let nextNumber = 1;
  if (lastRecord && lastRecord.reference_no) {
    const lastNumberStr = lastRecord.reference_no.replace(`${datePrefix}-`, '');
    const parsed = parseInt(lastNumberStr, 10);
    if (!isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  let candidate = `${datePrefix}-${String(nextNumber).padStart(4, '0')}`;
  while (true) {
    const existing = await tx.productionBatchNew.findUnique({
      where: { referenceNo: candidate },
      select: { id: true }
    });
    if (!existing) break;
    nextNumber++;
    candidate = `${datePrefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  return candidate;
}

// Reusable helper to match and insert Raw Material Usages & Granular Lot Allocations
async function insertBatchRMUsagesAndAllocations(tx, batchId, rawMaterials, safeUserId) {
  for (const rm of rawMaterials) {
    // Overheads (Gas, EB, Rent, etc.) are tracked in overhead_amt, not as warehouse inventory items
    if (rm.isOverhead) continue;

    let finalRmId = null;
    let rmRecord = null;
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    // 1. Direct ID match (check rm.rmId and rm.rawMaterialId)
    const candidateId = isUuid(rm.rmId) ? rm.rmId : (isUuid(rm.rawMaterialId) ? rm.rawMaterialId : null);
    if (candidateId) {
      const existing = await tx.rawMaterial.findUnique({
        where: { id: candidateId },
        include: { category: true }
      });
      if (existing) {
        finalRmId = existing.id;
        rmRecord = existing;
      }
    }

    // 2. Lookup by Code (rm.rmCode, rm.rawMaterialCode, rm.code, or string rm.rmId)
    if (!finalRmId) {
      const candidateCode = rm.rmCode || rm.rawMaterialCode || rm.code || (!isUuid(rm.rmId) ? rm.rmId : null);
      if (candidateCode && typeof candidateCode === 'string' && candidateCode.trim()) {
        const byCode = await tx.rawMaterial.findFirst({
          where: {
            code: { equals: candidateCode.trim(), mode: 'insensitive' }
          },
          include: { category: true }
        });
        if (byCode) {
          finalRmId = byCode.id;
          rmRecord = byCode;
        }
      }
    }

    // 3. Lookup by Allocated Warehouse Lot (InventoryBatch)
    if (!finalRmId && Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0) {
      for (const alloc of rm.allocatedBatches) {
        const lotNum = alloc.lotNumber || alloc.batchNumber || (!isUuid(alloc.batchId) ? alloc.batchId : null);
        const lotId = isUuid(alloc.batchId) ? alloc.batchId : null;
        
        const invLot = await tx.inventoryBatch.findFirst({
          where: {
            OR: [
              ...(lotId ? [{ id: lotId }] : []),
              ...(lotNum ? [{ batchNumber: lotNum }] : [])
            ]
          }
        });

        if (invLot?.rawMaterialId) {
          const byLotRM = await tx.rawMaterial.findUnique({
            where: { id: invLot.rawMaterialId },
            include: { category: true }
          });
          if (byLotRM) {
            finalRmId = byLotRM.id;
            rmRecord = byLotRM;
            break;
          }
        }
      }
    }

    // 4. Lookup by Name (exact or partial, ignoring generic 'Raw Material')
    if (!finalRmId) {
      const candidateName = rm.rmName || rm.rawMaterialName || rm.name;
      if (candidateName && typeof candidateName === 'string') {
        const cleanName = candidateName.trim();
        if (cleanName && cleanName.toLowerCase() !== 'raw material') {
          const byName = await tx.rawMaterial.findFirst({
            where: {
              OR: [
                { name: { equals: cleanName, mode: 'insensitive' } },
                { name: { contains: cleanName, mode: 'insensitive' } }
              ]
            },
            include: { category: true }
          });
          if (byName) {
            finalRmId = byName.id;
            rmRecord = byName;
          }
        }
      }
    }

    // If still not matched, throw clear error
    if (!finalRmId) {
      throw new Error(`Raw material "${rm.rmName || rm.rmCode || rm.rmId || 'Unknown'}" could not be matched with any warehouse inventory raw material. Please select an existing raw material.`);
    }

    const firstAlloc = rm.allocatedBatches?.[0];
    const combinedBatchSummary = rm.allocatedBatches?.length > 1
      ? rm.allocatedBatches.map(b => `${b.lotNumber} (${b.allocatedQty} ${rm.selectedUom})`).join(' + ')
      : firstAlloc?.lotNumber || null;

    const selectedUom = rm.selectedUom || rmRecord?.unitId || 'Kg';
    const convFactor = getConversionFactor(
      rmRecord?.unitId,
      rm.selectedUom || rmRecord?.alternateUom || rmRecord?.consumptionUnit,
      rm.conversionFactor || rmRecord?.conversionFactor,
      rmRecord
    );

    const usage = await tx.productionBatchRMUsage.create({
      data: {
        batchId,
        rmId: finalRmId,
        requiredQty: Number(rm.requiredQty || rm.inputQty || 0),
        availableQtyAtTime: Number(rm.availableQtyAtTime || rm.requiredQty || 0),
        actualUsedQty: Number(rm.actualUsedQty || rm.requiredQty || 0),
        unitCost: Number(rm.unitRate || 0),
        totalCost: Number(rm.totalCost || 0),
        selectedUom: selectedUom,
        inputQty: Number(rm.inputQty || rm.requiredQty || 0),
        conversionFactorUsed: convFactor,
        allocatedBatchId: firstAlloc?.batchId || null,
        internalBatchNo: combinedBatchSummary
      }
    });

    // Insert granular batch allocations with proportional PO division
    if (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0) {
      for (const alloc of rm.allocatedBatches) {
        let targetBatchId = alloc.batchId;

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
        const propFactor = poOrigQty > 0 ? (Number(alloc.allocatedQty || 0) / poOrigQty) : 1;
        const propAmount = Number((poTotAmt * propFactor).toFixed(2));

        const isOverride = Boolean(
          alloc.isManualOverride || 
          alloc.source === 'MANUAL_OVERRIDE' || 
          (alloc.batchId && String(alloc.batchId).startsWith('manual-')) ||
          (alloc.grnNumber && String(alloc.grnNumber).toLowerCase().includes('override'))
        );
        const effectiveGrn = alloc.grnNumber || alloc.grnRef || (isOverride ? 'GRN-MANUAL-OVERRIDE' : null);
        const effectivePo = alloc.poNumber || alloc.poReferenceNo || (isOverride ? 'PO-MANUAL-OVERRIDE' : null);
        const effectiveSuppBatch = alloc.supplierBatchNo || alloc.mfgBatchNo || null;

        await tx.$executeRawUnsafe(
          `INSERT INTO "production_batch_allocations" (
            batch_id, usage_id, inventory_batch_id, lot_number,
            allocated_qty, po_original_qty, po_total_amount,
            allocated_amount, unit_rate, uom,
            is_manual_override, grn_number, po_number, supplier_batch_no
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          batchId,
          usage.id,
          targetBatchId ? String(targetBatchId) : null,
          alloc.lotNumber || alloc.internalBatchNo || 'WAREHOUSE-LOT',
          Number(alloc.allocatedQty || 0),
          poOrigQty,
          poTotAmt,
          propAmount,
          Number(alloc.unitRate || rm.unitRate || 0),
          alloc.uom || rm.selectedUom || 'Kg',
          isOverride,
          effectiveGrn,
          effectivePo,
          effectiveSuppBatch
        );
      }
    }
  }
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
        const querySql = `SELECT b.id, b.base_id, b.template_id, b.shift, b.machine_line,
                  b.adjustment_reason, b.adjustment_reference,
                  b.sub_total, b.wastage_amt, b.overhead_amt, b.grand_total, b.cost_per_unit,
                  b.started_by, b.started_at, b.pause_history, b.sop_guide, b.timeline_stages,
                  b.pause_reason, b.cancelled_reason, b.cancelled_by, b.cancelled_at,
                  b.labour_count, b.labour_staff_ids, b.labour_staff_details, b.labour_total_cost,
                  bm.name as base_name, pt.name as template_name
           FROM "production_batches" b
           LEFT JOIN "base_master" bm ON b.base_id = bm.id
           LEFT JOIN "production_templates" pt ON b.template_id = pt.id
           WHERE b.id IN (${batchIds.map(id => `'${id}'`).join(',')})`;
        try {
          const rows = await prisma.$queryRawUnsafe(querySql);
          for (const r of rows) {
            extraDetails[r.id] = r;
          }
        } catch (rawErr) {
          if (rawErr.code === '42703' || (rawErr.message && rawErr.message.includes('base_id'))) {
            await ensureProductionBatchesRedesignSchema();
            try {
              const rows = await prisma.$queryRawUnsafe(querySql);
              for (const r of rows) {
                extraDetails[r.id] = r;
              }
            } catch (_) {}
          }
        }
      }

      const formatted = batches.map(b => {
        const extra = extraDetails[b.id] || {};
        const analysis = analyzeProductionBatchNumber(b.referenceNo || b.batchNo, b.startDate || b.createdAt);
        const resolvedRef = analysis?.formattedBatchNo || b.referenceNo || b.batchNo;
        return {
          id: b.id,
          referenceNo: resolvedRef,
          batchNo: b.batchNo || resolvedRef,
          batchAnalysis: analysis,
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
          labourCount: extra.labour_count !== null && extra.labour_count !== undefined ? Number(extra.labour_count) : 0,
          labourTotalCost: extra.labour_total_cost !== null && extra.labour_total_cost !== undefined ? Number(extra.labour_total_cost) : 0,
          labourStaffIds: Array.isArray(extra.labour_staff_ids) ? extra.labour_staff_ids : (typeof extra.labour_staff_ids === 'string' ? JSON.parse(extra.labour_staff_ids || '[]') : []),
          labourStaffDetails: Array.isArray(extra.labour_staff_details) ? extra.labour_staff_details : (typeof extra.labour_staff_details === 'string' ? JSON.parse(extra.labour_staff_details || '[]') : []),
          rawMaterialsCount: b.rmUsages?.length || 0,
          rmUsages: (b.rmUsages || []).map(u => {
            let baseUom = u.rawMaterial?.unit?.abbreviation || u.rawMaterial?.unitId || 'liter';
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) {
              baseUom = 'units';
            }
            const altUomCandidate = u.rawMaterial?.alternateUom || (u.rawMaterial?.consumptionUnit && u.rawMaterial.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? u.rawMaterial.consumptionUnit : null);
            const hasAlt = Boolean(u.rawMaterial?.hasAlternateUom && altUomCandidate && altUomCandidate.toLowerCase() !== baseUom.toLowerCase());
            const altUom = hasAlt ? altUomCandidate : null;
            const factor = hasAlt ? getConversionFactor(baseUom, altUom, u.conversionFactorUsed, u.rawMaterial) : 1;
            return {
              ...u,
              baseUom,
              hasAlternateUom: hasAlt,
              alternateUom: altUom,
              conversionFactor: factor
            };
          }),
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
      let extra = {};
      const batchSql = `SELECT b.id, b.base_id, b.template_id, b.shift, b.machine_line,
                b.adjustment_reason, b.adjustment_reference,
                b.sub_total, b.wastage_amt, b.overhead_amt, b.grand_total, b.cost_per_unit,
                b.started_by, b.started_at, b.pause_history, b.sop_guide, b.timeline_stages,
                b.pause_reason, b.cancelled_reason, b.cancelled_by, b.cancelled_at,
                b.mfd, b.shelf_life_days, b.lab_test_required, b.qc_status, b.quarantine_stock,
                b.good_quantity, b.rejected_quantity, b.scrap_quantity, b.scrap_reason,
                b.yield_percentage, b.eb_start_reading, b.eb_end_reading, b.eb_units_kwh,
                b.eb_rate_per_unit, b.eb_total_cost, b.labour_total_cost,
                b.labour_count, b.labour_staff_ids, b.labour_staff_details,
                b.completed_by, b.completed_at,
                b.evaporation_data, b.floor_stage, b.merged_pre_evap_ml,
                b.evaporation_rate_pct, b.evaporation_loss_ml, b.net_post_evap_mix_ml,
                b.mould_allocations,
                bm.name as base_name, pt.name as template_name
         FROM "production_batches" b
         LEFT JOIN "base_master" bm ON b.base_id = bm.id
         LEFT JOIN "production_templates" pt ON b.template_id = pt.id
         WHERE b.id = $1`;
      try {
        const rows = await prisma.$queryRawUnsafe(batchSql, id);
        extra = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
      } catch (rawErr) {
        if (rawErr.code === '42703' || (rawErr.message && rawErr.message.includes('base_id'))) {
          await ensureProductionBatchesRedesignSchema();
          try {
            const rows = await prisma.$queryRawUnsafe(batchSql, id);
            extra = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
          } catch (_) {}
        }
      }

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

      // Fetch multi-product items if present
      let batchProducts = [];
      try {
        const itemRows = await prisma.$queryRawUnsafe(`
          SELECT pbi.*, fp.name, fp.code, fp.unit_id, u.abbreviation as unit_abbr
          FROM "production_batch_items" pbi
          LEFT JOIN "finished_products" fp ON pbi.product_id = fp.id
          LEFT JOIN "uoms" u ON fp.unit_id = u.id
          WHERE pbi.batch_id = $1
        `, id);
        if (Array.isArray(itemRows) && itemRows.length > 0) {
          batchProducts = itemRows.map(r => ({
            productId: r.product_id,
            id: r.product_id,
            name: r.name,
            code: r.code,
            plannedQty: Number(r.planned_qty || 1),
            factor: Number(r.factor || 1.0),
            unit: r.unit_abbr || 'pcs'
          }));
        }
      } catch (itemErr) {
        batchProducts = [];
      }

      if (batchProducts.length === 0 && batch.product) {
        batchProducts = [{
          productId: batch.product.id,
          id: batch.product.id,
          name: batch.product.name,
          code: batch.product.code,
          plannedQty: Number(batch.quantity || 1),
          factor: 1.0,
          unit: batch.product.unit?.abbreviation || 'pcs'
        }];
      }

      // Compute per-piece ratios and dual UOMs
      const batchQty = Number(batch.quantity || 1);
      const actualYield = batch.actualOutput ? Number(batch.actualOutput) : null;

      const enrichedUsages = (batch.rmUsages || []).map(u => {
        let baseUom = u.rawMaterial?.unit?.abbreviation || u.rawMaterial?.unitId || 'liter';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(baseUom)) {
          baseUom = 'units';
        }

        const altUomCandidate = u.rawMaterial?.alternateUom || (u.rawMaterial?.consumptionUnit && u.rawMaterial.consumptionUnit.toLowerCase() !== baseUom.toLowerCase() ? u.rawMaterial.consumptionUnit : null);
        const hasAlt = Boolean(u.rawMaterial?.hasAlternateUom && altUomCandidate && altUomCandidate.toLowerCase() !== baseUom.toLowerCase());
        const altUom = hasAlt ? altUomCandidate : null;
        const factor = hasAlt ? Number(
          u.conversionFactorUsed ||
          u.rawMaterial?.conversionFactor ||
          (u.rawMaterial?.alternateUomQty && u.rawMaterial?.baseUomQty ? (u.rawMaterial.alternateUomQty / u.rawMaterial.baseUomQty) : 1000) ||
          1000
        ) : 1;

        const reqQty = Number(u.requiredQty || 0);
        let actQty = u.actualUsedQty !== null ? Number(u.actualUsedQty) : null;

        // Historical corruption protection: if actQty was recorded 1000x of requiredQty (e.g. 4200 instead of 4.2):
        if (actQty !== null && hasAlt && factor > 1 && reqQty > 0 && actQty > reqQty * 10) {
          actQty = Number((actQty / factor).toFixed(4));
        }

        const allocs = (allocations || []).filter(a => a.usage_id === u.id);
        const allocatedBatches = allocs.map(a => ({
          batchId: a.inventory_batch_id || a.lot_number,
          lotNumber: a.lot_number,
          allocatedQty: Number(a.allocated_qty || 0),
          poOriginalQty: Number(a.po_original_qty || 0),
          poTotalAmount: Number(a.po_total_amount || 0),
          allocatedAmount: Number(a.allocated_amount || 0),
          unitRate: Number(a.unit_rate || 0),
          uom: a.uom,
          isManualOverride: Boolean(a.is_manual_override),
          grnNumber: a.grn_number,
          poNumber: a.po_number,
          supplierBatchNo: a.supplier_batch_no
        }));

        const effectiveSelectedUom = u.selectedUom || (hasAlt ? altUom : baseUom);

        // Dual quantities (Base & Alternate)
        const altRequiredQty = hasAlt ? Number((reqQty * factor).toFixed(2)) : null;
        const altActualUsedQty = (hasAlt && actQty !== null) ? Number((actQty * factor).toFixed(2)) : null;

        const basePerPiece = batchQty > 0 ? Number((reqQty / batchQty).toFixed(6)) : 0;
        const altPerPiece = hasAlt ? Number((basePerPiece * factor).toFixed(4)) : null;

        const actualBasePerPiece = (actualYield && actualYield > 0 && actQty !== null) ? Number((actQty / actualYield).toFixed(6)) : null;
        const actualAltPerPiece = (actualBasePerPiece !== null && hasAlt) ? Number((actualBasePerPiece * factor).toFixed(4)) : null;

        return {
          ...u,
          rmId: u.rmId || u.rawMaterialId || u.rawMaterial?.id,
          rawMaterialId: u.rmId || u.rawMaterialId || u.rawMaterial?.id,
          rmCode: u.rawMaterial?.code || '',
          rawMaterialCode: u.rawMaterial?.code || '',
          rmName: u.rawMaterial?.name || '',
          rawMaterialName: u.rawMaterial?.name || '',
          category: (u.rawMaterial?.category && typeof u.rawMaterial.category === 'object') ? u.rawMaterial.category.name : (u.rawMaterial?.category || ''),
          description: u.rawMaterial?.description || '',
          baseUom,
          hasAlternateUom: hasAlt,
          alternateUom: altUom,
          conversionFactor: factor,
          selectedUom: effectiveSelectedUom,
          requiredQty: reqQty,
          baseRequiredQty: reqQty,
          altRequiredQty,
          activeEntryMode: (effectiveSelectedUom && altUom && effectiveSelectedUom.toLowerCase() === altUom.toLowerCase()) ? 'ALT' : 'BASE',
          unitRate: Number(u.unitCost || 0),
          baseRate: Number(u.unitCost || 0),
          altRate: (hasAlt && factor > 0) ? Number((Number(u.unitCost || 0) / factor).toFixed(4)) : Number(u.unitCost || 0),
          totalCost: Number(u.totalCost || 0),
          actualUsedQty: actQty,
          altActualUsedQty,
          perPieceQty: basePerPiece,
          altPerPieceQty: altPerPiece,
          actualBasePerPiece,
          actualAltPerPieceQty: actualAltPerPiece,
          allocations: allocs,
          allocatedBatches: allocatedBatches
        };
      });

      const batchAnalysis = analyzeProductionBatchNumber(batch.referenceNo || batch.batchNo, batch.startDate || batch.createdAt);
      const resolvedRef = batchAnalysis?.formattedBatchNo || batch.referenceNo || batch.batchNo;

      res.json({
        id: batch.id,
        referenceNo: resolvedRef,
        batchNo: batch.batchNo || resolvedRef,
        batchAnalysis,
        productionType: batch.productionType,
        startDate: batch.startDate,
        productionDate: batch.startDate ? new Date(batch.startDate).toISOString().split('T')[0] : null,
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
        productId: batch.productId,
        product: batch.product,
        products: batchProducts,
        selectedProducts: batchProducts,
        orderId: batch.orderId,
        order: batch.order,
        creator: batch.creator,
        baseId: extra.base_id || null,
        baseName: extra.base_name || 'Ice Cream Base',
        templateId: extra.template_id || null,
        templateName: extra.template_name || 'Standard Formula',
        shift: extra.shift || 'General',
        machineLine: extra.machine_line || 'Main Line',
        adjustmentReason: extra.adjustment_reason || null,
        adjustmentReference: extra.adjustment_reference || null,
        expiryDays: batch.expiryDays || extra.shelf_life_days || 365,
        note: batch.note || '',
        startedBy: extra.started_by || (batch.status === 'In Progress' || batch.status === 'Completed' ? (batch.creator?.name || 'Production Staff') : null),
        startedAt: extra.started_at || (batch.status === 'In Progress' || batch.status === 'Completed' ? batch.startDate : null),
        pauseHistory: Array.isArray(extra.pause_history) ? extra.pause_history : (typeof extra.pause_history === 'string' ? JSON.parse(extra.pause_history || '[]') : []),
        sopGuide: extra.sop_guide || null,
        timelineStages: Array.isArray(extra.timeline_stages) ? extra.timeline_stages : (typeof extra.timeline_stages === 'string' ? JSON.parse(extra.timeline_stages || '[]') : []),
        pauseReason: extra.pause_reason || null,
        cancelledReason: extra.cancelled_reason || null,
        cancelledBy: extra.cancelled_by || null,
        cancelledAt: extra.cancelled_at || null,
        // Completion & QC details
        mfd: extra.mfd || null,
        shelfLifeDays: extra.shelf_life_days ? Number(extra.shelf_life_days) : null,
        labTestRequired: extra.lab_test_required || false,
        qcStatus: extra.qc_status || 'PENDING',
        quarantineStock: extra.quarantine_stock ? Number(extra.quarantine_stock) : 0,
        goodQuantity: extra.good_quantity !== null && extra.good_quantity !== undefined ? Number(extra.good_quantity) : null,
        rejectedQuantity: extra.rejected_quantity !== null && extra.rejected_quantity !== undefined ? Number(extra.rejected_quantity) : 0,
        scrapQuantity: extra.scrap_quantity !== null && extra.scrap_quantity !== undefined ? Number(extra.scrap_quantity) : 0,
        scrapReason: extra.scrap_reason || null,
        yieldPercentage: extra.yield_percentage !== null && extra.yield_percentage !== undefined ? Number(extra.yield_percentage) : null,
        ebStartReading: extra.eb_start_reading !== null && extra.eb_start_reading !== undefined ? Number(extra.eb_start_reading) : null,
        ebEndReading: extra.eb_end_reading !== null && extra.eb_end_reading !== undefined ? Number(extra.eb_end_reading) : null,
        ebUnitsKwh: extra.eb_units_kwh !== null && extra.eb_units_kwh !== undefined ? Number(extra.eb_units_kwh) : null,
        ebRatePerUnit: extra.eb_rate_per_unit !== null && extra.eb_rate_per_unit !== undefined ? Number(extra.eb_rate_per_unit) : null,
        ebTotalCost: extra.eb_total_cost !== null && extra.eb_total_cost !== undefined ? Number(extra.eb_total_cost) : 0,
        labourTotalCost: extra.labour_total_cost !== null && extra.labour_total_cost !== undefined ? Number(extra.labour_total_cost) : 0,
        labourCount: extra.labour_count !== null && extra.labour_count !== undefined ? Number(extra.labour_count) : 0,
        assignedStaffIds: Array.isArray(extra.labour_staff_ids) ? extra.labour_staff_ids : (typeof extra.labour_staff_ids === 'string' ? JSON.parse(extra.labour_staff_ids || '[]') : []),
        labourStaffIds: Array.isArray(extra.labour_staff_ids) ? extra.labour_staff_ids : (typeof extra.labour_staff_ids === 'string' ? JSON.parse(extra.labour_staff_ids || '[]') : []),
        labourStaffDetails: Array.isArray(extra.labour_staff_details) ? extra.labour_staff_details : (typeof extra.labour_staff_details === 'string' ? JSON.parse(extra.labour_staff_details || '[]') : []),
        completedBy: extra.completed_by || null,
        completedAt: extra.completed_at || null,
        // Floor Execution & Evaporation Data
        floorStage: extra.floor_stage || 'PRE_EVAPORATION',
        mergedPreEvapMl: Number(extra.merged_pre_evap_ml || 0),
        evaporationRatePct: Number(extra.evaporation_rate_pct || 5.0),
        evaporationLossMl: Number(extra.evaporation_loss_ml || 0),
        netPostEvapMixMl: Number(extra.net_post_evap_mix_ml || 0),
        mouldAllocations: Array.isArray(extra.mould_allocations) ? extra.mould_allocations : (typeof extra.mould_allocations === 'string' ? JSON.parse(extra.mould_allocations || '[]') : []),
        evaporationData: (extra.evaporation_data && typeof extra.evaporation_data === 'object') ? extra.evaporation_data : (typeof extra.evaporation_data === 'string' ? JSON.parse(extra.evaporation_data || '{}') : {}),
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
      const raw = { ...req.body };
      if ((!raw.selectedProducts || raw.selectedProducts.length === 0) && Array.isArray(raw.products)) {
        raw.selectedProducts = raw.products;
      }
      if (!raw.quantity && raw.totalPlannedQty !== undefined) {
        raw.quantity = raw.totalPlannedQty;
      }
      if (!raw.startDate && raw.productionDate) {
        raw.startDate = raw.productionDate;
      }
      if (!raw.baseId && raw.base_id) {
        raw.baseId = raw.base_id;
      }
      if (!raw.templateId && raw.template_id) {
        raw.templateId = raw.template_id;
      }
      if (!raw.orderId && raw.order_id) {
        raw.orderId = raw.order_id;
      }
      if (!raw.categoryId && raw.category_id) {
        raw.categoryId = raw.category_id;
      }
      if (!raw.subCategoryId && raw.sub_category_id) {
        raw.subCategoryId = raw.sub_category_id;
      }

      const isUuidStr = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
      if (raw.baseId && !isUuidStr(raw.baseId)) raw.baseId = null;
      if (raw.templateId && !isUuidStr(raw.templateId)) raw.templateId = null;
      if (raw.orderId && !isUuidStr(raw.orderId)) raw.orderId = null;

      const schema = z.object({
        productionType: z.enum(['STANDARD', 'ORDER_BASED', 'STOCK_UPDATE']).default('STANDARD'),
        baseId: z.string().optional().nullable(),
        templateId: z.string().optional().nullable(),
        categoryId: z.string().optional().nullable(),
        subCategoryId: z.string().optional().nullable(),
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

        // Labour and Floor Staff
        labourCount: z.coerce.number().optional().default(0),
        labourTotalCost: z.coerce.number().optional().default(0),
        assignedStaffIds: z.array(z.string()).optional().default([]),
        labourStaffIds: z.array(z.string()).optional().default([]),
        labourStaffDetails: z.array(z.any()).optional().default([]),

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

      // Ensure all extended columns exist in production_batches before entering the transaction
      await ensureProductionBatchesRedesignSchema();

      const createdBatch = await prisma.$transaction(async (tx) => {
        const effectiveProductId = data.productId || data.selectedProducts?.[0]?.productId || data.selectedProducts?.[0]?.id;
        let finalBatchProductId = effectiveProductId;
        if (!finalBatchProductId) {
          const fallbackProd = await tx.finishedProduct.findFirst();
          finalBatchProductId = fallbackProd?.id;
        }

        const referenceNo = await generateBatchReference(tx, data.startDate);
        // Generate atomic unique batch number with row locking: YYYYMMDD-PRODUCTCODE-NNNNN
        const batchNumInfo = await batchNumberService.generateNextBatchNumber(tx, finalBatchProductId, data.startDate);
        const batchNo = batchNumInfo.batchNo;

        const shelfLife = parseInt(data.expiryDays, 10) || 365;
        const mfd = new Date(data.startDate);
        const expDate = new Date(mfd.getTime() + shelfLife * 24 * 60 * 60 * 1000);

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
            expiryDays: shelfLife,
            expiryDate: expDate,
            quantity: Number(data.quantity || 1),
            remainingQty: Number(data.quantity || 1),
            totalCost: Number(data.grandTotal || 0),
            note: data.note || null,
            orderId: data.orderId || null,
            createdBy: safeUserId
          }
        });

        // Extract assigned labour information
        const staffIds = Array.isArray(data.assignedStaffIds) && data.assignedStaffIds.length > 0
          ? data.assignedStaffIds
          : (Array.isArray(data.labourStaffIds) ? data.labourStaffIds : []);
        const staffDetails = Array.isArray(data.labourStaffDetails) ? data.labourStaffDetails : [];
        const labourCount = Number(data.labourCount || staffIds.length || 0);
        const labourTotalCost = Number(data.labourTotalCost || 0);

        // 2. Update extended columns in production_batches
        const startedAtVal = data.status === 'In Progress' ? new Date() : null;
        const startedByVal = data.status === 'In Progress' ? (req.user?.name || req.user?.email || 'Supervisor') : null;
        const stagesJson = JSON.stringify(data.timelineStages || []);

        const safeUuid = (val) => (typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())) ? val.trim() : null;

        await tx.$executeRawUnsafe(
          `UPDATE "production_batches" SET
            base_id = CASE WHEN $1::text IS NULL OR $1::text = '' THEN NULL ELSE $1::uuid END,
            template_id = CASE WHEN $2::text IS NULL OR $2::text = '' THEN NULL ELSE $2::uuid END,
            category_id = $3,
            sub_category_id = $4,
            shift = $5,
            machine_line = $6,
            adjustment_reason = $7,
            adjustment_reference = $8,
            sub_total = $9,
            wastage_amt = $10,
            overhead_amt = $11,
            grand_total = $12,
            cost_per_unit = $13,
            approval_status = $14,
            timeline_stages = $15::jsonb,
            started_at = $16,
            started_by = $17,
            mfd = $18,
            shelf_life_days = $19,
            qc_status = 'PENDING',
            labour_count = $20,
            labour_staff_ids = $21::jsonb,
            labour_staff_details = $22::jsonb,
            labour_total_cost = $23
          WHERE id = $24`,
          safeUuid(data.baseId),
          safeUuid(data.templateId),
          data.categoryId || null,
          data.subCategoryId || null,
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
          mfd,
          shelfLife,
          labourCount,
          JSON.stringify(staffIds),
          JSON.stringify(staffDetails),
          labourTotalCost,
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

        // 4. Insert Raw Material Usage Lines & Lot Allocations using reusable helper
        await insertBatchRMUsagesAndAllocations(tx, batch.id, data.rawMaterials, safeUserId);

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

  // PUT /api/production/batches-redesign/:id
  async updateBatch(req, res, next) {
    try {
      const { id } = req.params;
      const raw = { ...req.body };
      if ((!raw.selectedProducts || raw.selectedProducts.length === 0) && Array.isArray(raw.products)) {
        raw.selectedProducts = raw.products;
      }
      if (!raw.quantity && raw.totalPlannedQty !== undefined) {
        raw.quantity = raw.totalPlannedQty;
      }
      if (!raw.startDate && raw.productionDate) {
        raw.startDate = raw.productionDate;
      }
      if (!raw.baseId && raw.base_id) {
        raw.baseId = raw.base_id;
      }
      if (!raw.templateId && raw.template_id) {
        raw.templateId = raw.template_id;
      }
      if (!raw.orderId && raw.order_id) {
        raw.orderId = raw.order_id;
      }
      if (!raw.categoryId && raw.category_id) {
        raw.categoryId = raw.category_id;
      }
      if (!raw.subCategoryId && raw.sub_category_id) {
        raw.subCategoryId = raw.sub_category_id;
      }

      const isUuidStr = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
      if (raw.baseId && !isUuidStr(raw.baseId)) raw.baseId = null;
      if (raw.templateId && !isUuidStr(raw.templateId)) raw.templateId = null;
      if (raw.orderId && !isUuidStr(raw.orderId)) raw.orderId = null;

      const schema = z.object({
        productionType: z.enum(['STANDARD', 'ORDER_BASED', 'STOCK_UPDATE']).default('STANDARD'),
        baseId: z.string().optional().nullable(),
        templateId: z.string().optional().nullable(),
        categoryId: z.string().optional().nullable(),
        subCategoryId: z.string().optional().nullable(),
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

        // Labour and Floor Staff
        labourCount: z.coerce.number().optional().default(0),
        labourTotalCost: z.coerce.number().optional().default(0),
        assignedStaffIds: z.array(z.string()).optional().default([]),
        labourStaffIds: z.array(z.string()).optional().default([]),
        labourStaffDetails: z.array(z.any()).optional().default([]),
        timelineStages: z.array(z.any()).optional().default([]),

        // Raw material lines with batch allocations
        rawMaterials: z.array(z.object({
          rmId: z.string().optional().nullable(),
          rawMaterialId: z.string().optional().nullable(),
          rmCode: z.string().optional().nullable(),
          rawMaterialCode: z.string().optional().nullable(),
          rmName: z.string().optional().nullable(),
          rawMaterialName: z.string().optional().nullable(),
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
        })).optional().default([])
      });

      const data = schema.parse(raw);

      // Verify batch exists
      const existingBatch = await prisma.productionBatchNew.findUnique({
        where: { id },
        include: { product: true }
      });
      if (!existingBatch) {
        return res.status(404).json({ error: 'Production batch not found' });
      }

      // Check if batch is editable (allow if Draft or Planned)
      const currentStatus = existingBatch.status;
      if (currentStatus === 'Completed' || currentStatus === 'Cancelled') {
        return res.status(400).json({
          error: `Cannot edit batch with status '${currentStatus}'. Only batches in Draft or Planned status can be edited.`
        });
      }

      // Validation for Order-Based
      if (data.productionType === 'ORDER_BASED' && !data.orderId) {
        return res.status(400).json({ error: 'Order Based Production requires a valid Sales Order link (orderId).' });
      }

      // Validation for Stock-Update
      if (data.productionType === 'STOCK_UPDATE' && !data.adjustmentReason) {
        return res.status(400).json({ error: 'Stock Update Production requires an adjustment reason.' });
      }

      await ensureProductionBatchesRedesignSchema();

      const defaultUser = await prisma.user.findFirst();
      const safeUserId = req.user?.id || defaultUser?.id;

      const updatedBatch = await prisma.$transaction(async (tx) => {
        const effectiveProductId = data.productId || data.selectedProducts?.[0]?.productId || data.selectedProducts?.[0]?.id || existingBatch.productId;
        let finalBatchProductId = effectiveProductId;
        if (finalBatchProductId) {
          const prodExists = await tx.finishedProduct.findUnique({ where: { id: finalBatchProductId } });
          if (!prodExists) {
            finalBatchProductId = existingBatch.productId;
          }
        }
        if (!finalBatchProductId) {
          const fallbackProd = await tx.finishedProduct.findFirst();
          finalBatchProductId = fallbackProd?.id;
        }

        const shelfLife = parseInt(data.expiryDays, 10) || existingBatch.expiryDays || 365;
        const mfd = new Date(data.startDate);
        const expDate = new Date(mfd.getTime() + shelfLife * 24 * 60 * 60 * 1000);

        let targetStatus = data.status;
        if (targetStatus === 'Draft' || targetStatus === 'PLANNED') {
          targetStatus = 'Draft';
        }

        // 1. Update main ProductionBatchNew record
        const batch = await tx.productionBatchNew.update({
          where: { id },
          data: {
            productId: finalBatchProductId,
            productionType: data.productionType,
            status: targetStatus,
            startDate: new Date(data.startDate),
            expiryDays: shelfLife,
            expiryDate: expDate,
            quantity: Number(data.quantity || 1),
            remainingQty: Number(data.quantity || 1),
            totalCost: Number(data.grandTotal || 0),
            note: data.note || null,
            orderId: data.orderId || null
          }
        });

        // 2. Extract assigned labour information
        const staffIds = Array.isArray(data.assignedStaffIds) && data.assignedStaffIds.length > 0
          ? data.assignedStaffIds
          : (Array.isArray(data.labourStaffIds) ? data.labourStaffIds : []);
        const staffDetails = Array.isArray(data.labourStaffDetails) ? data.labourStaffDetails : [];
        const labourCount = Number(data.labourCount || staffIds.length || 0);
        const labourTotalCost = Number(data.labourTotalCost || 0);

        const startedAtVal = targetStatus === 'In Progress' ? new Date() : null;
        const startedByVal = targetStatus === 'In Progress' ? (req.user?.name || req.user?.email || 'Floor Supervisor') : null;
        const stagesJson = JSON.stringify(data.timelineStages || []);

        const safeUuid = (val) => (typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())) ? val.trim() : null;

        await tx.$executeRawUnsafe(
          `UPDATE "production_batches" SET
            base_id = CASE WHEN $1::text IS NULL OR $1::text = '' THEN NULL ELSE $1::uuid END,
            template_id = CASE WHEN $2::text IS NULL OR $2::text = '' THEN NULL ELSE $2::uuid END,
            category_id = $3,
            sub_category_id = $4,
            shift = $5,
            machine_line = $6,
            adjustment_reason = $7,
            adjustment_reference = $8,
            sub_total = $9,
            wastage_amt = $10,
            overhead_amt = $11,
            grand_total = $12,
            cost_per_unit = $13,
            approval_status = $14,
            timeline_stages = $15::jsonb,
            started_at = CASE WHEN $14 = 'In Progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
            started_by = CASE WHEN $14 = 'In Progress' AND started_by IS NULL THEN $16 ELSE started_by END,
            mfd = $17,
            shelf_life_days = $18,
            labour_count = $19,
            labour_staff_ids = $20::jsonb,
            labour_staff_details = $21::jsonb,
            labour_total_cost = $22
          WHERE id = $23`,
          safeUuid(data.baseId),
          safeUuid(data.templateId),
          data.categoryId || null,
          data.subCategoryId || null,
          data.shift || null,
          data.machineLine || null,
          data.adjustmentReason || null,
          data.adjustmentReference || null,
          Number(data.subTotal || 0),
          Number(data.wastageAmt || 0),
          Number(data.overheadAmt || 0),
          Number(data.grandTotal || 0),
          Number(data.costPerUnit || 0),
          targetStatus,
          stagesJson,
          startedByVal,
          mfd,
          shelfLife,
          labourCount,
          JSON.stringify(staffIds),
          JSON.stringify(staffDetails),
          labourTotalCost,
          id
        );

        // 3. Re-create production_batch_items
        await tx.$executeRawUnsafe(`DELETE FROM "production_batch_items" WHERE batch_id = $1`, id);
        const productsToInsert = Array.isArray(data.selectedProducts) && data.selectedProducts.length > 0
          ? data.selectedProducts.map(p => ({
              productId: p.productId || p.id || finalBatchProductId,
              plannedQty: Number(p.plannedQty || data.quantity || 1),
              factor: Number(p.factor || 1.0)
            }))
          : [{ productId: finalBatchProductId, plannedQty: Number(data.quantity || 1), factor: 1.0 }];

        for (const p of productsToInsert) {
          if (!p.productId) continue;
          const pExists = await tx.finishedProduct.findUnique({ where: { id: p.productId } });
          if (!pExists) continue;
          await tx.$executeRawUnsafe(
            `INSERT INTO "production_batch_items" (
              batch_id, product_id, planned_qty, factor, cost_per_unit
            ) VALUES ($1, $2, $3, $4, $5)`,
            id,
            p.productId,
            Number(p.plannedQty || 1),
            Number(p.factor || 1.0),
            Number(data.costPerUnit || 0)
          );
        }

        // 4. Re-create production_batch_allocations & rm usages
        await tx.$executeRawUnsafe(`DELETE FROM "production_batch_allocations" WHERE batch_id = $1`, id);
        await tx.productionBatchRMUsage.deleteMany({ where: { batchId: id } });

        await insertBatchRMUsagesAndAllocations(tx, id, data.rawMaterials, safeUserId);

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

      res.json({
        message: 'Production batch updated successfully',
        batch: updatedBatch
      });
    } catch (err) {
      console.error('UPDATE BATCH ERROR:', err);
      if (err instanceof z.ZodError) {
        const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || 'Validation error';
        return res.status(400).json({ error: msg, details: err.issues || err.errors });
      }
      return res.status(500).json({
        error: err.message || 'Failed to update production batch',
        details: err.message
      });
    }
  }

  // PATCH /api/production/batches-redesign/:id/status
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { 
        status, 
        actualOutput, 
        rmUsages, 
        note, 
        reason, 
        failureReason, 
        isWasted, 
        wastageItems, 
        responsibleId 
      } = req.body;
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

      // If completing (either Lab Test Exempt or Lab Test Required), delegate to ProductionCompletionService
      if (status === 'Completed' || status === 'Lab Test In Progress') {
        const completionResult = await productionCompletionService.completeProduction(id, {
          actualOutput,
          rmUsages,
          note,
          completeDate: req.body.completeDate,
          shelfLifeDays: req.body.shelfLifeDays,
          labTestRequired: req.body.labTestRequired !== undefined 
            ? Boolean(req.body.labTestRequired) 
            : (status === 'Lab Test In Progress'),
          rejectedQty: req.body.rejectedQty,
          reworkQty: req.body.reworkQty,
          scrapQty: req.body.scrapQty,
          scrapReason: req.body.scrapReason,
          ebStartReading: req.body.ebStartReading,
          ebEndReading: req.body.ebEndReading,
          ebUnitsKwh: req.body.ebUnitsKwh,
          ebRatePerUnit: req.body.ebRatePerUnit,
          labourLogs: req.body.labourLogs,
          overheadCost: req.body.overheadCost,
          byProductName: req.body.byProductName,
          byProductQty: req.body.byProductQty,
          qcSampleQty: req.body.qcSampleQty,
          retentionSampleQty: req.body.retentionSampleQty
        }, req.user);

        return res.json({
          message: completionResult.labTestRequired
            ? `Production sent to QC Queue for Lab Testing! Batch status updated to 'Lab Test In Progress'. Finished goods remain in Quarantine.`
            : `Production completed (Lab Exempt)! Actual yield (${completionResult.actualYield} ${batch.product?.unit?.abbreviation || 'pcs'}) added directly to available inventory.`,
          batch: completionResult.batch,
          actualYield: completionResult.actualYield,
          labTestRequired: completionResult.labTestRequired,
          productUom: batch.product?.unit?.abbreviation || batch.product?.unit?.name || 'pcs'
        });
      }

      const finalYield = actualOutput !== undefined && actualOutput !== null ? Number(actualOutput) : Number(batch.quantity);

      const cancelReasonRaw = failureReason || reason || note || 'Cancelled';
      const finalCancelReason = status === 'Cancelled'
        ? (isWasted ? `Production Failed: ${cancelReasonRaw}` : cancelReasonRaw)
        : null;

      const result = await prisma.$transaction(async (tx) => {
        const updateData = {
          status
        };

        const updated = await tx.productionBatchNew.update({
          where: { id },
          data: updateData
        });

        if (status === 'Cancelled') {
          // Mark all RM usages for this batch as CANCELLED
          await tx.productionBatchRMUsage.updateMany({
            where: { batchId: id },
            data: { status: 'CANCELLED' }
          });

          // If production failed with raw material wastage, record into RMWaste & deduct from allocated inventory lots
          if (Boolean(isWasted) && Array.isArray(wastageItems) && wastageItems.length > 0) {
            const validWastage = wastageItems.filter(w => Number(w.quantity) > 0);
            if (validWastage.length > 0) {
              const refNo = await generateReferenceNo(tx, 'RMWaste', 'RMW');
              const totalLoss = validWastage.reduce((sum, w) => sum + Number(w.lossAmount || (Number(w.quantity || 0) * Number(w.unitCost || 0))), 0);

              const safeResponsibleId = responsibleId && isUuid(responsibleId) 
                ? responsibleId 
                : (req.user?.id || batch.createdBy);

              const newWaste = await tx.rMWaste.create({
                data: {
                  referenceNo: refNo,
                  date: new Date(),
                  totalLoss: Number(totalLoss.toFixed(2)),
                  note: `Production Failed • Batch #${batch.referenceNo} (${batch.batchNo || batch.product?.name || ''}) - ${cancelReasonRaw}`,
                  responsibleId: safeResponsibleId,
                  createdBy: req.user?.id || batch.createdBy
                }
              });

              // Default active UOM fallback
              const defaultUom = await tx.uOM.findFirst({ where: { isActive: true } });

              for (const item of validWastage) {
                let qtyToWaste = Number(item.quantity);

                // Fetch RM to safeguard canonical base UOM
                const rm = await tx.rawMaterial.findUnique({ where: { id: item.rmId } });
                const baseUom = rm?.unitId || 'liter';
                const altUom = rm?.alternateUom || rm?.consumptionUnit;
                const hasAlt = Boolean(rm?.hasAlternateUom && altUom && altUom.toLowerCase() !== baseUom.toLowerCase());
                const factor = hasAlt ? Number(item.conversionFactorUsed || rm?.conversionFactor || 1000) : 1;

                if (hasAlt && factor > 1) {
                  // Guard against client sending raw alternate quantity
                  if (item.selectedUom && item.selectedUom.toLowerCase() === altUom.toLowerCase() && item.inputQty && qtyToWaste === Number(item.inputQty)) {
                    qtyToWaste = Number((qtyToWaste / factor).toFixed(6));
                  }
                }

                const lossAmt = Number(item.lossAmount || (qtyToWaste * Number(item.unitCost || rm?.ratePerUnit || 0)));

                // Resolve UOM ID
                let resolvedUomId = item.uomId;
                if (!resolvedUomId || !isUuid(resolvedUomId)) {
                  const matchUom = await tx.uOM.findFirst({
                    where: {
                      OR: [
                        { abbreviation: { equals: String(item.uomId || item.uom || 'Kg'), mode: 'insensitive' } },
                        { name: { equals: String(item.uomId || item.uom || 'Kg'), mode: 'insensitive' } }
                      ]
                    }
                  });
                  resolvedUomId = matchUom?.id || defaultUom?.id;
                }

                await tx.rMWasteItem.create({
                  data: {
                    wasteId: newWaste.id,
                    rawMaterialId: item.rmId,
                    quantity: qtyToWaste,
                    uomId: resolvedUomId,
                    lossAmount: Number(lossAmt.toFixed(2)),
                    batchId: item.batchId && isUuid(item.batchId) ? item.batchId : null,
                    batchNumber: item.batchNumber ? String(item.batchNumber).trim() : null,
                    mfgBatchNo: item.mfgBatchNo ? String(item.mfgBatchNo).trim() : null,
                    mfgDate: item.mfgDate ? new Date(item.mfgDate) : null,
                    expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                    weight: item.weight ? String(item.weight).trim() : null,
                    remarks: `Production Failed • Batch #${batch.referenceNo} (${batch.batchNo || ''})`
                  }
                });

                // Deduct from RawMaterial main stock table
                await tx.rawMaterial.update({
                  where: { id: item.rmId },
                  data: {
                    currentStock: { decrement: qtyToWaste }
                  }
                });

                // Deduct directly from the allocated InventoryBatch lot
                if (item.batchId || item.batchNumber) {
                  const batchWhere = (item.batchId && isUuid(item.batchId))
                    ? { id: item.batchId }
                    : { batchNumber: String(item.batchNumber).trim() };

                  const lot = await tx.inventoryBatch.findFirst({ where: batchWhere });
                  if (lot) {
                    const currentNet = Number(lot.netQty || 0);
                    const currentWasted = Number(lot.wastedQty || 0);
                    const newWasted = currentWasted + qtyToWaste;
                    const newNet = Math.max(0, currentNet - qtyToWaste);
                    const newStatus = newNet <= 0 ? 'WASTED' : lot.status;

                    await tx.inventoryBatch.update({
                      where: { id: lot.id },
                      data: {
                        netQty: newNet,
                        wastedQty: newWasted,
                        status: newStatus
                      }
                    });
                  }
                }
              }
            }
          } else if (batch.status === 'Completed') {
            // If the batch was previously completed and now cancelled with 0 waste, restore deducted stock
            const usages = await tx.productionBatchRMUsage.findMany({
              where: { batchId: id }
            });
            for (const u of usages) {
              const consumed = Number(u.actualUsedQty || u.requiredQty || 0);
              if (u.rmId && consumed > 0) {
                await tx.rawMaterial.update({
                  where: { id: u.rmId },
                  data: { currentStock: { increment: consumed } }
                });
              }
              try {
                const allocations = await tx.$queryRawUnsafe(
                  `SELECT inventory_batch_id, allocated_qty FROM "production_batch_allocations" WHERE usage_id = $1`,
                  u.id
                );
                for (const alloc of allocations) {
                  if (alloc.inventory_batch_id && Number(alloc.allocated_qty) > 0) {
                    await tx.inventoryBatch.updateMany({
                      where: { id: alloc.inventory_batch_id },
                      data: { netQty: { increment: Number(alloc.allocated_qty) } }
                    });
                  }
                }
              } catch (allocErr) {
                console.warn('Revert inventory batch allocation warning:', allocErr.message);
              }
            }

            // Deduct finished goods that were added when completed
            if (batch.productId && finalYield > 0) {
              await tx.finishedProduct.update({
                where: { id: batch.productId },
                data: { currentStock: { decrement: finalYield } }
              });
            }
          }
        }

        // Update approval status, pause history, timestamps in extended table
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
          status === 'Cancelled' ? finalCancelReason : null,
          id
        );

        return updated;
      });

      res.json({
        message: `Batch status updated to ${status}`,
        batch: result,
        actualYield: finalYield,
        productUom: batch.product?.unit?.abbreviation || batch.product?.unit?.name || 'pcs'
      });
    } catch (err) {
      console.error('Update batch status error:', err);
      next(err);
    }
  }

  // POST /api/production/batches-redesign/:id/complete
  async completeBatch(req, res, next) {
    try {
      const { id } = req.params;
      const result = await productionCompletionService.completeProduction(id, req.body, req.user);
      res.json({
        message: result.labTestRequired
          ? `Production dispatched to QC Testing Queue! Status set to 'Lab Test In Progress'.`
          : `Production successfully completed and released to sellable inventory.`,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/production/batches-redesign/:id/label
  async getBatchLabel(req, res, next) {
    try {
      const { id } = req.params;
      const batch = await prisma.productionBatchNew.findUnique({
        where: { id },
        include: {
          product: { include: { unit: true, category: true } }
        }
      });
      if (!batch) return res.status(404).json({ error: 'Batch not found' });

      const extraRows = await prisma.$queryRawUnsafe(
        `SELECT mfd, shelf_life_days, qc_status, good_quantity, yield_percentage FROM "production_batches" WHERE id = $1`,
        id
      );
      const extra = extraRows[0] || {};

      const gtin = batch.product?.upcEan || batch.product?.barcode || batch.product?.sku || '8901234567890';
      const batchNo = batch.batchNo || batch.referenceNo;
      const mfd = extra.mfd || batch.startDate;
      const expiryDate = batch.expiryDate || new Date(new Date(mfd).getTime() + (extra.shelf_life_days || 365) * 86400000);

      const mfdStr = new Date(mfd).toISOString().split('T')[0];
      const expStr = new Date(expiryDate).toISOString().split('T')[0];

      // Fetch Live Business Profile from /setup/tax (PostgreSQL Live Data)
      let company = {};
      try {
        company = await getTaxSettingsData();
      } catch (e) {
        console.warn('Failed to load live tax settings, fallback to DB query:', e.message);
      }

      const companyName = company.companyName || 'Leonex';
      const companyAddress = company.companyAddress || 'Factory / Registered Office Address';
      const companyGstin = company.companyGstin || '33AAWCS2781F1ZZ';
      const companyPan = company.companyPan || 'AAWCS2781F';
      const companyMobile = company.companyMobile || '+91 99404 54154';

      const qrPayload = JSON.stringify({
        batch: batchNo,
        product: batch.product?.name,
        code: batch.product?.code,
        gtin: gtin,
        mfd: mfdStr,
        exp: expStr,
        mrp: Number(batch.salePrice || 0),
        netWt: `${batch.actualOutput || batch.quantity} ${batch.product?.unit?.abbreviation || 'pcs'}`,
        mfgBy: companyName,
        address: companyAddress,
        gstin: companyGstin,
        pan: companyPan,
        mobile: companyMobile,
        fssaiLic: companyPan
      });

      res.json({
        batchId: batch.id,
        referenceNo: batch.referenceNo,
        batchNo,
        status: batch.status,
        isCancelled: batch.status === 'Cancelled',
        productName: batch.product?.name,
        productCode: batch.product?.code,
        gtin,
        mfd: mfdStr,
        expiryDate: expStr,
        mrp: Number(batch.salePrice || 0),
        netWeight: `${batch.actualOutput || batch.quantity} ${batch.product?.unit?.abbreviation || 'pcs'}`,
        storageConditions: 'Store in cool and dry place away from direct sunlight',
        fssaiLicence: companyPan,
        manufacturer: companyName,
        address: companyAddress,
        gstin: companyGstin,
        pan: companyPan,
        mobile: companyMobile,
        qrPayload
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/production/traceability/:batchNo
  async getBatchTraceability(req, res, next) {
    try {
      const { batchNo } = req.params;
      const batch = await prisma.productionBatchNew.findFirst({
        where: {
          OR: [
            { batchNo },
            { referenceNo: batchNo }
          ],
          deletedAt: null
        },
        include: {
          product: { include: { unit: true, category: true } },
          rmUsages: {
            include: {
              rawMaterial: { include: { category: true } }
            }
          },
          order: {
            include: {
              customer: true
            }
          },
          qcTests: {
            include: {
              tester: { select: { name: true, email: true } }
            }
          }
        }
      });

      if (!batch) {
        return res.status(404).json({ error: `Batch '${batchNo}' not found.` });
      }

      const backwardLots = await prisma.$queryRawUnsafe(`
        SELECT 
          ba.lot_number, ba.allocated_qty, ba.po_id,
          ib.batch_number as internal_lot, ib.supplier_id, ib.mfg_batch_no,
          ib.mfg_date as supplier_mfg_date, ib.expiry_date as supplier_expiry_date,
          grn.reference_no as grn_number,
          po.po_number,
          sup.name as supplier_name
        FROM "production_batch_allocations" ba
        LEFT JOIN "inventory_batches" ib ON ba.inventory_batch_id = ib.id
        LEFT JOIN "grn_receives" grn ON ib.grn_id = grn.id
        LEFT JOIN "raw_material_pos" po ON ib.po_id = po.id
        LEFT JOIN "suppliers" sup ON ib.supplier_id = sup.id
        WHERE ba.batch_id = $1
      `, batch.id);

      const forwardSales = await prisma.$queryRawUnsafe(`
        SELECT 
          co.reference_no as order_ref, co.created_at as order_date,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          coi.quantity as ordered_qty,
          ba.quantity as allocated_qty,
          co.status as order_status
        FROM "batch_allocations" ba
        JOIN "customer_order_items" coi ON ba.order_item_id = coi.id
        JOIN "customer_orders" co ON coi.order_id = co.id
        JOIN "customers" c ON co.customer_id = c.id
        WHERE ba.batch_id = $1
      `, batch.id);

      res.json({
        batch: {
          id: batch.id,
          batchNo: batch.batchNo,
          referenceNo: batch.referenceNo,
          product: batch.product,
          status: batch.status,
          startDate: batch.startDate,
          completeDate: batch.completeDate,
          quantity: Number(batch.quantity),
          actualOutput: batch.actualOutput ? Number(batch.actualOutput) : null
        },
        backwardTraceability: {
          rmUsages: batch.rmUsages.map(u => ({
            rawMaterial: u.rawMaterial?.name,
            code: u.rawMaterial?.code,
            consumedQty: Number(u.actualUsedQty || u.requiredQty),
            uom: u.selectedUom || u.rawMaterial?.consumptionUnit || 'units'
          })),
          supplierLots: backwardLots
        },
        forwardTraceability: {
          linkedOrder: batch.order ? {
            orderRef: batch.order.referenceNo,
            customer: batch.order.customer?.name,
            status: batch.order.status
          } : null,
          customerDeliveries: forwardSales
        },
        qcRecord: batch.qcTests
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/production/batch-number/preview
  async previewBatchNumber(req, res, next) {
    try {
      const { productId, date } = req.query;
      if (!productId) return res.status(400).json({ error: 'productId is required' });
      const preview = await batchNumberService.previewNextBatchNumber(productId, date || new Date());
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/production/batch-number/settings
  async getBatchSettings(req, res, next) {
    try {
      const settings = await batchNumberService.getSettings();
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/production/batch-number/settings
  async updateBatchSettings(req, res, next) {
    try {
      const updated = await batchNumberService.updateSettings(req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/production/batches-redesign/analyze/:batchNo
  async analyzeBatch(req, res, next) {
    try {
      const { batchNo } = req.params;
      const analysis = analyzeProductionBatchNumber(batchNo);
      res.json(analysis || { isValid: false, raw: batchNo });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/production/batches-redesign/:id/floor-execution
  async updateFloorExecution(req, res, next) {
    try {
      const { id } = req.params;
      const {
        floorStage,
        mergedPreEvapMl,
        evaporationRatePct,
        evaporationLossMl,
        netPostEvapMixMl,
        mouldAllocations,
        rawMaterialsFloorUsage,
        note
      } = req.body;

      const userIdentifier = req.user?.name || req.user?.email || 'Floor Supervisor';

      const evaporationData = {
        floorStage: floorStage || 'PRE_EVAPORATION',
        mergedPreEvapMl: Number(mergedPreEvapMl || 0),
        evaporationRatePct: Number(evaporationRatePct || 5.0),
        evaporationLossMl: Number(evaporationLossMl || 0),
        netPostEvapMixMl: Number(netPostEvapMixMl || 0),
        mouldAllocations: Array.isArray(mouldAllocations) ? mouldAllocations : [],
        rawMaterialsFloorUsage: Array.isArray(rawMaterialsFloorUsage) ? rawMaterialsFloorUsage : [],
        note: note || '',
        updatedBy: userIdentifier,
        updatedAt: new Date().toISOString()
      };

      await prisma.$executeRawUnsafe(`
        UPDATE "production_batches" SET
          "floor_stage" = $2,
          "merged_pre_evap_ml" = $3,
          "evaporation_rate_pct" = $4,
          "evaporation_loss_ml" = $5,
          "net_post_evap_mix_ml" = $6,
          "mould_allocations" = $7::jsonb,
          "evaporation_data" = $8::jsonb,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1
      `,
        id,
        floorStage || 'PRE_EVAPORATION',
        Number(mergedPreEvapMl || 0),
        Number(evaporationRatePct || 5.0),
        Number(evaporationLossMl || 0),
        Number(netPostEvapMixMl || 0),
        JSON.stringify(mouldAllocations || []),
        JSON.stringify(evaporationData)
      );

      res.json({
        success: true,
        message: 'Floor execution data saved successfully',
        evaporationData
      });
    } catch (err) {
      console.error('Failed to update floor execution data:', err);
      next(err);
    }
  }
}

module.exports = new ProductionBatchRedesignController();
module.exports.analyzeProductionBatchNumber = analyzeProductionBatchNumber;
module.exports.generateBatchReference = generateBatchReference;

