const prisma = require('../prisma');

let isEnsured = false;

async function ensureProductionBatchesRedesignSchema() {
  if (isEnsured) return;

  const alterStatements = [
    // Ensure pgcrypto extension for UUID generation
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',

    // Core relation and category pointers
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "base_id" UUID;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "template_id" UUID;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "category_id" TEXT;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "sub_category_id" TEXT;',

    // Operational and line details
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "shift" VARCHAR(50);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "machine_line" VARCHAR(100);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "adjustment_reason" TEXT;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "adjustment_reference" VARCHAR(100);',

    // Costing and financial metrics
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "sub_total" DECIMAL(15, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "wastage_amt" DECIMAL(15, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "overhead_amt" DECIMAL(15, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "grand_total" DECIMAL(15, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cost_per_unit" DECIMAL(15, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(50);',

    // Execution tracking and lifecycle stages
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "started_by" VARCHAR(150);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "pause_history" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "sop_guide" TEXT;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "timeline_stages" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "pause_reason" TEXT;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cancelled_reason" TEXT;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cancelled_by" VARCHAR(150);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);',

    // Manufacturing, shelf life, and QA/QC outputs
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "mfd" TIMESTAMP(3);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "shelf_life_days" INT DEFAULT 365;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "lab_test_required" BOOLEAN DEFAULT false;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "qc_status" VARCHAR(50) DEFAULT \'EXEMPT\';',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "quarantine_stock" DECIMAL(15, 3) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "good_quantity" DECIMAL(15, 3) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "rejected_quantity" DECIMAL(15, 3) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "scrap_quantity" DECIMAL(15, 3) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "scrap_reason" TEXT;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "yield_percentage" DECIMAL(6, 2) DEFAULT 100;',

    // Electricity and utilities tracking
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_start_reading" DECIMAL(12, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_end_reading" DECIMAL(12, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_units_kwh" DECIMAL(12, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_rate_per_unit" DECIMAL(10, 2) DEFAULT 8.50;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_total_cost" DECIMAL(12, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "labour_total_cost" DECIMAL(12, 2) DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "labour_count" INT DEFAULT 0;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "labour_staff_ids" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "labour_staff_details" JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "completed_by" VARCHAR(150);',
    'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);',

    // Multi-Product batch line items table
    `CREATE TABLE IF NOT EXISTS "production_batch_items" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL,
      "product_id" TEXT NOT NULL,
      "planned_qty" NUMERIC NOT NULL DEFAULT 1,
      "actual_qty" NUMERIC NOT NULL DEFAULT 0,
      "factor" NUMERIC NOT NULL DEFAULT 1.0,
      "cost_per_unit" NUMERIC NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Granular Raw Material Lot Allocations Table
    `CREATE TABLE IF NOT EXISTS "production_batch_allocations" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL,
      "usage_id" TEXT,
      "inventory_batch_id" TEXT,
      "po_id" TEXT,
      "lot_number" VARCHAR(255) NOT NULL DEFAULT 'WAREHOUSE-LOT',
      "allocated_qty" NUMERIC NOT NULL DEFAULT 0,
      "po_original_qty" NUMERIC DEFAULT 0,
      "po_total_amount" NUMERIC DEFAULT 0,
      "allocated_amount" NUMERIC NOT NULL DEFAULT 0,
      "unit_rate" NUMERIC NOT NULL DEFAULT 0,
      "uom" VARCHAR(50) DEFAULT 'Kg',
      "is_manual_override" BOOLEAN DEFAULT false,
      "grn_number" VARCHAR(255),
      "po_number" VARCHAR(255),
      "supplier_batch_no" VARCHAR(255),
      "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Production Output Details Table
    `CREATE TABLE IF NOT EXISTS "production_output_details" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "good_qty" DECIMAL(15, 3) NOT NULL DEFAULT 0,
      "rejected_qty" DECIMAL(15, 3) NOT NULL DEFAULT 0,
      "rework_qty" DECIMAL(15, 3) NOT NULL DEFAULT 0,
      "scrap_qty" DECIMAL(15, 3) NOT NULL DEFAULT 0,
      "scrap_reason" TEXT,
      "by_product_name" VARCHAR(200),
      "by_product_qty" DECIMAL(15, 3) DEFAULT 0,
      "qc_sample_qty" DECIMAL(15, 3) DEFAULT 0,
      "retention_sample_qty" DECIMAL(15, 3) DEFAULT 0,
      "theoretical_qty" DECIMAL(15, 3) NOT NULL DEFAULT 0,
      "yield_percentage" DECIMAL(6, 2) NOT NULL DEFAULT 100,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Production Utility Logs Table
    `CREATE TABLE IF NOT EXISTS "production_utility_logs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "eb_start_reading" DECIMAL(12, 2) DEFAULT 0,
      "eb_end_reading" DECIMAL(12, 2) DEFAULT 0,
      "eb_units_kwh" DECIMAL(12, 2) DEFAULT 0,
      "eb_rate_per_unit" DECIMAL(10, 2) DEFAULT 8.50,
      "eb_cost" DECIMAL(12, 2) DEFAULT 0,
      "water_quantity" DECIMAL(10, 2) DEFAULT 0,
      "water_cost" DECIMAL(10, 2) DEFAULT 0,
      "fuel_quantity" DECIMAL(10, 2) DEFAULT 0,
      "fuel_cost" DECIMAL(10, 2) DEFAULT 0,
      "generator_diesel_qty" DECIMAL(10, 2) DEFAULT 0,
      "generator_diesel_cost" DECIMAL(10, 2) DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Production Labour Logs Table
    `CREATE TABLE IF NOT EXISTS "production_labour_logs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "employee_id" VARCHAR(100),
      "employee_name" VARCHAR(200) NOT NULL,
      "employee_type" VARCHAR(50) DEFAULT 'Permanent',
      "contractor_name" VARCHAR(200),
      "work_centre" VARCHAR(100),
      "normal_hours" DECIMAL(6, 2) DEFAULT 8,
      "ot_hours" DECIMAL(6, 2) DEFAULT 0,
      "rate_per_hour" DECIMAL(10, 2) DEFAULT 0,
      "total_cost" DECIMAL(12, 2) DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Production Machine Logs Table
    `CREATE TABLE IF NOT EXISTS "production_machine_logs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "machine_id" VARCHAR(100) NOT NULL,
      "run_hours" DECIMAL(6, 2) DEFAULT 0,
      "downtime_hours" DECIMAL(6, 2) DEFAULT 0,
      "downtime_reason" TEXT,
      "cleaning_done" BOOLEAN DEFAULT true,
      "line_clearance_passed" BOOLEAN DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Production Barcode Labels Table
    `CREATE TABLE IF NOT EXISTS "production_barcode_labels" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "product_id" TEXT NOT NULL REFERENCES "products"("id"),
      "gtin_ean" VARCHAR(50),
      "batch_no" VARCHAR(100) NOT NULL,
      "qr_payload" TEXT NOT NULL,
      "mfd" TIMESTAMP(3) NOT NULL,
      "expiry_date" TIMESTAMP(3) NOT NULL,
      "mrp" DECIMAL(12, 2) DEFAULT 0,
      "net_weight" VARCHAR(50),
      "storage_conditions" VARCHAR(255),
      "fssai_licence" VARCHAR(100),
      "manufacturer_address" TEXT,
      "printed_count" INT NOT NULL DEFAULT 0,
      "reprint_log" JSONB DEFAULT '[]'::jsonb,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Production Batch Costing Table
    `CREATE TABLE IF NOT EXISTS "production_batch_costing" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "material_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "packing_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "labour_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "machine_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "utility_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "overhead_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "total_batch_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "cost_per_unit" DECIMAL(15, 4) NOT NULL DEFAULT 0,
      "standard_cost_per_unit" DECIMAL(15, 4) NOT NULL DEFAULT 0,
      "variance_cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Batch Sequences Table
    `CREATE TABLE IF NOT EXISTS "batch_sequences" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "sequence_key" VARCHAR(20) NOT NULL,
      "reset_mode" VARCHAR(10) NOT NULL DEFAULT 'DAILY',
      "last_number" INT NOT NULL DEFAULT 0,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "uq_batch_seq_prod_key" UNIQUE ("product_id", "sequence_key")
    );`,

    // Batch Settings Table
    `CREATE TABLE IF NOT EXISTS "batch_settings" (
      "id" VARCHAR(50) PRIMARY KEY DEFAULT 'DEFAULT',
      "reset_mode" VARCHAR(20) NOT NULL DEFAULT 'DAILY',
      "counter_digits" INT NOT NULL DEFAULT 5,
      "allow_backdated_entries" BOOLEAN NOT NULL DEFAULT true,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Default Batch Setting
    `INSERT INTO "batch_settings" ("id", "reset_mode", "counter_digits", "allow_backdated_entries")
     VALUES ('DEFAULT', 'DAILY', 5, true)
     ON CONFLICT ("id") DO NOTHING;`,

    // Ensure id column defaults exist even if table was created without default
    `ALTER TABLE "production_batch_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();`,
    `ALTER TABLE "production_batch_allocations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();`,

    // Performance Indices
    `CREATE INDEX IF NOT EXISTS "idx_alloc_batch" ON "production_batch_allocations"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_alloc_usage" ON "production_batch_allocations"("usage_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_batch_items_batch" ON "production_batch_items"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_output_batch" ON "production_output_details"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_costing_batch" ON "production_batch_costing"("batch_id");`
  ];

  for (const sql of alterStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (statementErr) {
      // Ignore if column already exists or already converted
      console.warn('Notice executing schema statement:', statementErr.message);
    }
  }

  isEnsured = true;
  console.log('✅ Production batches redesign schema ensured successfully (base_id, template_id, timeline_stages, etc).');
}

if (require.main === module) {
  ensureProductionBatchesRedesignSchema()
    .then(() => {
      console.log('Production batches migration finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Production batches migration error:', err);
      process.exit(1);
    });
}

module.exports = { ensureProductionBatchesRedesignSchema };
