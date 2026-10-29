const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const migrationStatements = [
  // 1. Extend "RawMaterial" with density and evaporation defaults
  `ALTER TABLE "RawMaterial" ADD COLUMN IF NOT EXISTS density_g_per_ml NUMERIC(8,4) DEFAULT 1.0000;`,
  `ALTER TABLE "RawMaterial" ADD COLUMN IF NOT EXISTS evaporates_by_default BOOLEAN DEFAULT FALSE;`,

  // 2. Add positive density constraint if not exists
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_raw_material_density_positive'
    ) THEN
      ALTER TABLE "RawMaterial" 
        ADD CONSTRAINT chk_raw_material_density_positive CHECK (density_g_per_ml > 0);
    END IF;
  END $$;`,

  // 3. Create raw_material view for query compatibility
  `CREATE OR REPLACE VIEW raw_material AS 
  SELECT 
    id, 
    name, 
    code, 
    "consumptionUnit" AS uom, 
    "currentStock" AS current_stock, 
    "ratePerUnit" AS rate_per_unit, 
    density_g_per_ml, 
    evaporates_by_default, 
    "hasAlternateUom" AS has_alternate_uom, 
    "alternateUom" AS alternate_uom, 
    "conversionFactor" AS conversion_factor
  FROM "RawMaterial";`,

  // 4. Enhance ice_cream_moulds table
  `ALTER TABLE ice_cream_moulds ADD COLUMN IF NOT EXISTS tray_length_mm NUMERIC;`,
  `ALTER TABLE ice_cream_moulds ADD COLUMN IF NOT EXISTS tray_width_mm NUMERIC;`,
  `ALTER TABLE ice_cream_moulds ADD COLUMN IF NOT EXISTS tray_height_mm NUMERIC;`,
  `ALTER TABLE ice_cream_moulds ADD COLUMN IF NOT EXISTS dimension_text VARCHAR(255);`,

  // 5. Synchronize tray dimension aliases
  `UPDATE ice_cream_moulds 
   SET 
     tray_length_mm = COALESCE(tray_length_mm, length_mm),
     tray_width_mm = COALESCE(tray_width_mm, width_mm),
     tray_height_mm = COALESCE(tray_height_mm, height_mm);`,

  // 6. Create ice_cream_mould view
  `CREATE OR REPLACE VIEW ice_cream_mould AS 
  SELECT 
    id,
    mould_code,
    mould_name,
    mould_category,
    model_number,
    capacity_ml,
    cavity_count,
    COALESCE(tray_length_mm, length_mm) AS tray_length_mm,
    COALESCE(tray_width_mm, width_mm) AS tray_width_mm,
    COALESCE(tray_height_mm, height_mm) AS tray_height_mm,
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
  FROM ice_cream_moulds;`,

  // 7. Table: production_batch_rm_line
  `CREATE TABLE IF NOT EXISTS production_batch_rm_line (
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
  );`,

  `CREATE INDEX IF NOT EXISTS idx_pb_rm_line_batch_id ON production_batch_rm_line(batch_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pb_rm_line_rm_id ON production_batch_rm_line(raw_material_id);`,

  // 8. Table: production_batch_merge
  `CREATE TABLE IF NOT EXISTS production_batch_merge (
    batch_id TEXT PRIMARY KEY REFERENCES production_batches(id) ON DELETE CASCADE,
    merge_stage VARCHAR(50) NOT NULL DEFAULT 'Before freezing',
    merged_total_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (merged_total_ml >= 0),
    evaporation_pct NUMERIC(6,2) NOT NULL DEFAULT 5.00 CHECK (evaporation_pct >= 0 AND evaporation_pct <= 100),
    evaporation_applied BOOLEAN NOT NULL DEFAULT FALSE,
    evaporated_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (evaporated_ml >= 0),
    mix_after_evap_ml NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (mix_after_evap_ml >= 0),
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );`,

  // 9. Table: production_batch_allocation
  `CREATE TABLE IF NOT EXISTS production_batch_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    product_id TEXT NOT NULL,
    use_mould BOOLEAN NOT NULL DEFAULT FALSE,
    mould_id UUID REFERENCES ice_cream_moulds(id) ON DELETE SET NULL,
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
  );`,

  `CREATE INDEX IF NOT EXISTS idx_pb_alloc_batch_id ON production_batch_allocation(batch_id);`,
  `CREATE INDEX IF NOT EXISTS idx_pb_alloc_product_id ON production_batch_allocation(product_id);`,

  // 10. Seed default evaporation flags for standard raw materials
  `UPDATE "RawMaterial" 
   SET evaporates_by_default = TRUE 
   WHERE LOWER(name) LIKE '%milk%' 
      OR LOWER(name) LIKE '%stabilizer%' 
      OR LOWER(name) LIKE '%smp%' 
      OR LOWER(name) LIKE '%skimmed%' 
      OR LOWER(name) LIKE '%essence%'
      OR LOWER(name) LIKE '%vanilla%'
      OR LOWER(name) LIKE '%rabdi%';`,

  // 11. Grant permissions to application users
  `GRANT ALL PRIVILEGES ON TABLE production_batch_merge TO PUBLIC;`,
  `GRANT ALL PRIVILEGES ON TABLE production_batch_rm_line TO PUBLIC;`,
  `GRANT ALL PRIVILEGES ON TABLE production_batch_allocation TO PUBLIC;`,
  `GRANT ALL PRIVILEGES ON TABLE production_moulds TO PUBLIC;`
];

async function run() {
  console.log('🔄 Executing migration statements in a PostgreSQL transaction...');
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < migrationStatements.length; i++) {
      const stmt = migrationStatements[i];
      await tx.$executeRawUnsafe(stmt);
    }
  });

  console.log('✅ Standard production database schema successfully created and committed!');

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('raw_material', 'ice_cream_mould', 'production_batch_rm_line', 'production_batch_merge', 'production_batch_allocation')
    ORDER BY table_name;
  `);
  console.log('Verified database objects:', tables);
}

run()
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
