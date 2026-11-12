const { randomUUID } = require('crypto');
const prisma = require('../../../database/prisma');
const {
  round2,
  calculateAllocations,
  calculateDayProductCosting
} = require('../utils/productionCalculation');
const {
  formatDDMMYY,
  sanitizeToken,
  formatProductBatchNo,
  getCanonicalCompanyName,
  ensureSerialTable,
  assignNextProductSerial,
  ensureUniqueProductBatchNo
} = require('./productionDaySerial.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ensures all additive Multi-Day, Stock Lot, and Per-Product Serial tables & columns exist.
 * Idempotent and safe against partially migrated environments.
 */
async function ensureMultiDaySchema(p = prisma) {
  try {
    await ensureSerialTable(p);
  } catch (_) {}

  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS production_batch_days (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      day_no INT NOT NULL DEFAULT 1,
      day_label VARCHAR(50) NOT NULL DEFAULT 'Day 1',
      production_date DATE NOT NULL DEFAULT CURRENT_DATE,
      day_batch_code VARCHAR(80),
      status VARCHAR(40) NOT NULL DEFAULT 'IN_PROGRESS',
      qc_status VARCHAR(40) NOT NULL DEFAULT 'EXEMPT',
      lab_test_required BOOLEAN NOT NULL DEFAULT FALSE,
      opening_mix_ml NUMERIC(16,2) NOT NULL DEFAULT 0,
      allocated_mix_ml NUMERIC(16,2) NOT NULL DEFAULT 0,
      waste_ml NUMERIC(16,2) NOT NULL DEFAULT 0,
      remaining_mix_ml NUMERIC(16,2) NOT NULL DEFAULT 0,
      total_output_qty NUMERIC(16,2) NOT NULL DEFAULT 0,
      total_rejected_qty NUMERIC(16,2) NOT NULL DEFAULT 0,
      timeline_stages JSONB DEFAULT '[]'::jsonb,
      product_stages_map JSONB DEFAULT '{}'::jsonb,
      eb_start_reading NUMERIC(14,2) DEFAULT 0,
      eb_end_reading NUMERIC(14,2) DEFAULT 0,
      eb_units_kwh NUMERIC(14,2) DEFAULT 0,
      eb_rate_per_unit NUMERIC(10,2) DEFAULT 8.50,
      eb_total_cost NUMERIC(16,2) DEFAULT 0,
      labour_total_cost NUMERIC(16,2) DEFAULT 0,
      overhead_amt NUMERIC(16,2) DEFAULT 0,
      base_rm_cost NUMERIC(16,2) DEFAULT 0,
      product_rm_cost NUMERIC(16,2) DEFAULT 0,
      day_grand_total NUMERIC(16,2) DEFAULT 0,
      product_rm_deducted BOOLEAN NOT NULL DEFAULT FALSE,
      pushed_to_sales BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      paused_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      completed_by TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_pb_days_batch_day UNIQUE (batch_id, day_no)
    );`,
    `CREATE TABLE IF NOT EXISTS production_batch_day_outputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      day_id UUID NOT NULL REFERENCES production_batch_days(id) ON DELETE CASCADE,
      day_no INT NOT NULL,
      seq INT NOT NULL DEFAULT 1,
      product_id TEXT NOT NULL,
      product_name VARCHAR(255),
      uom VARCHAR(50) DEFAULT 'pcs',
      product_batch_no VARCHAR(150) NOT NULL,
      company_prefix VARCHAR(50),
      serial_seq BIGINT,
      product_serial_no VARCHAR(180),
      use_mould BOOLEAN DEFAULT FALSE,
      mould_id UUID,
      capacity_ml NUMERIC(10,2) DEFAULT 0,
      cavities INT DEFAULT 1,
      trays INT DEFAULT 0,
      bulk_uom VARCHAR(30) DEFAULT 'L',
      waste_mode VARCHAR(20) DEFAULT 'PERCENT',
      waste_value NUMERIC(10,2) DEFAULT 0,
      allocated_base_ml NUMERIC(16,2) DEFAULT 0,
      waste_ml NUMERIC(16,2) DEFAULT 0,
      theoretical_qty NUMERIC(16,2) DEFAULT 0,
      actual_yield NUMERIC(16,2) DEFAULT 0,
      reject_output NUMERIC(16,2) DEFAULT 0,
      product_rms JSONB DEFAULT '[]'::jsonb,
      base_rm_cost NUMERIC(16,2) DEFAULT 0,
      product_rm_cost NUMERIC(16,2) DEFAULT 0,
      allocated_eb_cost NUMERIC(16,2) DEFAULT 0,
      allocated_labour_cost NUMERIC(16,2) DEFAULT 0,
      total_cost NUMERIC(16,2) DEFAULT 0,
      unit_cost NUMERIC(16,4) DEFAULT 0,
      qc_status VARCHAR(40) NOT NULL DEFAULT 'EXEMPT',
      lab_test_required BOOLEAN NOT NULL DEFAULT FALSE,
      pushed_to_sales BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS finished_product_stock_lots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id TEXT NOT NULL,
      batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
      day_id UUID REFERENCES production_batch_days(id) ON DELETE SET NULL,
      day_output_id UUID REFERENCES production_batch_day_outputs(id) ON DELETE SET NULL,
      day_no INT DEFAULT 1,
      product_batch_no VARCHAR(150) NOT NULL,
      product_serial_no VARCHAR(180),
      reference_no VARCHAR(100),
      mfg_date TIMESTAMPTZ,
      expiry_date TIMESTAMPTZ,
      initial_qty NUMERIC(16,3) NOT NULL DEFAULT 0,
      remaining_qty NUMERIC(16,3) NOT NULL DEFAULT 0,
      unit_cost NUMERIC(16,4) DEFAULT 0,
      qc_status VARCHAR(40) DEFAULT 'EXEMPT',
      is_sellable BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_fpsl_product_sellable ON finished_product_stock_lots (product_id, is_sellable, expiry_date);`,
    `CREATE INDEX IF NOT EXISTS idx_pb_days_batch_id ON production_batch_days (batch_id, day_no);`,
    `CREATE INDEX IF NOT EXISTS idx_pb_day_outputs_batch ON production_batch_day_outputs (batch_id, day_no);`
  ];

  for (const sql of ddlStatements) {
    try {
      await p.$executeRawUnsafe(sql);
    } catch (_) {}
  }

  const alterStatements = [
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS short_batch_code VARCHAR(80);`,
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS active_day_no INT DEFAULT 1;`,
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS completed_days_count INT DEFAULT 0;`,
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS base_rm_deducted BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS base_rm_deducted_at TIMESTAMPTZ;`,
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS remaining_mix_balance_ml NUMERIC(16,2) DEFAULT 0;`,
    `ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS day_no INT DEFAULT 1;`,
    `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS day_id UUID;`,
    `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS product_batch_no VARCHAR(150);`,
    `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS product_serial_no VARCHAR(180);`,
    `ALTER TABLE production_batch_allocation ADD COLUMN IF NOT EXISTS actual_yield NUMERIC(16,2);`,
    `ALTER TABLE production_batch_allocation ALTER COLUMN good_pieces TYPE NUMERIC(16,2);`,
    `ALTER TABLE product_stock_movements ADD COLUMN IF NOT EXISTS day_id UUID;`,
    `ALTER TABLE product_stock_movements ADD COLUMN IF NOT EXISTS product_batch_no VARCHAR(150);`,
    `ALTER TABLE product_stock_movements ADD COLUMN IF NOT EXISTS product_serial_no VARCHAR(180);`,
    `ALTER TABLE production_barcode_labels ADD COLUMN IF NOT EXISTS day_output_id UUID;`,
    `ALTER TABLE production_barcode_labels ADD COLUMN IF NOT EXISTS product_serial_no VARCHAR(180);`,
    // Drop legacy FK referencing ice_cream_moulds when active mould master view points to production_moulds
    `ALTER TABLE production_batch_allocation DROP CONSTRAINT IF EXISTS production_batch_allocation_mould_id_fkey;`
  ];

  for (const sql of alterStatements) {
    try {
      await p.$executeRawUnsafe(sql);
    } catch (_) {}
  }

  // Upgrade unique constraint on production_batch_allocation from (batch_id, seq) to (batch_id, day_no, seq)
  try {
    const oldConstraint = await p.$queryRawUnsafe(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'production_batch_allocation'::regclass
        AND conname = 'uq_pb_alloc_batch_seq';
    `);
    if (oldConstraint && oldConstraint.length > 0) {
      await p.$executeRawUnsafe(`ALTER TABLE production_batch_allocation DROP CONSTRAINT IF EXISTS uq_pb_alloc_batch_seq;`);
    }
    const newConstraint = await p.$queryRawUnsafe(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'production_batch_allocation'::regclass
        AND conname = 'uq_pb_alloc_batch_day_seq';
    `);
    if (!newConstraint || newConstraint.length === 0) {
      await p.$executeRawUnsafe(`
        ALTER TABLE production_batch_allocation
        ADD CONSTRAINT uq_pb_alloc_batch_day_seq UNIQUE (batch_id, day_no, seq);
      `);
    }
  } catch (_) {}
}

/**
 * Resolves total post-evaporation available mix (ml) for a batch.
 */
async function resolveNetPostEvapMixMl(db, batchId, fallbackRequestedMl = 0) {
  let availableMixMl = 0;
  try {
    const mergeRows = await db.$queryRawUnsafe(
      `SELECT mix_after_evap_ml, merged_total_ml FROM production_batch_merge WHERE batch_id = $1 LIMIT 1;`,
      batchId
    );
    if (mergeRows && mergeRows.length > 0) {
      availableMixMl = Number(mergeRows[0].mix_after_evap_ml || mergeRows[0].merged_total_ml || 0);
    }
  } catch (_) {}

  if (availableMixMl <= 0) {
    const pbRows = await db.$queryRawUnsafe(
      `SELECT net_post_evap_mix_ml, merged_pre_evap_ml, quantity FROM production_batches WHERE id = $1 LIMIT 1;`,
      batchId
    );
    if (pbRows && pbRows.length > 0) {
      availableMixMl = Number(pbRows[0].net_post_evap_mix_ml || pbRows[0].merged_pre_evap_ml || 0);
      if (availableMixMl <= 0 && Number(pbRows[0].quantity || 0) > 0) {
        availableMixMl = Number(pbRows[0].quantity) * 1000;
      }
    }
  }

  if (availableMixMl <= 0) {
    try {
      const rmSum = await db.$queryRawUnsafe(`
        SELECT COALESCE(SUM(COALESCE(taken_qty, required_qty, 0) * COALESCE(density, 1) * 1000), 0) AS total_ml
        FROM production_batch_rm_line WHERE batch_id = $1;
      `, batchId);
      if (rmSum && rmSum.length > 0 && Number(rmSum[0].total_ml) > 0) {
        availableMixMl = Number(rmSum[0].total_ml);
      }
    } catch (_) {}
  }

  if (availableMixMl <= 0 && Number(fallbackRequestedMl) > 0) {
    availableMixMl = Number(fallbackRequestedMl);
  }

  return round2(availableMixMl);
}

/**
 * Sums mix already consumed in previous completed / QC-submitted days (< currentDayNo).
 */
async function getPreviousDaysAllocatedMl(db, batchId, currentDayNo = null) {
  try {
    const rows = currentDayNo
      ? await db.$queryRawUnsafe(`
          SELECT COALESCE(SUM(allocated_mix_ml), 0) AS used_ml
          FROM production_batch_days
          WHERE batch_id = $1 AND status <> 'IN_PROGRESS' AND day_no < $2;
        `, batchId, Number(currentDayNo))
      : await db.$queryRawUnsafe(`
          SELECT COALESCE(SUM(allocated_mix_ml), 0) AS used_ml
          FROM production_batch_days
          WHERE batch_id = $1 AND status <> 'IN_PROGRESS';
        `, batchId);
    return round2(Number(rows?.[0]?.used_ml || 0));
  } catch (_) {
    return 0;
  }
}

/**
 * Computes total Base Raw Material cost for a batch from production_batch_rm_line + RawMaterial rates.
 */
async function computeBatchBaseRmCost(db, batchId) {
  const rows = await db.$queryRawUnsafe(`
    SELECT
      pbl.raw_material_id,
      COALESCE(pbl.taken_qty, pbl.required_qty, 0) AS taken_qty,
      COALESCE(NULLIF(pbl.unit_rate, 0), rm."ratePerUnit", u.unit_cost, 0) AS effective_rate
    FROM production_batch_rm_line pbl
    LEFT JOIN "RawMaterial" rm ON rm.id = pbl.raw_material_id
    LEFT JOIN production_batch_rm_usage u ON u.id = pbl.id::text
    WHERE pbl.batch_id = $1;
  `, batchId);

  let total = 0;
  for (const r of rows || []) {
    total += Number(r.taken_qty || 0) * Number(r.effective_rate || 0);
  }
  return round2(total);
}

/**
 * Deducts one inventory lot by ID or batchNumber cleanly inside a transaction.
 */
async function decrementInventoryBatchLot(tx, lotId, lotNum, qty) {
  const amount = Number(qty || 0);
  if (amount <= 0) return;

  const cleanId = lotId ? String(lotId).trim() : null;
  const cleanNum = lotNum ? String(lotNum).trim() : null;

  try {
    if (cleanId && UUID_REGEX.test(cleanId)) {
      await tx.$executeRawUnsafe(`
        UPDATE "InventoryBatch"
        SET "netQty" = GREATEST(0, "netQty" - $1),
            "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, amount, cleanId);
    } else if (cleanNum) {
      await tx.$executeRawUnsafe(`
        UPDATE "InventoryBatch"
        SET "netQty" = GREATEST(0, "netQty" - $1),
            "status" = CASE WHEN ("netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "batchNumber" = $2;
      `, amount, cleanNum);
    }
  } catch (err) {
    console.warn('[standardProductionDay] InventoryBatch decrement warning:', err.message);
  }
}

/**
 * Deducts Step 1 Base Raw Materials ONCE per batch (on Day 1 completion) and locks merge.
 */
async function deductBaseRawMaterialsOnce(tx, batchId) {
  const batchRows = await tx.$queryRawUnsafe(`
    SELECT id, base_rm_deducted FROM production_batches WHERE id = $1 FOR UPDATE;
  `, batchId);
  if (!batchRows || batchRows.length === 0 || batchRows[0].base_rm_deducted) {
    return [];
  }

  const rmLines = await tx.$queryRawUnsafe(`
    SELECT * FROM production_batch_rm_line WHERE batch_id = $1;
  `, batchId);

  const deductionLog = [];
  for (const line of rmLines || []) {
    const taken = Number(line.taken_qty || 0);
    if (taken > 0 && line.raw_material_id) {
      await tx.$executeRawUnsafe(`
        UPDATE "RawMaterial"
        SET "currentStock" = GREATEST(0, "currentStock" - $1),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, taken, line.raw_material_id);

      const postStock = await tx.$queryRawUnsafe(`
        SELECT "currentStock", name, "consumptionUnit" FROM "RawMaterial" WHERE id = $1;
      `, line.raw_material_id);

      deductionLog.push({
        rawMaterialId: line.raw_material_id,
        name: postStock?.[0]?.name || 'Raw Material',
        consumedQty: taken,
        uom: postStock?.[0]?.consumptionUnit || line.uom || 'kg',
        remainingWarehouseStock: Number(postStock?.[0]?.currentStock || 0)
      });
    }
  }

  // Deduct allocated lots from production_batch_allocations (base RM pool)
  const allocations = await tx.$queryRawUnsafe(`
    SELECT inventory_batch_id, allocated_qty, lot_number
    FROM "production_batch_allocations"
    WHERE batch_id = $1 AND usage_id IS NOT NULL;
  `, batchId);

  const deductedLots = new Set();
  for (const alloc of allocations || []) {
    const q = Number(alloc.allocated_qty || 0);
    if (q > 0) {
      await decrementInventoryBatchLot(tx, alloc.inventory_batch_id, alloc.lot_number, q);
      if (alloc.inventory_batch_id) deductedLots.add(String(alloc.inventory_batch_id).trim());
      if (alloc.lot_number) deductedLots.add(String(alloc.lot_number).trim());
    }
  }

  for (const line of rmLines || []) {
    const taken = Number(line.taken_qty || 0);
    const lotId = line.lot_id ? String(line.lot_id).trim() : null;
    if (taken > 0 && lotId && !deductedLots.has(lotId)) {
      await decrementInventoryBatchLot(tx, lotId, lotId, taken);
      deductedLots.add(lotId);
    }
  }

  await tx.$executeRawUnsafe(`
    UPDATE production_batch_rm_usage SET status = 'CONSUMED' WHERE batch_id = $1;
  `, batchId).catch(() => {});

  await tx.$executeRawUnsafe(`
    UPDATE production_batch_merge SET locked = TRUE, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $1;
  `, batchId).catch(() => {});

  await tx.$executeRawUnsafe(`
    UPDATE production_batches
    SET base_rm_deducted = TRUE,
        base_rm_deducted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1;
  `, batchId);

  return deductionLog;
}

/**
 * Deducts Step 3 per-product raw materials (essences, flavours, sticks, packaging)
 * for a single Day's allocations only.
 */
async function deductDayProductRawMaterials(tx, batchId, allocations = []) {
  for (const alloc of allocations) {
    if (!Array.isArray(alloc.productRms)) continue;
    for (const prm of alloc.productRms) {
      const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
      const prmId = prm.rmId || prm.rawMaterialId;
      if (prmQty <= 0 || !prmId) continue;

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
          const aLotNum = (ab.batchNumber || ab.lotNumber || ab.batchNo || ab.batchId)
            ? String(ab.batchNumber || ab.lotNumber || ab.batchNo || ab.batchId).trim()
            : null;
          if (aQty > 0) {
            await decrementInventoryBatchLot(tx, aLotId, aLotNum, aQty);
          }
        }
      }

      const prmLot = prm.allocatedBatches?.[0]?.lotNumber || prm.allocatedBatches?.[0]?.internalBatchNo || 'LOT-DIRECT';
      const prmRate = Number(prm.unitRate || prm.rate || prm.allocatedBatches?.[0]?.unitRate || 0);
      await tx.$executeRawUnsafe(`
        INSERT INTO production_batch_rm_usage (
          id, batch_id, rm_id, required_qty, available_qty_at_time,
          actual_used_qty, unit_cost, total_cost, status,
          internal_batch_no, selected_uom, input_qty
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'CONSUMED', $9, $10, $11
        );
      `, randomUUID(), batchId, prmId, prmQty, prmQty, prmQty, prmRate, round2(prmQty * prmRate), prmLot, prm.uom || 'kg', prmQty).catch(() => {});
    }
  }
}

/**
 * Re-aggregates all completed/QC days onto the parent production_batches row
 * so list views, costing summaries, and clean reports stay 100% in sync.
 */
async function syncParentBatchAggregate(tx, batchId) {
  const days = await tx.$queryRawUnsafe(`
    SELECT * FROM production_batch_days WHERE batch_id = $1 ORDER BY day_no ASC;
  `, batchId);

  const completedDays = (days || []).filter(d => d.status !== 'IN_PROGRESS');
  const netPostEvapMixMl = await resolveNetPostEvapMixMl(tx, batchId);
  const totalAllocatedMl = completedDays.reduce((s, d) => s + Number(d.allocated_mix_ml || 0), 0);
  const remainingMixBalanceMl = Math.max(0, round2(netPostEvapMixMl - totalAllocatedMl));

  const totalOutputQty = completedDays.reduce((s, d) => s + Number(d.total_output_qty || 0), 0);
  const totalRejectedQty = completedDays.reduce((s, d) => s + Number(d.total_rejected_qty || 0), 0);
  const totalEbCost = completedDays.reduce((s, d) => s + Number(d.eb_total_cost || 0), 0);
  const totalLabourCost = completedDays.reduce((s, d) => s + Number(d.labour_total_cost || 0), 0);
  const totalOverheadCost = completedDays.reduce((s, d) => s + Number(d.overhead_amt || 0), 0);
  const totalProductRmCost = completedDays.reduce((s, d) => s + Number(d.product_rm_cost || 0), 0);
  const baseRmCost = await computeBatchBaseRmCost(tx, batchId);

  const subTotalCost = round2(baseRmCost + totalProductRmCost);
  const grandTotalCost = round2(subTotalCost + totalEbCost + totalLabourCost + totalOverheadCost);
  const costPerUnit = totalOutputQty > 0 ? round2(grandTotalCost / totalOutputQty) : 0;

  const outputs = await tx.$queryRawUnsafe(`
    SELECT * FROM production_batch_day_outputs WHERE batch_id = $1 ORDER BY day_no ASC, seq ASC;
  `, batchId);

  const quarantineQty = (outputs || [])
    .filter(o => o.qc_status === 'PENDING' || (o.lab_test_required && !o.pushed_to_sales && o.qc_status !== 'FAILED'))
    .reduce((s, o) => s + Number(o.actual_yield || 0), 0);

  const hasPendingQc = (completedDays || []).some(d => d.qc_status === 'PENDING');
  const totalSellableStockRemaining = await tx.$queryRawUnsafe(`
    SELECT COALESCE(SUM(remaining_qty), 0) AS rem
    FROM finished_product_stock_lots
    WHERE batch_id = $1 AND is_sellable = TRUE;
  `, batchId);
  const sellableRemaining = Number(totalSellableStockRemaining?.[0]?.rem || 0);

  const mergedProductYields = (outputs || []).map(o => ({
    dayNo: Number(o.day_no),
    dayId: o.day_id,
    dayOutputId: o.id,
    seq: Number(o.seq),
    productId: o.product_id,
    productName: o.product_name,
    uom: o.uom,
    productBatchNo: o.product_batch_no,
    productSerialNo: o.product_serial_no,
    planned: Number(o.theoretical_qty || 0),
    actualGoodOutput: Number(o.actual_yield || 0),
    rejectOutput: Number(o.reject_output || 0),
    qcStatus: o.qc_status,
    pushedToSales: Boolean(o.pushed_to_sales),
    unitCost: Number(o.unit_cost || 0),
    totalCost: Number(o.total_cost || 0)
  }));

  // Determine active_day_no safely
  const inProgressDay = (days || []).find(d => d.status === 'IN_PROGRESS');
  const maxDayNo = (days || []).reduce((m, d) => Math.max(m, Number(d.day_no || 0)), 0);
  const activeDayNo = inProgressDay ? Number(inProgressDay.day_no) : Math.max(1, maxDayNo);

  await tx.$executeRawUnsafe(`
    UPDATE production_batches
    SET
      completed_days_count = $2,
      active_day_no = $3,
      remaining_mix_balance_ml = $4,
      good_quantity = CASE WHEN $5 > 0 THEN $5 ELSE good_quantity END,
      actual_output = CASE WHEN $5 > 0 THEN $5 ELSE actual_output END,
      rejected_quantity = $6,
      quarantine_stock = $7,
      remaining_quantity = $8,
      eb_total_cost = $9,
      labour_total_cost = $10,
      overhead_amt = $11,
      sub_total = $12,
      grand_total = $13,
      total_cost = $13,
      cost_per_unit = $14,
      product_yields = CASE WHEN jsonb_array_length($15::jsonb) > 0 THEN $15::jsonb ELSE product_yields END,
      qc_status = CASE WHEN $16 THEN 'PENDING' ELSE COALESCE(NULLIF(qc_status, 'PENDING'), 'EXEMPT') END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1;
  `,
    batchId,
    completedDays.length,
    activeDayNo,
    remainingMixBalanceMl,
    round2(totalOutputQty),
    round2(totalRejectedQty),
    round2(quarantineQty),
    round2(sellableRemaining),
    round2(totalEbCost),
    round2(totalLabourCost),
    round2(totalOverheadCost),
    subTotalCost,
    grandTotalCost,
    costPerUnit,
    JSON.stringify(mergedProductYields),
    hasPendingQc
  );

  return {
    completedDaysCount: completedDays.length,
    activeDayNo,
    netPostEvapMixMl,
    totalAllocatedMl: round2(totalAllocatedMl),
    remainingMixBalanceMl,
    totalOutputQty: round2(totalOutputQty),
    totalEbCost: round2(totalEbCost),
    totalLabourCost: round2(totalLabourCost),
    totalOverheadCost: round2(totalOverheadCost),
    baseRmCost,
    totalProductRmCost: round2(totalProductRmCost),
    grandTotalCost,
    costPerUnit
  };
}

/**
 * Fetches structured multi-day execution history & outputs for getBatchDetails / CleanReportView.
 */
async function getBatchDaysData(db, batchId, userCanViewCost = true) {
  await ensureMultiDaySchema(db);

  const days = await db.$queryRawUnsafe(`
    SELECT * FROM production_batch_days WHERE batch_id = $1 ORDER BY day_no ASC;
  `, batchId);

  const outputs = await db.$queryRawUnsafe(`
    SELECT
      o.*,
      p.code AS product_code,
      m.mould_name,
      m.mould_code,
      l.id AS stock_lot_id,
      l.remaining_qty AS lot_remaining_qty,
      l.is_sellable AS lot_is_sellable
    FROM production_batch_day_outputs o
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN ice_cream_mould m ON m.id = o.mould_id
    LEFT JOIN finished_product_stock_lots l ON l.day_output_id = o.id
    WHERE o.batch_id = $1
    ORDER BY o.day_no ASC, o.seq ASC;
  `, batchId);

  // Backfill any missing InventoryBatch expiry dates onto productRms & allocatedBatches for traceability/Clean Sheet
  const lookupIds = new Set();
  const lookupLotNums = new Set();
  for (const out of outputs || []) {
    const prms = Array.isArray(out.product_rms) ? out.product_rms : [];
    for (const prm of prms) {
      if (prm.lotBatchNo) lookupLotNums.add(String(prm.lotBatchNo));
      const abs = Array.isArray(prm.allocatedBatches) ? prm.allocatedBatches : [];
      for (const ab of abs) {
        if (!ab.expiryDate) {
          if (ab.batchId) lookupIds.add(String(ab.batchId));
          if (ab.lotNumber || ab.internalBatchNo) lookupLotNums.add(String(ab.lotNumber || ab.internalBatchNo));
        }
      }
    }
  }
  const expiryById = new Map();
  const expiryByLot = new Map();
  if (lookupIds.size > 0 || lookupLotNums.size > 0) {
    try {
      const ibRows = await db.$queryRawUnsafe(`
        SELECT id, "batchNumber", "expiryDate"
        FROM "InventoryBatch"
        WHERE id = ANY($1::text[]) OR "batchNumber" = ANY($2::text[]);
      `, Array.from(lookupIds), Array.from(lookupLotNums));
      for (const ib of ibRows || []) {
        if (ib.id && ib.expiryDate) expiryById.set(String(ib.id), ib.expiryDate);
        if (ib.batchNumber && ib.expiryDate) expiryByLot.set(String(ib.batchNumber), ib.expiryDate);
      }
    } catch (_) {}
  }

  const outputsByDay = new Map();
  for (const out of outputs || []) {
    const k = Number(out.day_no);
    if (!outputsByDay.has(k)) outputsByDay.set(k, []);
    const enrichedProductRms = (Array.isArray(out.product_rms) ? out.product_rms : []).map(prm => {
      const abs = (Array.isArray(prm.allocatedBatches) ? prm.allocatedBatches : []).map(ab => ({
        ...ab,
        expiryDate: ab.expiryDate || expiryById.get(String(ab.batchId)) || expiryByLot.get(String(ab.lotNumber || ab.internalBatchNo)) || null
      }));
      const firstExpiry = prm.expiryDate || abs.find(a => a.expiryDate)?.expiryDate || expiryByLot.get(String(prm.lotBatchNo)) || null;
      return {
        ...prm,
        expiryDate: firstExpiry,
        allocatedBatches: abs
      };
    });
    const row = {
      id: out.id,
      dayId: out.day_id,
      dayNo: Number(out.day_no),
      seq: Number(out.seq),
      productId: out.product_id,
      productName: out.product_name,
      productCode: out.product_code,
      uom: out.uom,
      productBatchNo: out.product_batch_no,
      companyPrefix: out.company_prefix,
      serialSeq: Number(out.serial_seq || 0),
      productSerialNo: out.product_serial_no,
      useMould: Boolean(out.use_mould),
      mouldId: out.mould_id,
      mouldName: out.mould_name,
      mouldCode: out.mould_code,
      capacityMl: Number(out.capacity_ml || 0),
      cavities: Number(out.cavities || 1),
      trays: Number(out.trays || 0),
      bulkUom: out.bulk_uom || 'L',
      wasteMode: out.waste_mode || 'PERCENT',
      wasteValue: Number(out.waste_value || 0),
      allocatedBaseMl: Number(out.allocated_base_ml || 0),
      wasteMl: Number(out.waste_ml || 0),
      theoreticalQty: Number(out.theoretical_qty || 0),
      actualYield: Number(out.actual_yield || 0),
      rejectOutput: Number(out.reject_output || 0),
      productRms: enrichedProductRms,
      qcStatus: out.qc_status,
      labTestRequired: Boolean(out.lab_test_required),
      pushedToSales: Boolean(out.pushed_to_sales),
      stockLotId: out.stock_lot_id || null,
      lotRemainingQty: Number(out.lot_remaining_qty ?? out.actual_yield ?? 0),
      lotIsSellable: out.lot_is_sellable !== undefined ? Boolean(out.lot_is_sellable) : Boolean(out.pushed_to_sales)
    };
    if (userCanViewCost) {
      row.baseRmCost = Number(out.base_rm_cost || 0);
      row.productRmCost = Number(out.product_rm_cost || 0);
      row.allocatedEbCost = Number(out.allocated_eb_cost || 0);
      row.allocatedLabourCost = Number(out.allocated_labour_cost || 0);
      row.totalCost = Number(out.total_cost || 0);
      row.unitCost = Number(out.unit_cost || 0);
    }
    outputsByDay.get(k).push(row);
  }

  return (days || []).map(d => {
    let timelineStages = [];
    let productStagesMap = {};
    try {
      timelineStages = typeof d.timeline_stages === 'string' ? JSON.parse(d.timeline_stages || '[]') : (d.timeline_stages || []);
    } catch (_) {}
    try {
      productStagesMap = typeof d.product_stages_map === 'string' ? JSON.parse(d.product_stages_map || '{}') : (d.product_stages_map || {});
    } catch (_) {}

    const dayObj = {
      id: d.id,
      batchId: d.batch_id,
      dayNo: Number(d.day_no),
      dayLabel: d.day_label || `Day ${d.day_no}`,
      productionDate: d.production_date,
      dayBatchCode: d.day_batch_code,
      status: d.status,
      qcStatus: d.qc_status,
      labTestRequired: Boolean(d.lab_test_required),
      openingMixMl: Number(d.opening_mix_ml || 0),
      allocatedMixMl: Number(d.allocated_mix_ml || 0),
      wasteMl: Number(d.waste_ml || 0),
      remainingMixMl: Number(d.remaining_mix_ml || 0),
      totalOutputQty: Number(d.total_output_qty || 0),
      totalRejectedQty: Number(d.total_rejected_qty || 0),
      timelineStages: Array.isArray(timelineStages) ? timelineStages : [],
      productStagesMap: (productStagesMap && typeof productStagesMap === 'object') ? productStagesMap : {},
      ebStartReading: Number(d.eb_start_reading || 0),
      ebEndReading: Number(d.eb_end_reading || 0),
      ebUnitsKwh: Number(d.eb_units_kwh || 0),
      ebRatePerUnit: Number(d.eb_rate_per_unit || 8.5),
      pushedToSales: Boolean(d.pushed_to_sales),
      notes: d.notes || '',
      pausedAt: d.paused_at,
      completedAt: d.completed_at,
      completedBy: d.completed_by,
      outputs: outputsByDay.get(Number(d.day_no)) || []
    };

    if (userCanViewCost) {
      dayObj.ebTotalCost = Number(d.eb_total_cost || 0);
      dayObj.labourTotalCost = Number(d.labour_total_cost || 0);
      dayObj.overheadAmt = Number(d.overhead_amt || 0);
      dayObj.baseRmCost = Number(d.base_rm_cost || 0);
      dayObj.productRmCost = Number(d.product_rm_cost || 0);
      dayObj.dayGrandTotal = Number(d.day_grand_total || 0);
    }

    return dayObj;
  });
}

/**
 * Executes Day N Completion:
 *  - Deducts Base RM once (Day 1) and Product RMs per Day
 *  - Computes Day product costs + unit costs
 *  - Assigns per-product batch code (<EditableDDMMYY>-<PRODUCTNAME>-<DDMMYY>) & atomic 8-digit serial
 *  - Creates sellable stock lot + pushes immediately to finished goods stock (unless QC Lab Testing is enabled)
 *  - Pauses batch for Day N+1 if unallocated base mix remains OR finalizes entire production when requested/exhausted
 */
async function completeDayRun({
  batchId,
  dayNo,
  dayBatchCode,
  productionDate,
  timelineStages = [],
  productStagesMap = {},
  ebStartReading = 0,
  ebEndReading = 0,
  ebUnitsKwh = 0,
  ebRatePerUnit = 8.5,
  ebTotalCost = 0,
  labourTotalCost = 0,
  overheadAmt = 0,
  allocations = [],
  productYields = [],
  labTestRequired = false,
  finalizeProduction = false,
  scrapRemainingMixAsWaste = true,
  notes = '',
  userId,
  operatorName = 'Supervisor'
}) {
  await ensureMultiDaySchema(prisma);

  return await prisma.$transaction(async (tx) => {
    const batchRows = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batches WHERE id = $1 FOR UPDATE;
    `, batchId);

    if (!batchRows || batchRows.length === 0) {
      const err = new Error('Production batch not found');
      err.statusCode = 404;
      throw err;
    }

    const batch = batchRows[0];
    if (batch.is_finalized || batch.status === 'Completed') {
      const err = new Error('Entire production batch is already finalized.');
      err.statusCode = 409;
      throw err;
    }

    const targetDayNo = Math.max(1, Number(dayNo || batch.active_day_no || 1));

    // Check if this specific Day is already completed
    const existingDayRows = await tx.$queryRawUnsafe(`
      SELECT id, status FROM production_batch_days WHERE batch_id = $1 AND day_no = $2 FOR UPDATE;
    `, batchId, targetDayNo);

    if (existingDayRows && existingDayRows.length > 0 && existingDayRows[0].status !== 'IN_PROGRESS') {
      const err = new Error(`Day ${targetDayNo} is already submitted. Start Day ${targetDayNo + 1} to allocate remaining mix.`);
      err.statusCode = 409;
      throw err;
    }

    // Resolve Step 3 allocations for this day (payload first, fallback to DB rows for this day)
    let inputAllocs = Array.isArray(allocations) ? allocations : [];
    if (inputAllocs.length === 0) {
      const dbAllocs = await tx.$queryRawUnsafe(`
        SELECT * FROM production_batch_allocation
        WHERE batch_id = $1 AND COALESCE(day_no, 1) = $2
        ORDER BY seq ASC;
      `, batchId, targetDayNo);
      inputAllocs = (dbAllocs || []).map(a => ({
        seq: a.seq,
        productId: a.product_id,
        useMould: Boolean(a.use_mould),
        mouldId: a.mould_id,
        capacityMl: Number(a.capacity_ml || 0),
        cavities: Number(a.cavities || 1),
        trays: Number(a.trays || 0),
        wasteMode: a.waste_mode || 'PERCENT',
        wasteValue: Number(a.waste_value || 0),
        allocatedBaseMl: Number(a.allocated_base_ml || a.mix_used_ml || 0),
        mixUsedMl: Number(a.mix_used_ml || 0),
        bulkUom: a.bulk_uom || 'L',
        productRms: Array.isArray(a.product_rms) ? a.product_rms : [],
        productBatchNo: a.product_batch_no || null,
        actualYield: a.actual_yield
      }));
    }

    if (inputAllocs.length === 0) {
      const err = new Error(`No products allocated for Day ${targetDayNo}. Add at least one product in Step 3 before completing the Day.`);
      err.statusCode = 422;
      throw err;
    }

    const totalRequestedMl = inputAllocs.reduce((s, a) => s + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
    const netPostEvapMixMl = await resolveNetPostEvapMixMl(tx, batchId, totalRequestedMl);
    const previousDaysAllocatedMl = await getPreviousDaysAllocatedMl(tx, batchId, targetDayNo);

    const computed = calculateAllocations({
      availableMixMl: netPostEvapMixMl,
      previousDaysAllocatedMl,
      allocations: inputAllocs
    });

    if (!computed.isValid) {
      const err = new Error(computed.errors.map(e => e.message).join('; '));
      err.statusCode = 422;
      err.errors = computed.errors;
      throw err;
    }

    // Lookup finished product catalog names & UOMs for accurate batch/serial naming
    const prodIds = [...new Set(computed.allocations.map(a => a.productId).filter(Boolean))];
    const dbProducts = prodIds.length > 0
      ? await tx.finishedProduct.findMany({
          where: { id: { in: prodIds } },
          include: { unit: true }
        })
      : [];
    const prodMap = new Map(dbProducts.map(p => [p.id, p]));

    const companyName = await getCanonicalCompanyName();
    const companyPrefix = sanitizeToken(companyName, 24, 'COMPANY');
    const effDateStr = typeof productionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(productionDate.trim())
      ? productionDate.trim().slice(0, 10)
      : null;
    const rawEffDate = effDateStr ? new Date(`${effDateStr}T00:00:00Z`) : (productionDate ? new Date(productionDate) : new Date());
    const effDate = isNaN(rawEffDate.getTime()) ? new Date() : rawEffDate;
    const ddmmyy = formatDDMMYY(effDateStr || effDate);
    const resolvedDayCode = sanitizeToken(dayBatchCode || batch.short_batch_code || ddmmyy, 24, ddmmyy);

    // Deduct Step 1 Base RMs ONCE (Day 1 only)
    const baseRmDeductions = await deductBaseRawMaterialsOnce(tx, batchId);

    // Deduct Step 3 Product RMs for THIS Day
    await deductDayProductRawMaterials(tx, batchId, computed.allocations);

    const totalBaseRmCost = await computeBatchBaseRmCost(tx, batchId);
    const yieldsArr = Array.isArray(productYields) ? productYields : [];

    // Prepare output records + serials + product batch numbers
    const preparedOutputs = [];
    for (let i = 0; i < computed.allocations.length; i++) {
      const alloc = computed.allocations[i];
      const prod = prodMap.get(alloc.productId);
      const productName = alloc.productName || prod?.name || 'Product';
      const uom = alloc.useMould
        ? (prod?.unit?.abbreviation || 'pcs')
        : (alloc.bulkUom || prod?.unit?.abbreviation || 'Ltr');

      const matchedYield = yieldsArr.find(y =>
        (y.seq !== undefined && Number(y.seq) === Number(alloc.seq)) ||
        (y.productId === alloc.productId && (y.index === undefined || Number(y.index) === i))
      ) || yieldsArr[i] || null;

      const theoreticalQty = Number(alloc.goodPieces || 0);
      const actualYield = Number(
        matchedYield?.actualGoodOutput ??
        matchedYield?.actualOutput ??
        alloc.actualYield ??
        theoreticalQty
      );
      const rejectOutput = Number(matchedYield?.rejectOutput ?? alloc.rejectOutput ?? 0);

      let productRmCost = 0;
      if (Array.isArray(alloc.productRms)) {
        for (const prm of alloc.productRms) {
          const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
          const prmRate = Number(prm.unitRate ?? prm.rate ?? 0);
          productRmCost += prmQty * prmRate;
        }
      }

      const rawCandidateBatchNo =
        matchedYield?.productBatchNo ||
        alloc.productBatchNo ||
        formatProductBatchNo({
          headerBatchCode: resolvedDayCode,
          productName,
          dateInput: effDate
        });

      const uniqueProductBatchNo = await ensureUniqueProductBatchNo(tx, rawCandidateBatchNo, batchId, targetDayNo);
      const serialResult = await assignNextProductSerial(tx, alloc.productId, productName, companyName);

      preparedOutputs.push({
        seq: Number(alloc.seq || i + 1),
        productId: alloc.productId,
        productName,
        uom,
        productBatchNo: uniqueProductBatchNo,
        companyPrefix: serialResult.companyPrefix,
        serialSeq: serialResult.serialSeq,
        productSerialNo: serialResult.serialNo,
        useMould: Boolean(alloc.useMould),
        mouldId: (alloc.mouldId && UUID_REGEX.test(String(alloc.mouldId))) ? String(alloc.mouldId) : null,
        capacityMl: Number(alloc.capacityMl || 0),
        cavities: Number(alloc.cavities || 1),
        trays: Number(alloc.trays || 0),
        bulkUom: alloc.bulkUom || 'L',
        wasteMode: alloc.wasteMode || 'PERCENT',
        wasteValue: Number(alloc.wasteValue || 0),
        allocatedBaseMl: Number(alloc.allocatedBaseMl || alloc.mixUsedMl || 0),
        wasteMl: Number(alloc.wasteMl || 0),
        theoreticalQty,
        actualYield,
        rejectOutput,
        productRms: Array.isArray(alloc.productRms) ? alloc.productRms : [],
        productTotalMixMl: Number(alloc.productTotalMixMl || alloc.allocatedBaseMl || 0),
        productRmCost: round2(productRmCost),
        labourCostOverride: matchedYield?.labourCostOverride ?? alloc.labourCostOverride
      });
    }

    const ebVal = Number(ebTotalCost || 0);
    const labourVal = Number(labourTotalCost || 0);
    const overheadVal = Number(overheadAmt || 0);

    const costing = calculateDayProductCosting({
      outputs: preparedOutputs,
      totalBaseRmCost,
      netPostEvapMixMl,
      ebTotalCost: ebVal,
      labourTotalCost: labourVal
    });

    const dayId = existingDayRows?.[0]?.id || randomUUID();
    const dayStatus = labTestRequired ? 'LAB_PENDING' : 'COMPLETED';
    const dayQcStatus = labTestRequired ? 'PENDING' : 'EXEMPT';
    const totalDayWasteMl = round2(costing.outputs.reduce((s, o) => s + Number(o.wasteMl || 0), 0));
    const totalDayRejects = round2(costing.outputs.reduce((s, o) => s + Number(o.rejectOutput || 0), 0));
    const remainingAfterDayMl = Math.max(0, round2(computed.remainingMixMl));

    await tx.$executeRawUnsafe(`
      INSERT INTO production_batch_days (
        id, batch_id, day_no, day_label, production_date, day_batch_code,
        status, qc_status, lab_test_required,
        opening_mix_ml, allocated_mix_ml, waste_ml, remaining_mix_ml,
        total_output_qty, total_rejected_qty,
        timeline_stages, product_stages_map,
        eb_start_reading, eb_end_reading, eb_units_kwh, eb_rate_per_unit, eb_total_cost,
        labour_total_cost, overhead_amt, base_rm_cost, product_rm_cost, day_grand_total,
        product_rm_deducted, pushed_to_sales, notes,
        completed_at, completed_by, updated_at
      ) VALUES (
        $1::uuid, $2, $3, $4, $5::date, $6,
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15,
        $16::jsonb, $17::jsonb,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        TRUE, $28, $29,
        CURRENT_TIMESTAMP, $30, CURRENT_TIMESTAMP
      )
      ON CONFLICT (batch_id, day_no) DO UPDATE SET
        production_date = EXCLUDED.production_date,
        day_batch_code = EXCLUDED.day_batch_code,
        status = EXCLUDED.status,
        qc_status = EXCLUDED.qc_status,
        lab_test_required = EXCLUDED.lab_test_required,
        opening_mix_ml = EXCLUDED.opening_mix_ml,
        allocated_mix_ml = EXCLUDED.allocated_mix_ml,
        waste_ml = EXCLUDED.waste_ml,
        remaining_mix_ml = EXCLUDED.remaining_mix_ml,
        total_output_qty = EXCLUDED.total_output_qty,
        total_rejected_qty = EXCLUDED.total_rejected_qty,
        timeline_stages = EXCLUDED.timeline_stages,
        product_stages_map = EXCLUDED.product_stages_map,
        eb_start_reading = EXCLUDED.eb_start_reading,
        eb_end_reading = EXCLUDED.eb_end_reading,
        eb_units_kwh = EXCLUDED.eb_units_kwh,
        eb_rate_per_unit = EXCLUDED.eb_rate_per_unit,
        eb_total_cost = EXCLUDED.eb_total_cost,
        labour_total_cost = EXCLUDED.labour_total_cost,
        overhead_amt = EXCLUDED.overhead_amt,
        base_rm_cost = EXCLUDED.base_rm_cost,
        product_rm_cost = EXCLUDED.product_rm_cost,
        day_grand_total = EXCLUDED.day_grand_total,
        product_rm_deducted = TRUE,
        pushed_to_sales = EXCLUDED.pushed_to_sales,
        notes = EXCLUDED.notes,
        completed_at = CURRENT_TIMESTAMP,
        completed_by = EXCLUDED.completed_by,
        updated_at = CURRENT_TIMESTAMP;
    `,
      dayId, batchId, targetDayNo, `Day ${targetDayNo}`, effDate.toISOString().split('T')[0], resolvedDayCode,
      dayStatus, dayQcStatus, Boolean(labTestRequired),
      computed.initialMixAvailableMl, computed.totalMixUsedMl, totalDayWasteMl, remainingAfterDayMl,
      costing.dayTotalYield, totalDayRejects,
      JSON.stringify(Array.isArray(timelineStages) ? timelineStages : []),
      JSON.stringify(productStagesMap && typeof productStagesMap === 'object' ? productStagesMap : {}),
      Number(ebStartReading || 0), Number(ebEndReading || 0), Number(ebUnitsKwh || 0), Number(ebRatePerUnit || 8.5), round2(ebVal),
      round2(labourVal), round2(overheadVal), costing.dayBaseRmCost, costing.dayProductRmCost, round2(costing.dayGrandTotal + overheadVal),
      !labTestRequired, notes || `Day ${targetDayNo} execution completed by ${operatorName}`,
      operatorName
    );

    // Replace allocation rows for this day and insert final outputs + stock lots + movements
    await tx.$executeRawUnsafe(
      `DELETE FROM production_batch_allocation WHERE batch_id = $1 AND COALESCE(day_no, 1) = $2;`,
      batchId, targetDayNo
    );

    const mfdDate = effDate;
    const shelfLife = Number(batch.expiry_days || batch.shelf_life_days || 365);
    const expiryDate = new Date(mfdDate.getTime() + shelfLife * 24 * 60 * 60 * 1000);
    const createdOutputs = [];

    for (const out of costing.outputs) {
      const dayOutputId = randomUUID();
      const stockLotId = randomUUID();

      await tx.$executeRawUnsafe(`
        INSERT INTO production_batch_allocation (
          id, batch_id, day_no, day_id, seq, product_id, use_mould, mould_id,
          capacity_ml, cavities, trays, waste_mode, waste_value,
          mix_used_ml, waste_ml, good_pieces, actual_yield,
          allocated_base_ml, bulk_uom, product_rms,
          product_batch_no, product_serial_no,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3::uuid, $4, $5, $6, ($7::text)::uuid,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19::jsonb,
          $20, $21,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
      `,
        batchId, targetDayNo, dayId, out.seq, out.productId, out.useMould, out.mouldId,
        out.capacityMl, out.cavities, out.trays, out.wasteMode, out.wasteValue,
        out.allocatedBaseMl, out.wasteMl, out.theoreticalQty, out.actualYield,
        out.allocatedBaseMl, out.bulkUom, JSON.stringify(out.productRms || []),
        out.productBatchNo, out.productSerialNo
      );

      await tx.$executeRawUnsafe(`
        INSERT INTO production_batch_day_outputs (
          id, batch_id, day_id, day_no, seq, product_id, product_name, uom,
          product_batch_no, company_prefix, serial_seq, product_serial_no,
          use_mould, mould_id, capacity_ml, cavities, trays, bulk_uom,
          waste_mode, waste_value, allocated_base_ml, waste_ml,
          theoretical_qty, actual_yield, reject_output, product_rms,
          base_rm_cost, product_rm_cost, allocated_eb_cost, allocated_labour_cost,
          total_cost, unit_cost, qc_status, lab_test_required, pushed_to_sales
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, ($14::text)::uuid, $15, $16, $17, $18,
          $19, $20, $21, $22,
          $23, $24, $25, $26::jsonb,
          $27, $28, $29, $30,
          $31, $32, $33, $34, $35
        );
      `,
        dayOutputId, batchId, dayId, targetDayNo, out.seq, out.productId, out.productName, out.uom,
        out.productBatchNo, out.companyPrefix, out.serialSeq, out.productSerialNo,
        out.useMould, out.mouldId, out.capacityMl, out.cavities, out.trays, out.bulkUom,
        out.wasteMode, out.wasteValue, out.allocatedBaseMl, out.wasteMl,
        out.theoreticalQty, out.actualYield, out.rejectOutput, JSON.stringify(out.productRms || []),
        out.baseRmCost, out.productRmCost, out.allocatedEbCost, out.allocatedLabourCost,
        out.totalCost, out.unitCost, dayQcStatus, Boolean(labTestRequired), !labTestRequired
      );

      if (out.actualYield > 0) {
        await tx.$executeRawUnsafe(`
          INSERT INTO finished_product_stock_lots (
            id, product_id, batch_id, day_id, day_output_id, day_no,
            product_batch_no, product_serial_no, reference_no,
            mfg_date, expiry_date, initial_qty, remaining_qty, unit_cost,
            qc_status, is_sellable
          ) VALUES (
            $1::uuid, $2, $3, $4::uuid, $5::uuid, $6,
            $7, $8, $9,
            $10, $11, $12, $12, $13,
            $14, $15
          );
        `,
          stockLotId, out.productId, batchId, dayId, dayOutputId, targetDayNo,
          out.productBatchNo, out.productSerialNo, batch.reference_no,
          mfdDate, expiryDate, out.actualYield, out.unitCost,
          dayQcStatus, !labTestRequired
        );

        // Immediately release Day N yield into products.current_stock + product_stock_movements unless QA Lab Testing is enabled
        if (!labTestRequired) {
          await tx.$executeRawUnsafe(`
            UPDATE products
            SET current_stock = COALESCE(current_stock, 0) + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2;
          `, out.actualYield, out.productId);

          if (userId) {
            await tx.$executeRawUnsafe(`
              INSERT INTO product_stock_movements (
                id, product_id, batch_id, day_id, type, quantity, direction,
                product_batch_no, product_serial_no, note, created_by, created_at
              ) VALUES (
                gen_random_uuid()::text, $1, $2, $3::uuid, 'production_in', $4, 1,
                $5, $6, $7, $8, CURRENT_TIMESTAMP
              );
            `,
              out.productId, batchId, dayId, out.actualYield,
              out.productBatchNo, out.productSerialNo,
              `Day ${targetDayNo} Output Released to Sales | Batch: ${out.productBatchNo} | Serial: ${out.productSerialNo} | Ref: ${batch.reference_no}`,
              userId
            );
          }
        }

        // Persist lot barcode metadata
        await tx.$executeRawUnsafe(`
          INSERT INTO production_barcode_labels (
            id, batch_id, day_output_id, product_id, batch_no, product_serial_no,
            qr_payload, mfd, expiry_date, mrp, net_weight, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2::uuid, $3, $4, $5,
            $6, $7, $8, 0, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          );
        `,
          batchId, dayOutputId, out.productId, out.productBatchNo, out.productSerialNo,
          JSON.stringify({
            referenceNo: batch.reference_no,
            dayNo: targetDayNo,
            productBatchNo: out.productBatchNo,
            productSerialNo: out.productSerialNo,
            productName: out.productName,
            qty: out.actualYield,
            uom: out.uom
          }),
          mfdDate, expiryDate, `${out.actualYield} ${out.uom}`
        ).catch(() => {});

        // Sync cumulative product actual_qty into production_batch_items
        const prodCum = await tx.$queryRawUnsafe(`
          SELECT COALESCE(SUM(actual_yield), 0) AS total_actual,
                 COALESCE(SUM(theoretical_qty), 0) AS total_planned
          FROM production_batch_day_outputs
          WHERE batch_id = $1 AND product_id = $2;
        `, batchId, out.productId);

        const existingItem = await tx.$queryRawUnsafe(`
          SELECT id FROM production_batch_items WHERE batch_id = $1 AND product_id = $2 LIMIT 1;
        `, batchId, out.productId);

        if (existingItem && existingItem.length > 0) {
          await tx.$executeRawUnsafe(`
            UPDATE production_batch_items
            SET planned_qty = $1, actual_qty = $2, cost_per_unit = $3
            WHERE id = $4::uuid;
          `, Number(prodCum[0]?.total_planned || out.theoreticalQty), Number(prodCum[0]?.total_actual || out.actualYield), out.unitCost, existingItem[0].id);
        } else {
          await tx.$executeRawUnsafe(`
            INSERT INTO production_batch_items (id, batch_id, product_id, planned_qty, actual_qty, factor, cost_per_unit, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, 1.0, $5, CURRENT_TIMESTAMP);
          `, batchId, out.productId, Number(prodCum[0]?.total_planned || out.theoreticalQty), Number(prodCum[0]?.total_actual || out.actualYield), out.unitCost);
        }
      }

      createdOutputs.push({
        ...out,
        dayOutputId,
        stockLotId
      });
    }

    // Decide whether entire production finishes or pauses for next day
    const shouldFinalize = Boolean(finalizeProduction) || remainingAfterDayMl <= 0.01;
    if (shouldFinalize && remainingAfterDayMl > 0.01 && scrapRemainingMixAsWaste) {
      await tx.$executeRawUnsafe(`
        INSERT INTO production_loss (id, date, responsible_person_id, production_batch_id, total_loss, note, created_by, created_at)
        VALUES (gen_random_uuid()::text, CURRENT_TIMESTAMP, $1, $2, $3, $4, $1, CURRENT_TIMESTAMP);
      `, userId || batch.created_by, batchId, round2(remainingAfterDayMl / 1000), `FINAL_UNALLOCATED_MIX: Final unallocated mix closed upon completing entire production (Day ${targetDayNo})`);
    }

    // Sync parent aggregate totals and transition parent status accurately
    const aggregate = await syncParentBatchAggregate(tx, batchId);

    // Determine parent batch status
    const allDaysNow = await tx.$queryRawUnsafe(`SELECT status, qc_status FROM production_batch_days WHERE batch_id = $1;`, batchId);
    const anyPendingQc = allDaysNow.some(d => d.qc_status === 'PENDING');
    const allPendingQc = allDaysNow.length > 0 && allDaysNow.every(d => d.qc_status === 'PENDING');

    let parentStatus = 'Paused';
    if (shouldFinalize) {
      parentStatus = allPendingQc ? 'Lab Test In Progress' : (anyPendingQc ? 'Completed' : 'Completed');
    } else {
      parentStatus = 'Paused';
    }

    // Append Day pause/completion log to pause_history
    let pauseHist = [];
    try {
      pauseHist = Array.isArray(batch.pause_history)
        ? batch.pause_history
        : (typeof batch.pause_history === 'string' ? JSON.parse(batch.pause_history || '[]') : []);
    } catch (_) {
      pauseHist = [];
    }
    pauseHist.push({
      action: shouldFinalize ? `DAY_${targetDayNo}_FINISH_ENTIRE_PRODUCTION` : `DAY_${targetDayNo}_COMPLETE_PAUSED`,
      dayNo: targetDayNo,
      dayBatchCode: resolvedDayCode,
      allocatedMl: computed.totalMixUsedMl,
      remainingMixMl: remainingAfterDayMl,
      totalOutputQty: costing.dayTotalYield,
      pushedToSales: !labTestRequired,
      ebTotalCost: round2(ebVal),
      labourTotalCost: round2(labourVal),
      by: operatorName,
      at: new Date().toISOString()
    });

    await tx.$executeRawUnsafe(`
      UPDATE production_batches
      SET
        status = $2,
        short_batch_code = COALESCE($3, short_batch_code),
        is_finalized = $4,
        pause_reason = $5,
        pause_history = $6::jsonb,
        completed_by = CASE WHEN $4 THEN $7 ELSE completed_by END,
        completed_at = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE completed_at END,
        complete_date = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE complete_date END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `,
      batchId,
      parentStatus,
      resolvedDayCode,
      shouldFinalize,
      shouldFinalize ? null : `Day ${targetDayNo} complete (${remainingAfterDayMl.toFixed(0)} ml base mix carry-forward)`,
      JSON.stringify(pauseHist),
      operatorName
    );

    return {
      batchId,
      referenceNo: batch.reference_no,
      dayId,
      dayNo: targetDayNo,
      dayLabel: `Day ${targetDayNo}`,
      dayBatchCode: resolvedDayCode,
      companyPrefix,
      dayStatus,
      qcStatus: dayQcStatus,
      pushedToSales: !labTestRequired,
      labTestRequired: Boolean(labTestRequired),
      finalizedEntireProduction: shouldFinalize,
      parentStatus,
      allocatedMixMl: computed.totalMixUsedMl,
      remainingMixMl: remainingAfterDayMl,
      baseRmDeductions,
      dayCosting: {
        baseRmCost: costing.dayBaseRmCost,
        productRmCost: costing.dayProductRmCost,
        ebTotalCost: round2(ebVal),
        labourTotalCost: round2(labourVal),
        overheadAmt: round2(overheadVal),
        dayGrandTotal: round2(costing.dayGrandTotal + overheadVal),
        dayTotalYield: costing.dayTotalYield
      },
      outputs: createdOutputs,
      aggregate
    };
  }, { maxWait: 15000, timeout: 60000 });
}

/**
 * Opens Day N+1 for a paused multi-day batch when carry-forward mix remains.
 */
async function startNextDayRun(batchId, { productionDate = null, dayBatchCode = null, operatorName = 'Supervisor' } = {}) {
  await ensureMultiDaySchema(prisma);

  return await prisma.$transaction(async (tx) => {
    const batchRows = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batches WHERE id = $1 FOR UPDATE;
    `, batchId);

    if (!batchRows || batchRows.length === 0) {
      const err = new Error('Production batch not found');
      err.statusCode = 404;
      throw err;
    }

    const batch = batchRows[0];
    if (batch.is_finalized || batch.status === 'Completed') {
      const err = new Error('Entire production batch is already finalized. Cannot start another day.');
      err.statusCode = 409;
      throw err;
    }

    const existingDays = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batch_days WHERE batch_id = $1 ORDER BY day_no ASC;
    `, batchId);

    const existingInProgress = (existingDays || []).find(d => d.status === 'IN_PROGRESS');
    if (existingInProgress) {
      await tx.$executeRawUnsafe(`
        UPDATE production_batches SET status = 'In Progress', active_day_no = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1;
      `, batchId, Number(existingInProgress.day_no));

      return {
        batchId,
        dayId: existingInProgress.id,
        dayNo: Number(existingInProgress.day_no),
        dayBatchCode: existingInProgress.day_batch_code,
        openingMixMl: Number(existingInProgress.opening_mix_ml || 0),
        reusedExistingOpenDay: true
      };
    }

    const netPostEvapMixMl = await resolveNetPostEvapMixMl(tx, batchId);
    const usedMl = await getPreviousDaysAllocatedMl(tx, batchId);
    const openingMixMl = Math.max(0, round2(netPostEvapMixMl - usedMl));

    if (openingMixMl <= 0.01) {
      const err = new Error('All evaporated base mix has already been allocated across previous days.');
      err.statusCode = 422;
      throw err;
    }

    const maxDayNo = (existingDays || []).reduce((m, d) => Math.max(m, Number(d.day_no || 0)), 0);
    const nextDayNo = maxDayNo + 1;
    const effDateStr = typeof productionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(productionDate.trim())
      ? productionDate.trim().slice(0, 10)
      : null;
    const effDate = effDateStr ? new Date(`${effDateStr}T00:00:00Z`) : (productionDate ? new Date(productionDate) : new Date());
    const validEffDate = isNaN(effDate.getTime()) ? new Date() : effDate;
    const effIso = effDateStr || validEffDate.toISOString().split('T')[0];
    const ddmmyy = formatDDMMYY(effDateStr || validEffDate);
    const resolvedDayCode = sanitizeToken(dayBatchCode || ddmmyy, 24, ddmmyy);
    const dayId = randomUUID();

    await tx.$executeRawUnsafe(`
      INSERT INTO production_batch_days (
        id, batch_id, day_no, day_label, production_date, day_batch_code,
        status, opening_mix_ml, remaining_mix_ml, eb_rate_per_unit
      ) VALUES (
        $1::uuid, $2, $3, $4, $5::date, $6,
        'IN_PROGRESS', $7, $7, $8
      );
    `, dayId, batchId, nextDayNo, `Day ${nextDayNo}`, effIso, resolvedDayCode, openingMixMl, Number(batch.eb_rate_per_unit || 8.5));

    await tx.$executeRawUnsafe(`
      UPDATE production_batches
      SET status = 'In Progress',
          active_day_no = $2,
          short_batch_code = COALESCE($3, short_batch_code),
          remaining_mix_balance_ml = $4,
          pause_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, batchId, nextDayNo, resolvedDayCode, openingMixMl);

    return {
      batchId,
      dayId,
      dayNo: nextDayNo,
      dayLabel: `Day ${nextDayNo}`,
      dayBatchCode: resolvedDayCode,
      openingMixMl,
      startedBy: operatorName
    };
  }, { maxWait: 15000, timeout: 60000 });
}

/**
 * Updates Electricity, Direct Labour, and per-product Labour amounts on ANY completed Day
 * (Day 1, Day 2, ...), dynamically recalculating Day unit costs, stock lot unit costs,
 * and parent production_batches aggregate costing + AuditLog.
 */
async function updateCompletedDayCosts({
  batchId,
  dayId,
  ebStartReading,
  ebEndReading,
  ebUnitsKwh,
  ebRatePerUnit,
  ebTotalCost,
  labourTotalCost,
  overheadAmt,
  outputLabourOverrides = {},
  timelineStages,
  productStagesMap,
  notes,
  productionDate,
  dayBatchCode,
  userId,
  operatorName = 'Supervisor'
}) {
  await ensureMultiDaySchema(prisma);

  return await prisma.$transaction(async (tx) => {
    const dayRows = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batch_days WHERE batch_id = $1 AND id = $2::uuid FOR UPDATE;
    `, batchId, dayId);

    if (!dayRows || dayRows.length === 0) {
      const err = new Error('Day execution record not found for this batch');
      err.statusCode = 404;
      throw err;
    }

    const day = dayRows[0];
    const outputs = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batch_day_outputs WHERE day_id = $1::uuid ORDER BY seq ASC;
    `, dayId);

    const netPostEvapMixMl = await resolveNetPostEvapMixMl(tx, batchId);
    const totalBaseRmCost = await computeBatchBaseRmCost(tx, batchId);

    const nextEbStart = ebStartReading !== undefined ? Number(ebStartReading) : Number(day.eb_start_reading || 0);
    const nextEbEnd = ebEndReading !== undefined ? Number(ebEndReading) : Number(day.eb_end_reading || 0);
    const nextEbRate = ebRatePerUnit !== undefined ? Number(ebRatePerUnit) : Number(day.eb_rate_per_unit || 8.5);
    const nextEbUnits = ebUnitsKwh !== undefined
      ? Number(ebUnitsKwh)
      : (nextEbEnd > nextEbStart ? round2(nextEbEnd - nextEbStart) : Number(day.eb_units_kwh || 0));
    const nextEbCost = ebTotalCost !== undefined
      ? Number(ebTotalCost)
      : (nextEbUnits > 0 ? round2(nextEbUnits * nextEbRate) : Number(day.eb_total_cost || 0));
    const nextLabourCost = labourTotalCost !== undefined ? Number(labourTotalCost) : Number(day.labour_total_cost || 0);
    const nextOverhead = overheadAmt !== undefined ? Number(overheadAmt) : Number(day.overhead_amt || 0);

    const resolvedTimelineStagesJson = Array.isArray(timelineStages)
      ? JSON.stringify(timelineStages)
      : null;
    const resolvedProductStagesMapJson = (productStagesMap && typeof productStagesMap === 'object')
      ? JSON.stringify(productStagesMap)
      : null;
    const resolvedNotes = notes !== undefined ? String(notes ?? '') : null;
    const resolvedProdDate = typeof productionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(productionDate.trim())
      ? productionDate.trim().slice(0, 10)
      : null;
    const resolvedDayCode = dayBatchCode !== undefined && dayBatchCode !== null && String(dayBatchCode).trim() !== ''
      ? sanitizeToken(dayBatchCode, 24, day.day_batch_code || formatDDMMYY(resolvedProdDate || day.production_date || new Date()))
      : null;

    const costingInputs = (outputs || []).map(o => {
      const overrideVal =
        outputLabourOverrides?.[o.id] ??
        outputLabourOverrides?.[o.product_id] ??
        outputLabourOverrides?.[String(o.seq)];

      return {
        ...o,
        allocatedBaseMl: Number(o.allocated_base_ml || 0),
        baseRmCost: Number(o.base_rm_cost || 0),
        productRmCost: Number(o.product_rm_cost || 0),
        actualYield: Number(o.actual_yield || 0),
        labourCostOverride: overrideVal !== undefined && overrideVal !== null ? Number(overrideVal) : undefined
      };
    });

    const recalculated = calculateDayProductCosting({
      outputs: costingInputs,
      totalBaseRmCost,
      netPostEvapMixMl,
      ebTotalCost: nextEbCost,
      labourTotalCost: nextLabourCost
    });

    const newDayGrandTotal = round2(recalculated.dayGrandTotal + nextOverhead);

    await tx.$executeRawUnsafe(`
      UPDATE production_batch_days
      SET
        eb_start_reading = $2,
        eb_end_reading = $3,
        eb_units_kwh = $4,
        eb_rate_per_unit = $5,
        eb_total_cost = $6,
        labour_total_cost = $7,
        overhead_amt = $8,
        day_grand_total = $9,
        timeline_stages = COALESCE($10::jsonb, timeline_stages),
        product_stages_map = COALESCE($11::jsonb, product_stages_map),
        notes = COALESCE($12, notes),
        production_date = COALESCE($13::date, production_date),
        day_batch_code = COALESCE($14, day_batch_code),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid;
    `, dayId, nextEbStart, nextEbEnd, nextEbUnits, nextEbRate, round2(nextEbCost), round2(nextLabourCost), round2(nextOverhead), newDayGrandTotal,
      resolvedTimelineStagesJson, resolvedProductStagesMapJson, resolvedNotes, resolvedProdDate, resolvedDayCode);

    for (const out of recalculated.outputs) {
      await tx.$executeRawUnsafe(`
        UPDATE production_batch_day_outputs
        SET
          allocated_eb_cost = $2,
          allocated_labour_cost = $3,
          total_cost = $4,
          unit_cost = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid;
      `, out.id, out.allocatedEbCost, out.allocatedLabourCost, out.totalCost, out.unitCost);

      await tx.$executeRawUnsafe(`
        UPDATE finished_product_stock_lots
        SET unit_cost = $2, updated_at = CURRENT_TIMESTAMP
        WHERE day_output_id = $1::uuid;
      `, out.id, out.unitCost);

      // Keep production_batch_items weighted average unit cost fresh
      const itemAgg = await tx.$queryRawUnsafe(`
        SELECT COALESCE(SUM(total_cost), 0) AS sum_cost, COALESCE(SUM(actual_yield), 0) AS sum_qty
        FROM production_batch_day_outputs
        WHERE batch_id = $1 AND product_id = $2;
      `, batchId, out.product_id);
      const sumQty = Number(itemAgg?.[0]?.sum_qty || 0);
      const avgUnitCost = sumQty > 0 ? round2(Number(itemAgg[0].sum_cost || 0) / sumQty) : out.unitCost;
      await tx.$executeRawUnsafe(`
        UPDATE production_batch_items SET cost_per_unit = $3 WHERE batch_id = $1 AND product_id = $2;
      `, batchId, out.product_id, avgUnitCost);
    }

    const aggregate = await syncParentBatchAggregate(tx, batchId);

    // Record AuditLog entry for post-completion cost adjustment
    if (userId) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "AuditLog" (id, "userId", action, "tableName", "recordId", "oldValue", "newValue", ip, "createdAt")
        VALUES ($1, $2, 'UPDATE_DAY_OPERATIONAL_COSTS', 'production_batch_days', $3, $4::jsonb, $5::jsonb, 'internal', CURRENT_TIMESTAMP);
      `,
        randomUUID(),
        userId,
        dayId,
        JSON.stringify({
          ebTotalCost: Number(day.eb_total_cost || 0),
          labourTotalCost: Number(day.labour_total_cost || 0),
          overheadAmt: Number(day.overhead_amt || 0),
          dayGrandTotal: Number(day.day_grand_total || 0)
        }),
        JSON.stringify({
          batchId,
          dayNo: Number(day.day_no),
          ebTotalCost: round2(nextEbCost),
          labourTotalCost: round2(nextLabourCost),
          overheadAmt: round2(nextOverhead),
          dayGrandTotal: newDayGrandTotal,
          updatedBy: operatorName
        })
      );
    }

    const updatedDays = await getBatchDaysData(tx, batchId, true);
    const updatedDay = updatedDays.find(d => d.id === dayId) || null;

    return {
      day: updatedDay,
      days: updatedDays,
      aggregate
    };
  }, { maxWait: 15000, timeout: 60000 });
}

/**
 * Reconciles Product RM (essences/flavours/packing) warehouse stock & lot netQty
 * by applying ONLY the delta between old completed-day outputs and edited allocations.
 */
async function reconcileDayProductRmStockDelta(tx, batchId, oldOutputs = [], newAllocations = []) {
  const sumRms = (list, keySelector) => {
    const rmQty = new Map();
    const lotQty = new Map();
    for (const item of list || []) {
      const prms = Array.isArray(item.productRms || item.product_rms) ? (item.productRms || item.product_rms) : [];
      for (const prm of prms) {
        const rmId = prm.rmId || prm.rawMaterialId;
        const qty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
        if (rmId && qty > 0) {
          rmQty.set(rmId, (rmQty.get(rmId) || 0) + qty);
        }
        if (Array.isArray(prm.allocatedBatches)) {
          for (const ab of prm.allocatedBatches) {
            const aQty = Number(ab.allocatedQty || ab.qty || 0);
            const lotKey = keySelector(ab);
            if (lotKey && aQty > 0) {
              lotQty.set(lotKey, (lotQty.get(lotKey) || 0) + aQty);
            }
          }
        }
      }
    }
    return { rmQty, lotQty };
  };

  const lotKeyFn = (ab) => {
    const id = ab.batchId ? String(ab.batchId).trim() : '';
    const num = (ab.batchNumber || ab.lotNumber || ab.batchNo || '') ? String(ab.batchNumber || ab.lotNumber || ab.batchNo).trim() : '';
    return id || num || null;
  };

  const oldAgg = sumRms(oldOutputs, lotKeyFn);
  const newAgg = sumRms(newAllocations, lotKeyFn);

  const allRmIds = new Set([...oldAgg.rmQty.keys(), ...newAgg.rmQty.keys()]);
  for (const rmId of allRmIds) {
    const delta = round2((newAgg.rmQty.get(rmId) || 0) - (oldAgg.rmQty.get(rmId) || 0));
    if (Math.abs(delta) > 0.0001) {
      await tx.$executeRawUnsafe(`
        UPDATE "RawMaterial"
        SET "currentStock" = GREATEST(0, "currentStock" - $1),
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, delta, rmId).catch(() => {});
    }
  }

  const allLotKeys = new Set([...oldAgg.lotQty.keys(), ...newAgg.lotQty.keys()]);
  for (const lKey of allLotKeys) {
    const delta = round2((newAgg.lotQty.get(lKey) || 0) - (oldAgg.lotQty.get(lKey) || 0));
    if (Math.abs(delta) > 0.0001) {
      if (UUID_REGEX.test(lKey)) {
        await tx.$executeRawUnsafe(`
          UPDATE "InventoryBatch"
          SET "netQty" = GREATEST(0, "netQty" - $1),
              "status" = CASE WHEN GREATEST(0, "netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $2;
        `, delta, lKey).catch(() => {});
      } else {
        await tx.$executeRawUnsafe(`
          UPDATE "InventoryBatch"
          SET "netQty" = GREATEST(0, "netQty" - $1),
              "status" = CASE WHEN GREATEST(0, "netQty" - $1) <= 0.0001 THEN 'DEPLETED' ELSE 'AVAILABLE' END,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "batchNumber" = $2;
        `, delta, lKey).catch(() => {});
      }
    }
  }
}

/**
 * Full Update for an already-completed Day (Day 1, Day 2, ...):
 * Updates Step 3 Products/Moulds/Allocations/RMs, Step 4 Timeline/EB/Labour/Overhead,
 * Step 5 Actual Yields/Rejects/Notes, reconciles Product RM & Finished Stock deltas cleanly,
 * cascades mix opening balances to subsequent days, and re-syncs parent batch aggregates.
 */
async function updateCompletedDayRun({
  batchId,
  dayId,
  productionDate,
  dayBatchCode,
  allocations = [],
  timelineStages,
  productStagesMap,
  ebStartReading,
  ebEndReading,
  ebUnitsKwh,
  ebRatePerUnit,
  ebTotalCost,
  labourTotalCost,
  overheadAmt,
  productYields = [],
  notes,
  userId,
  operatorName = 'Supervisor'
}) {
  await ensureMultiDaySchema(prisma);

  return await prisma.$transaction(async (tx) => {
    const batchRows = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batches WHERE id = $1 FOR UPDATE;
    `, batchId);
    if (!batchRows || batchRows.length === 0) {
      const err = new Error('Production batch not found');
      err.statusCode = 404;
      throw err;
    }
    const batch = batchRows[0];

    const dayRows = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batch_days WHERE batch_id = $1 AND id = $2::uuid FOR UPDATE;
    `, batchId, dayId);
    if (!dayRows || dayRows.length === 0) {
      const err = new Error('Day execution record not found for this batch');
      err.statusCode = 404;
      throw err;
    }
    const day = dayRows[0];
    const targetDayNo = Number(day.day_no);

    const oldOutputs = await tx.$queryRawUnsafe(`
      SELECT * FROM production_batch_day_outputs WHERE day_id = $1::uuid ORDER BY seq ASC FOR UPDATE;
    `, dayId);

    const netPostEvapMixMl = await resolveNetPostEvapMixMl(tx, batchId);
    const otherCompletedDays = await tx.$queryRawUnsafe(`
      SELECT COALESCE(SUM(allocated_mix_ml), 0) AS used_other
      FROM production_batch_days
      WHERE batch_id = $1 AND day_no <> $2 AND status <> 'IN_PROGRESS';
    `, batchId, targetDayNo);
    const priorBeforeThisDay = await getPreviousDaysAllocatedMl(tx, batchId, targetDayNo);
    const otherCompletedUsed = Number(otherCompletedDays?.[0]?.used_other || 0);

    const inputAllocs = Array.isArray(allocations) && allocations.length > 0
      ? allocations
      : (oldOutputs || []).map(o => ({
          seq: o.seq,
          productId: o.product_id,
          productName: o.product_name,
          useMould: Boolean(o.use_mould),
          mouldId: o.mould_id,
          capacityMl: Number(o.capacity_ml || 0),
          cavities: Number(o.cavities || 1),
          trays: Number(o.trays || 0),
          wasteMode: o.waste_mode || 'PERCENT',
          wasteValue: Number(o.waste_value || 0),
          allocatedBaseMl: Number(o.allocated_base_ml || 0),
          bulkUom: o.bulk_uom || 'L',
          productRms: Array.isArray(o.product_rms) ? o.product_rms : [],
          productBatchNo: o.product_batch_no,
          actualYield: Number(o.actual_yield || 0),
          rejectOutput: Number(o.reject_output || 0)
        }));

    if (inputAllocs.length === 0) {
      const err = new Error(`Day ${targetDayNo} must retain at least one product allocation.`);
      err.statusCode = 422;
      throw err;
    }

    const totalThisDayRequested = inputAllocs.reduce((s, a) => s + Number(a.allocatedBaseMl || a.mixUsedMl || 0), 0);
    if (otherCompletedUsed + totalThisDayRequested > netPostEvapMixMl + 1) {
      const err = new Error(
        `Day ${targetDayNo} allocation (${totalThisDayRequested.toFixed(2)} ml) plus other completed days (${otherCompletedUsed.toFixed(2)} ml) exceeds net post-evaporation tank volume (${netPostEvapMixMl.toFixed(2)} ml).`
      );
      err.statusCode = 422;
      throw err;
    }

    const computed = calculateAllocations({
      availableMixMl: netPostEvapMixMl,
      previousDaysAllocatedMl: priorBeforeThisDay,
      allocations: inputAllocs
    });
    if (!computed.isValid) {
      const err = new Error(computed.errors.map(e => e.message).join('; '));
      err.statusCode = 422;
      err.errors = computed.errors;
      throw err;
    }

    // Reconcile Product RM stock & InventoryBatch netQty delta
    await reconcileDayProductRmStockDelta(tx, batchId, oldOutputs, computed.allocations);

    const totalBaseRmCost = await computeBatchBaseRmCost(tx, batchId);
    const prodIds = [...new Set(computed.allocations.map(a => a.productId).filter(Boolean))];
    const dbProducts = prodIds.length > 0
      ? await tx.finishedProduct.findMany({ where: { id: { in: prodIds } }, include: { unit: true } })
      : [];
    const prodMap = new Map(dbProducts.map(p => [p.id, p]));
    const companyName = await getCanonicalCompanyName();

    const effDateStr = typeof productionDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(productionDate.trim())
      ? productionDate.trim().slice(0, 10)
      : (day.production_date ? new Date(day.production_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const effDate = new Date(`${effDateStr}T00:00:00Z`);
    const ddmmyy = formatDDMMYY(effDateStr);
    const resolvedDayCode = dayBatchCode !== undefined && dayBatchCode !== null && String(dayBatchCode).trim() !== ''
      ? sanitizeToken(dayBatchCode, 24, ddmmyy)
      : (day.day_batch_code || ddmmyy);

    const yieldsArr = Array.isArray(productYields) ? productYields : [];
    const oldOutByKey = new Map();
    for (const oo of oldOutputs || []) {
      oldOutByKey.set(`${oo.product_id}::${Number(oo.seq)}`, oo);
      if (!oldOutByKey.has(oo.product_id)) oldOutByKey.set(oo.product_id, oo);
    }

    const preparedOutputs = [];
    const matchedOldIds = new Set();

    for (let i = 0; i < computed.allocations.length; i++) {
      const alloc = computed.allocations[i];
      const prod = prodMap.get(alloc.productId);
      const productName = alloc.productName || prod?.name || 'Product';
      const uom = alloc.useMould
        ? (prod?.unit?.abbreviation || 'pcs')
        : (alloc.bulkUom || prod?.unit?.abbreviation || 'Ltr');

      const matchedOld = oldOutByKey.get(`${alloc.productId}::${Number(alloc.seq)}`) || oldOutByKey.get(alloc.productId) || null;
      if (matchedOld) matchedOldIds.add(matchedOld.id);

      const matchedYield = yieldsArr.find(y =>
        (y.seq !== undefined && Number(y.seq) === Number(alloc.seq)) ||
        (y.productId === alloc.productId && (y.index === undefined || Number(y.index) === i))
      ) || yieldsArr[i] || null;

      const theoreticalQty = Number(alloc.goodPieces || 0);
      const actualYield = Number(
        matchedYield?.actualGoodOutput ??
        matchedYield?.actualOutput ??
        alloc.actualYield ??
        matchedOld?.actual_yield ??
        theoreticalQty
      );
      const rejectOutput = Number(matchedYield?.rejectOutput ?? alloc.rejectOutput ?? matchedOld?.reject_output ?? 0);

      let productRmCost = 0;
      if (Array.isArray(alloc.productRms)) {
        for (const prm of alloc.productRms) {
          const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
          const prmRate = Number(prm.unitRate ?? prm.rate ?? 0);
          productRmCost += prmQty * prmRate;
        }
      }

      const rawCandidateBatchNo =
        matchedYield?.productBatchNo ||
        alloc.productBatchNo ||
        matchedOld?.product_batch_no ||
        formatProductBatchNo({ headerBatchCode: resolvedDayCode, productName, dateInput: effDate });
      const uniqueProductBatchNo = (matchedOld && matchedOld.product_batch_no === rawCandidateBatchNo)
        ? rawCandidateBatchNo
        : await ensureUniqueProductBatchNo(tx, rawCandidateBatchNo, batchId, targetDayNo);

      let serialInfo;
      if (matchedOld && matchedOld.product_serial_no) {
        serialInfo = {
          companyPrefix: matchedOld.company_prefix || sanitizeToken(companyName, 24, 'COMPANY'),
          serialSeq: Number(matchedOld.serial_seq || 1),
          serialNo: matchedOld.product_serial_no
        };
      } else {
        serialInfo = await assignNextProductSerial(tx, alloc.productId, productName, companyName);
      }

      preparedOutputs.push({
        existingOutputId: matchedOld?.id || null,
        oldActualYield: Number(matchedOld?.actual_yield || 0),
        pushedToSales: matchedOld ? Boolean(matchedOld.pushed_to_sales) : !Boolean(day.lab_test_required),
        qcStatus: matchedOld?.qc_status || day.qc_status || 'EXEMPT',
        labTestRequired: matchedOld ? Boolean(matchedOld.lab_test_required) : Boolean(day.lab_test_required),
        seq: Number(alloc.seq || i + 1),
        productId: alloc.productId,
        productName,
        uom,
        productBatchNo: uniqueProductBatchNo,
        companyPrefix: serialInfo.companyPrefix,
        serialSeq: serialInfo.serialSeq,
        productSerialNo: serialInfo.serialNo,
        useMould: Boolean(alloc.useMould),
        mouldId: (alloc.mouldId && UUID_REGEX.test(String(alloc.mouldId))) ? String(alloc.mouldId) : null,
        capacityMl: Number(alloc.capacityMl || 0),
        cavities: Number(alloc.cavities || 1),
        trays: Number(alloc.trays || 0),
        bulkUom: alloc.bulkUom || 'L',
        wasteMode: alloc.wasteMode || 'PERCENT',
        wasteValue: Number(alloc.wasteValue || 0),
        allocatedBaseMl: Number(alloc.allocatedBaseMl || alloc.mixUsedMl || 0),
        wasteMl: Number(alloc.wasteMl || 0),
        theoreticalQty,
        actualYield,
        rejectOutput,
        productRms: Array.isArray(alloc.productRms) ? alloc.productRms : [],
        productTotalMixMl: Number(alloc.productTotalMixMl || alloc.allocatedBaseMl || 0),
        productRmCost: round2(productRmCost),
        labourCostOverride: matchedYield?.labourCostOverride ?? alloc.labourCostOverride
      });
    }

    const nextEbStart = ebStartReading !== undefined ? Number(ebStartReading) : Number(day.eb_start_reading || 0);
    const nextEbEnd = ebEndReading !== undefined ? Number(ebEndReading) : Number(day.eb_end_reading || 0);
    const nextEbRate = ebRatePerUnit !== undefined ? Number(ebRatePerUnit) : Number(day.eb_rate_per_unit || 8.5);
    const nextEbUnits = ebUnitsKwh !== undefined
      ? Number(ebUnitsKwh)
      : (nextEbEnd > nextEbStart ? round2(nextEbEnd - nextEbStart) : Number(day.eb_units_kwh || 0));
    const nextEbCost = ebTotalCost !== undefined
      ? Number(ebTotalCost)
      : (nextEbUnits > 0 ? round2(nextEbUnits * nextEbRate) : Number(day.eb_total_cost || 0));
    const nextLabourCost = labourTotalCost !== undefined ? Number(labourTotalCost) : Number(day.labour_total_cost || 0);
    const nextOverhead = overheadAmt !== undefined ? Number(overheadAmt) : Number(day.overhead_amt || 0);

    const costing = calculateDayProductCosting({
      outputs: preparedOutputs,
      totalBaseRmCost,
      netPostEvapMixMl,
      ebTotalCost: nextEbCost,
      labourTotalCost: nextLabourCost
    });

    const totalDayWasteMl = round2(costing.outputs.reduce((s, o) => s + Number(o.wasteMl || 0), 0));
    const totalDayRejects = round2(costing.outputs.reduce((s, o) => s + Number(o.rejectOutput || 0), 0));
    const remainingAfterDayMl = Math.max(0, round2(computed.remainingMixMl));
    const nextTimelineJson = Array.isArray(timelineStages) ? JSON.stringify(timelineStages) : null;
    const nextProdStagesJson = (productStagesMap && typeof productStagesMap === 'object') ? JSON.stringify(productStagesMap) : null;

    await tx.$executeRawUnsafe(`
      UPDATE production_batch_days
      SET
        production_date = $2::date,
        day_batch_code = $3,
        opening_mix_ml = $4,
        allocated_mix_ml = $5,
        waste_ml = $6,
        remaining_mix_ml = $7,
        total_output_qty = $8,
        total_rejected_qty = $9,
        timeline_stages = COALESCE($10::jsonb, timeline_stages),
        product_stages_map = COALESCE($11::jsonb, product_stages_map),
        eb_start_reading = $12,
        eb_end_reading = $13,
        eb_units_kwh = $14,
        eb_rate_per_unit = $15,
        eb_total_cost = $16,
        labour_total_cost = $17,
        overhead_amt = $18,
        base_rm_cost = $19,
        product_rm_cost = $20,
        day_grand_total = $21,
        notes = COALESCE($22, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::uuid;
    `,
      dayId, effDateStr, resolvedDayCode,
      computed.initialMixAvailableMl, computed.totalMixUsedMl, totalDayWasteMl, remainingAfterDayMl,
      costing.dayTotalYield, totalDayRejects,
      nextTimelineJson, nextProdStagesJson,
      nextEbStart, nextEbEnd, nextEbUnits, nextEbRate, round2(nextEbCost),
      round2(nextLabourCost), round2(nextOverhead), costing.dayBaseRmCost, costing.dayProductRmCost,
      round2(costing.dayGrandTotal + nextOverhead),
      notes !== undefined ? String(notes ?? '') : null
    );

    // Reverse any removed outputs from oldOutputs first
    for (const oo of oldOutputs || []) {
      if (!matchedOldIds.has(oo.id)) {
        const oldY = Number(oo.actual_yield || 0);
        if (oo.pushed_to_sales && oldY > 0) {
          await tx.$executeRawUnsafe(`
            UPDATE products SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2;
          `, oldY, oo.product_id);
        }
        await tx.$executeRawUnsafe(`DELETE FROM finished_product_stock_lots WHERE day_output_id = $1::uuid;`, oo.id).catch(() => {});
        await tx.$executeRawUnsafe(`DELETE FROM production_batch_day_outputs WHERE id = $1::uuid;`, oo.id);
      }
    }

    // Replace production_batch_allocation rows for this day
    await tx.$executeRawUnsafe(`DELETE FROM production_batch_allocation WHERE batch_id = $1 AND COALESCE(day_no, 1) = $2;`, batchId, targetDayNo);

    const shelfLife = Number(batch.expiry_days || batch.shelf_life_days || 365);
    const expiryDate = new Date(effDate.getTime() + shelfLife * 24 * 60 * 60 * 1000);

    for (const out of costing.outputs) {
      await tx.$executeRawUnsafe(`
        INSERT INTO production_batch_allocation (
          id, batch_id, day_no, day_id, seq, product_id, use_mould, mould_id,
          capacity_ml, cavities, trays, waste_mode, waste_value,
          mix_used_ml, waste_ml, good_pieces, actual_yield,
          allocated_base_ml, bulk_uom, product_rms,
          product_batch_no, product_serial_no,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3::uuid, $4, $5, $6, ($7::text)::uuid,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19::jsonb,
          $20, $21,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
      `,
        batchId, targetDayNo, dayId, out.seq, out.productId, out.useMould, out.mouldId,
        out.capacityMl, out.cavities, out.trays, out.wasteMode, out.wasteValue,
        out.allocatedBaseMl, out.wasteMl, out.theoreticalQty, out.actualYield,
        out.allocatedBaseMl, out.bulkUom, JSON.stringify(out.productRms || []),
        out.productBatchNo, out.productSerialNo
      );

      if (out.existingOutputId) {
        const deltaYield = round2(out.actualYield - out.oldActualYield);
        await tx.$executeRawUnsafe(`
          UPDATE production_batch_day_outputs
          SET
            seq = $2, product_name = $3, uom = $4, product_batch_no = $5,
            use_mould = $6, mould_id = ($7::text)::uuid, capacity_ml = $8, cavities = $9, trays = $10,
            bulk_uom = $11, waste_mode = $12, waste_value = $13,
            allocated_base_ml = $14, waste_ml = $15, theoretical_qty = $16,
            actual_yield = $17, reject_output = $18, product_rms = $19::jsonb,
            base_rm_cost = $20, product_rm_cost = $21, allocated_eb_cost = $22, allocated_labour_cost = $23,
            total_cost = $24, unit_cost = $25, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::uuid;
        `,
          out.existingOutputId, out.seq, out.productName, out.uom, out.productBatchNo,
          out.useMould, out.mouldId, out.capacityMl, out.cavities, out.trays,
          out.bulkUom, out.wasteMode, out.wasteValue,
          out.allocatedBaseMl, out.wasteMl, out.theoreticalQty,
          out.actualYield, out.rejectOutput, JSON.stringify(out.productRms || []),
          out.baseRmCost, out.productRmCost, out.allocatedEbCost, out.allocatedLabourCost,
          out.totalCost, out.unitCost
        );

        await tx.$executeRawUnsafe(`
          UPDATE finished_product_stock_lots
          SET
            product_batch_no = $2,
            initial_qty = $3,
            remaining_qty = GREATEST(0, remaining_qty + $4),
            unit_cost = $5,
            mfg_date = $6,
            expiry_date = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE day_output_id = $1::uuid;
        `, out.existingOutputId, out.productBatchNo, out.actualYield, deltaYield, out.unitCost, effDate, expiryDate);

        if (out.pushedToSales && Math.abs(deltaYield) > 0.0001) {
          await tx.$executeRawUnsafe(`
            UPDATE products
            SET current_stock = GREATEST(0, COALESCE(current_stock, 0) + $1),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2;
          `, deltaYield, out.productId);
        }
      } else {
        const newOutId = randomUUID();
        const newLotId = randomUUID();
        await tx.$executeRawUnsafe(`
          INSERT INTO production_batch_day_outputs (
            id, batch_id, day_id, day_no, seq, product_id, product_name, uom,
            product_batch_no, company_prefix, serial_seq, product_serial_no,
            use_mould, mould_id, capacity_ml, cavities, trays, bulk_uom,
            waste_mode, waste_value, allocated_base_ml, waste_ml,
            theoretical_qty, actual_yield, reject_output, product_rms,
            base_rm_cost, product_rm_cost, allocated_eb_cost, allocated_labour_cost,
            total_cost, unit_cost, qc_status, lab_test_required, pushed_to_sales
          ) VALUES (
            $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, ($14::text)::uuid, $15, $16, $17, $18,
            $19, $20, $21, $22,
            $23, $24, $25, $26::jsonb,
            $27, $28, $29, $30,
            $31, $32, $33, $34, $35
          );
        `,
          newOutId, batchId, dayId, targetDayNo, out.seq, out.productId, out.productName, out.uom,
          out.productBatchNo, out.companyPrefix, out.serialSeq, out.productSerialNo,
          out.useMould, out.mouldId, out.capacityMl, out.cavities, out.trays, out.bulkUom,
          out.wasteMode, out.wasteValue, out.allocatedBaseMl, out.wasteMl,
          out.theoreticalQty, out.actualYield, out.rejectOutput, JSON.stringify(out.productRms || []),
          out.baseRmCost, out.productRmCost, out.allocatedEbCost, out.allocatedLabourCost,
          out.totalCost, out.unitCost, out.qcStatus, out.labTestRequired, out.pushedToSales
        );

        if (out.actualYield > 0) {
          await tx.$executeRawUnsafe(`
            INSERT INTO finished_product_stock_lots (
              id, product_id, batch_id, day_id, day_output_id, day_no,
              product_batch_no, product_serial_no, reference_no,
              mfg_date, expiry_date, initial_qty, remaining_qty, unit_cost,
              qc_status, is_sellable
            ) VALUES (
              $1::uuid, $2, $3, $4::uuid, $5::uuid, $6,
              $7, $8, $9,
              $10, $11, $12, $12, $13,
              $14, $15
            );
          `,
            newLotId, out.productId, batchId, dayId, newOutId, targetDayNo,
            out.productBatchNo, out.productSerialNo, batch.reference_no,
            effDate, expiryDate, out.actualYield, out.unitCost,
            out.qcStatus, out.pushedToSales
          );
          if (out.pushedToSales) {
            await tx.$executeRawUnsafe(`
              UPDATE products
              SET current_stock = COALESCE(current_stock, 0) + $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2;
            `, out.actualYield, out.productId);
          }
        }
      }
    }

    // Cascade opening/remaining mix balances onto any open subsequent day (e.g. Day 2 IN_PROGRESS)
    const afterUsed = priorBeforeThisDay + computed.totalMixUsedMl;
    const cascadeRemaining = Math.max(0, round2(netPostEvapMixMl - afterUsed));
    await tx.$executeRawUnsafe(`
      UPDATE production_batch_days
      SET opening_mix_ml = $2,
          remaining_mix_ml = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE batch_id = $1 AND day_no > $3 AND status = 'IN_PROGRESS';
    `, batchId, cascadeRemaining, targetDayNo).catch(() => {});

    const aggregate = await syncParentBatchAggregate(tx, batchId);
    const updatedDays = await getBatchDaysData(tx, batchId, true);
    const updatedDay = updatedDays.find(d => d.id === dayId) || null;

    if (userId) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "AuditLog" (id, "userId", action, "tableName", "recordId", "oldValue", "newValue", ip, "createdAt")
        VALUES ($1, $2, 'UPDATE_COMPLETED_DAY_RUN', 'production_batch_days', $3, $4::jsonb, $5::jsonb, 'internal', CURRENT_TIMESTAMP);
      `,
        randomUUID(), userId, dayId,
        JSON.stringify({ dayNo: targetDayNo, allocatedMixMl: Number(day.allocated_mix_ml || 0), totalOutputQty: Number(day.total_output_qty || 0) }),
        JSON.stringify({ batchId, dayNo: targetDayNo, allocatedMixMl: computed.totalMixUsedMl, totalOutputQty: costing.dayTotalYield, updatedBy: operatorName })
      ).catch(() => {});
    }

    return { day: updatedDay, days: updatedDays, aggregate };
  }, { maxWait: 15000, timeout: 60000 });
}

module.exports = {
  ensureMultiDaySchema,
  resolveNetPostEvapMixMl,
  getPreviousDaysAllocatedMl,
  computeBatchBaseRmCost,
  syncParentBatchAggregate,
  getBatchDaysData,
  completeDayRun,
  startNextDayRun,
  updateCompletedDayCosts,
  updateCompletedDayRun
};
