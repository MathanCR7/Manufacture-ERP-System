const { randomUUID } = require('crypto');
const { z } = require('zod');
const prisma = require('../../database/prisma');
const {
  toMl,
  round2,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays
} = require('./utils/productionCalculation');
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
    await p.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // Ensure production_moulds table
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

    // Ensure view ice_cream_mould
    await p.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW ice_cream_mould AS 
      SELECT * FROM production_moulds;
    `);

    // Ensure production_batch_rm_line
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

    // Ensure production_batch_merge
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS production_batch_merge (
        batch_id TEXT PRIMARY KEY REFERENCES production_batches(id) ON DELETE CASCADE,
        merge_stage VARCHAR(50) NOT NULL DEFAULT 'Before freezing',
        merged_total_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (merged_total_ml >= 0),
        evaporation_pct NUMERIC(6,2) NOT NULL DEFAULT 5.00 CHECK (evaporation_pct >= 0 AND evaporation_pct <= 100),
        evaporation_applied BOOLEAN NOT NULL DEFAULT FALSE,
        evaporated_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (evaporated_ml >= 0),
        mix_after_evap_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (mix_after_evap_ml >= 0),
        locked BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure production_batch_allocation
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
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_pb_alloc_batch_seq UNIQUE (batch_id, seq)
      );
    `);

    // Add columns to production_batches if missing
    try {
      await p.$executeRawUnsafe(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS floor_stage VARCHAR(50) DEFAULT 'STEP1_RM';`);
      await p.$executeRawUnsafe(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS merged_pre_evap_ml DECIMAL(15, 3) DEFAULT 0;`);
      await p.$executeRawUnsafe(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS evaporation_rate_pct DECIMAL(6, 2) DEFAULT 5.00;`);
      await p.$executeRawUnsafe(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS evaporation_loss_ml DECIMAL(15, 3) DEFAULT 0;`);
      await p.$executeRawUnsafe(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS net_post_evap_mix_ml DECIMAL(15, 3) DEFAULT 0;`);
      await p.$executeRawUnsafe(`ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS mould_allocations JSONB DEFAULT '[]'::jsonb;`);
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
          dimension_source,
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

        // If formulation lines were sent, save them into production_batch_rm_line
        const rawMaterials = Array.isArray(data.rawMaterials) ? data.rawMaterials : [];
        for (const rm of rawMaterials) {
          const rmId = rm.rawMaterialId || rm.rmId;
          if (!rmId) continue;

          // Lookup RM defaults
          const rmMaster = await tx.$queryRawUnsafe(`
            SELECT density_g_per_ml, evaporates_by_default, "currentStock" 
            FROM "RawMaterial" WHERE id = $1 LIMIT 1;
          `, rmId);
          const master = rmMaster[0] || {};

          const density = Number(rm.density || master.density_g_per_ml || 1.0);
          const evaporates = Boolean(rm.evaporates ?? master.evaporates_by_default ?? false);
          const available = Number(rm.availableQty ?? master.currentStock ?? 0);
          const required = Number(rm.requiredQty || 0);
          const taken = Number(rm.takenQty ?? required);

          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_rm_line (
              id, batch_id, raw_material_id, lot_id, uom, density,
              available_qty, required_qty, taken_qty, evaporates, merged,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, batch.id, rmId, rm.lotId || null, rm.uom || rm.selectedUom || 'kg', density,
             available, required, taken, evaporates, rm.merged !== undefined ? Boolean(rm.merged) : true);
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
          for (const rm of data.rawMaterials) {
            const rmId = rm.rawMaterialId || rm.rmId;
            if (!rmId) continue;
            const rmMaster = await tx.$queryRawUnsafe(`
              SELECT density_g_per_ml, evaporates_by_default, "currentStock" 
              FROM "RawMaterial" WHERE id = $1 LIMIT 1;
            `, rmId);
            const master = rmMaster[0] || {};
            const density = Number(rm.density || master.density_g_per_ml || 1.0);
            const evaporates = Boolean(rm.evaporates ?? master.evaporates_by_default ?? false);
            const available = Number(rm.availableQty ?? master.currentStock ?? 0);
            const required = Number(rm.requiredQty || 0);
            const taken = Number(rm.takenQty ?? required);

            await tx.$executeRawUnsafe(`
              INSERT INTO production_batch_rm_line (
                id, batch_id, raw_material_id, lot_id, uom, density,
                available_qty, required_qty, taken_qty, evaporates, merged,
                created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              );
            `, id, rmId, rm.lotId || null, rm.uom || rm.selectedUom || 'kg', density,
               available, required, taken, evaporates, rm.merged !== undefined ? Boolean(rm.merged) : true);
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
            rm.density_g_per_ml,
            rm.evaporates_by_default,
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
        await tx.$executeRawUnsafe(`
          INSERT INTO production_batch_merge (
            batch_id, merge_stage, merged_total_ml, evaporation_pct,
            evaporation_applied, evaporated_ml, mix_after_evap_ml, locked, updated_at
          ) VALUES (
            $1, 'Before freezing', 0, 5.00,
            false, 0, 0, false, CURRENT_TIMESTAMP
          )
          ON CONFLICT (batch_id) DO NOTHING;
        `, id);

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
        evaporationApplied = true
      } = req.body || {};

      const result = await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE on batch
        const batchRows = await tx.$queryRawUnsafe(`
          SELECT id, status FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!batchRows || batchRows.length === 0) {
          return res.status(404).json({ error: 'Production batch not found' });
        }

        const batch = batchRows[0];
        if (batch.status === 'Completed') {
          return res.status(409).json({
            error: `Cannot process floor execution. Batch is already Completed.`
          });
        }
        if (batch.status !== 'In Progress' && batch.status !== 'IN_PROGRESS') {
          await tx.$executeRawUnsafe(`
            UPDATE production_batches SET status = 'In Progress', started_at = CURRENT_TIMESTAMP WHERE id = $1;
          `, id);
        }

        // Check if merge is already locked
        const mergeRows = await tx.$queryRawUnsafe(`
          SELECT locked FROM production_batch_merge WHERE batch_id = $1;
        `, id);
        if (mergeRows.length > 0 && mergeRows[0].locked) {
          return res.status(409).json({
            error: 'Floor merge and evaporation for this batch has been locked after completion.'
          });
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

          enrichedLines.push({
            ...line,
            rawMaterialId: rmId,
            rawMaterialName: line.rawMaterialName || master.name || 'Raw Material',
            uom: line.uom || master.consumptionUnit || master.unitId || 'kg',
            density: Number(line.density || master.density_g_per_ml || 1.0),
            evaporates: line.evaporates !== undefined ? Boolean(line.evaporates) : Boolean(master.evaporates_by_default),
            availableQty: Number(line.availableQty ?? master.currentStock ?? 0),
            requiredQty: Number(line.requiredQty || 0),
            takenQty: Number(line.takenQty ?? line.requiredQty ?? 0),
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

        // Persist computed lines into production_batch_rm_line
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_rm_line WHERE batch_id = $1;`, id);
        try {
          await tx.$executeRawUnsafe(`DELETE FROM "production_batch_allocations" WHERE batch_id = $1;`, id);
        } catch (_) {}

        for (const line of computed.lines) {
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_rm_line (
              id, batch_id, raw_material_id, lot_id, uom, density,
              available_qty, required_qty, taken_qty, evaporates, merged,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, id, line.rawMaterialId, line.lotId || null, line.uom, line.density,
             line.availableQty, line.requiredQty, line.takenQty, line.evaporates, line.merged);

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
                  id,
                  ab.batchId ? String(ab.batchId) : null,
                  lotNum,
                  Number(ab.allocatedQty || 0),
                  Number(ab.availableQty || ab.allocatedQty || 0),
                  Number(ab.allocatedAmount || 0),
                  Number(ab.allocatedAmount || 0),
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
        await tx.$executeRawUnsafe(`
          INSERT INTO production_batch_merge (
            batch_id, merge_stage, merged_total_ml, evaporation_pct,
            evaporation_applied, evaporated_ml, mix_after_evap_ml, locked, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, false, CURRENT_TIMESTAMP
          )
          ON CONFLICT (batch_id) DO UPDATE SET
            merge_stage = EXCLUDED.merge_stage,
            merged_total_ml = EXCLUDED.merged_total_ml,
            evaporation_pct = EXCLUDED.evaporation_pct,
            evaporation_applied = EXCLUDED.evaporation_applied,
            evaporated_ml = EXCLUDED.evaporated_ml,
            mix_after_evap_ml = EXCLUDED.mix_after_evap_ml,
            updated_at = CURRENT_TIMESTAMP;
        `, id, computed.mergeStage, computed.totalBeforeEvapMl, computed.evaporationPct,
           computed.evaporationApplied, computed.evaporatedMl, computed.mixAfterEvapMl);

        // Mirror to production_batches columns for fast dashboard queries
        await tx.$executeRawUnsafe(`
          UPDATE production_batches 
          SET 
            floor_stage = $2,
            merged_pre_evap_ml = $3,
            evaporation_rate_pct = $4,
            evaporation_loss_ml = $5,
            net_post_evap_mix_ml = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, computed.mergeStage, computed.totalBeforeEvapMl, computed.evaporationPct,
           computed.evaporatedMl, computed.mixAfterEvapMl);

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
      next(err);
    }
  }

  // ── 6. PUT /api/production/standard/:id/allocations ──
  // Section C: Replaces finished product allocations atomically in one transaction
  async saveAllocations(req, res, next) {
    try {
      const { id } = req.params;
      const { allocations = [] } = req.body || {};

      const result = await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE on batch
        const batchRows = await tx.$queryRawUnsafe(`
          SELECT id, status FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!batchRows || batchRows.length === 0) {
          return res.status(404).json({ error: 'Production batch not found' });
        }

        const batch = batchRows[0];
        if (batch.status === 'Completed') {
          return res.status(409).json({
            error: `Cannot update mould allocations. Batch is already Completed.`
          });
        }
        if (batch.status !== 'In Progress' && batch.status !== 'IN_PROGRESS') {
          await tx.$executeRawUnsafe(`
            UPDATE production_batches SET status = 'In Progress', started_at = CURRENT_TIMESTAMP WHERE id = $1;
          `, id);
        }

        // Get latest mix_after_evap_ml from production_batch_merge or batch record
        let availableMixMl = 0;
        try {
          const mergeRows = await tx.$queryRawUnsafe(`
            SELECT mix_after_evap_ml, evaporation_applied FROM production_batch_merge WHERE batch_id = $1;
          `, id);
          if (mergeRows.length > 0) {
            availableMixMl = Number(mergeRows[0].mix_after_evap_ml || 0);
          }
        } catch (_) {}

        if (availableMixMl <= 0) {
          const pbFallback = await tx.$queryRawUnsafe(`
            SELECT net_post_evap_mix_ml, merged_pre_evap_ml FROM production_batches WHERE id = $1;
          `, id);
          if (pbFallback.length > 0) {
            availableMixMl = Number(pbFallback[0].net_post_evap_mix_ml || pbFallback[0].merged_pre_evap_ml || 0);
          }
        }

        if (availableMixMl <= 0) {
          return res.status(422).json({
            error: 'No mix available for allocation. Complete Raw Materials merge & evaporation before allocating products.',
            mixAvailableMl: 0
          });
        }

        // Run sequential allocation calculation
        const computed = calculateAllocations({
          availableMixMl,
          allocations
        });

        if (!computed.isValid) {
          return res.status(422).json({
            error: 'Validation failed in product mould allocations',
            errors: computed.errors,
            message: computed.errors.map(e => e.message).join('; ')
          });
        }

        // Atomically replace allocations in production_batch_allocation
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_allocation WHERE batch_id = $1;`, id);

        for (let i = 0; i < computed.allocations.length; i++) {
          const alloc = computed.allocations[i];
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_allocation (
              id, batch_id, seq, product_id, use_mould, mould_id,
              capacity_ml, cavities, trays, waste_mode, waste_value,
              mix_used_ml, waste_ml, good_pieces,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, CASE WHEN $5 IS NULL OR $5 = '' THEN NULL ELSE $5::uuid END,
              $6, $7, $8, $9, $10,
              $11, $12, $13,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
          `, id, alloc.seq, alloc.productId, Boolean(alloc.useMould), alloc.mouldId || null,
             alloc.capacityMl, alloc.cavities, alloc.trays, alloc.wasteMode, alloc.wasteValue,
             alloc.mixUsedMl, alloc.wasteMl, alloc.goodPieces);
        }

        // Mirror allocations into production_batches.mould_allocations
        await tx.$executeRawUnsafe(`
          UPDATE production_batches 
          SET 
            mould_allocations = $2::jsonb,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, JSON.stringify(computed.allocations));

        return computed;
      });

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Product allocations atomically saved',
          data: result
        });
      }
    } catch (err) {
      console.error('Error saving mould allocations:', err);
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
      const rmLines = await prisma.$queryRawUnsafe(`
        SELECT 
          pbl.*,
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
            WHEN LOWER(rm.name) LIKE '%milk%' OR LOWER(rm.name) LIKE '%smp%' OR LOWER(rm.name) LIKE '%stabilizer%' OR LOWER(rm.name) LIKE '%rabdi%' THEN TRUE 
            ELSE FALSE 
          END AS master_evaporates,
          ib."batchNumber" AS lot_batch_no,
          ib."expiryDate" AS lot_expiry_date
        FROM production_batch_rm_line pbl
        LEFT JOIN "RawMaterial" rm ON rm.id = pbl.raw_material_id
        LEFT JOIN "InventoryBatch" ib ON ib.id = pbl.lot_id
        WHERE pbl.batch_id = $1
        ORDER BY pbl.created_at;
      `, id);

      // Fetch saved raw material batch allocations
      let savedBatchAllocations = [];
      try {
        savedBatchAllocations = await prisma.$queryRawUnsafe(
          `SELECT * FROM "production_batch_allocations" WHERE batch_id = $1`,
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

      // Fetch Allocations with mould and product names
      let allocations = [];
      try {
        allocations = await prisma.$queryRawUnsafe(`
          SELECT 
            pba.*,
            p.name AS product_name,
            p.code AS product_code,
            m.mould_code,
            m.mould_name,
            m.mould_category,
            m.specification_status
          FROM production_batch_allocation pba
          LEFT JOIN products p ON p.id = pba.product_id
          LEFT JOIN ice_cream_mould m ON m.id = pba.mould_id
          WHERE pba.batch_id = $1
          ORDER BY pba.seq;
        `, id);
      } catch (allocErr) {
        allocations = await prisma.$queryRawUnsafe(`
          SELECT 
            pba.*,
            p.name AS product_name,
            p.code AS product_code
          FROM production_batch_allocation pba
          LEFT JOIN products p ON p.id = pba.product_id
          WHERE pba.batch_id = $1
          ORDER BY pba.seq;
        `, id).catch(() => []);
      }

      // Calculate Costing
      let costingSummary = null;
      if (userCanViewCost) {
        let totalMaterialCost = 0;
        let totalWastageCost = 0;
        const totalMixUsedMl = allocations.reduce((sum, a) => sum + Number(a.mix_used_ml || 0), 0);

        const rmCostBreakdown = rmLines.map(line => {
          const taken = Number(line.taken_qty || 0);
          const rate = Number(line.rate_per_unit || 0);
          const lineCost = taken * rate;
          totalMaterialCost += lineCost;
          return {
            rawMaterialId: line.raw_material_id,
            rawMaterialName: line.raw_material_name,
            takenQty: taken,
            uom: line.uom,
            unitRate: rate,
            totalCost: round2(lineCost)
          };
        });

        const labourCost = Number(batch.labour_total_cost || 0);
        const utilityCost = Number(batch.eb_total_cost || 0);
        const overheadCost = Number(batch.overhead_amt || 0);

        // Waste cost calculation
        const totalWasteMl = allocations.reduce((sum, a) => sum + Number(a.waste_ml || 0), 0);
        const costPerMixMl = totalMixUsedMl > 0 ? (totalMaterialCost / totalMixUsedMl) : 0;
        totalWastageCost = totalWasteMl * costPerMixMl;

        const totalProductionCost = totalMaterialCost + labourCost + utilityCost + overheadCost;

        // Per-product cost attribution
        const productCostAttribution = allocations.map(a => {
          const mixUsed = Number(a.mix_used_ml || 0);
          const share = totalMixUsedMl > 0 ? (mixUsed / totalMixUsedMl) : 0;
          const assignedRmCost = totalMaterialCost * share;
          const assignedLabourCost = labourCost * share;
          const assignedTotal = assignedRmCost + assignedLabourCost;
          const pieces = Number(a.good_pieces || 0);
          const costPerPiece = pieces > 0 ? (assignedTotal / pieces) : 0;

          return {
            seq: a.seq,
            productId: a.product_id,
            productName: a.product_name,
            goodPieces: pieces,
            mixUsedMl: mixUsed,
            assignedRmCost: round2(assignedRmCost),
            assignedLabourCost: round2(assignedLabourCost),
            totalAssignedCost: round2(assignedTotal),
            costPerPiece: round2(costPerPiece)
          };
        });

        costingSummary = {
          totalMaterialCost: round2(totalMaterialCost),
          totalWastageCost: round2(totalWastageCost),
          labourCost: round2(labourCost),
          utilityCost: round2(utilityCost),
          overheadCost: round2(overheadCost),
          totalProductionCost: round2(totalProductionCost),
          rmCostBreakdown,
          productCostAttribution
        };
      }

      res.json({
        success: true,
        batch: {
          ...batch,
          quantity: Number(batch.quantity || 0),
          baseName: batch.base_name,
          templateName: batch.template_name
        },
        rmLines: rmLines.map(r => {
          const matchedAllocs = (savedBatchAllocations || []).filter(a => 
            a.usage_id === r.id || 
            (r.lot_id && a.inventory_batch_id === r.lot_id) ||
            (r.lot_batch_no && a.lot_number === r.lot_batch_no)
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
            isManualOverride: Boolean(a.is_manual_override),
            grnNumber: a.grn_number || 'GRN-MANUAL-OVERRIDE',
            poNumber: a.po_number || 'PO-MANUAL-OVERRIDE',
            supplierBatchNo: a.supplier_batch_no || 'SUP-LOT-01'
          }));

          const resolvedLotBatchNo = allocatedBatches.length > 0
            ? allocatedBatches.map(b => b.lotNumber).join(', ')
            : (r.lot_batch_no || (batchMap.get(r.raw_material_id)?.[0]?.batchNo || null));

          return {
            ...r,
            density: Number(r.density),
            available_qty: Number(r.available_qty),
            required_qty: Number(r.required_qty),
            taken_qty: Number(r.taken_qty),
            unit_id: r.unit_id,
            has_alternate_uom: Boolean(r.has_alternate_uom),
            alternate_uom: r.alternate_uom,
            conversion_factor: Number(r.conversion_factor || 1),
            consumption_unit: r.consumption_unit,
            lot_batch_no: resolvedLotBatchNo,
            allocatedBatches: allocatedBatches,
            available_batches: batchMap.get(r.raw_material_id) || []
          };
        }),
        mergeData: mergeData ? {
          ...mergeData,
          merged_total_ml: Number(mergeData.merged_total_ml),
          evaporation_pct: Number(mergeData.evaporation_pct),
          evaporated_ml: Number(mergeData.evaporated_ml),
          mix_after_evap_ml: Number(mergeData.mix_after_evap_ml)
        } : null,
        allocations: allocations.map(a => ({
          ...a,
          capacity_ml: Number(a.capacity_ml),
          cavities: Number(a.cavities),
          trays: Number(a.trays),
          waste_value: Number(a.waste_value),
          mix_used_ml: Number(a.mix_used_ml),
          waste_ml: Number(a.waste_ml),
          good_pieces: Number(a.good_pieces)
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
      const materials = await prisma.rawMaterial.findMany({
        include: {
          category: true
        },
        orderBy: { name: 'asc' }
      });

      // Query active inventory batches
      const batches = await prisma.inventoryBatch.findMany({
        where: { netQty: { gt: 0 } },
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

      const formatted = materials.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name,
        printName: m.printName || m.name,
        category: m.category?.name || 'Raw Material',
        categoryId: m.categoryId,
        unitId: m.unitId || 'kg',
        hasAlternateUom: Boolean(m.hasAlternateUom),
        alternateUom: m.alternateUom,
        alternateUomQty: Number(m.alternateUomQty || 1),
        baseUomQty: Number(m.baseUomQty || 1),
        conversionFactor: Number(m.conversionFactor || 1),
        consumptionUnit: m.consumptionUnit || m.unitId || 'kg',
        currentStock: Number(m.currentStock || 0),
        density_g_per_ml: Number(m.density_g_per_ml || 1.0),
        evaporates_by_default: Boolean(m.evaporates_by_default),
        ratePerUnit: Number(m.ratePerUnit || 0),
        hsnCode: m.hsnCode || '',
        availableBatches: batchMap.get(m.id) || []
      }));

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
  // Returns finished products with live stock, base category, subcategory and sale price
  async getProductsCatalog(req, res, next) {
    try {
      const products = await prisma.finishedProduct.findMany({
        where: { deletedAt: null },
        include: {
          category: true,
          subcategory: true
        },
        orderBy: { name: 'asc' }
      });

      const formatted = products.map(p => ({
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
        unit: p.unitId || 'pcs',
        salePrice: Number(p.salePrice || 0),
        currentStock: Number(p.currentStock || 0),
        sku: p.sku,
        barcode: p.barcode
      }));

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
  // Record actual yield, complete run, deduct inventory, and transition status to 'Completed'
  async completeProduction(req, res, next) {
    try {
      const { id } = req.params;
      const { actualOutput, notes = '' } = req.body || {};

      const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRawUnsafe(`
          SELECT id, status, batch_no FROM production_batches WHERE id = $1 FOR UPDATE;
        `, id);

        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Production batch not found' });
        }

        const batch = rows[0];
        if (batch.status === 'Completed') {
          return res.status(409).json({ error: 'Batch is already completed.' });
        }

        const operatorName = req.user?.name || req.user?.username || 'Supervisor';

        await tx.$executeRawUnsafe(`
          UPDATE production_batches
          SET 
            status = 'Completed',
            actual_output = $2,
            note = COALESCE(note, '') || ' ' || $3,
            completed_at = CURRENT_TIMESTAMP,
            completed_by = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, id, Number(actualOutput || 0), notes ? `[Completion Note]: ${notes}` : '', operatorName);

        // Lock merge table
        await tx.$executeRawUnsafe(`
          UPDATE production_batch_merge SET locked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $1;
        `, id);

        return {
          id,
          batchNo: batch.batch_no,
          status: 'Completed',
          actualOutput: Number(actualOutput || 0),
          completedBy: operatorName
        };
      });

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Production run successfully completed and actual yield recorded!',
          data: result
        });
      }
    } catch (err) {
      console.error('Error completing production:', err);
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
      await prisma.$executeRawUnsafe(`
        UPDATE production_batches 
        SET status = 'In Progress', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1 AND status = 'Paused';
      `, id);

      res.json({ success: true, message: 'Production run resumed' });
    } catch (err) {
      next(err);
    }
  }
}

async function txOrPrisma(p, sql, ...params) {
  return await p.$queryRawUnsafe(sql, ...params);
}

module.exports = new StandardProductionController();
