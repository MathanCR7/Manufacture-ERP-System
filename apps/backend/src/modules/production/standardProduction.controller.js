const { randomUUID } = require('crypto');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const { getTaxSettingsData } = require('../setup/tax.controller');
const {
  toMl,
  round2,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays
} = require('./utils/productionCalculation');
const {
  formatDDMMYY,
  sanitizeToken,
  previewNextProductSerials
} = require('./services/productionDaySerial.service');
const {
  ensureMultiDaySchema,
  resolveNetPostEvapMixMl,
  getPreviousDaysAllocatedMl,
  syncParentBatchAggregate,
  getBatchDaysData,
  completeDayRun,
  startNextDayRun,
  updateCompletedDayCosts,
  updateCompletedDayRun
} = require('./services/standardProductionDay.service');
// Helper to generate unique PRODYYYYMMDD-XXXX batch reference (e.g. PROD20261021-0001)
async function generateBatchReference(tx, inputDate = new Date()) {
  const d = inputDate ? new Date(inputDate) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  
  const year = validDate.getFullYear().toString();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const datePrefix = `PROD${year}${month}${day}`;
  const searchPattern = `${datePrefix}-%`;

  const result = await tx.$queryRawUnsafe(`
    SELECT reference_no FROM production_batches 
    WHERE reference_no LIKE $1
    ORDER BY reference_no DESC 
    LIMIT 1 
    FOR UPDATE;
  `, searchPattern);
  const lastRecord = Array.isArray(result) && result.length > 0 ? result[0] : null;

  let nextNumber = 1;
  if (lastRecord && lastRecord.reference_no) {
    const lastNumberStr = lastRecord.reference_no.replace(`${datePrefix}-`, '');
    const parsed = parseInt(lastNumberStr, 10);
    if (!isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  return `${datePrefix}-${String(nextNumber).padStart(4, '0')}`;
}

// Helper to determine if current user has permission to see financial costing
function canViewCosting(user) {
  if (!user || !user.role) return false;
  const role = String(user.role).toUpperCase();
  return ['MAIN_MASTER', 'ADMIN', 'SUPERVISOR'].includes(role);
}

let isSchemaEnsured = false;
async function ensureStandardProductionSchema(p = prisma) {
  if (isSchemaEnsured) return;
  try {
    try {
      await p.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    } catch (_) {}

    // Ensure production_moulds table
    try {
      await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS production_moulds (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mould_code VARCHAR(50) NOT NULL UNIQUE,
          mould_name VARCHAR(150) NOT NULL,
          mould_category VARCHAR(100) NOT NULL,
          model_number VARCHAR(100),
          capacity_ml DECIMAL(10, 2) NOT NULL,
          cavity_count INT DEFAULT 1,
          total_nominal_capacity_ml DECIMAL(12, 2) GENERATED ALWAYS AS (capacity_ml * cavity_count) STORED,
          tray_length_mm DECIMAL(10, 2),
          tray_width_mm DECIMAL(10, 2),
          tray_height_mm DECIMAL(10, 2),
          cavity_length_mm DECIMAL(10, 2),
          cavity_width_mm DECIMAL(10, 2),
          cavity_depth_mm DECIMAL(10, 2),
          dimension_text VARCHAR(255),
          material VARCHAR(100) DEFAULT 'Stainless Steel 304',
          machine_type VARCHAR(100) DEFAULT 'Brine Tank Line',
          specification_status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
          supplier_id VARCHAR(100),
          supplier_name VARCHAR(200),
          status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (_) {}

    // Ensure view ice_cream_mould
    try {
      await p.$executeRawUnsafe(`
        CREATE OR REPLACE VIEW ice_cream_mould AS 
        SELECT * FROM production_moulds;
      `);
    } catch (_) {
      try {
        await p.$executeRawUnsafe(`DROP VIEW IF EXISTS ice_cream_mould CASCADE;`);
        await p.$executeRawUnsafe(`
          CREATE VIEW ice_cream_mould AS 
          SELECT * FROM production_moulds;
        `);
      } catch (dropErr) {
        // ignore if not allowed
      }
    }

    // Ensure production_batch_rm_line
    try {
      await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS production_batch_rm_line (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
          raw_material_id TEXT NOT NULL,
          lot_id TEXT,
          uom VARCHAR(30) NOT NULL,
          density NUMERIC(8,4) NOT NULL DEFAULT 1.0000 CHECK (density > 0),
          available_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
          required_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (required_qty >= 0),
          taken_qty NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (taken_qty >= 0),
          evaporates BOOLEAN NOT NULL DEFAULT FALSE,
          merged BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (_) {}

    // Ensure production_batch_merge
    try {
      await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS production_batch_merge (
          batch_id TEXT PRIMARY KEY REFERENCES production_batches(id) ON DELETE CASCADE,
          merge_stage VARCHAR(50) NOT NULL DEFAULT 'After heating',
          merged_total_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (merged_total_ml >= 0),
          evaporation_pct NUMERIC(6,2) NOT NULL DEFAULT 5.00 CHECK (evaporation_pct >= 0 AND evaporation_pct <= 100),
          evaporation_applied BOOLEAN NOT NULL DEFAULT FALSE,
          evaporated_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (evaporated_ml >= 0),
          mix_after_evap_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (mix_after_evap_ml >= 0),
          locked BOOLEAN NOT NULL DEFAULT FALSE,
          is_slide_merged BOOLEAN DEFAULT FALSE,
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await p.$executeRawUnsafe(`ALTER TABLE production_batch_merge ADD COLUMN IF NOT EXISTS is_slide_merged BOOLEAN DEFAULT FALSE;`);
    } catch (_) {}

    // Ensure production_batch_allocation
    try {
      await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS production_batch_allocation (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
          seq INT NOT NULL,
          product_id TEXT NOT NULL,
          use_mould BOOLEAN NOT NULL DEFAULT FALSE,
          mould_id UUID,
          capacity_ml NUMERIC(10,2) NOT NULL CHECK (capacity_ml >= 0),
          cavities INT NOT NULL DEFAULT 1 CHECK (cavities > 0),
          trays INT NOT NULL DEFAULT 0 CHECK (trays >= 0),
          waste_mode VARCHAR(20) NOT NULL DEFAULT 'PERCENT',
          waste_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (waste_value >= 0),
          mix_used_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (mix_used_ml >= 0),
          waste_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (waste_ml >= 0),
          good_pieces INT NOT NULL DEFAULT 0 CHECK (good_pieces >= 0),
          allocated_base_ml NUMERIC(16,2) DEFAULT 0,
          bulk_uom VARCHAR(30) DEFAULT 'L',
          product_rms JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_pb_alloc_batch_seq UNIQUE (batch_id, seq)
        );
      `);
    } catch (_) {}

    // Add columns to production_batches if missing (isolated per statement)
    const alterStatements = [
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS floor_stage VARCHAR(50) DEFAULT 'STEP1_RM';`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS merged_pre_evap_ml DECIMAL(15, 3) DEFAULT 0;`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS evaporation_rate_pct DECIMAL(6, 2) DEFAULT 5.00;`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS evaporation_loss_ml DECIMAL(15, 3) DEFAULT 0;`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS net_post_evap_mix_ml DECIMAL(15, 3) DEFAULT 0;`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS mould_allocations JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS timeline_stages JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS product_yields JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS allocated_base_ml NUMERIC(16,2) DEFAULT 0;`,
      `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS bulk_uom VARCHAR(30) DEFAULT 'L';`,
      `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS product_rms JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE production_batch_merge ADD COLUMN IF NOT EXISTS is_slide_merged BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE production_batch_rm_line ADD COLUMN IF NOT EXISTS unit_rate NUMERIC(14,4) DEFAULT 0;`,
      `ALTER TABLE production_batch_rm_line ADD COLUMN IF NOT EXISTS total_cost NUMERIC(16,2) DEFAULT 0;`,
      `ALTER TABLE production_batch_allocation DROP CONSTRAINT IF EXISTS production_batch_allocation_mould_id_fkey;`
    ];

    for (const sql of alterStatements) {
      try {
        await p.$executeRawUnsafe(sql);
      } catch (_) {}
    }

    // Ensure Multi-Day, Stock Lots & Per-Product 8-Digit Serial Schema
    await ensureMultiDaySchema(p);

    // Drop any legacy triggers to prevent duplicate stock restoration
    try {
      await p.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_revert_production_batch_stock ON production_batches;`);
      await p.$executeRawUnsafe(`DROP FUNCTION IF EXISTS trg_revert_stock_on_batch_delete CASCADE;`);
    } catch (_) {}

    isSchemaEnsured = true;
  } catch (schemaErr) {
    console.warn('ensureStandardProductionSchema notice:', schemaErr.message);
  }
}

// Run schema initialization asynchronously in background
ensureStandardProductionSchema().catch(() => {});

class StandardProductionController {

  // ── 1. GET /api/production/standard/moulds ──
  // Returns active moulds grouped by category; ?all=1 includes inactive ones
  async getMoulds(req, res, next) {
    try {
      const includeAll = req.query.all === '1' || req.query.all === 'true';
      const categoryFilter = req.query.category;

      let whereClause = includeAll ? '' : "WHERE status = 'ACTIVE'";
      if (categoryFilter) {
        whereClause += includeAll ? `WHERE mould_category = '${categoryFilter}'` : ` AND mould_category = '${categoryFilter}'`;
      }

      const moulds = await prisma.$queryRawUnsafe(`
        SELECT 
          id,
          mould_code,
          mould_name,
          mould_category,
          model_number,
          capacity_ml,
          cavity_count,
          tray_length_mm,
          tray_width_mm,
          tray_height_mm,
          cavity_length_mm,
          cavity_width_mm,
          cavity_depth_mm,
          dimension_text,
          material,
          machine_type,
          specification_status,
          'SPECIFICATION' AS dimension_source,
          supplier_id,
          supplier_name,
          status,
          total_nominal_capacity_ml,
          created_at,
          updated_at
        FROM ice_cream_mould
        ${whereClause}
        ORDER BY mould_category, mould_code;
      `);

      // Group by category
      const grouped = {};
      moulds.forEach(m => {
        const cat = m.mould_category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          ...m,
          capacity_ml: Number(m.capacity_ml),
          cavity_count: m.cavity_count !== null ? Number(m.cavity_count) : null,
          total_nominal_capacity_ml: m.total_nominal_capacity_ml !== null ? Number(m.total_nominal_capacity_ml) : null,
          tray_length_mm: m.tray_length_mm !== null ? Number(m.tray_length_mm) : null,
          tray_width_mm: m.tray_width_mm !== null ? Number(m.tray_width_mm) : null,
          tray_height_mm: m.tray_height_mm !== null ? Number(m.tray_height_mm) : null,
          cavity_length_mm: m.cavity_length_mm !== null ? Number(m.cavity_length_mm) : null,
          cavity_width_mm: m.cavity_width_mm !== null ? Number(m.cavity_width_mm) : null,
          cavity_depth_mm: m.cavity_depth_mm !== null ? Number(m.cavity_depth_mm) : null
        });
      });

      res.json({
        success: true,
        total: moulds.length,
        categories: Object.keys(grouped),
        grouped,
        moulds
      });
    } catch (err) {
      console.error('Error fetching moulds:', err);
      next(err);
    }
  }

  // ── 2. POST /api/production/standard (Create Draft) ──
  // Wizard allows saving draft at any time even with incomplete steps
  async createDraft(req, res, next) {
    try {
      const data = req.body || {};

      const created = await prisma.$transaction(async (tx) => {
        const generatedBatchNo = await generateBatchReference(tx, data.startDate || data.productionDate || new Date());
        const qty = Number(data.quantity || data.totalPlannedQty || 0);
        const shelfLife = Number(data.expiryDays || 365);
        const startDate = data.startDate ? new Date(data.startDate) : new Date();
        const expDate = new Date(startDate.getTime() + shelfLife * 24 * 60 * 60 * 1000);

        let productId = data.productId || data.selectedProducts?.[0]?.productId || data.selectedProducts?.[0]?.id;
        if (!productId) {
          const fallbackProd = await tx.finishedProduct.findFirst();
          productId = fallbackProd?.id;
        }

        const defaultUser = await tx.user.findFirst();
        const safeUserId = req.user?.id || defaultUser?.id;

        const batch = await tx.productionBatchNew.create({
          data: {
            batchNo: generatedBatchNo,
            referenceNo: generatedBatchNo,
            productId: productId || null,
            productionType: 'STANDARD',
            status: 'Draft',
            startDate: startDate,
            expiryDays: shelfLife,
            expiryDate: expDate,
            quantity: qty,
            remainingQty: qty,
            totalCost: Number(data.grandTotal || 0),
            shift: data.shift || 'Morning',
            machineLine: data.machineLine || 'Main Processing Line',
            baseId: data.baseId || null,
            templateId: data.templateId || null,
            categoryId: data.categoryId || null,
            subCategoryId: data.subCategoryId || null,
            note: data.note || null,
            labourCount: Number(data.labourCount || 1),
            labourStaffIds: data.assignedStaffIds || [],
            labourStaffDetails: data.labourStaffDetails || [],
            timelineStages: data.timelineStages || [],
            subTotal: Number(data.subTotal || 0),
            wastageAmt: Number(data.wastageAmt || 0),
            overheadAmt: Number(data.overheadAmt || 0),
            grandTotal: Number(data.grandTotal || 0),
            costPerUnit: Number(data.costPerUnit || 0),
            createdBy: safeUserId
          }
        });

        // Persist additive DDMMYY editable short batch code & initial active_day_no
        const defaultShortCode = sanitizeToken(
          data.shortBatchCode || data.dayBatchCode || formatDDMMYY(startDate),
          24,
          formatDDMMYY(startDate)
        );
        await tx.$executeRawUnsafe(`
          UPDATE production_batches
          SET short_batch_code = $2,
              active_day_no = 1,
              completed_days_count = 0,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, batch.id, defaultShortCode).catch(() => {});

        // If formulation lines were sent, save them into production_batch_rm_line
        const rawMaterials = Array.isArray(data.rawMaterials) ? data.rawMaterials : [];
        for (const rm of rawMaterials) {
          const rmId = rm.rawMaterialId || rm.rmId;
          if (!rmId) continue;

          // Lookup RM defaults safely
          const rmMaster = await tx.$queryRawUnsafe(`
            SELECT 
              "currentStock",
              1.0000::numeric(8,4) AS density_g_per_ml,
              CASE 
                WHEN LOWER(name) LIKE '%milk%' OR LOWER(name) LIKE '%smp%' OR LOWER(name) LIKE '%stabilizer%' OR LOWER(name) LIKE '%rabdi%' THEN TRUE 
                ELSE FALSE 
              END AS evaporates_by_default
            FROM "RawMaterial" WHERE id = $1 LIMIT 1;
          `, rmId);
          const master = rmMaster[0] || {};

          const totalAlloc = Array.isArray(rm.allocatedBatches)
            ? rm.allocatedBatches.reduce((sum, b) => sum + Number(b.allocatedQty || 0), 0)
            : 0;
          const density = Number(rm.density || master.density_g_per_ml || 1.0);
          const evaporates = Boolean(rm.evaporates ?? master.evaporates_by_default ?? false);
          const required = totalAlloc > 0 ? totalAlloc : Number(rm.requiredQty || 0);
          const available = totalAlloc > 0 ? totalAlloc : Number(rm.availableQty ?? master.currentStock ?? 0);
          const taken = totalAlloc > 0 ? totalAlloc : Number(rm.takenQty ?? required);
          const lineId = require('crypto').randomUUID();

          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_rm_line (
              id, batch_id, raw_material_id, lot_id, uom, density,
              available_qty, required_qty, taken_qty, evaporates, merged,
              created_at, updated_at
            ) VALUES (
              $1::uuid, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, lineId, batch.id, rmId, rm.lotId || (rm.allocatedBatches?.[0]?.batchId) || null, rm.uom || rm.selectedUom || 'kg', density,
             available, required, taken, evaporates, rm.merged !== undefined ? Boolean(rm.merged) : true);

          const primaryLotNum = (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches[0]?.lotNumber) ||
            (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches[0]?.internalBatchNo) ||
            'LOT-DIRECT';

          // Ensure exactly one usage record per raw material line
          try {
            await tx.$executeRawUnsafe(
              `INSERT INTO production_batch_rm_usage (
                id, batch_id, rm_id, required_qty, available_qty_at_time,
                actual_used_qty, unit_cost, total_cost, status,
                internal_batch_no, selected_uom, input_qty
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, 'ALLOCATED',
                $9, $10, $11
              ) ON CONFLICT (id) DO UPDATE SET
                actual_used_qty = EXCLUDED.actual_used_qty,
                total_cost = EXCLUDED.total_cost,
                input_qty = EXCLUDED.input_qty;`,
              lineId, batch.id, rmId, required, available,
              taken, Number(rm.unitRate || 0), Number(rm.unitRate || 0) * taken,
              primaryLotNum, rm.uom || rm.selectedUom || 'kg', taken
            );
          } catch (_) {}

          // Persist raw material batch allocations to database
          if (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0) {
            for (const ab of rm.allocatedBatches) {
              const isManual = Boolean(ab.isManualOverride || String(ab.batchId).startsWith('manual-'));
              const lotNum = ab.lotNumber || ab.internalBatchNo || 'LOT-DIRECT';
              
              if (isManual) {
                try {
                  const existingLot = await tx.inventoryBatch.findFirst({ where: { batchNumber: lotNum } });
                  if (!existingLot) {
                    await tx.inventoryBatch.create({
                      data: {
                        rawMaterialId: rmId,
                        rawMaterialName: rm.rawMaterialName || rm.name,
                        batchNumber: lotNum,
                        mfgBatchNo: ab.supplierBatchNo || 'SUP-LOT-01',
                        netQty: Number(ab.availableQty || Math.max(Number(ab.allocatedQty || 0) * 2, 500)),
                        status: 'AVAILABLE',
                        expiryDate: ab.expiryDate ? new Date(ab.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                        costPerUnit: Number(ab.unitRate || rm.unitRate || 0),
                        storageLocation: 'Central Store / Floor Manual',
                        isManualOverride: true
                      }
                    });
                  }
                } catch (_) {}
              }

              try {
                await tx.$executeRawUnsafe(
                  `INSERT INTO "production_batch_allocations" (
                    batch_id, usage_id, inventory_batch_id, lot_number,
                    allocated_qty, po_original_qty, po_total_amount,
                    allocated_amount, unit_rate, uom,
                    is_manual_override, grn_number, po_number, supplier_batch_no
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                  batch.id,
                  lineId,
                  ab.batchId ? String(ab.batchId) : null,
                  lotNum,
                  Number(ab.allocatedQty || 0),
                  Number(ab.availableQty || ab.allocatedQty || 0),
                  Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || 0))),
                  Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || 0))),
                  Number(ab.unitRate || rm.unitRate || 0),
                  ab.uom || rm.uom || rm.selectedUom || 'kg',
                  isManual,
                  ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
                  ab.poNumber || 'PO-MANUAL-OVERRIDE',
                  ab.supplierBatchNo || 'SUP-LOT-01'
                );
              } catch (allocErr) {
                console.warn('Notice saving production_batch_allocations:', allocErr.message);
              }
            }
          }
        }

        return batch;
      });

      res.status(201).json({
        success: true,
        message: 'Draft batch created successfully',
        batch: created,
        id: created.id
      });
    } catch (err) {
      console.error('Error creating draft batch:', err);
      next(err);
    }
  }

  // ── 3. PUT /api/production/standard/:id/draft (Update Draft) ──
  async updateDraft(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body || {};

      const updated = await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE to prevent race conditions
        const rows = await tx.$queryRawUnsafe(`
          SELECT id, status FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Production batch not found' });
        }

        const currentBatch = rows[0];
        if (currentBatch.status !== 'Draft') {
          return res.status(409).json({
            error: `Cannot update draft batch. Current status is '${currentBatch.status}'. Edits are locked after production start.`
          });
        }

        const batch = await tx.productionBatchNew.update({
          where: { id },
          data: {
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            shift: data.shift !== undefined ? data.shift : undefined,
            machineLine: data.machineLine !== undefined ? data.machineLine : undefined,
            baseId: data.baseId !== undefined ? data.baseId : undefined,
            templateId: data.templateId !== undefined ? data.templateId : undefined,
            categoryId: data.categoryId !== undefined ? data.categoryId : undefined,
            subCategoryId: data.subCategoryId !== undefined ? data.subCategoryId : undefined,
            quantity: data.quantity !== undefined ? Number(data.quantity) : undefined,
            note: data.note !== undefined ? data.note : undefined,
            expiryDays: data.expiryDays !== undefined ? Number(data.expiryDays) : undefined,
            labourCount: data.labourCount !== undefined ? Number(data.labourCount) : undefined,
            labourStaffIds: data.assignedStaffIds || undefined,
            labourStaffDetails: data.labourStaffDetails || undefined,
            timelineStages: data.timelineStages || undefined,
            subTotal: data.subTotal !== undefined ? Number(data.subTotal) : undefined,
            wastageAmt: data.wastageAmt !== undefined ? Number(data.wastageAmt) : undefined,
            overheadAmt: data.overheadAmt !== undefined ? Number(data.overheadAmt) : undefined,
            grandTotal: data.grandTotal !== undefined ? Number(data.grandTotal) : undefined,
            costPerUnit: data.costPerUnit !== undefined ? Number(data.costPerUnit) : undefined
          }
        });

        // Update RM lines if provided
        if (Array.isArray(data.rawMaterials) && data.rawMaterials.length > 0) {
          await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_line WHERE batch_id = $1;`, id);
          try {
            await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_usage WHERE batch_id = $1;`, id);
            await tx.$executeRawUnsafe(`DELETE FROM "production_batch_allocations" WHERE batch_id = $1;`, id);
          } catch (_) {}

          for (const rm of data.rawMaterials) {
            const rmId = rm.rawMaterialId || rm.rmId;
            if (!rmId) continue;
            const rmMaster = await tx.$queryRawUnsafe(`
              SELECT 
                "currentStock",
                1.0000::numeric(8,4) AS density_g_per_ml,
                CASE 
                  WHEN LOWER(name) LIKE '%milk%' OR LOWER(name) LIKE '%smp%' OR LOWER(name) LIKE '%stabilizer%' OR LOWER(name) LIKE '%rabdi%' THEN TRUE 
                  ELSE FALSE 
                END AS evaporates_by_default
              FROM "RawMaterial" WHERE id = $1 LIMIT 1;
            `, rmId);
            const master = rmMaster[0] || {};
            const totalAlloc = Array.isArray(rm.allocatedBatches)
              ? rm.allocatedBatches.reduce((sum, b) => sum + Number(b.allocatedQty || 0), 0)
              : 0;
            const density = Number(rm.density || master.density_g_per_ml || 1.0);
            const evaporates = Boolean(rm.evaporates ?? master.evaporates_by_default ?? false);
            const required = totalAlloc > 0 ? totalAlloc : Number(rm.requiredQty || 0);
            const available = totalAlloc > 0 ? totalAlloc : Number(rm.availableQty ?? master.currentStock ?? 0);
            const taken = totalAlloc > 0 ? totalAlloc : Number(rm.takenQty ?? required);
            const lineId = require('crypto').randomUUID();

            await tx.$executeRawUnsafe(`
              INSERT INTO production_batch_rm_line (
                id, batch_id, raw_material_id, lot_id, uom, density,
                available_qty, required_qty, taken_qty, evaporates, merged,
                created_at, updated_at
              ) VALUES (
                $1::uuid, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              );
            `, lineId, id, rmId, rm.lotId || (rm.allocatedBatches?.[0]?.batchId) || null, rm.uom || rm.selectedUom || 'kg', density,
               available, required, taken, evaporates, rm.merged !== undefined ? Boolean(rm.merged) : true);

            const primaryLotNum = (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches[0]?.lotNumber) ||
              (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches[0]?.internalBatchNo) ||
              'LOT-DIRECT';

            // Ensure exactly one usage record per raw material line
            try {
              await tx.$executeRawUnsafe(
                `INSERT INTO production_batch_rm_usage (
                  id, batch_id, rm_id, required_qty, available_qty_at_time,
                  actual_used_qty, unit_cost, total_cost, status,
                  internal_batch_no, selected_uom, input_qty
                ) VALUES (
                  $1, $2, $3, $4, $5,
                  $6, $7, $8, 'ALLOCATED',
                  $9, $10, $11
                ) ON CONFLICT (id) DO UPDATE SET
                  actual_used_qty = EXCLUDED.actual_used_qty,
                  total_cost = EXCLUDED.total_cost,
                  input_qty = EXCLUDED.input_qty;`,
                lineId, id, rmId, required, available,
                taken, Number(rm.unitRate || 0), Number(rm.unitRate || 0) * taken,
                primaryLotNum, rm.uom || rm.selectedUom || 'kg', taken
              );
            } catch (_) {}

            // Persist raw material batch allocations to database
            if (Array.isArray(rm.allocatedBatches) && rm.allocatedBatches.length > 0) {
              for (const ab of rm.allocatedBatches) {
                const isManual = Boolean(ab.isManualOverride || String(ab.batchId).startsWith('manual-'));
                const lotNum = ab.lotNumber || ab.internalBatchNo || 'LOT-DIRECT';
                
                if (isManual) {
                  try {
                    const existingLot = await tx.inventoryBatch.findFirst({ where: { batchNumber: lotNum } });
                    if (!existingLot) {
                      await tx.inventoryBatch.create({
                        data: {
                          rawMaterialId: rmId,
                          rawMaterialName: rm.rawMaterialName || rm.name,
                          batchNumber: lotNum,
                          mfgBatchNo: ab.supplierBatchNo || 'SUP-LOT-01',
                          netQty: Number(ab.availableQty || Math.max(Number(ab.allocatedQty || 0) * 2, 500)),
                          status: 'AVAILABLE',
                          expiryDate: ab.expiryDate ? new Date(ab.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                          costPerUnit: Number(ab.unitRate || rm.unitRate || 0),
                          storageLocation: 'Central Store / Floor Manual',
                          isManualOverride: true
                        }
                      });
                    }
                  } catch (_) {}
                }

                try {
                  await tx.$executeRawUnsafe(
                    `INSERT INTO "production_batch_allocations" (
                      batch_id, usage_id, inventory_batch_id, lot_number,
                      allocated_qty, po_original_qty, po_total_amount,
                      allocated_amount, unit_rate, uom,
                      is_manual_override, grn_number, po_number, supplier_batch_no
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                    id,
                    lineId,
                    ab.batchId ? String(ab.batchId) : null,
                    lotNum,
                    Number(ab.allocatedQty || 0),
                    Number(ab.availableQty || ab.allocatedQty || 0),
                    Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || 0))),
                    Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || 0))),
                    Number(ab.unitRate || rm.unitRate || 0),
                    ab.uom || rm.uom || rm.selectedUom || 'kg',
                    isManual,
                    ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
                    ab.poNumber || 'PO-MANUAL-OVERRIDE',
                    ab.supplierBatchNo || 'SUP-LOT-01'
                  );
                } catch (allocErr) {
                  console.warn('Notice saving production_batch_allocations in updateDraft:', allocErr.message);
                }
              }
            }
          }
        }

        return batch;
      });

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Draft batch updated successfully',
          batch: updated
        });
      }
    } catch (err) {
      console.error('Error updating draft batch:', err);
      next(err);
    }
  }

  // ── 4. POST /api/production/standard/:id/start ──
  // Moves status DRAFT to IN_PROGRESS. Validates mandatory fields (date, shift, base, template)
  // Pre-creates one RM line per formulation line. Wizard steps become read-only.
  async startProduction(req, res, next) {
    try {
      const { id } = req.params;

      const started = await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE
        const rows = await tx.$queryRawUnsafe(`
          SELECT * FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Production batch not found' });
        }

        const batch = rows[0];
        if (batch.status !== 'Draft') {
          return res.status(409).json({
            error: `Cannot start production. Batch is already in '${batch.status}' status.`
          });
        }

        // Validate mandatory fields (date, shift, base, template)
        const missingFields = [];
        if (!batch.start_date) missingFields.push('Date (start_date)');
        if (!batch.shift) missingFields.push('Shift');
        if (!batch.base_id) missingFields.push('Base Recipe (base_id)');
        if (!batch.template_id) missingFields.push('Template (template_id)');

        if (missingFields.length > 0) {
          return res.status(422).json({
            error: 'Mandatory fields missing to start production batch',
            missingFields,
            message: `Please complete required wizard steps before starting: ${missingFields.join(', ')}`
          });
        }

        // Fetch formulation lines from template
        const templateLines = await tx.$queryRawUnsafe(`
          SELECT 
            ptl.id,
            ptl.raw_material_id,
            ptl.quantity,
            ptl.uom,
            rm.name AS raw_material_name,
            rm.code AS raw_material_code,
            rm."currentStock" AS current_stock,
            1.0000::numeric(8,4) AS density_g_per_ml,
            CASE 
              WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
              ELSE FALSE 
            END AS evaporates_by_default,
            rm."ratePerUnit" AS rate_per_unit
          FROM production_template_lines ptl
          LEFT JOIN "RawMaterial" rm ON rm.id = ptl.raw_material_id
          WHERE ptl.template_id::text = $1::text;
        `, batch.template_id);

        // Pre-create or ensure lines in production_batch_rm_line
        const existingLines = await tx.$queryRawUnsafe(`
          SELECT id FROM production_batch_rm_line WHERE batch_id = $1;
        `, id);

        if (existingLines.length === 0 && templateLines.length > 0) {
          for (const line of templateLines) {
            const reqQty = Number(line.quantity || 0);
            const density = Number(line.density_g_per_ml || 1.0);
            const evaporates = Boolean(line.evaporates_by_default ?? false);
            const available = Number(line.current_stock || 0);

            await tx.$executeRawUnsafe(`
              INSERT INTO production_batch_rm_line (
                id, batch_id, raw_material_id, uom, density,
                available_qty, required_qty, taken_qty, evaporates, merged,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4,
                $5, $6, $7, $8, true,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              );
            `, id, line.raw_material_id, line.uom || 'kg', density,
               available, reqQty, reqQty, evaporates);
          }
        }

        // Initialize production_batch_merge entry
        try {
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_merge (
              batch_id, merge_stage, merged_total_ml, evaporation_pct,
              evaporation_applied, evaporated_ml, mix_after_evap_ml, locked, updated_at
            ) VALUES (
              $1, 'After heating', 0, 5.00,
              false, 0, 0, false, CURRENT_TIMESTAMP
            )
            ON CONFLICT (batch_id) DO NOTHING;
          `, id);
        } catch (mErr) {
          console.warn('Notice initializing production_batch_merge:', mErr.message);
        }

        // Update batch status to IN_PROGRESS (In Progress)
        const operatorName = req.user?.username || req.user?.name || 'Operator';
        await tx.$executeRawUnsafe(`
          UPDATE production_batches 
          SET 
            status = 'In Progress',
            started_at = CURRENT_TIMESTAMP,
            started_by = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, operatorName);

        return {
          id,
          batchNo: batch.batch_no,
          status: 'In Progress',
          startedAt: new Date(),
          startedBy: operatorName
        };
      });

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Production started successfully! Screen transitioned to Floor Execution Cockpit.',
          batch: started
        });
      }
    } catch (err) {
      console.error('Error starting production:', err);
      next(err);
    }
  }

  // ── 5. PUT /api/production/standard/:id/process ──
  // Section A & B: Update RM taken quantities, merge stage, evaporation percentage
  // Server recomputes everything using shared calculation module!
  async processFloorExecution(req, res, next) {
    try {
      const { id } = req.params;
      const {
        lines = [],
        mergeStage = 'Before freezing',
        evaporationPct = 5.0,
        evaporationApplied = true,
        isSlideMerged = undefined,
        dayNo = 1
      } = req.body || {};

      if (Number(dayNo || 1) !== 1) {
        return res.status(403).json({
          error: 'Base raw materials and evaporation can only be edited on Day 1. On Day 2+, edit only Products & Moulds, Factory Timeline, and Actual Yield.'
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE on batch
        const batchRows = await tx.$queryRawUnsafe(`
          SELECT id, status, base_rm_deducted FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!batchRows || batchRows.length === 0) {
          const err = new Error('Production batch not found');
          err.statusCode = 404;
          throw err;
        }

        const batch = batchRows[0];
        if (batch.status === 'Completed') {
          const err = new Error('Cannot process floor execution. Batch is already Completed.');
          err.statusCode = 409;
          throw err;
        }
        const alreadyDeductedBaseRm = Boolean(batch.base_rm_deducted);
        if (batch.status !== 'In Progress' && batch.status !== 'IN_PROGRESS' && !alreadyDeductedBaseRm) {
          await tx.$executeRawUnsafe(`
            UPDATE production_batches SET status = 'In Progress', started_at = CURRENT_TIMESTAMP WHERE id = $1;
          `, id);
        }

        // Snapshot prior RM lines & lot allocations when editing Day 1 after base RM deduction
        const prevRmTakenMap = new Map();
        const prevLotTakenMap = new Map();
        let wasMergeLocked = false;
        try {
          const mergeRows = await tx.$queryRawUnsafe(`
            SELECT locked FROM production_batch_merge WHERE batch_id = $1;
          `, id);
          wasMergeLocked = Boolean(mergeRows?.[0]?.locked);
        } catch (_) {}

        if (alreadyDeductedBaseRm) {
          const prevLines = await tx.$queryRawUnsafe(`
            SELECT raw_material_id, lot_id, taken_qty FROM production_batch_rm_line WHERE batch_id = $1;
          `, id).catch(() => []);
          for (const pl of prevLines || []) {
            if (pl.raw_material_id) {
              prevRmTakenMap.set(pl.raw_material_id, (prevRmTakenMap.get(pl.raw_material_id) || 0) + Number(pl.taken_qty || 0));
            }
          }
          const prevAllocs = await tx.$queryRawUnsafe(`
            SELECT inventory_batch_id, lot_number, allocated_qty FROM "production_batch_allocations"
            WHERE batch_id = $1 AND usage_id IS NOT NULL;
          `, id).catch(() => []);
          for (const pa of prevAllocs || []) {
            const lk = (pa.inventory_batch_id || pa.lot_number || '').trim();
            if (lk) prevLotTakenMap.set(lk, (prevLotTakenMap.get(lk) || 0) + Number(pa.allocated_qty || 0));
          }
        }

        // Fetch raw material master metadata for density & default evaporation
        const rmIds = lines.map(l => l.rawMaterialId || l.rmId).filter(Boolean);
        const rmMap = new Map();
        if (rmIds.length > 0) {
          const masters = await tx.$queryRawUnsafe(`
            SELECT 
              id, name, "consumptionUnit", "currentStock", "ratePerUnit",
              1.0000::numeric(8,4) AS density_g_per_ml,
              CASE 
                WHEN LOWER(name) LIKE '%milk%' OR LOWER(name) LIKE '%smp%' OR LOWER(name) LIKE '%stabilizer%' OR LOWER(name) LIKE '%rabdi%' THEN TRUE 
                ELSE FALSE 
              END AS evaporates_by_default
            FROM "RawMaterial"
            WHERE id = ANY($1::text[]);
          `, rmIds);
          masters.forEach(m => rmMap.set(m.id, m));
        }

        // Enrich lines with master defaults and ensure rmId is always resolved
        const fallbackRm = await tx.rawMaterial.findFirst();
        const enrichedLines = [];
        for (const line of lines) {
          let rmId = line.rawMaterialId || line.rmId;
          if (!rmId && line.rawMaterialName) {
            const found = await tx.rawMaterial.findFirst({
              where: {
                name: { contains: line.rawMaterialName, mode: 'insensitive' }
              }
            });
            rmId = found?.id;
          }
          if (!rmId) {
            rmId = fallbackRm?.id;
          }

          const master = rmMap.get(rmId) || (rmId ? await tx.rawMaterial.findUnique({ where: { id: rmId } }) : null) || {};

          const totalAlloc = Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0
            ? line.allocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0)
            : 0;
          const lineReq = Number(line.requiredQty || 0);
          const requiredQty = totalAlloc > 0 ? totalAlloc : lineReq;
          const availableQty = totalAlloc > 0 ? totalAlloc : Number(line.availableQty || 0);
          const takenQty = Number(line.takenQty !== undefined && line.takenQty !== null 
            ? line.takenQty 
            : (totalAlloc > 0 ? totalAlloc : requiredQty));

          enrichedLines.push({
            ...line,
            rawMaterialId: rmId,
            rawMaterialName: line.rawMaterialName || master.name || 'Raw Material',
            uom: line.uom || master.consumptionUnit || master.unitId || 'kg',
            density: Number(line.density || master.density_g_per_ml || 1.0),
            evaporates: line.evaporates !== undefined ? Boolean(line.evaporates) : Boolean(master.evaporates_by_default),
            availableQty,
            requiredQty,
            takenQty,
            merged: Boolean(line.merged ?? true),
            unitRate: Number(line.unitRate || master.ratePerUnit || 0)
          });
        }

        // Compute evaporation using shared calculation engine
        const computed = calculateEvaporation({
          lines: enrichedLines,
          evaporationPct,
          mergeStage,
          evaporationApplied
        });

        // Persist computed lines into production_batch_rm_line and keep production_batch_rm_usage synchronized
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_line WHERE batch_id = $1;`, id);
        try {
          await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_usage WHERE batch_id = $1;`, id);
          await tx.$executeRawUnsafe(`DELETE FROM "production_batch_allocations" WHERE batch_id = $1;`, id);
        } catch (_) {}

        for (const line of computed.lines) {
          const lineId = require('crypto').randomUUID();
          const primaryLotId = (Array.isArray(line.allocatedBatches) && line.allocatedBatches[0]?.batchId)
            ? String(line.allocatedBatches[0].batchId)
            : (line.lotId || null);

          const lineRate = Number(line.unitRate || line.rate_per_unit || 0);
          const lineCost = lineRate * Number(line.takenQty || 0);

          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_rm_line (
              id, batch_id, raw_material_id, lot_id, uom, density,
              available_qty, required_qty, taken_qty, evaporates, merged,
              unit_rate, total_cost,
              created_at, updated_at
            ) VALUES (
              $1::uuid, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, lineId, id, line.rawMaterialId, primaryLotId, line.uom, line.density,
             line.availableQty, line.requiredQty, line.takenQty, line.evaporates, line.merged,
             lineRate, lineCost);

          const primaryLotNum = (Array.isArray(line.allocatedBatches) && line.allocatedBatches[0]?.lotNumber) ||
            (Array.isArray(line.allocatedBatches) && line.allocatedBatches[0]?.internalBatchNo) ||
            'LOT-DIRECT';

          // Record exactly ONE synchronized production_batch_rm_usage per raw material line
          try {
            await tx.$executeRawUnsafe(
              `INSERT INTO production_batch_rm_usage (
                id, batch_id, rm_id, required_qty, available_qty_at_time,
                actual_used_qty, unit_cost, total_cost, status,
                internal_batch_no, selected_uom, input_qty
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, 'ALLOCATED',
                $9, $10, $11
              ) ON CONFLICT (id) DO UPDATE SET
                actual_used_qty = EXCLUDED.actual_used_qty,
                total_cost = EXCLUDED.total_cost,
                input_qty = EXCLUDED.input_qty;`,
              lineId, id, line.rawMaterialId, Number(line.requiredQty || 0), Number(line.availableQty || 0),
              Number(line.takenQty || 0), lineRate, lineCost,
              primaryLotNum, line.uom || 'kg', Number(line.takenQty || 0)
            );
          } catch (_) {}

          // If raw material line has allocated lots, persist to production_batch_allocations
          if (Array.isArray(line.allocatedBatches) && line.allocatedBatches.length > 0) {
            for (const ab of line.allocatedBatches) {
              const isManual = Boolean(ab.isManualOverride || String(ab.batchId).startsWith('manual-'));
              const lotNum = ab.lotNumber || ab.internalBatchNo || 'LOT-DIRECT';

              // Ensure manual lot exists in InventoryBatch
              if (isManual) {
                try {
                  const existingLot = await tx.inventoryBatch.findFirst({
                    where: { batchNumber: lotNum }
                  });
                  if (!existingLot) {
                    await tx.inventoryBatch.create({
                      data: {
                        rawMaterialId: line.rawMaterialId,
                        rawMaterialName: line.rawMaterialName,
                        batchNumber: lotNum,
                        mfgBatchNo: ab.supplierBatchNo || 'SUP-LOT-01',
                        netQty: Number(ab.availableQty || Math.max(Number(ab.allocatedQty || 0) * 2, 500)),
                        status: 'AVAILABLE',
                        expiryDate: ab.expiryDate ? new Date(ab.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                        costPerUnit: Number(ab.unitRate || line.unitRate || 0),
                        storageLocation: 'Central Store / Floor Manual',
                        isManualOverride: true
                      }
                    });
                  }
                } catch (_) {}
              }

              try {
                await tx.$executeRawUnsafe(
                  `INSERT INTO "production_batch_allocations" (
                    batch_id, usage_id, inventory_batch_id, lot_number,
                    allocated_qty, po_original_qty, po_total_amount,
                    allocated_amount, unit_rate, uom,
                    is_manual_override, grn_number, po_number, supplier_batch_no
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                  id,
                  lineId,
                  ab.batchId ? String(ab.batchId) : null,
                  lotNum,
                  Number(ab.allocatedQty || 0),
                  Number(ab.availableQty || ab.allocatedQty || 0),
                  Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || line.unitRate || 0))),
                  Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || line.unitRate || 0))),
                  Number(ab.unitRate || line.unitRate || 0),
                  ab.uom || line.uom || 'kg',
                  isManual,
                  ab.grnNumber || 'GRN-MANUAL-OVERRIDE',
                  ab.poNumber || 'PO-MANUAL-OVERRIDE',
                  ab.supplierBatchNo || 'SUP-LOT-01'
                );
              } catch (_) {}
            }
          }
        }

        // Persist computed merge results into production_batch_merge
        const effectiveSlideMerged = Boolean(isSlideMerged !== undefined ? isSlideMerged : (computed.totalBeforeEvapMl > 0));
        try {
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_merge (
              batch_id, merge_stage, merged_total_ml, evaporation_pct,
              evaporation_applied, evaporated_ml, mix_after_evap_ml, locked, is_slide_merged, updated_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8, $9, CURRENT_TIMESTAMP
            )
            ON CONFLICT (batch_id) DO UPDATE SET
              merge_stage = EXCLUDED.merge_stage,
              merged_total_ml = EXCLUDED.merged_total_ml,
              evaporation_pct = EXCLUDED.evaporation_pct,
              evaporation_applied = EXCLUDED.evaporation_applied,
              evaporated_ml = EXCLUDED.evaporated_ml,
              mix_after_evap_ml = EXCLUDED.mix_after_evap_ml,
              locked = EXCLUDED.locked,
              is_slide_merged = EXCLUDED.is_slide_merged,
              updated_at = CURRENT_TIMESTAMP;
          `, id, computed.mergeStage, computed.totalBeforeEvapMl, computed.evaporationPct,
             computed.evaporationApplied, computed.evaporatedMl, computed.mixAfterEvapMl, wasMergeLocked, effectiveSlideMerged);
        } catch (mErr) {
          console.warn('Notice persisting to production_batch_merge:', mErr.message);
        }

        // If Base RM was already deducted on Day 1 completion, apply ONLY net delta to RawMaterial & InventoryBatch
        if (alreadyDeductedBaseRm) {
          const newRmTakenMap = new Map();
          const newLotTakenMap = new Map();
          for (const l of computed.lines || []) {
            if (l.rawMaterialId) {
              newRmTakenMap.set(l.rawMaterialId, (newRmTakenMap.get(l.rawMaterialId) || 0) + Number(l.takenQty || 0));
            }
            if (Array.isArray(l.allocatedBatches)) {
              for (const ab of l.allocatedBatches) {
                const lk = String(ab.batchId || ab.lotNumber || ab.internalBatchNo || '').trim();
                if (lk) newLotTakenMap.set(lk, (newLotTakenMap.get(lk) || 0) + Number(ab.allocatedQty || 0));
              }
            }
          }
          const allRmIds = new Set([...prevRmTakenMap.keys(), ...newRmTakenMap.keys()]);
          for (const rmId of allRmIds) {
            const delta = round2((newRmTakenMap.get(rmId) || 0) - (prevRmTakenMap.get(rmId) || 0));
            if (Math.abs(delta) > 0.0001) {
              await tx.$executeRawUnsafe(`
                UPDATE "RawMaterial" SET "currentStock" = GREATEST(0, "currentStock" - $1), "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2;
              `, delta, rmId).catch(() => {});
            }
          }
          const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const allLots = new Set([...prevLotTakenMap.keys(), ...newLotTakenMap.keys()]);
          for (const lk of allLots) {
            const delta = round2((newLotTakenMap.get(lk) || 0) - (prevLotTakenMap.get(lk) || 0));
            if (Math.abs(delta) > 0.0001) {
              if (uuidRx.test(lk)) {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch"
                  SET "netQty" = GREATEST(0, "netQty" - $1),
                      "status" = CASE WHEN GREATEST(0, "netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, delta, lk).catch(() => {});
              } else {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch"
                  SET "netQty" = GREATEST(0, "netQty" - $1),
                      "status" = CASE WHEN GREATEST(0, "netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE "batchNumber" = $2;
                `, delta, lk).catch(() => {});
              }
            }
          }
          await tx.$executeRawUnsafe(`UPDATE production_batch_rm_usage SET status = 'CONSUMED' WHERE batch_id = $1;`, id).catch(() => {});
        }

        // Mirror to production_batches columns & recalculate Day 1 / active Day carry-forward balances
        await tx.$executeRawUnsafe(`
          UPDATE production_batches 
          SET 
            floor_stage = $2,
            merged_pre_evap_ml = $3,
            evaporation_rate_pct = $4,
            evaporation_loss_ml = $5,
            net_post_evap_mix_ml = $6,
            remaining_mix_balance_ml = GREATEST(0, $6 - COALESCE((
              SELECT SUM(allocated_mix_ml) FROM production_batch_days WHERE batch_id = $1 AND status <> 'IN_PROGRESS'
            ), 0)),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, computed.mergeStage, computed.totalBeforeEvapMl, computed.evaporationPct,
           computed.evaporatedMl, computed.mixAfterEvapMl);

        if (alreadyDeductedBaseRm) {
          await tx.$executeRawUnsafe(`
            UPDATE production_batch_days
            SET opening_mix_ml = $2,
                remaining_mix_ml = GREATEST(0, $2 - allocated_mix_ml),
                updated_at = CURRENT_TIMESTAMP
            WHERE batch_id = $1 AND day_no = 1;
          `, id, computed.mixAfterEvapMl).catch(() => {});

          const usedCompletedRows = await tx.$queryRawUnsafe(`
            SELECT COALESCE(SUM(allocated_mix_ml), 0) AS used_ml
            FROM production_batch_days
            WHERE batch_id = $1 AND status <> 'IN_PROGRESS';
          `, id).catch(() => []);
          const usedCompletedMl = Number(usedCompletedRows?.[0]?.used_ml || 0);
          const openCascadeMl = Math.max(0, round2(Number(computed.mixAfterEvapMl || 0) - usedCompletedMl));
          await tx.$executeRawUnsafe(`
            UPDATE production_batch_days
            SET opening_mix_ml = $2,
                remaining_mix_ml = GREATEST(0, $2 - allocated_mix_ml),
                updated_at = CURRENT_TIMESTAMP
            WHERE batch_id = $1 AND day_no > 1 AND status = 'IN_PROGRESS';
          `, id, openCascadeMl).catch(() => {});

          await syncParentBatchAggregate(tx, id);
        }

        return computed;
      });

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Floor raw materials and evaporation successfully processed',
          data: result
        });
      }
    } catch (err) {
      console.error('Error processing floor execution:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  }

  // ── 6. PUT /api/production/standard/:id/allocations ──
  // Section C: Replaces finished product allocations atomically in one transaction (Day-aware)
  async saveAllocations(req, res, next) {
    try {
      const { id } = req.params;
      const { allocations = [], dayNo, dayBatchCode, productionDate } = req.body || {};

      // Existence and status pre-check outside transaction
      const batchCheck = await prisma.$queryRawUnsafe(`
        SELECT id, status, quantity, is_finalized FROM production_batches WHERE id = $1;
      `, id);

      if (!batchCheck || batchCheck.length === 0) {
        return res.status(404).json({ error: 'Production batch not found' });
      }

      if (batchCheck[0].status === 'Completed' || batchCheck[0].is_finalized) {
        return res.status(409).json({
          error: `Cannot update mould allocations. Batch is already Completed.`
        });
      }

      await ensureStandardProductionSchema();
      await ensureMultiDaySchema(prisma);

      const result = await prisma.$transaction(async (tx) => {

        // SELECT FOR UPDATE on batch
        const batchRows = await tx.$queryRawUnsafe(`
          SELECT id, status, quantity, active_day_no, short_batch_code, start_date, eb_rate_per_unit
          FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!batchRows || batchRows.length === 0) {
          const notFoundErr = new Error('Production batch not found');
          notFoundErr.statusCode = 404;
          throw notFoundErr;
        }

        const batch = batchRows[0];
        const targetDayNo = Math.max(1, Number(dayNo || batch.active_day_no || 1));

        if (batch.status !== 'In Progress' && batch.status !== 'IN_PROGRESS') {
          await tx.$executeRawUnsafe(`
            UPDATE production_batches SET status = 'In Progress', started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = $1;
          `, id);
        }

        const sumRequested = allocations.reduce((s, a) => s + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
        let availableMixMl = await resolveNetPostEvapMixMl(tx, id, sumRequested);
        if (availableMixMl <= 0) {
          availableMixMl = 100000;
        }
        const previousDaysAllocatedMl = await getPreviousDaysAllocatedMl(tx, id, targetDayNo);

        // Guard against mutating an already completed Day
        const existingDayRows = await tx.$queryRawUnsafe(`
          SELECT id, status FROM production_batch_days WHERE batch_id = $1 AND day_no = $2;
        `, id, targetDayNo);
        if (existingDayRows && existingDayRows.length > 0 && existingDayRows[0].status !== 'IN_PROGRESS') {
          const conflictErr = new Error(`Day ${targetDayNo} is already completed. Start Day ${targetDayNo + 1} before adding more products.`);
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        // Run sequential allocation calculation against carry-forward mix pool
        const computed = calculateAllocations({
          availableMixMl,
          previousDaysAllocatedMl,
          allocations
        });

        if (!computed.isValid && (!computed.allocations || computed.allocations.length === 0)) {
          const valErr = new Error(computed.errors?.map(e => e.message).join('; ') || 'Validation failed in product mould allocations');
          valErr.statusCode = 422;
          valErr.errors = computed.errors;
          throw valErr;
        }

        // Ensure open production_batch_days row exists for this active Day
        const prodDateStr = typeof productionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(productionDate.trim())
          ? productionDate.trim().slice(0, 10)
          : null;
        const ddmmyy = formatDDMMYY(prodDateStr || batch.start_date || new Date());
        const resolvedDayCode = dayBatchCode
          ? sanitizeToken(dayBatchCode, 24, ddmmyy)
          : (batch.short_batch_code || ddmmyy);
        const dayId = existingDayRows?.[0]?.id || require('crypto').randomUUID();
        if (!existingDayRows || existingDayRows.length === 0) {
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_days (
              id, batch_id, day_no, day_label, production_date, day_batch_code,
              status, opening_mix_ml, allocated_mix_ml, remaining_mix_ml, eb_rate_per_unit
            ) VALUES (
              $1::uuid, $2, $3, $4, COALESCE($10::date, CURRENT_DATE), $5,
              'IN_PROGRESS', $6, $7, $8, $9
            )
            ON CONFLICT (batch_id, day_no) DO UPDATE SET
              production_date = COALESCE(EXCLUDED.production_date, production_batch_days.production_date),
              day_batch_code = COALESCE(EXCLUDED.day_batch_code, production_batch_days.day_batch_code),
              opening_mix_ml = EXCLUDED.opening_mix_ml,
              allocated_mix_ml = EXCLUDED.allocated_mix_ml,
              remaining_mix_ml = EXCLUDED.remaining_mix_ml,
              updated_at = CURRENT_TIMESTAMP;
          `, dayId, id, targetDayNo, `Day ${targetDayNo}`, resolvedDayCode,
             computed.initialMixAvailableMl, computed.totalMixUsedMl, computed.remainingMixMl, Number(batch.eb_rate_per_unit || 8.5), prodDateStr);
        } else {
          await tx.$executeRawUnsafe(`
            UPDATE production_batch_days
            SET production_date = COALESCE($6::date, production_date),
                day_batch_code = COALESCE($2, day_batch_code),
                opening_mix_ml = $3,
                allocated_mix_ml = $4,
                remaining_mix_ml = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1::uuid;
          `, dayId, resolvedDayCode, computed.initialMixAvailableMl, computed.totalMixUsedMl, computed.remainingMixMl, prodDateStr);
        }

        // Atomically replace allocations ONLY for this active Day
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_allocation WHERE batch_id = $1 AND COALESCE(day_no, 1) = $2;`, id, targetDayNo);

        for (let i = 0; i < computed.allocations.length; i++) {
          const alloc = computed.allocations[i];
          const mouldUuid = (alloc.mouldId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(alloc.mouldId).trim()))
            ? String(alloc.mouldId).trim()
            : null;
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_allocation (
              id, batch_id, day_no, day_id, seq, product_id, use_mould, mould_id,
              capacity_ml, cavities, trays, waste_mode, waste_value,
              mix_used_ml, waste_ml, good_pieces, actual_yield,
              allocated_base_ml, bulk_uom, product_rms, product_batch_no,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3::uuid, $4, $5, $6, ($7::text)::uuid,
              $8, $9, $10, $11, $12,
              $13, $14, $15, $16,
              $17, $18, $19::jsonb, $20,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, id, targetDayNo, dayId, alloc.seq, alloc.productId, Boolean(alloc.useMould), mouldUuid,
             alloc.capacityMl, alloc.cavities, alloc.trays, alloc.wasteMode, alloc.wasteValue,
             alloc.mixUsedMl, alloc.wasteMl, Number(alloc.theoreticalGoodPieces ?? alloc.goodPieces ?? 0),
             alloc.actualYield !== null && alloc.actualYield !== undefined ? Number(alloc.actualYield) : Number(alloc.goodPieces ?? 0),
             Number(alloc.allocatedBaseMl || alloc.mixUsedMl || 0),
             alloc.bulkUom || 'L',
             JSON.stringify(alloc.productRms || []),
             alloc.productBatchNo || null);
        }

        // Mirror active allocations & carry-forward remaining balance into production_batches
        await tx.$executeRawUnsafe(`
          UPDATE production_batches 
          SET 
            mould_allocations = $2::jsonb,
            remaining_mix_balance_ml = $3,
            short_batch_code = COALESCE($4, short_batch_code),
            active_day_no = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, JSON.stringify(computed.allocations), computed.remainingMixMl, resolvedDayCode, targetDayNo);

        return {
          ...computed,
          dayNo: targetDayNo,
          dayId,
          dayBatchCode: resolvedDayCode
        };
      }, { maxWait: 15000, timeout: 60000 });

      // Synchronize production_batch_items and product_rms outside transaction for zero rollback interference
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "production_batch_items" WHERE batch_id = $1;`, id);
        const prodAggMap = new Map();
        for (const alloc of result.allocations || []) {
          if (alloc.productId) {
            const currentPlanned = prodAggMap.get(alloc.productId) || 0;
            prodAggMap.set(alloc.productId, currentPlanned + Number(alloc.goodPieces || 0));
          }
        }
        for (const [prodId, totalPlanned] of prodAggMap.entries()) {
          const pCheck = await prisma.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1;`, prodId).catch(() => []);
          if (pCheck.length > 0) {
            await prisma.$executeRawUnsafe(`
              INSERT INTO "production_batch_items" (
                id, batch_id, product_id, planned_qty, actual_qty, factor, cost_per_unit, created_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, 0, 1.0, 0, CURRENT_TIMESTAMP
              );
            `, id, prodId, totalPlanned).catch(() => {});
          }
        }
      } catch (itemErr) {
        console.warn('Notice synchronizing production_batch_items:', itemErr.message);
      }

      // Persist product-specific essence and ingredient lots to production_batch_allocations outside transaction
      try {
        for (const alloc of result.allocations || []) {
          if (Array.isArray(alloc.productRms)) {
            for (const prm of alloc.productRms) {
              if (Array.isArray(prm.allocatedBatches)) {
                for (const ab of prm.allocatedBatches) {
                  if (Number(ab.allocatedQty) > 0) {
                    const isManual = Boolean(ab.isManualOverride || String(ab.batchId).startsWith('manual-'));
                    const lotNum = ab.lotNumber || ab.internalBatchNo || 'LOT-DIRECT';
                    await prisma.$executeRawUnsafe(`
                      INSERT INTO "production_batch_allocations" (
                        batch_id, usage_id, inventory_batch_id, lot_number,
                        allocated_qty, po_original_qty, po_total_amount,
                        allocated_amount, unit_rate, uom,
                        is_manual_override, grn_number, po_number, supplier_batch_no
                      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);
                    `, id,
                       null,
                       ab.batchId ? String(ab.batchId) : null,
                       lotNum,
                       Number(ab.allocatedQty || 0),
                       Number(ab.availableQty || ab.allocatedQty || 0),
                       Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || prm.unitRate || 0))),
                       Number(ab.allocatedAmount || (Number(ab.allocatedQty || 0) * Number(ab.unitRate || prm.unitRate || 0))),
                       Number(ab.unitRate || prm.unitRate || 0),
                       ab.uom || prm.uom || 'kg',
                       isManual,
                       ab.grnNumber || 'GRN-PRODUCT-ESSENCE',
                       ab.poNumber || 'PO-PRODUCT-ESSENCE',
                       ab.supplierBatchNo || 'SUP-LOT-01'
                    ).catch(() => {});
                  }
                }
              }
            }
          }
        }
      } catch (rmLotErr) {
        console.warn('Notice persisting product RM lots to production_batch_allocations:', rmLotErr.message);
      }

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Product allocations atomically saved',
          data: result
        });
      }
    } catch (err) {
      console.error('Error saving mould allocations:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message, errors: err.errors });
      }
      next(err);
    }
  }

  // ── 7. GET /api/production/standard/:id ──
  // Returns full batch details, RM lines, merge state, allocations, and role-protected costing
  async getBatchDetails(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;
      const userCanViewCost = canViewCosting(user);

      let batchRows = [];
      try {
        batchRows = await prisma.$queryRawUnsafe(`
          SELECT 
            pb.*,
            bm.name AS base_name,
            pt.name AS template_name
          FROM production_batches pb
          LEFT JOIN base_master bm ON bm.id = pb.base_id
          LEFT JOIN production_templates pt ON pt.id = pb.template_id
          WHERE pb.id = $1;
        `, id);
      } catch (_) {
        batchRows = await prisma.$queryRawUnsafe(`
          SELECT pb.*
          FROM production_batches pb
          WHERE pb.id = $1;
        `, id);
      }

      if (!batchRows || batchRows.length === 0) {
        return res.status(404).json({ error: 'Production batch not found' });
      }

      const batch = batchRows[0];

      // Fetch RM Lines with live database UOMs, alternate UOMs, and lot batch details
      let rmLines = [];
      try {
        rmLines = await prisma.$queryRawUnsafe(`
          SELECT 
            pbl.*,
            COALESCE(
              uom_tbl.abbreviation,
              uom_tbl.name,
              CASE WHEN rm."unitId" ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE rm."unitId" END,
              CASE WHEN pbl.uom ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE pbl.uom END,
              CASE WHEN rm."consumptionUnit" ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE rm."consumptionUnit" END,
              'kg'
            ) AS uom,
            rm.name AS raw_material_name,
            rm.code AS raw_material_code,
            rm."currentStock" AS current_stock,
            rm."ratePerUnit" AS rate_per_unit,
            rm."unitId" AS unit_id,
            rm."hasAlternateUom" AS has_alternate_uom,
            rm."alternateUom" AS alternate_uom,
            rm."alternateUomQty" AS alternate_uom_qty,
            rm."baseUomQty" AS base_uom_qty,
            rm."conversionFactor" AS conversion_factor,
            rm."consumptionUnit" AS consumption_unit,
            COALESCE(pbl.density, 1.0000) AS master_density,
            CASE 
              WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%stabl%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
              ELSE FALSE 
            END AS master_evaporates,
            ib."batchNumber" AS lot_batch_no,
            ib."expiryDate" AS lot_expiry_date
          FROM production_batch_rm_line pbl
          LEFT JOIN "RawMaterial" rm ON rm.id = pbl.raw_material_id
          LEFT JOIN "InventoryBatch" ib ON ib.id = pbl.lot_id
          LEFT JOIN "UOM" uom_tbl ON uom_tbl.id = rm."unitId"
          WHERE pbl.batch_id = $1
          ORDER BY pbl.created_at;
        `, id);
      } catch (_) {
        rmLines = [];
      }

      // If production_batch_rm_line is empty, seamlessly fallback to production_batch_rm_usage
      if (!rmLines || rmLines.length === 0) {
        try {
          rmLines = await prisma.$queryRawUnsafe(`
            SELECT 
              u.id,
              u.batch_id,
              u.rm_id AS raw_material_id,
              u.allocated_batch_id AS lot_id,
              COALESCE(
                uom_tbl.abbreviation,
                uom_tbl.name,
                CASE WHEN rm."unitId" ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE rm."unitId" END,
                CASE WHEN u.selected_uom ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE u.selected_uom END,
                CASE WHEN rm."consumptionUnit" ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE rm."consumptionUnit" END,
                'kg'
              ) AS uom,
              1.0000 AS density,
              COALESCE(rm."currentStock", u.available_qty_at_time, 0) AS available_qty,
              COALESCE(u.required_qty, 0) AS required_qty,
              COALESCE(u.input_qty, u.actual_used_qty, u.required_qty, 0) AS taken_qty,
              CASE 
                WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%stabl%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
                ELSE FALSE 
              END AS evaporates,
              TRUE AS merged,
              rm.name AS raw_material_name,
              rm.code AS raw_material_code,
              rm."currentStock" AS current_stock,
              COALESCE(u.unit_cost, rm."ratePerUnit", 0) AS rate_per_unit,
              rm."unitId" AS unit_id,
              rm."hasAlternateUom" AS has_alternate_uom,
              rm."alternateUom" AS alternate_uom,
              rm."conversionFactor" AS conversion_factor,
              rm."consumptionUnit" AS consumption_unit,
              1.0000 AS master_density,
              CASE 
                WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%stabl%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
                ELSE FALSE 
              END AS master_evaporates,
              COALESCE(u.internal_batch_no, ib."batchNumber") AS lot_batch_no,
              ib."expiryDate" AS lot_expiry_date
            FROM production_batch_rm_usage u
            LEFT JOIN "RawMaterial" rm ON rm.id = u.rm_id
            LEFT JOIN "InventoryBatch" ib ON ib.id = u.allocated_batch_id
            LEFT JOIN "UOM" uom_tbl ON uom_tbl.id = rm."unitId"
            WHERE u.batch_id = $1
            ORDER BY u.id;
          `, id);
        } catch (uErr) {
          console.warn('Fallback rm_usage query error:', uErr.message);
        }
      }

      // If production_batch_rm_line and rm_usage are both empty, seamlessly fallback to production_template_lines
      if (!rmLines || rmLines.length === 0) {
        try {
          const tId = batch.template_id;
          const bId = batch.base_id;
          rmLines = await prisma.$queryRawUnsafe(`
            SELECT 
              ptl.id,
              $1::text AS batch_id,
              ptl.raw_material_id,
              NULL::text AS lot_id,
              COALESCE(
                uom_tbl.abbreviation,
                uom_tbl.name,
                CASE WHEN rm."unitId" ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE rm."unitId" END,
                CASE WHEN ptl.uom ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE ptl.uom END,
                CASE WHEN rm."consumptionUnit" ~ '^[0-9a-fA-F-]{32,36}$' THEN NULL ELSE rm."consumptionUnit" END,
                'kg'
              ) AS uom,
              1.0000 AS density,
              COALESCE(rm."currentStock", 0) AS available_qty,
              COALESCE(ptl.quantity, 0) AS required_qty,
              COALESCE(ptl.quantity, 0) AS taken_qty,
              CASE 
                WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%stabl%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
                ELSE FALSE 
              END AS evaporates,
              TRUE AS merged,
              rm.name AS raw_material_name,
              rm.code AS raw_material_code,
              rm."currentStock" AS current_stock,
              COALESCE(ptl.rate, rm."ratePerUnit", 0) AS rate_per_unit,
              rm."unitId" AS unit_id,
              rm."hasAlternateUom" AS has_alternate_uom,
              rm."alternateUom" AS alternate_uom,
              rm."alternateUomQty" AS alternate_uom_qty,
              rm."baseUomQty" AS base_uom_qty,
              rm."conversionFactor" AS conversion_factor,
              rm."consumptionUnit" AS consumption_unit,
              1.0000 AS master_density,
              CASE 
                WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%stabl%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
                ELSE FALSE 
              END AS master_evaporates,
              NULL AS lot_batch_no,
              NULL AS lot_expiry_date
            FROM production_template_lines ptl
            LEFT JOIN "RawMaterial" rm ON rm.id = ptl.raw_material_id
            LEFT JOIN "UOM" uom_tbl ON uom_tbl.id = rm."unitId"
            WHERE ptl.template_id = $2 OR ptl.template_id IN (SELECT id FROM production_templates WHERE base_id = $3)
            ORDER BY ptl.seq_no;
          `, id, tId || '', bId || '');
        } catch (tErr) {
          console.warn('Fallback template_lines query error:', tErr.message);
        }
      }

      // Fetch saved raw material batch allocations
      let savedBatchAllocations = [];
      try {
        savedBatchAllocations = await prisma.$queryRawUnsafe(
          `SELECT 
             pba.*,
             COALESCE(u.rm_id, ib."rawMaterialId", pba.usage_id) AS matched_rm_id,
             ib."expiryDate" AS expiry_date
           FROM "production_batch_allocations" pba
           LEFT JOIN production_batch_rm_usage u ON u.id = pba.usage_id
           LEFT JOIN "InventoryBatch" ib ON ib.id = pba.inventory_batch_id
           WHERE pba.batch_id = $1`,
          id
        );
      } catch (_) {
        savedBatchAllocations = [];
      }

      // Fetch top available batches for the raw materials in this batch
      const rmIds = rmLines.map(r => r.raw_material_id).filter(Boolean);
      let batchMap = new Map();
      if (rmIds.length > 0) {
        const availableBatches = await prisma.$queryRawUnsafe(`
          SELECT 
            ib.id,
            ib."rawMaterialId" AS raw_material_id,
            ib."batchNumber" AS batch_number,
            ib."expiryDate" AS expiry_date,
            ib."netQty" AS remaining_qty
          FROM "InventoryBatch" ib
          WHERE ib."rawMaterialId" = ANY($1::text[]) AND ib."netQty" > 0
          ORDER BY ib."expiryDate" ASC;
        `, rmIds);
        availableBatches.forEach(b => {
          if (!batchMap.has(b.raw_material_id)) batchMap.set(b.raw_material_id, []);
          batchMap.get(b.raw_material_id).push({
            id: b.id,
            batchNo: b.batch_number,
            expiryDate: b.expiry_date,
            remainingQty: Number(b.remaining_qty)
          });
        });
      }

      // Fetch Merge state
      let mergeData = null;
      try {
        const mergeRows = await txOrPrisma(prisma, `
          SELECT * FROM production_batch_merge WHERE batch_id = $1;
        `, id);
        mergeData = mergeRows[0] || null;
      } catch (_) {
        mergeData = null;
      }

      // Fetch Multi-Day execution history & outputs (if any)
      let days = [];
      try {
        days = await getBatchDaysData(prisma, id, userCanViewCost);
      } catch (daysErr) {
        console.warn('Notice reading production_batch_days:', daysErr.message);
      }

      const activeDayNo = Math.max(1, Number(batch.active_day_no || 1));
      const viewingDayNo = req.query?.dayNo ? Math.max(1, Number(req.query.dayNo)) : activeDayNo;
      const hasMultiDay = days.length > 0;
      const viewingDayRec = hasMultiDay
        ? (days.find(d => Number(d.dayNo) === viewingDayNo) || null)
        : null;
      const previousDaysAllocatedMl = days
        .filter(d => d.status !== 'IN_PROGRESS' && Number(d.dayNo) < viewingDayNo)
        .reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0);
      const totalAllocatedAcrossCompletedDaysMl = days
        .filter(d => d.status !== 'IN_PROGRESS')
        .reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0);

      // Fetch Allocations scoped strictly to viewingDayNo so clicking Edit Day 1..N loads that Day's full products & moulds cleanly
      let allocations = [];
      const dayScopeFilter = hasMultiDay ? `AND COALESCE(pba.day_no, 1) = ${viewingDayNo}` : '';
      try {
        allocations = await prisma.$queryRawUnsafe(`
          SELECT 
            pba.*,
            p.name AS product_name,
            p.code AS product_code,
            COALESCE(puom.abbreviation, puom.name, 'pcs') AS product_unit,
            m.mould_code,
            m.mould_name,
            m.mould_category,
            m.specification_status
          FROM production_batch_allocation pba
          LEFT JOIN products p ON p.id = pba.product_id
          LEFT JOIN "UOM" puom ON puom.id = p.unit_id
          LEFT JOIN ice_cream_mould m ON m.id = pba.mould_id
          WHERE pba.batch_id = $1 ${dayScopeFilter}
          ORDER BY pba.seq;
        `, id);
      } catch (allocErr) {
        allocations = await prisma.$queryRawUnsafe(`
          SELECT 
            pba.*,
            p.name AS product_name,
            p.code AS product_code,
            COALESCE(puom.abbreviation, puom.name, 'pcs') AS product_unit
          FROM production_batch_allocation pba
          LEFT JOIN products p ON p.id = pba.product_id
          LEFT JOIN "UOM" puom ON puom.id = p.unit_id
          WHERE pba.batch_id = $1 ${dayScopeFilter}
          ORDER BY pba.seq;
        `, id).catch(() => []);
      }

      // If viewing an already-completed Day whose pba rows were absent (e.g. reconstructed from outputs), populate from viewingDayRec.outputs
      if (hasMultiDay && allocations.length === 0 && viewingDayRec && Array.isArray(viewingDayRec.outputs) && viewingDayRec.outputs.length > 0) {
        allocations = viewingDayRec.outputs.map(o => ({
          seq: o.seq,
          day_no: viewingDayRec.dayNo,
          product_id: o.productId,
          product_name: o.productName,
          product_code: o.productCode || 'FP',
          product_unit: o.uom || 'pcs',
          use_mould: Boolean(o.useMould),
          mould_id: o.mouldId || null,
          mould_code: o.mouldCode || '',
          mould_name: o.mouldName || '',
          capacity_ml: Number(o.capacityMl || 0),
          cavities: Number(o.cavities || 1),
          trays: Number(o.trays || 0),
          waste_mode: o.wasteMode || 'PERCENT',
          waste_value: Number(o.wasteValue || 0),
          allocated_base_ml: Number(o.allocatedBaseMl || 0),
          mix_used_ml: Number(o.allocatedBaseMl || 0),
          waste_ml: Number(o.wasteMl || 0),
          good_pieces: Number(o.theoreticalQty || 0),
          actual_yield: Number(o.actualYield || 0),
          reject_output: Number(o.rejectOutput || 0),
          bulk_uom: o.bulkUom || 'L',
          product_rms: Array.isArray(o.productRms) ? o.productRms : [],
          product_batch_no: o.productBatchNo || null,
          product_serial_no: o.productSerialNo || null
        }));
      }

      // If batch is finalized/completed and viewingDayNo has no rows AND no specific dayNo was requested, fallback to all
      if (hasMultiDay && !req.query?.dayNo && allocations.length === 0 && (batch.is_finalized || batch.status === 'Completed')) {
        try {
          allocations = await prisma.$queryRawUnsafe(`
            SELECT 
              pba.*,
              p.name AS product_name,
              p.code AS product_code,
              COALESCE(puom.abbreviation, puom.name, 'pcs') AS product_unit,
              m.mould_code,
              m.mould_name,
              m.mould_category,
              m.specification_status
            FROM production_batch_allocation pba
            LEFT JOIN products p ON p.id = pba.product_id
            LEFT JOIN "UOM" puom ON puom.id = p.unit_id
            LEFT JOIN ice_cream_mould m ON m.id = pba.mould_id
            WHERE pba.batch_id = $1
            ORDER BY COALESCE(pba.day_no, 1), pba.seq;
          `, id);
        } catch (_) {}
      }

      // Merge saved rich mould_allocations JSON ONLY when there are active rows (or legacy single-day batch)
      let savedMouldAllocs = [];
      if (!hasMultiDay || allocations.length > 0) {
        try {
          if (typeof batch.mould_allocations === 'string') {
            savedMouldAllocs = JSON.parse(batch.mould_allocations || '[]');
          } else if (Array.isArray(batch.mould_allocations)) {
            savedMouldAllocs = batch.mould_allocations;
          }
        } catch (_) {}
      }

      const viewingOuts = Array.isArray(viewingDayRec?.outputs) ? viewingDayRec.outputs : [];
      const enrichedAllocs = allocations.map((a, idx) => {
        const match = (!hasMultiDay || viewingDayNo === 1)
          ? (savedMouldAllocs.find(s => s.seq === a.seq && s.productId === a.product_id) || savedMouldAllocs[idx] || {})
          : {};
        const dayOutMatch = viewingOuts.find(o => Number(o.seq) === Number(a.seq) && o.productId === a.product_id)
          || viewingOuts.find(o => o.productId === a.product_id)
          || null;
        let parsedProductRms = [];
        if (Array.isArray(a.product_rms) && a.product_rms.length > 0) {
          parsedProductRms = a.product_rms;
        } else if (typeof a.product_rms === 'string' && a.product_rms.trim().startsWith('[')) {
          try { parsedProductRms = JSON.parse(a.product_rms); } catch (_) {}
        } else if (dayOutMatch && Array.isArray(dayOutMatch.productRms) && dayOutMatch.productRms.length > 0) {
          parsedProductRms = dayOutMatch.productRms;
        } else if (Array.isArray(match.productRms) && match.productRms.length > 0) {
          parsedProductRms = match.productRms;
        }
        return {
          ...match,
          ...a,
          allocatedBaseMl: Number(a.allocated_base_ml ?? a.mix_used_ml ?? dayOutMatch?.allocatedBaseMl ?? match.allocatedBaseMl ?? 0),
          productRms: parsedProductRms,
          productBatchNo: a.product_batch_no || dayOutMatch?.productBatchNo || match.productBatchNo || null,
          productSerialNo: a.product_serial_no || dayOutMatch?.productSerialNo || match.productSerialNo || null,
          actualYield: a.actual_yield !== null && a.actual_yield !== undefined
            ? Number(a.actual_yield)
            : (dayOutMatch?.actualYield !== undefined ? Number(dayOutMatch.actualYield) : (match.actualYield ?? null)),
          rejectOutput: a.reject_output !== undefined
            ? Number(a.reject_output)
            : Number(dayOutMatch?.rejectOutput || 0),
          useMould: a.use_mould !== undefined ? Boolean(a.use_mould) : (match.useMould !== undefined ? Boolean(match.useMould) : true),
          bulkUom: a.bulk_uom || dayOutMatch?.bulkUom || match.bulkUom || a.product_unit || 'L'
        };
      });

      // Calculate Costing
      let costingSummary = null;
      if (userCanViewCost) {
        let totalMaterialCost = 0;
        let totalWastageCost = 0;
        const totalMixUsedMl = enrichedAllocs.reduce((sum, a) => sum + Number(a.allocatedBaseMl || a.mix_used_ml || 0), 0);

        const rmCostBreakdown = rmLines.map(line => {
          const taken = Number(line.taken_qty || 0);
          const rate = Number(line.rate_per_unit || 0);
          const lineCost = taken * rate;
          totalMaterialCost += lineCost;
          const uom = line.uom || 'kg';
          const density = Number(line.density || 1.0);
          let liquidMl = 0;
          try {
            liquidMl = toMl(taken, uom, density);
          } catch (_) {}

          const matchedAllocs = (savedBatchAllocations || []).filter(a =>
            (a.matched_rm_id && (a.matched_rm_id === line.raw_material_id || a.matched_rm_id === line.id)) ||
            a.usage_id === line.id ||
            a.usage_id === line.raw_material_id ||
            (line.lot_id && a.inventory_batch_id === line.lot_id) ||
            (line.lot_batch_no && a.lot_number === line.lot_batch_no)
          );
          const lotBatches = matchedAllocs.length > 0
            ? matchedAllocs.map(a => ({
                batchId: a.inventory_batch_id || a.lot_number,
                lotNumber: a.lot_number,
                allocatedQty: Number(a.allocated_qty || 0),
                uom: a.uom || uom,
                unitRate: Number(a.unit_rate || rate),
                totalCost: round2(Number(a.allocated_qty || 0) * Number(a.unit_rate || rate)),
                expiryDate: a.expiry_date || line.lot_expiry_date || null,
                poNumber: a.po_number || 'PO-MANUAL-OVERRIDE',
                grnNumber: a.grn_number || 'GRN-MANUAL-OVERRIDE'
              }))
            : (line.lot_batch_no ? [{
                batchId: line.lot_id || line.lot_batch_no,
                lotNumber: line.lot_batch_no,
                allocatedQty: taken,
                uom,
                unitRate: rate,
                totalCost: round2(lineCost),
                expiryDate: line.lot_expiry_date || (batchMap.get(line.raw_material_id)?.find(b => b.batchNo === line.lot_batch_no)?.expiryDate) || null
              }] : []);

          const resolvedExpiry = line.lot_expiry_date || lotBatches.find(lb => lb.expiryDate)?.expiryDate || null;

          return {
            rawMaterialId: line.raw_material_id,
            rawMaterialName: line.raw_material_name,
            rawMaterialCode: line.raw_material_code || 'RM',
            takenQty: taken,
            uom,
            unitRate: rate,
            totalCost: round2(lineCost),
            lotBatchNo: lotBatches.length > 0 ? lotBatches.map(b => b.lotNumber).filter(Boolean).join(', ') : (line.lot_batch_no || 'BATCH-DIRECT'),
            expiryDate: resolvedExpiry,
            allocatedBatches: lotBatches,
            evaporates: Boolean(line.evaporates),
            liquidVolumeMl: liquidMl
          };
        });

        const labourCost = hasMultiDay
          ? round2(days.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.labourTotalCost || 0), 0)) || Number(batch.labour_total_cost || 0)
          : Number(batch.labour_total_cost || 0);
        const utilityCost = hasMultiDay
          ? round2(days.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.ebTotalCost || 0), 0)) || Number(batch.eb_total_cost || 0)
          : Number(batch.eb_total_cost || 0);
        const overheadCost = hasMultiDay
          ? round2(days.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.overheadAmt || 0), 0)) || Number(batch.overhead_amt || 0)
          : Number(batch.overhead_amt || 0);

        const completedDaysAllocatedMl = hasMultiDay
          ? days.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.allocatedMixMl || 0), 0)
          : 0;
        const completedDaysWasteMl = hasMultiDay
          ? days.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.wasteMl || 0), 0)
          : 0;

        const effectiveCumulativeUsedMl = hasMultiDay && completedDaysAllocatedMl > 0
          ? completedDaysAllocatedMl
          : totalMixUsedMl;
        const totalBaseMixMl = mergeData?.mix_after_evap_ml ? Number(mergeData.mix_after_evap_ml) : (effectiveCumulativeUsedMl || 1);
        const baseCostPerMl = totalBaseMixMl > 0 ? (totalMaterialCost / totalBaseMixMl) : 0;

        // Waste cost calculation: while multi-day run is still open (not finalized), unallocated mix is carry-forward pool, NOT waste
        const activeAllocWasteMl = enrichedAllocs.reduce((sum, a) => sum + Number(a.waste_ml || 0), 0);
        const totalWasteMl = hasMultiDay ? completedDaysWasteMl : activeAllocWasteMl;
        const carryForwardOrUnallocatedMl = Math.max(0, totalBaseMixMl - effectiveCumulativeUsedMl);
        const isBatchClosed = Boolean(batch.is_finalized || batch.status === 'Completed');
        const unallocatedMixMl = isBatchClosed ? carryForwardOrUnallocatedMl : 0;
        totalWastageCost = (totalWasteMl + unallocatedMixMl) * baseCostPerMl;

        const totalProductRmsCostPre = hasMultiDay
          ? days.filter(d => d.status !== 'IN_PROGRESS').reduce((s, d) => s + Number(d.productRmCost || 0), 0)
          : 0;
        const totalProductionCost = totalMaterialCost + totalProductRmsCostPre + labourCost + utilityCost + overheadCost;

        // Per-product cost attribution based on base mix consumption + specific product raw materials
        const effectiveAllocsForCost = (hasMultiDay && enrichedAllocs.length === 0)
          ? days.flatMap(d => (d.outputs || []).map(o => ({
              seq: o.seq,
              product_id: o.productId,
              product_name: o.productName,
              good_pieces: o.actualYield,
              allocatedBaseMl: o.allocatedBaseMl,
              productRms: o.productRms,
              productBatchNo: o.productBatchNo,
              productSerialNo: o.productSerialNo,
              dayNo: d.dayNo
            })))
          : enrichedAllocs;
        const effectiveMixForCostShare = effectiveAllocsForCost.reduce((s, a) => s + Number(a.allocatedBaseMl || a.mix_used_ml || 0), 0) || totalMixUsedMl;
        const productCostAttribution = effectiveAllocsForCost.map(a => {
          const baseMixConsumed = Number(a.allocatedBaseMl || a.mix_used_ml || 0);
          const assignedBaseRmCost = baseMixConsumed * baseCostPerMl;

          let productSpecificRmCost = 0;
          let productRmsBreakdown = [];
          if (Array.isArray(a.productRms)) {
            for (const prm of a.productRms) {
              const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
              const prmRate = Number(prm.unitRate || prm.rate || 0);
              const prmCost = prmQty * prmRate;
              productSpecificRmCost += prmCost;
              productRmsBreakdown.push({
                ...prm,
                rawMaterialName: prm.rawMaterialName || prm.rmName || 'Flavour / Addition',
                rawMaterialCode: prm.rawMaterialCode || prm.rmCode || 'RM-ADD',
                lotBatchNo: prm.allocatedBatches?.[0]?.lotNumber || prm.lotBatchNo || 'BATCH-DIRECT',
                takenQty: prmQty,
                unitRate: prmRate,
                totalCost: round2(prmCost),
                uom: prm.uom || 'kg',
                density: Number(prm.density || 1.0)
              });
            }
          }

          const totalAssignedRmCost = assignedBaseRmCost + productSpecificRmCost;
          const share = effectiveMixForCostShare > 0 ? (baseMixConsumed / effectiveMixForCostShare) : 0;
          const assignedLabourCost = labourCost * share;
          const assignedUtilityCost = utilityCost * share;
          const assignedOverheadCost = overheadCost * share;
          const assignedTotal = totalAssignedRmCost + assignedLabourCost + assignedUtilityCost + assignedOverheadCost;
          const pieces = Number(a.good_pieces || a.goodPieces || 0);
          const costPerPiece = pieces > 0 ? (assignedTotal / pieces) : 0;

          return {
            dayNo: a.dayNo || null,
            seq: a.seq,
            productId: a.product_id || a.productId,
            productName: a.product_name || a.productName,
            productBatchNo: a.productBatchNo || null,
            productSerialNo: a.productSerialNo || null,
            goodPieces: pieces,
            mixUsedMl: baseMixConsumed,
            productRmsCost: round2(productSpecificRmCost),
            productRms: productRmsBreakdown,
            assignedRmCost: round2(totalAssignedRmCost),
            assignedBaseRmCost: round2(assignedBaseRmCost),
            assignedLabourCost: round2(assignedLabourCost),
            assignedUtilityCost: round2(assignedUtilityCost),
            assignedOverheadCost: round2(assignedOverheadCost),
            totalAssignedCost: round2(assignedTotal),
            costPerPiece: round2(costPerPiece)
          };
        });

        costingSummary = {
          totalMaterialCost: round2(totalMaterialCost),
          totalProductRmsCost: round2(totalProductRmsCostPre || productCostAttribution.reduce((s, p) => s + Number(p.productRmsCost || 0), 0)),
          totalWastageCost: round2(totalWastageCost),
          unallocatedMixMl: round2(unallocatedMixMl),
          carryForwardMixMl: round2(isBatchClosed ? 0 : carryForwardOrUnallocatedMl),
          baseCostPerMl: Number(baseCostPerMl.toFixed(4)),
          labourCost: round2(labourCost),
          utilityCost: round2(utilityCost),
          overheadCost: round2(overheadCost),
          totalProductionCost: round2(totalProductionCost),
          rmCostBreakdown,
          productCostAttribution
        };
      }

      const activeDayRec = viewingDayRec;

      let savedProductYields = [];
      let parsedTimelineStages = [];
      let parsedProductStagesMap = {};

      if (hasMultiDay && activeDayRec) {
        // Strictly scope yields & factory timeline stages to the active Day record
        // so Day 1's data never leaks into Day 2 / Day N+1's active workspace.
        if (Array.isArray(activeDayRec.outputs) && activeDayRec.outputs.length > 0) {
          savedProductYields = activeDayRec.outputs.map(o => ({
            seq: o.seq,
            productId: o.productId,
            productName: o.productName,
            productCode: o.productCode,
            uom: o.uom,
            allocatedBaseMl: Number(o.allocatedBaseMl || 0),
            calculatedYield: Number(o.theoreticalQty || o.actualYield || 0),
            actualGoodOutput: Number(o.actualYield || 0),
            actualOutput: Number(o.actualYield || 0),
            rejectOutput: Number(o.rejectOutput || 0),
            productBatchNo: o.productBatchNo,
            productSerialNo: o.productSerialNo
          }));
        } else {
          savedProductYields = [];
        }

        parsedTimelineStages = Array.isArray(activeDayRec.timelineStages) ? activeDayRec.timelineStages : [];
        parsedProductStagesMap = (activeDayRec.productStagesMap && typeof activeDayRec.productStagesMap === 'object')
          ? activeDayRec.productStagesMap
          : {};
      } else {
        try {
          if (typeof batch.product_yields === 'string') {
            savedProductYields = JSON.parse(batch.product_yields || '[]');
          } else if (Array.isArray(batch.product_yields)) {
            savedProductYields = batch.product_yields;
          }
        } catch (_) {}

        try {
          let rawStages = batch.timeline_stages;
          if (typeof rawStages === 'string') {
            rawStages = JSON.parse(rawStages || '[]');
          }
          if (rawStages && typeof rawStages === 'object' && !Array.isArray(rawStages)) {
            parsedTimelineStages = Array.isArray(rawStages.stages) ? rawStages.stages : [];
            parsedProductStagesMap = rawStages.productStagesMap || {};
          } else if (Array.isArray(rawStages)) {
            parsedTimelineStages = rawStages;
            parsedProductStagesMap = {};
          }
        } catch (_) {
          parsedTimelineStages = [];
          parsedProductStagesMap = {};
        }
      }

      // Fetch live company settings from setup/tax
      let companyDetails = null;
      try {
        companyDetails = await getTaxSettingsData();
        if (companyDetails && companyDetails.companyName) {
          companyDetails.companyPrefix = sanitizeToken(companyDetails.companyName, 24, 'COMPANY');
        }
      } catch (cErr) {
        console.warn('Error reading tax settings:', cErr.message);
      }

      const netPostEvapMixMlResolved = Number(
        mergeData?.mix_after_evap_ml || batch.net_post_evap_mix_ml || batch.merged_pre_evap_ml || 0
      );
      const remainingMixBalanceMlResolved = Math.max(
        0,
        round2(netPostEvapMixMlResolved - totalAllocatedAcrossCompletedDaysMl)
      );
      const resolvedShortBatchCode = batch.short_batch_code || formatDDMMYY(batch.start_date || new Date());

      res.json({
        success: true,
        batch: {
          ...batch,
          batchNo: batch.batch_no || batch.reference_no,
          referenceNo: batch.reference_no || batch.batch_no,
          batch_number: batch.batch_no || batch.reference_no,
          shortBatchCode: resolvedShortBatchCode,
          short_batch_code: resolvedShortBatchCode,
          activeDayNo,
          active_day_no: activeDayNo,
          viewingDayNo,
          viewingDayStatus: viewingDayRec?.status || 'IN_PROGRESS',
          completedDaysCount: Number(batch.completed_days_count || days.filter(d => d.status !== 'IN_PROGRESS').length),
          baseRmDeducted: Boolean(batch.base_rm_deducted),
          isFinalized: Boolean(batch.is_finalized || batch.status === 'Completed'),
          previousDaysAllocatedMl,
          totalAllocatedAcrossCompletedDaysMl,
          remainingMixBalanceMl: remainingMixBalanceMlResolved,
          actualOutput: Number(batch.actual_output || batch.good_quantity || batch.quantity || 0),
          quantity: Number(batch.quantity || 0),
          baseName: batch.base_name,
          templateName: batch.template_name,
          productYields: savedProductYields,
          timelineStages: parsedTimelineStages,
          productStagesMap: parsedProductStagesMap,
          companyDetails
        },
        companyDetails,
        days,
        timelineStages: parsedTimelineStages,
        productStagesMap: parsedProductStagesMap,
        productYields: savedProductYields,
        rmLines: rmLines.map(r => {
          const matchedAllocs = (savedBatchAllocations || []).filter(a => 
            (a.matched_rm_id && (a.matched_rm_id === r.raw_material_id || a.matched_rm_id === r.id)) ||
            a.usage_id === r.id || 
            a.usage_id === r.raw_material_id ||
            (r.lot_id && a.inventory_batch_id === r.lot_id) ||
            (r.lot_batch_no && a.lot_number === r.lot_batch_no) ||
            (a.inventory_batch_id && batchMap.has(r.raw_material_id) && batchMap.get(r.raw_material_id).some(b => b.id === a.inventory_batch_id || b.batchNo === a.lot_number))
          );
          const allocatedBatches = matchedAllocs.map(a => ({
            batchId: a.inventory_batch_id || a.lot_number,
            lotNumber: a.lot_number,
            internalBatchNo: a.lot_number,
            allocatedQty: Number(a.allocated_qty || 0),
            poOriginalQty: Number(a.po_original_qty || 0),
            poTotalAmount: Number(a.po_total_amount || 0),
            allocatedAmount: Number(a.allocated_amount || 0),
            unitRate: Number(a.unit_rate || r.rate_per_unit || 0),
            uom: a.uom || r.uom,
            expiryDate: a.expiry_date || r.lot_expiry_date || null,
            isManualOverride: Boolean(a.is_manual_override),
            grnNumber: a.grn_number || 'GRN-MANUAL-OVERRIDE',
            poNumber: a.po_number || 'PO-MANUAL-OVERRIDE',
            supplierBatchNo: a.supplier_batch_no || 'SUP-LOT-01'
          }));

          let resolvedAllocatedBatches = allocatedBatches;
          if (resolvedAllocatedBatches.length === 0 && (r.lot_id || r.lot_batch_no)) {
            resolvedAllocatedBatches = [{
              batchId: r.lot_id || r.lot_batch_no,
              lotNumber: r.lot_batch_no || 'LOT-AUTO-01',
              internalBatchNo: r.lot_batch_no || 'LOT-AUTO-01',
              allocatedQty: Number(r.taken_qty || r.required_qty || 0),
              unitRate: Number(r.rate_per_unit || 0),
              allocatedAmount: Number(r.taken_qty || r.required_qty || 0) * Number(r.rate_per_unit || 0),
              uom: r.uom,
              expiryDate: r.lot_expiry_date || null,
              isManualOverride: false,
              grnNumber: 'GRN-AUTO',
              poNumber: 'PO-AUTO',
              supplierBatchNo: r.lot_batch_no || 'SUP-LOT-01'
            }];
          } else if (resolvedAllocatedBatches.length === 0 && batchMap.has(r.raw_material_id) && batchMap.get(r.raw_material_id).length > 0) {
            const availLots = batchMap.get(r.raw_material_id);
            const neededQty = Number(r.taken_qty || r.required_qty || 0);
            let unalloc = neededQty;
            const autoLots = [];
            for (const lot of availLots) {
              if (unalloc <= 0) break;
              const allocFromLot = Math.min(lot.remainingQty, unalloc);
              autoLots.push({
                batchId: lot.id,
                lotNumber: lot.batchNo,
                internalBatchNo: lot.batchNo,
                allocatedQty: allocFromLot,
                poOriginalQty: lot.remainingQty,
                poTotalAmount: Number((allocFromLot * Number(r.rate_per_unit || 0)).toFixed(2)),
                allocatedAmount: Number((allocFromLot * Number(r.rate_per_unit || 0)).toFixed(2)),
                unitRate: Number(r.rate_per_unit || 0),
                uom: r.uom,
                expiryDate: lot.expiryDate || null,
                isManualOverride: false,
                grnNumber: 'GRN-AUTO',
                poNumber: 'PO-AUTO',
                supplierBatchNo: lot.batchNo
              });
              unalloc -= allocFromLot;
            }
            if (autoLots.length > 0) {
              resolvedAllocatedBatches = autoLots;
            }
          }

          const resolvedLotBatchNo = resolvedAllocatedBatches.length > 0
            ? resolvedAllocatedBatches.map(b => b.lotNumber).join(', ')
            : (r.lot_batch_no || (batchMap.get(r.raw_material_id)?.[0]?.batchNo || null));
          const resolvedLotExpiry = r.lot_expiry_date || resolvedAllocatedBatches.find(b => b.expiryDate)?.expiryDate || null;

          const totalAllocQty = resolvedAllocatedBatches.reduce((acc, b) => acc + Number(b.allocatedQty || 0), 0);
          const reqQty = Number(r.required_qty || 0);
          const effectiveAvailableQty = totalAllocQty > 0 ? totalAllocQty : 0;
          const effectiveTakenQty = totalAllocQty > 0 ? totalAllocQty : Number(r.taken_qty || reqQty);
          const effectiveReqQty = totalAllocQty > 0 ? totalAllocQty : reqQty;

          return {
            ...r,
            density: Number(r.density || 1.0),
            evaporates: Boolean(r.evaporates ?? r.master_evaporates ?? false),
            merged: Boolean(r.merged ?? true),
            available_qty: effectiveAvailableQty,
            warehouse_stock: Number(r.current_stock || 0),
            current_stock: Number(r.current_stock || 0),
            required_qty: effectiveReqQty,
            taken_qty: effectiveTakenQty,
            allocated_qty: totalAllocQty,
            unit_id: r.unit_id,
            has_alternate_uom: Boolean(r.has_alternate_uom),
            alternate_uom: r.alternate_uom,
            conversion_factor: Number(r.conversion_factor || 1),
            consumption_unit: r.consumption_unit,
            lot_batch_no: resolvedLotBatchNo,
            lot_expiry_date: resolvedLotExpiry,
            allocatedBatches: resolvedAllocatedBatches,
            available_batches: batchMap.get(r.raw_material_id) || []
          };
        }),
        mergeData: mergeData ? {
          ...mergeData,
          is_slide_merged: Boolean(mergeData.is_slide_merged ?? (Number(mergeData.merged_total_ml) > 0)),
          merged_total_ml: Number(mergeData.merged_total_ml),
          evaporation_pct: Number(mergeData.evaporation_pct),
          evaporated_ml: Number(mergeData.evaporated_ml),
          mix_after_evap_ml: Number(mergeData.mix_after_evap_ml)
        } : null,
        allocations: enrichedAllocs.map(a => ({
          ...a,
          allocatedBaseMl: Number(a.allocatedBaseMl || a.mix_used_ml || 0),
          productRms: Array.isArray(a.productRms) ? a.productRms : [],
          useMould: a.use_mould !== undefined ? Boolean(a.use_mould) : (a.useMould !== undefined ? Boolean(a.useMould) : true),
          bulkUom: a.bulkUom || a.product_unit || 'L',
          capacity_ml: Number(a.capacity_ml || a.capacityMl || 0),
          cavities: Number(a.cavities || 1),
          trays: Number(a.trays || 0),
          waste_value: Number(a.waste_value ?? a.wasteValue ?? 0),
          mix_used_ml: Number(a.mix_used_ml || a.mixUsedMl || 0),
          waste_ml: Number(a.waste_ml || a.wasteMl || 0),
          good_pieces: Number(a.good_pieces ?? a.goodPieces ?? 0)
        })),
        costingSummary,
        costingHidden: !userCanViewCost
      });
    } catch (err) {
      console.error('Error fetching standard batch details:', err);
      next(err);
    }
  }

  // ── 8. GET /api/production/standard/raw-materials-catalog ──
  // Returns raw materials with live DB UOMs, alternate UOMs, stock, and available lot batches
  async getRawMaterialsCatalog(req, res, next) {
    try {
      const isUuid = (str) => typeof str === 'string' && /^[0-9a-fA-F-]{32,36}$/.test(str.trim());

      const materials = await prisma.rawMaterial.findMany({
        include: {
          category: true,
          uoms: true
        },
        orderBy: { name: 'asc' }
      });

      // Query active inventory batches (excluding depleted lots)
      const batches = await prisma.inventoryBatch.findMany({
        where: { 
          netQty: { gt: 0.0001 },
          status: { notIn: ['DEPLETED', 'EXHAUSTED', 'CONSUMED', 'WASTED'] }
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }]
      });

      const batchMap = new Map();
      batches.forEach(b => {
        const rId = b.rawMaterialId;
        if (!rId) return;
        if (!batchMap.has(rId)) batchMap.set(rId, []);
        batchMap.get(rId).push({
          id: b.id,
          batchNo: b.batchNumber,
          expiryDate: b.expiryDate,
          remainingQty: Number(b.netQty),
          receivedQty: Number(b.receivedQty)
        });
      });

      const formatted = materials.map(m => {
        const primaryUom = Array.isArray(m.uoms) && m.uoms.length > 0 ? m.uoms[0] : null;
        const uomAbbr = primaryUom?.abbreviation || primaryUom?.name || (!isUuid(m.unitId) ? m.unitId : null) || (!isUuid(m.consumptionUnit) ? m.consumptionUnit : null) || 'kg';
        const uomName = primaryUom?.name || uomAbbr;

        return {
          id: m.id,
          code: m.code,
          name: m.name,
          printName: m.printName || m.name,
          category: m.category?.name || 'Raw Material',
          categoryId: m.categoryId,
          unitId: uomAbbr,
          uom: uomAbbr,
          uomName,
          rawUnitId: m.unitId,
          hasAlternateUom: Boolean(m.hasAlternateUom),
          alternateUom: m.alternateUom,
          alternateUomQty: Number(m.alternateUomQty || 1),
          baseUomQty: Number(m.baseUomQty || 1),
          conversionFactor: Number(m.conversionFactor || 1),
          consumptionUnit: (!isUuid(m.consumptionUnit) ? m.consumptionUnit : null) || uomAbbr,
          currentStock: Number(m.currentStock || 0),
          density_g_per_ml: Number(m.density_g_per_ml || 1.0),
          evaporates_by_default: Boolean(m.evaporates_by_default),
          ratePerUnit: Number(m.ratePerUnit || 0),
          hsnCode: m.hsnCode || '',
          description: m.description || '',
          availableBatches: batchMap.get(m.id) || []
        };
      });

      res.json({
        success: true,
        count: formatted.length,
        data: formatted
      });
    } catch (err) {
      console.error('Error fetching raw materials catalog:', err);
      next(err);
    }
  }

  // ── 9. GET /api/production/standard/products-catalog ──
  // Returns finished products with live stock, base category, subcategory, sale price, and human-readable UOM
  async getProductsCatalog(req, res, next) {
    try {
      const products = await prisma.finishedProduct.findMany({
        where: { deletedAt: null },
        include: {
          category: true,
          subcategory: true,
          unit: true
        },
        orderBy: { name: 'asc' }
      });

      const formatted = products.map(p => {
        const unitAbbr = p.unit?.abbreviation || p.unit?.name || 'pcs';
        const unitFullName = p.unit?.name || 'Pieces';

        return {
          id: p.id,
          code: p.code,
          systemCode: p.code,
          name: p.productName || p.name,
          categoryId: p.categoryId,
          category: p.category?.name || 'Standard',
          subcategoryId: p.subcategoryId,
          subcategory: p.subcategory?.name || '-',
          baseId: p.baseId,
          baseCategory: p.category?.name || 'Ice Cream',
          unit: unitAbbr,
          unitName: unitFullName,
          unitId: p.unitId,
          salePrice: Number(p.salePrice || 0),
          currentStock: Number(p.currentStock || 0),
          sku: p.sku,
          barcode: p.barcode
        };
      });

      res.json({
        success: true,
        count: formatted.length,
        data: formatted
      });
    } catch (err) {
      console.error('Error fetching products catalog:', err);
      next(err);
    }
  }

  // ── 10. POST /api/production/standard/:id/complete ──
  // Record actual yield, complete run, deduct raw material inventory, add finished goods, and transition status
  async completeProduction(req, res, next) {
    try {
      const { id } = req.params;
      const { 
        actualOutput, 
        notes = '', 
        labTestRequired = false,
        subBatchLetter = 'A',
        isFinalize = true,
        productOutputs = [],
        productYields = [],
        productStagesMap = {},
        timelineStages,
        labourTotalCost,
        labourCost,
        ebTotalCost,
        utilityCost,
        ebUnitsKwh,
        ebRatePerUnit,
        overheadCost,
        overheadAmt
      } = req.body || {};

      // Existence and status pre-check outside transaction
      const batchCheck = await prisma.$queryRawUnsafe(`
        SELECT * FROM production_batches WHERE id = $1;
      `, id);

      if (!batchCheck || batchCheck.length === 0) {
        return res.status(404).json({ error: 'Production batch not found' });
      }

      if (batchCheck[0].status === 'Completed') {
        return res.status(409).json({ error: 'Batch is already completed.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe(`
          SELECT * FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!rows || rows.length === 0) {
          const notFoundErr = new Error('Production batch not found');
          notFoundErr.statusCode = 404;
          throw notFoundErr;
        }

        const batch = rows[0];
        if (batch.status === 'Completed') {
          const conflictErr = new Error('Batch is already completed.');
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        const userId = req.user?.id || batch.created_by;
        const operatorName = req.user?.name || req.user?.username || 'Supervisor';

        // 1. Fetch raw materials in this batch to deduct taken quantities
        const rmLines = await tx.$queryRawUnsafe(`
          SELECT * FROM production_batch_rm_line WHERE batch_id = $1;
        `, id);

        const rmDeductionLog = [];
        for (const line of rmLines) {
          const taken = Number(line.taken_qty || 0);
          if (taken > 0 && line.raw_material_id) {
            // Deduct taken from RawMaterial.currentStock
            await tx.$executeRawUnsafe(`
              UPDATE "RawMaterial" 
              SET "currentStock" = GREATEST(0, "currentStock" - $1),
                  "updatedAt" = CURRENT_TIMESTAMP
              WHERE id = $2;
            `, taken, line.raw_material_id);

            // Fetch remaining stock in warehouse
            const postStockRes = await tx.$queryRawUnsafe(`
              SELECT "currentStock", name, "consumptionUnit" FROM "RawMaterial" WHERE id = $1;
            `, line.raw_material_id);

            rmDeductionLog.push({
              rawMaterialId: line.raw_material_id,
              name: postStockRes[0]?.name || 'Raw Material',
              consumedQty: taken,
              uom: postStockRes[0]?.consumptionUnit || line.uom || 'kg',
              remainingWarehouseStock: Number(postStockRes[0]?.currentStock || 0),
              batchLeftoverRestored: Math.max(0, Number(line.available_qty || 0) - taken)
            });
          }
        }

        // 2. Deduct from allocated lots in InventoryBatch (matching by ID and Batch Number, updating status to DEPLETED when netQty <= 0)
        const allocations = await tx.$queryRawUnsafe(`
          SELECT inventory_batch_id, allocated_qty, lot_number 
          FROM "production_batch_allocations" 
          WHERE batch_id = $1;
        `, id);

        const deductedLots = new Set();
        for (const alloc of allocations) {
          const qty = Number(alloc.allocated_qty || 0);
          if (qty > 0) {
            const lotId = alloc.inventory_batch_id ? String(alloc.inventory_batch_id).trim() : null;
            const lotNum = alloc.lot_number ? String(alloc.lot_number).trim() : null;
            try {
              if (lotId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch" 
                  SET "netQty" = GREATEST(0, "netQty" - $1),
                      "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, qty, lotId);
              } else if (lotNum) {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch" 
                  SET "netQty" = GREATEST(0, "netQty" - $1),
                      "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE "batchNumber" = $2;
                `, qty, lotNum);
              }
              if (lotId) deductedLots.add(lotId);
              if (lotNum) deductedLots.add(lotNum);
            } catch (lotErr) {
              console.warn('Notice deducting lot from allocations:', lotErr.message);
            }
          }
        }

        // Also ensure lots from production_batch_rm_line are deducted if not already covered
        for (const line of rmLines) {
          const taken = Number(line.taken_qty || 0);
          const lotId = line.lot_id ? String(line.lot_id).trim() : null;
          if (taken > 0 && lotId && !deductedLots.has(lotId)) {
            try {
              if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch" 
                  SET "netQty" = GREATEST(0, "netQty" - $1),
                      "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, taken, lotId);
              } else {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch" 
                  SET "netQty" = GREATEST(0, "netQty" - $1),
                      "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE "batchNumber" = $2;
                `, taken, lotId);
              }
              deductedLots.add(lotId);
            } catch (lotErr) {
              console.warn('Notice deducting lot from rm_line:', lotErr.message);
            }
          }
        }

        // Deduct product-specific raw materials (essences, flavours, wooden sticks, packing covers)
        try {
          let savedMAllocs = [];
          if (typeof batch.mould_allocations === 'string') {
            savedMAllocs = JSON.parse(batch.mould_allocations || '[]');
          } else if (Array.isArray(batch.mould_allocations)) {
            savedMAllocs = batch.mould_allocations;
          }
          for (const sAlloc of savedMAllocs) {
            if (Array.isArray(sAlloc.productRms)) {
              for (const prm of sAlloc.productRms) {
                const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
                const prmId = prm.rmId || prm.rawMaterialId;
                if (prmQty > 0 && prmId) {
                  await tx.$executeRawUnsafe(`
                    UPDATE "RawMaterial" 
                    SET "currentStock" = GREATEST(0, "currentStock" - $1),
                        "updatedAt" = CURRENT_TIMESTAMP
                    WHERE id = $2;
                  `, prmQty, prmId);

                  if (Array.isArray(prm.allocatedBatches)) {
                    for (const ab of prm.allocatedBatches) {
                      const aQty = Number(ab.allocatedQty || ab.qty || 0);
                      const aLotId = ab.batchId ? String(ab.batchId).trim() : null;
                      const aLotNum = (ab.batchNumber || ab.lotNumber || ab.batchNo || ab.batchId) ? String(ab.batchNumber || ab.lotNumber || ab.batchNo || ab.batchId).trim() : null;
                      if (aQty > 0 && (aLotId || aLotNum)) {
                        try {
                          if (aLotId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aLotId)) {
                            await tx.$executeRawUnsafe(`
                              UPDATE "InventoryBatch" 
                              SET "netQty" = GREATEST(0, "netQty" - $1),
                                  "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                                  "updatedAt" = CURRENT_TIMESTAMP
                              WHERE id = $2;
                            `, aQty, aLotId);
                          } else if (aLotNum) {
                            await tx.$executeRawUnsafe(`
                              UPDATE "InventoryBatch" 
                              SET "netQty" = GREATEST(0, "netQty" - $1),
                                  "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
                                  "updatedAt" = CURRENT_TIMESTAMP
                              WHERE "batchNumber" = $2;
                            `, aQty, aLotNum);
                          }
                        } catch (_) {}
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (rmErr) {
          console.warn('Notice deducting product-specific RMs:', rmErr.message);
        }

        // 3. Process finished product allocations and actual outputs
        const productAllocs = await tx.$queryRawUnsafe(`
          SELECT * FROM production_batch_allocation WHERE batch_id = $1;
        `, id);

        const yieldsList = (Array.isArray(productYields) && productYields.length > 0)
          ? productYields
          : (Array.isArray(productOutputs) && productOutputs.length > 0 ? productOutputs : []);

        let finalOutput = 0;
        let totalRejects = 0;

        if (yieldsList.length > 0) {
          // Pre-aggregate actual quantities by productId so that multi-allocation of the same product accumulates cleanly
          const productActualTotals = {};
          for (const po of yieldsList) {
            const pId = po.productId || po.id;
            if (pId) {
              productActualTotals[pId] = (productActualTotals[pId] || 0) + Number(po.actualGoodOutput ?? po.actualOutput ?? 0);
            }
          }

          for (const po of yieldsList) {
            const qty = Number(po.actualGoodOutput ?? po.actualOutput ?? 0);
            const rej = Number(po.rejectOutput || 0);
            finalOutput += qty;
            totalRejects += rej;
            const pId = po.productId || po.id;

            if (pId) {
              // Update production_batch_items with total actual output for this product
              try {
                await tx.$executeRawUnsafe(`
                  UPDATE "production_batch_items"
                  SET actual_qty = $1
                  WHERE batch_id = $2 AND product_id = $3;
                `, Number(productActualTotals[pId] ?? qty), id, pId);
              } catch (_) {}

              // Add to sellable inventory if not quarantined
              if (qty > 0 && !labTestRequired) {
                await tx.$executeRawUnsafe(`
                  UPDATE products 
                  SET current_stock = COALESCE(current_stock, 0) + $1,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, qty, pId);

                if (userId) {
                  try {
                    await tx.$executeRawUnsafe(`
                      INSERT INTO product_stock_movements (
                        id, product_id, batch_id, type, quantity, direction, note, created_by, created_at
                      ) VALUES (
                        gen_random_uuid(), $1, $2, 'production_in', $3, 1, $4, $5, CURRENT_TIMESTAMP
                      );
                    `, pId, id, qty, `Standard Production Output #${batch.reference_no || batch.batch_no} (${po.productName || 'Product'}: ${qty} ${po.uom || 'pcs'})`, userId);
                  } catch (psmErr) {
                    console.warn('Notice inserting product_stock_movements:', psmErr.message);
                  }
                }
              }

              // Record in production_output_details
              try {
                const theorQty = Number(po.planned || (qty + rej) || qty);
                await tx.$executeRawUnsafe(`
                  INSERT INTO production_output_details (
                    id, batch_id, good_qty, rejected_qty, rework_qty, scrap_qty,
                    theoretical_qty, yield_percentage, created_at
                  ) VALUES (
                    gen_random_uuid(), $1, $2, $3, 0, $3,
                    $4, 100, CURRENT_TIMESTAMP
                  );
                `, id, qty, rej, theorQty);
              } catch (podErr) {
                console.warn('Notice recording production_output_details:', podErr.message);
              }
            }
          }
        } else {
          const totalGoodPieces = productAllocs.reduce((s, a) => s + Number(a.good_pieces || 0), 0);
          finalOutput = Number(actualOutput || totalGoodPieces || batch.quantity || 0);

          const productAllocsTotals = {};
          for (const pa of productAllocs) {
            if (pa.product_id) {
              productAllocsTotals[pa.product_id] = (productAllocsTotals[pa.product_id] || 0) + Number(pa.good_pieces || 0);
            }
          }

          for (const pa of productAllocs) {
            const pcs = Number(pa.good_pieces || 0);
            if (pcs > 0 && pa.product_id) {
              try {
                await tx.$executeRawUnsafe(`
                  UPDATE "production_batch_items"
                  SET actual_qty = $1
                  WHERE batch_id = $2 AND product_id = $3;
                `, Number(productAllocsTotals[pa.product_id] ?? pcs), id, pa.product_id);
              } catch (_) {}

              if (!labTestRequired) {
                await tx.$executeRawUnsafe(`
                  UPDATE products 
                  SET current_stock = COALESCE(current_stock, 0) + $1,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, pcs, pa.product_id);

                if (userId) {
                  try {
                    await tx.$executeRawUnsafe(`
                      INSERT INTO product_stock_movements (
                        id, product_id, batch_id, type, quantity, direction, note, created_by, created_at
                      ) VALUES (
                        gen_random_uuid(), $1, $2, 'production_in', $3, 1, $4, $5, CURRENT_TIMESTAMP
                      );
                    `, pa.product_id, id, pcs, `Standard Production Output #${batch.reference_no || batch.batch_no} (Sub-Run ${subBatchLetter})`, userId);
                  } catch (psmErr) {
                    console.warn('Notice inserting product_stock_movements:', psmErr.message);
                  }
                }
              }
            }
          }
        }

        if (productAllocs.length === 0 && yieldsList.length === 0 && batch.product_id && !labTestRequired && finalOutput > 0) {
          await tx.$executeRawUnsafe(`
            UPDATE products 
            SET current_stock = COALESCE(current_stock, 0) + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2;
          `, finalOutput, batch.product_id);
        }

        // Record batch-level production output summary
        try {
          const totalPlanned = Number(batch.quantity || 0) || (finalOutput + totalRejects);
          const yieldPct = totalPlanned > 0 ? Math.min(100, Math.round((finalOutput / totalPlanned) * 100)) : 100;
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_output (
              id, batch_id, good_quantity, rejected_quantity, rework_quantity, scrap_quantity,
              theoretical_quantity, yield_percentage, created_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, 0, $3,
              $4, $5, CURRENT_TIMESTAMP
            );
          `, id, finalOutput, totalRejects, totalPlanned, yieldPct);
        } catch (pboErr) {
          console.warn('Notice recording production_batch_output:', pboErr.message);
        }

        // 4. Status decision: If lab test required -> 'Lab Test In Progress' / quarantine, else 'Completed'
        const finalStatus = labTestRequired ? 'Lab Test In Progress' : 'Completed';
        const qcStatus = labTestRequired ? 'PENDING' : 'EXEMPT';

        const finalLabour = labourTotalCost !== undefined && labourTotalCost !== null ? Number(labourTotalCost) : (labourCost !== undefined && labourCost !== null ? Number(labourCost) : null);
        const finalEb = ebTotalCost !== undefined && ebTotalCost !== null ? Number(ebTotalCost) : (utilityCost !== undefined && utilityCost !== null ? Number(utilityCost) : null);
        const finalUnits = ebUnitsKwh !== undefined && ebUnitsKwh !== null ? Number(ebUnitsKwh) : null;
        const finalRate = ebRatePerUnit !== undefined && ebRatePerUnit !== null ? Number(ebRatePerUnit) : null;
        const finalOverhead = overheadAmt !== undefined && overheadAmt !== null ? Number(overheadAmt) : (overheadCost !== undefined && overheadCost !== null ? Number(overheadCost) : null);

        // Compute financial grand total and per-unit cost
        let directMaterialsCost = 0;
        for (const line of rmLines) {
          const taken = Number(line.taken_qty || 0);
          const rate = Number(line.unit_rate || line.rate_per_unit || 0);
          directMaterialsCost += (taken * rate);
        }
        let productRmCost = 0;
        try {
          let savedMAllocs = [];
          if (typeof batch.mould_allocations === 'string') {
            savedMAllocs = JSON.parse(batch.mould_allocations || '[]');
          } else if (Array.isArray(batch.mould_allocations)) {
            savedMAllocs = batch.mould_allocations;
          }
          for (const mAlloc of savedMAllocs) {
            if (Array.isArray(mAlloc.productRms)) {
              for (const prm of mAlloc.productRms) {
                const prmQty = Number(prm.takenQty ?? prm.qty ?? 0);
                const prmRate = Number(prm.unitRate ?? prm.rate ?? 0);
                productRmCost += (prmQty * prmRate);
              }
            }
          }
        } catch (_) {}

        const labourVal = finalLabour !== null ? finalLabour : Number(batch.labour_total_cost || 0);
        const ebVal = finalEb !== null ? finalEb : Number(batch.eb_total_cost || 0);
        const overheadVal = finalOverhead !== null ? finalOverhead : Number(batch.overhead_amt || 1069.12);
        const subTotalCost = round2(directMaterialsCost + productRmCost);
        const totalBatchCost = round2(subTotalCost + labourVal + ebVal + overheadVal);
        const unitCost = finalOutput > 0 ? round2(totalBatchCost / finalOutput) : 0;

        const stagesPayload = (timelineStages || (productStagesMap && Object.keys(productStagesMap).length > 0)) ? {
          stages: Array.isArray(timelineStages) ? timelineStages : [],
          productStagesMap: (productStagesMap && typeof productStagesMap === 'object') ? productStagesMap : {}
        } : null;

        await tx.$executeRawUnsafe(`
          UPDATE production_batches
          SET 
            status = $2,
            qc_status = $3,
            quarantine_stock = $4,
            good_quantity = $5,
            actual_output = $5,
            rejected_quantity = $6,
            product_yields = $7::jsonb,
            note = COALESCE(note, '') || ' ' || $8,
            completed_at = CURRENT_TIMESTAMP,
            complete_date = CURRENT_TIMESTAMP,
            completed_by = $9,
            labour_total_cost = COALESCE($10, labour_total_cost),
            eb_total_cost = COALESCE($11, eb_total_cost),
            eb_units_kwh = COALESCE($12, eb_units_kwh),
            eb_rate_per_unit = COALESCE($13, eb_rate_per_unit),
            timeline_stages = COALESCE($14::jsonb, timeline_stages),
            overhead_amt = COALESCE($15, overhead_amt),
            sub_total = COALESCE($16, sub_total),
            grand_total = COALESCE($17, grand_total),
            total_cost = COALESCE($17, total_cost),
            cost_per_unit = COALESCE($18, cost_per_unit),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, finalStatus, qcStatus, 
           labTestRequired ? finalOutput : 0, 
           finalOutput, 
           totalRejects,
           JSON.stringify(yieldsList),
           notes ? `[Sub-Run ${subBatchLetter}]: ${notes}` : `[Sub-Run ${subBatchLetter}] Completed`, 
           operatorName,
           finalLabour,
           finalEb,
           finalUnits,
           finalRate,
           stagesPayload ? JSON.stringify(stagesPayload) : null,
           finalOverhead,
           subTotalCost,
           totalBatchCost,
           unitCost);

        // Update RM usages status to CONSUMED upon batch completion
        try {
          await tx.$executeRawUnsafe(`
            UPDATE production_batch_rm_usage
            SET status = 'CONSUMED'
            WHERE batch_id = $1;
          `, id);
        } catch (_) {}

        // Record any product-specific essences/additions into production_batch_rm_usage if not already recorded
        try {
          let savedMAllocsForUsage = [];
          if (typeof batch.mould_allocations === 'string') {
            savedMAllocsForUsage = JSON.parse(batch.mould_allocations || '[]');
          } else if (Array.isArray(batch.mould_allocations)) {
            savedMAllocsForUsage = batch.mould_allocations;
          }
          for (const sAlloc of savedMAllocsForUsage) {
            if (Array.isArray(sAlloc.productRms)) {
              for (const prm of sAlloc.productRms) {
                const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
                const prmId = prm.rmId || prm.rawMaterialId;
                if (prmQty > 0 && prmId) {
                  const prmLot = prm.allocatedBatches?.[0]?.lotNumber || prm.allocatedBatches?.[0]?.internalBatchNo || 'LOT-DIRECT';
                  const prmRate = Number(prm.unitRate || prm.allocatedBatches?.[0]?.unitRate || 0);
                  const prmLineId = require('crypto').randomUUID();
                  await tx.$executeRawUnsafe(`
                    INSERT INTO production_batch_rm_usage (
                      id, batch_id, rm_id, required_qty, available_qty_at_time,
                      actual_used_qty, unit_cost, total_cost, status,
                      internal_batch_no, selected_uom, input_qty
                    )
                    SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'CONSUMED', $9, $10, $11
                    WHERE NOT EXISTS (
                      SELECT 1 FROM production_batch_rm_usage WHERE batch_id = $2 AND rm_id = $3
                    );
                  `, prmLineId, id, prmId, prmQty, prmQty,
                     prmQty, prmRate, prmQty * prmRate,
                     prmLot, prm.uom || 'kg', prmQty
                  ).catch(() => {});
                }
              }
            }
          }
        } catch (_) {}

        // Lock merge table if finalized
        if (isFinalize) {
          try {
            await tx.$executeRawUnsafe(`
              UPDATE production_batch_merge SET locked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $1;
            `, id);
          } catch (_) {}
        }

        return {
          id,
          batchNo: batch.batch_no,
          referenceNo: batch.reference_no,
          status: finalStatus,
          subBatchLetter,
          actualOutput: finalOutput,
          rejectedQuantity: totalRejects,
          productYields: yieldsList,
          labTestRequired,
          qcStatus,
          rmDeductions: rmDeductionLog,
          completedBy: operatorName
        };
      });

      // Explicitly update productionBatchNew via Prisma ORM to ensure status is 100% committed & visible to getBatches
      try {
        await prisma.productionBatchNew.update({
          where: { id },
          data: {
            status: result.status || 'Completed',
            actualOutput: result.actualOutput || 0,
            goodQuantity: result.actualOutput || 0,
            completeDate: new Date(),
            updatedAt: new Date()
          }
        });
      } catch (ormErr) {
        console.warn('Notice updating productionBatchNew via Prisma ORM after complete:', ormErr.message);
        try {
          await prisma.$executeRawUnsafe(`
            UPDATE production_batches 
            SET status = $2, good_quantity = $3, actual_output = $3, complete_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1;
          `, id, result.status || 'Completed', result.actualOutput || 0);
        } catch (_) {}
      }

      if (!res.headersSent) {
        res.json({
          success: true,
          message: result.labTestRequired
            ? `Production sub-batch ${result.subBatchLetter} completed and dispatched to QC queue for lab testing.`
            : `Production sub-batch ${result.subBatchLetter} completed and released to finished goods sellable inventory.`,
          data: result
        });
      }
    } catch (err) {
      console.error('Error completing production:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  }

  // ── 10B. PUT /api/production/standard/:id/stages ──
  // Update Factory Stages & Timeline Sequence parameters (both batch & active Day)
  async updateStages(req, res, next) {
    try {
      const { id } = req.params;
      const { 
        timelineStages = [],
        productStagesMap = {},
        labourCost,
        labourTotalCost,
        utilityCost,
        ebTotalCost,
        ebStartReading,
        ebEndReading,
        ebUnitsKwh,
        ebRatePerUnit,
        overheadCost,
        overheadAmt,
        productYields,
        dayNo,
        dayBatchCode,
        productionDate
      } = req.body || {};

      const finalLabour = labourTotalCost !== undefined && labourTotalCost !== null ? Number(labourTotalCost) : (labourCost !== undefined && labourCost !== null ? Number(labourCost) : null);
      const finalEb = ebTotalCost !== undefined && ebTotalCost !== null ? Number(ebTotalCost) : (utilityCost !== undefined && utilityCost !== null ? Number(utilityCost) : null);
      const finalUnits = ebUnitsKwh !== undefined && ebUnitsKwh !== null ? Number(ebUnitsKwh) : null;
      const finalRate = ebRatePerUnit !== undefined && ebRatePerUnit !== null ? Number(ebRatePerUnit) : null;
      const finalOverhead = overheadAmt !== undefined && overheadAmt !== null ? Number(overheadAmt) : (overheadCost !== undefined && overheadCost !== null ? Number(overheadCost) : null);

      const stagesPayload = {
        stages: Array.isArray(timelineStages) ? timelineStages : [],
        productStagesMap: (productStagesMap && typeof productStagesMap === 'object') ? productStagesMap : {}
      };

      await prisma.$executeRawUnsafe(`
        UPDATE production_batches
        SET timeline_stages = $2::jsonb,
            labour_total_cost = COALESCE($3, labour_total_cost),
            eb_total_cost = COALESCE($4, eb_total_cost),
            eb_start_reading = COALESCE($5, eb_start_reading),
            eb_end_reading = COALESCE($6, eb_end_reading),
            eb_units_kwh = COALESCE($7, eb_units_kwh),
            eb_rate_per_unit = COALESCE($8, eb_rate_per_unit),
            overhead_amt = COALESCE($9, overhead_amt),
            product_yields = COALESCE($10::jsonb, product_yields),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, id, 
         JSON.stringify(stagesPayload),
         finalLabour,
         finalEb,
         ebStartReading !== undefined && ebStartReading !== null ? Number(ebStartReading) : null,
         ebEndReading !== undefined && ebEndReading !== null ? Number(ebEndReading) : null,
         finalUnits,
         finalRate,
         finalOverhead,
         productYields ? JSON.stringify(productYields) : null
      );

      // Sync active Day record if present
      if (dayNo) {
        const stageProdDate = typeof productionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(productionDate.trim())
          ? productionDate.trim().slice(0, 10)
          : null;
        const stageDayCode = dayBatchCode
          ? sanitizeToken(dayBatchCode, 24, formatDDMMYY(stageProdDate || new Date()))
          : null;
        await prisma.$executeRawUnsafe(`
          UPDATE production_batch_days
          SET timeline_stages = $3::jsonb,
              product_stages_map = $4::jsonb,
              eb_start_reading = COALESCE($5, eb_start_reading),
              eb_end_reading = COALESCE($6, eb_end_reading),
              eb_units_kwh = COALESCE($7, eb_units_kwh),
              eb_rate_per_unit = COALESCE($8, eb_rate_per_unit),
              eb_total_cost = COALESCE($9, eb_total_cost),
              labour_total_cost = COALESCE($10, labour_total_cost),
              overhead_amt = COALESCE($11, overhead_amt),
              production_date = COALESCE($12::date, production_date),
              day_batch_code = COALESCE($13, day_batch_code),
              updated_at = CURRENT_TIMESTAMP
          WHERE batch_id = $1 AND day_no = $2 AND status = 'IN_PROGRESS';
        `, id, Number(dayNo),
           JSON.stringify(Array.isArray(timelineStages) ? timelineStages : []),
           JSON.stringify((productStagesMap && typeof productStagesMap === 'object') ? productStagesMap : {}),
           ebStartReading !== undefined && ebStartReading !== null ? Number(ebStartReading) : null,
           ebEndReading !== undefined && ebEndReading !== null ? Number(ebEndReading) : null,
           finalUnits, finalRate, finalEb, finalLabour, finalOverhead, stageProdDate, stageDayCode
        ).catch(() => {});
      }

      res.json({
        success: true,
        message: 'Factory stages, labour cost and utilities updated successfully',
        timelineStages,
        productStagesMap,
        labourCost: finalLabour,
        ebTotalCost: finalEb,
        overheadCost: finalOverhead
      });
    } catch (err) {
      console.error('Error updating factory stages:', err);
      next(err);
    }
  }

  // ── 10C. POST /api/production/standard/:id/complete-day ──
  // Completes a single Day (Day 1, Day 2, ...), assigns product batch numbers & 8-digit serials,
  // deducts Base RMs once (Day 1) + Day Product RMs, pushes Day yield to Sales immediately (or QC),
  // and either pauses for Day N+1 (remaining base mix) or finalizes entire production.
  async completeDay(req, res, next) {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const operatorName = req.user?.name || req.user?.username || 'Supervisor';
      const userId = req.user?.id || null;

      const data = await completeDayRun({
        batchId: id,
        dayNo: body.dayNo,
        dayBatchCode: body.dayBatchCode || body.shortBatchCode,
        productionDate: body.productionDate || new Date(),
        timelineStages: body.timelineStages || [],
        productStagesMap: body.productStagesMap || {},
        ebStartReading: body.ebStartReading ?? 0,
        ebEndReading: body.ebEndReading ?? 0,
        ebUnitsKwh: body.ebUnitsKwh ?? 0,
        ebRatePerUnit: body.ebRatePerUnit ?? 8.5,
        ebTotalCost: body.ebTotalCost ?? body.utilityCost ?? 0,
        labourTotalCost: body.labourTotalCost ?? body.labourCost ?? 0,
        overheadAmt: body.overheadAmt ?? body.overheadCost ?? 0,
        allocations: body.allocations || [],
        productYields: body.productYields || body.productOutputs || [],
        labTestRequired: Boolean(body.labTestRequired),
        finalizeProduction: Boolean(body.finalizeProduction),
        scrapRemainingMixAsWaste: body.scrapRemainingMixAsWaste !== undefined ? Boolean(body.scrapRemainingMixAsWaste) : true,
        notes: body.notes || '',
        userId,
        operatorName
      });

      res.json({
        success: true,
        message: data.finalizedEntireProduction
          ? `Day ${data.dayNo} completed and ENTIRE production batch finalized${data.pushedToSales ? ' & pushed to Sales stock' : ' (QC Queue)'}.`
          : `Day ${data.dayNo} completed${data.pushedToSales ? ' & pushed to Sales stock' : ' (QC Queue)'}. Remaining ${data.remainingMixMl} ml carry-forward mix ready for Day ${data.dayNo + 1}.`,
        data
      });
    } catch (err) {
      console.error('Error completing day production:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message, errors: err.errors });
      }
      next(err);
    }
  }

  // ── 10D. POST /api/production/standard/:id/days/start-next ──
  // Resumes a paused batch into Day N+1 using remaining unallocated carry-forward base mix
  async startNextDay(req, res, next) {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const operatorName = req.user?.name || req.user?.username || 'Supervisor';

      const data = await startNextDayRun(id, {
        productionDate: body.productionDate || new Date(),
        dayBatchCode: body.dayBatchCode || body.shortBatchCode,
        operatorName
      });

      res.json({
        success: true,
        message: `Day ${data.dayNo} started with ${data.openingMixMl} ml carry-forward base mix.`,
        data
      });
    } catch (err) {
      console.error('Error starting next day run:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  }

  // ── 10E. PUT /api/production/standard/:id/days/:dayId/costs ──
  // Allows editing Electricity & Labour costs on any completed Day & dynamically recalculates unit costs
  async updateDayCosts(req, res, next) {
    try {
      const { id, dayId } = req.params;
      const body = req.body || {};
      const operatorName = req.user?.name || req.user?.username || 'Supervisor';

      const data = await updateCompletedDayCosts({
        batchId: id,
        dayId,
        ebStartReading: body.ebStartReading,
        ebEndReading: body.ebEndReading,
        ebUnitsKwh: body.ebUnitsKwh,
        ebRatePerUnit: body.ebRatePerUnit,
        ebTotalCost: body.ebTotalCost ?? body.utilityCost,
        labourTotalCost: body.labourTotalCost ?? body.labourCost,
        overheadAmt: body.overheadAmt ?? body.overheadCost,
        outputLabourOverrides: body.outputLabourOverrides || {},
        timelineStages: body.timelineStages,
        productStagesMap: body.productStagesMap,
        notes: body.notes,
        productionDate: body.productionDate,
        dayBatchCode: body.dayBatchCode,
        userId: req.user?.id || null,
        operatorName
      });

      res.json({
        success: true,
        message: `Day ${data.day?.dayNo || ''} operational costs updated and unit costs recalculated.`,
        data
      });
    } catch (err) {
      console.error('Error updating completed day costs:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  }

  // ── 10E-2. PUT /api/production/standard/:id/days/:dayId/update ──
  // Updates a completed Day's Step 3 Products/Moulds/RMs, Step 4 Timeline/EB/Labour/Overhead, & Step 5 Actual Yields cleanly
  async updateDayFull(req, res, next) {
    try {
      const { id, dayId } = req.params;
      const body = req.body || {};
      const operatorName = req.user?.name || req.user?.username || 'Supervisor';

      const data = await updateCompletedDayRun({
        batchId: id,
        dayId,
        productionDate: body.productionDate,
        dayBatchCode: body.dayBatchCode || body.shortBatchCode,
        allocations: body.allocations,
        timelineStages: body.timelineStages,
        productStagesMap: body.productStagesMap,
        ebStartReading: body.ebStartReading,
        ebEndReading: body.ebEndReading,
        ebUnitsKwh: body.ebUnitsKwh,
        ebRatePerUnit: body.ebRatePerUnit,
        ebTotalCost: body.ebTotalCost ?? body.utilityCost,
        labourTotalCost: body.labourTotalCost ?? body.labourCost,
        overheadAmt: body.overheadAmt ?? body.overheadCost,
        productYields: body.productYields,
        notes: body.notes,
        userId: req.user?.id || null,
        operatorName
      });

      res.json({
        success: true,
        message: `Day ${data.day?.dayNo || ''} products, timeline, operational costs, and actual yields updated successfully.`,
        data
      });
    } catch (err) {
      console.error('Error updating completed day execution:', err);
      if (err.statusCode && !res.headersSent) {
        return res.status(err.statusCode).json({ error: err.message, errors: err.errors });
      }
      next(err);
    }
  }

  // ── 10F. GET /api/production/standard/serial-preview ──
  // Live non-mutating preview of 8-digit per-product serial numbers & DDMMYY batch numbers
  async getSerialPreview(req, res, next) {
    try {
      const rawIds = String(req.query.productIds || '').split(',').map(s => s.trim()).filter(Boolean);
      const headerBatchCode = req.query.dayBatchCode || req.query.shortBatchCode || null;
      const dateInput = req.query.date || new Date();

      const preview = await previewNextProductSerials(rawIds, dateInput, headerBatchCode);
      res.json({ success: true, ...preview });
    } catch (err) {
      console.error('Error generating serial preview:', err);
      next(err);
    }
  }

  // ── 10G. POST /api/production/standard/:id/reopen ──
  async reopenProduction(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.$executeRawUnsafe(`
        UPDATE production_batches
        SET status = 'Paused', is_finalized = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, id);
      res.json({ success: true, message: 'Production batch reopened to Paused state.' });
    } catch (err) {
      next(err);
    }
  }

  // ── 11. POST /api/production/standard/:id/pause ──
  async pauseProduction(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.$executeRawUnsafe(`
        UPDATE production_batches 
        SET status = 'Paused', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND status = 'In Progress';
      `, id);

      res.json({ success: true, message: 'Production run paused' });
    } catch (err) {
      next(err);
    }
  }

  // ── 12. POST /api/production/standard/:id/resume ──
  async resumeProduction(req, res, next) {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const operatorName = req.user?.name || req.user?.username || 'Supervisor';

      await ensureMultiDaySchema(prisma);
      const dayRows = await prisma.$queryRawUnsafe(`
        SELECT day_no, status FROM production_batch_days WHERE batch_id = $1 ORDER BY day_no ASC;
      `, id).catch(() => []);
      const hasOpenDay = (dayRows || []).some(d => d.status === 'IN_PROGRESS');
      const hasCompletedDay = (dayRows || []).some(d => d.status !== 'IN_PROGRESS');

      await prisma.$executeRawUnsafe(`
        UPDATE production_batches 
        SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND status = 'Paused';
      `, id);

      if (hasCompletedDay && !hasOpenDay) {
        try {
          const nextDay = await startNextDayRun(id, {
            productionDate: body.productionDate || new Date(),
            dayBatchCode: body.dayBatchCode || body.shortBatchCode,
            operatorName
          });
          return res.json({
            success: true,
            startedNextDay: true,
            data: nextDay,
            message: `Production resumed and Day ${nextDay.dayNo} started with ${nextDay.openingMixMl} ml remaining mix.`
          });
        } catch (nextErr) {
          // If no carry-forward mix remains, still return normal resume response
          if (nextErr.statusCode !== 422 && nextErr.statusCode !== 409) {
            throw nextErr;
          }
        }
      }

      res.json({ success: true, startedNextDay: false, message: 'Production run resumed' });
    } catch (err) {
      next(err);
    }
  }

  // ── 13. DELETE /api/production/standard/:id (Delete Batch & Automatically Revert Stock) ──
  async deleteBatch(req, res, next) {
    try {
      const { id } = req.params;

      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe(`
          SELECT * FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!rows || rows.length === 0) {
          return { notFound: true };
        }

        const batch = rows[0];

        // 1. If batch was Completed or already completed Day runs, automatically restore warehouse stock (dual-layer safety)
        if (batch.status === 'Completed' || batch.base_rm_deducted || Number(batch.completed_days_count || 0) > 0) {
          const allocations = await tx.$queryRawUnsafe(`
            SELECT inventory_batch_id, lot_number, allocated_qty 
            FROM production_batch_allocations 
            WHERE batch_id = $1 AND allocated_qty > 0;
          `, id);

          for (const alloc of allocations) {
            const lotId = alloc.inventory_batch_id ? String(alloc.inventory_batch_id).trim() : null;
            const lotNum = alloc.lot_number ? String(alloc.lot_number).trim() : null;
            const aQty = Number(alloc.allocated_qty || 0);
            if (aQty > 0) {
              if (lotId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch" 
                  SET "netQty" = "netQty" + $1,
                      "status" = 'AVAILABLE',
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, aQty, lotId);
              } else if (lotNum) {
                await tx.$executeRawUnsafe(`
                  UPDATE "InventoryBatch" 
                  SET "netQty" = "netQty" + $1,
                      "status" = 'AVAILABLE',
                      "updatedAt" = CURRENT_TIMESTAMP
                  WHERE "batchNumber" = $2;
                `, aQty, lotNum);
              }
            }
          }

          const usages = await tx.$queryRawUnsafe(`
            SELECT rm_id, COALESCE(actual_used_qty, required_qty, input_qty, 0) AS qty
            FROM production_batch_rm_usage
            WHERE batch_id = $1 AND status = 'CONSUMED';
          `, id);

          for (const u of usages) {
            const uQty = Number(u.qty || 0);
            if (uQty > 0 && u.rm_id) {
              await tx.$executeRawUnsafe(`
                UPDATE "RawMaterial"
                SET "currentStock" = "currentStock" + $1,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = $2;
              `, uQty, u.rm_id);
            }
          }

          // Revert multi-day finished product stock lots pushed to sales, else fallback to single product
          const pushedLots = await tx.$queryRawUnsafe(`
            SELECT product_id, remaining_qty, initial_qty
            FROM finished_product_stock_lots
            WHERE batch_id = $1 AND is_sellable = TRUE;
          `, id).catch(() => []);

          if (pushedLots && pushedLots.length > 0) {
            for (const lot of pushedLots) {
              const revQty = Number(lot.remaining_qty ?? lot.initial_qty ?? 0);
              if (lot.product_id && revQty > 0) {
                await tx.$executeRawUnsafe(`
                  UPDATE products
                  SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1),
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = $2;
                `, revQty, lot.product_id);
              }
            }
          } else {
            const prodYield = Number(batch.good_quantity || batch.actual_output || batch.quantity || 0);
            if (batch.product_id && prodYield > 0 && batch.status === 'Completed') {
              await tx.$executeRawUnsafe(`
                UPDATE products
                SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2;
              `, prodYield, batch.product_id);
            }
          }
        }

        // 2. Cascade delete all child foreign key tables
        await tx.$executeRawUnsafe(`DELETE FROM finished_product_stock_lots WHERE batch_id = $1;`, id).catch(() => {});
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_day_outputs WHERE batch_id = $1;`, id).catch(() => {});
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_days WHERE batch_id = $1;`, id).catch(() => {});
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_allocations WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_usage WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_line WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_allocation WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_merge WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_items WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_output WHERE batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM production_loss WHERE production_batch_id = $1;`, id);
        await tx.$executeRawUnsafe(`DELETE FROM lab_production_test WHERE production_batch_id = $1;`, id);

        // 3. Delete the production batch itself
        await tx.$executeRawUnsafe(`DELETE FROM production_batches WHERE id = $1;`, id);

        return { success: true, batchNo: batch.batch_no || batch.reference_no, status: batch.status };
      });

      if (result.notFound) {
        return res.status(404).json({ error: 'Production batch not found' });
      }

      res.json({
        success: true,
        message: `Batch ${result.batchNo} deleted successfully. All raw material stock has been automatically restored to inventory.`,
        deletedBatch: result
      });
    } catch (err) {
      console.error('Error deleting production batch:', err);
      next(err);
    }
  }
}

async function txOrPrisma(p, sql, ...params) {
  return await p.$queryRawUnsafe(sql, ...params);
}

module.exports = new StandardProductionController();
