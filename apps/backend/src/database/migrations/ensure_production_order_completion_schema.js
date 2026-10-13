const prisma = require('../prisma');

async function migrateProductionModuleSchema() {
  console.log('=== Starting Full Production Module Schema Migration ===');

  const statements = [
    // 1. Batch Sequence Table for Concurrency & Auto Batch Numbering
    `CREATE TABLE IF NOT EXISTS "batch_sequences" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
      "sequence_key" VARCHAR(20) NOT NULL,
      "reset_mode" VARCHAR(10) NOT NULL DEFAULT 'DAILY',
      "last_number" INT NOT NULL DEFAULT 0,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "uq_batch_seq_prod_key" UNIQUE ("product_id", "sequence_key")
    );`,

    // 2. Batch Settings Table (Configurable per-factory or global)
    `CREATE TABLE IF NOT EXISTS "batch_settings" (
      "id" VARCHAR(50) PRIMARY KEY DEFAULT 'DEFAULT',
      "reset_mode" VARCHAR(20) NOT NULL DEFAULT 'DAILY',
      "counter_digits" INT NOT NULL DEFAULT 5,
      "allow_backdated_entries" BOOLEAN NOT NULL DEFAULT true,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // Insert default setting if not present
    `INSERT INTO "batch_settings" ("id", "reset_mode", "counter_digits", "allow_backdated_entries")
     VALUES ('DEFAULT', 'DAILY', 5, true)
     ON CONFLICT ("id") DO NOTHING;`,

    // 3. Extend production_batches with MFD, Shelf Life, Lab & Utilities columns
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "mfd" TIMESTAMP(3);`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "shelf_life_days" INT DEFAULT 365;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "lab_test_required" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "qc_status" VARCHAR(50) DEFAULT 'EXEMPT';`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "quarantine_stock" DECIMAL(15, 3) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "good_quantity" DECIMAL(15, 3) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "rejected_quantity" DECIMAL(15, 3) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "scrap_quantity" DECIMAL(15, 3) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "scrap_reason" TEXT;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "yield_percentage" DECIMAL(6, 2) DEFAULT 100;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_start_reading" DECIMAL(12, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_end_reading" DECIMAL(12, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_units_kwh" DECIMAL(12, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_rate_per_unit" DECIMAL(10, 2) DEFAULT 8.50;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "eb_total_cost" DECIMAL(12, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "labour_total_cost" DECIMAL(12, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "completed_by" VARCHAR(150);`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3);`,

    // 4. Unique Index on batch_no (ignoring nulls and deleted records)
    `CREATE UNIQUE INDEX IF NOT EXISTS "idx_production_batches_batch_no_unique" 
     ON "production_batches"("batch_no") WHERE "deleted_at" IS NULL AND "batch_no" IS NOT NULL;`,

    // 5. Index for quick sequence lookups
    `CREATE INDEX IF NOT EXISTS "idx_batch_seq_lookup" ON "batch_sequences"("product_id", "sequence_key");`,

    // 6. Production Labour Logs Table
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

    // 7. Production Machine Logs Table
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

    // 8. Production Utility Logs Table
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

    // 9. Production Output Details Table
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

    // 10. Production Barcode Labels Table
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

    // 11. Production Batch Costing Table
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

    // Indices for foreign keys
    `CREATE INDEX IF NOT EXISTS "idx_labour_batch" ON "production_labour_logs"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_machine_batch" ON "production_machine_logs"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_utility_batch" ON "production_utility_logs"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_output_batch" ON "production_output_details"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_label_batch" ON "production_barcode_labels"("batch_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_costing_batch" ON "production_batch_costing"("batch_id");`
  ];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      console.error('Migration statement error:', err.message);
    }
  }

  console.log('=== Full Production Module Schema Migration Completed Successfully ===');
}

migrateProductionModuleSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration fatal error:', err);
    process.exit(1);
  });
