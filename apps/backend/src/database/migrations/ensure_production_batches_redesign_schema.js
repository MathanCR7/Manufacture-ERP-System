const prisma = require('../prisma');

let isEnsured = false;

async function ensureProductionBatchesRedesignSchema() {
  if (isEnsured) return;

  const alterStatements = [
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
     ON CONFLICT ("id") DO NOTHING;`
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

module.exports = { ensureProductionBatchesRedesignSchema };
