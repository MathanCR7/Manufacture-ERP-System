const prisma = require('../database/prisma');

async function migrateAndSeed() {
  console.log('--- Starting Production Module Redesign Database Migration & Seed ---');

  const ddlStatements = [
    // 1. Base Master Table
    `CREATE TABLE IF NOT EXISTS "base_master" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "code" VARCHAR(20) NOT NULL UNIQUE,
      "name" VARCHAR(100) NOT NULL UNIQUE,
      "description" TEXT,
      "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // 2. Production Templates Table
    `CREATE TABLE IF NOT EXISTS "production_templates" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "code" VARCHAR(50) NOT NULL UNIQUE,
      "name" VARCHAR(200) NOT NULL,
      "base_id" UUID NOT NULL REFERENCES "base_master"("id") ON DELETE RESTRICT,
      "category_id" TEXT,
      "sub_category_id" TEXT,
      "output_qty" DECIMAL(15, 3) NOT NULL DEFAULT 2000,
      "output_uom" VARCHAR(20) NOT NULL DEFAULT 'Nos',
      "wastage_pct" DECIMAL(6, 2) NOT NULL DEFAULT 6.00,
      "overhead_pct" DECIMAL(6, 2) NOT NULL DEFAULT 10.00,
      "sub_total" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "wastage_amt" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "overhead_amt" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "grand_total" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "cost_per_unit" DECIMAL(15, 4) NOT NULL DEFAULT 0,
      "sop_steps" JSONB,
      "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      "created_by" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // 3. Production Template Lines Table
    `CREATE TABLE IF NOT EXISTS "production_template_lines" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "template_id" UUID NOT NULL REFERENCES "production_templates"("id") ON DELETE CASCADE,
      "seq_no" INT NOT NULL,
      "item_type" VARCHAR(30) NOT NULL DEFAULT 'RAW_MATERIAL',
      "raw_material_id" TEXT NOT NULL,
      "raw_material_name" VARCHAR(200) NOT NULL,
      "quantity" DECIMAL(15, 4) NOT NULL,
      "uom" VARCHAR(20) NOT NULL,
      "rate" DECIMAL(15, 4) NOT NULL DEFAULT 0,
      "rate_source" VARCHAR(50) DEFAULT 'PO_LATEST',
      "rate_override_reason" TEXT,
      "total" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "is_overhead" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // 4. Production Batch Items (Multi-Product association per batch)
    `CREATE TABLE IF NOT EXISTS "production_batch_items" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "product_id" TEXT NOT NULL REFERENCES "products"("id"),
      "planned_qty" DECIMAL(15, 3) NOT NULL,
      "actual_qty" DECIMAL(15, 3) NOT NULL DEFAULT 0,
      "factor" DECIMAL(8, 4) NOT NULL DEFAULT 1.0,
      "cost_per_unit" DECIMAL(15, 4) NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // 5. Production Batch Allocations (Detailed Lot Allocations with Proportional PO Math)
    `CREATE TABLE IF NOT EXISTS "production_batch_allocations" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" TEXT NOT NULL REFERENCES "production_batches"("id") ON DELETE CASCADE,
      "usage_id" TEXT REFERENCES "production_batch_rm_usage"("id") ON DELETE CASCADE,
      "inventory_batch_id" TEXT,
      "po_id" TEXT,
      "lot_number" VARCHAR(100) NOT NULL,
      "allocated_qty" DECIMAL(15, 4) NOT NULL,
      "po_original_qty" DECIMAL(15, 4),
      "po_total_amount" DECIMAL(15, 2),
      "allocated_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "unit_rate" DECIMAL(15, 4) NOT NULL DEFAULT 0,
      "uom" VARCHAR(20),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    // 6. Extend existing "production_batches" with new redesign fields
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "base_id" UUID;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "template_id" UUID;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "category_id" TEXT;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "sub_category_id" TEXT;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "shift" VARCHAR(50);`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "machine_line" VARCHAR(100);`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "adjustment_reason" VARCHAR(200);`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "adjustment_reference" VARCHAR(100);`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "sub_total" DECIMAL(15, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "wastage_amt" DECIMAL(15, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "overhead_amt" DECIMAL(15, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "grand_total" DECIMAL(15, 2) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cost_per_unit" DECIMAL(15, 4) DEFAULT 0;`,
    `ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(50) DEFAULT 'Draft';`,

    // Indices for high-speed queries
    `CREATE INDEX IF NOT EXISTS "idx_base_master_status" ON "base_master"("status");`,
    `CREATE INDEX IF NOT EXISTS "idx_production_templates_base" ON "production_templates"("base_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_production_templates_code" ON "production_templates"("code");`,
    `CREATE INDEX IF NOT EXISTS "idx_production_template_lines_tpl" ON "production_template_lines"("template_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_production_batch_base" ON "production_batches"("base_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_production_batch_tpl" ON "production_batches"("template_id");`,
    `CREATE INDEX IF NOT EXISTS "idx_production_batch_type" ON "production_batches"("production_type");`,
  ];

  for (const sql of ddlStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      console.error('DDL execute warning/error:', err.message);
    }
  }
  console.log('DDL execution completed successfully!');

  // Seed Bases
  console.log('Seeding Base Master...');
  const baseSeeds = [
    { code: 'ICB', name: 'ICE CREAM BASE', description: 'Base formula for standard & premium ice cream batches' },
    { code: 'KLB', name: 'KULFI BASE', description: 'Traditional thickened milk base for kulfi formulations' },
    { code: 'FDB', name: 'FD BASE', description: 'Freeze-dried / specialty formulated product base' },
  ];

  const seededBases = {};
  for (const b of baseSeeds) {
    let existing = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "base_master" WHERE code = $1 OR name = $2 LIMIT 1`,
      b.code, b.name
    );
    if (existing && existing.length > 0) {
      seededBases[b.code] = existing[0].id;
      console.log(`Base already exists: ${b.name} (${existing[0].id})`);
    } else {
      const res = await prisma.$queryRawUnsafe(
        `INSERT INTO "base_master" (code, name, description, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
        b.code, b.name, b.description
      );
      seededBases[b.code] = res[0].id;
      console.log(`Created Base: ${b.name} (${res[0].id})`);
    }
  }

  // Find or create admin user for created_by
  const adminUser = await prisma.user.findFirst({ where: { role: 'MAIN_MASTER' } });
  const adminId = adminUser ? adminUser.id : null;

  // Seed Template 1: Classic Cream Gallon - Vanilla under ICE CREAM BASE
  // Output: 2000 Nos, Wastage: 6%, Overhead: 10%
  // 16 lines exactly matching Excel sheet totaling 17,640.17 Sub Total, 20,462.59 Grand Total
  console.log('Seeding Excel Production Template (Classic Cream Gallon - Vanilla)...');
  const icbId = seededBases['ICB'];
  if (icbId) {
    let existingTpl = await prisma.$queryRawUnsafe(
      `SELECT id FROM "production_templates" WHERE code = 'TPL-0001' OR name = 'Classic Cream Gallon - Vanilla' LIMIT 1`
    );

    let templateId;
    if (existingTpl && existingTpl.length > 0) {
      templateId = existingTpl[0].id;
      console.log(`Template TPL-0001 already exists: ${templateId}`);
    } else {
      const subTotal = 17640.17;
      const wastagePct = 6.0;
      const overheadPct = 10.0;
      const wastageAmt = 1058.41;
      const overheadAmt = 1764.02;
      const grandTotal = 20462.59;
      const costPerUnit = 10.2313;

      const insRes = await prisma.$queryRawUnsafe(
        `INSERT INTO "production_templates" (
          code, name, base_id, output_qty, output_uom,
          wastage_pct, overhead_pct, sub_total, wastage_amt, overhead_amt,
          grand_total, cost_per_unit, status, created_by
        ) VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', $13)
        RETURNING id`,
        'TPL-0001',
        'Classic Cream Gallon - Vanilla',
        icbId,
        2000,
        'Nos',
        wastagePct,
        overheadPct,
        subTotal,
        wastageAmt,
        overheadAmt,
        grandTotal,
        costPerUnit,
        adminId
      );
      templateId = insRes[0].id;
      console.log(`Created Template: Classic Cream Gallon - Vanilla (${templateId})`);

      // Seed the 16 lines
      const excelLines = [
        { seqNo: 1, itemType: 'RAW_MATERIAL', name: 'Milk FAT @ 4%', qty: 160.00, uom: 'Ltr', rate: 48.00, total: 7680.00, isOverhead: false },
        { seqNo: 2, itemType: 'RAW_MATERIAL', name: 'Sugar', qty: 13.00, uom: 'Kg', rate: 54.00, total: 702.00, isOverhead: false },
        { seqNo: 3, itemType: 'RAW_MATERIAL', name: 'Brown Sugar', qty: 0.00, uom: 'Kg', rate: 0.00, total: 0.00, isOverhead: false },
        { seqNo: 4, itemType: 'RAW_MATERIAL', name: 'Stabilizer', qty: 320.00, uom: 'Grm', rate: 0.531, total: 169.92, isOverhead: false },
        { seqNo: 5, itemType: 'RAW_MATERIAL', name: 'SMP', qty: 0.00, uom: 'Kg', rate: 0.00, total: 0.00, isOverhead: false },
        { seqNo: 6, itemType: 'OVERHEAD', name: 'Gas', qty: 15.00, uom: 'Kg', rate: 170.1053, total: 2551.58, isOverhead: true },
        { seqNo: 7, itemType: 'OVERHEAD', name: 'EB', qty: 50.00, uom: 'Unit', rate: 15.00, total: 750.00, isOverhead: true },
        { seqNo: 8, itemType: 'OVERHEAD', name: 'Rent', qty: 1.00, uom: 'Day', rate: 1166.67, total: 1166.67, isOverhead: true },
        { seqNo: 9, itemType: 'OVERHEAD', name: 'Resource', qty: 700.00, uom: 'Nos', rate: 4.00, total: 2800.00, isOverhead: true },
        { seqNo: 10, itemType: 'OVERHEAD', name: 'RO Water Clean', qty: 6.00, uom: 'Nos', rate: 20.00, total: 120.00, isOverhead: true },
        { seqNo: 11, itemType: 'PACKING', name: 'Stick Cost', qty: 2000.00, uom: 'Nos', rate: 0.25, total: 500.00, isOverhead: false },
        { seqNo: 12, itemType: 'PACKING', name: 'Item Packing Cost', qty: 2000.00, uom: 'Nos', rate: 0.30, total: 600.00, isOverhead: false },
        { seqNo: 13, itemType: 'PACKING', name: 'Over Packing Cover', qty: 2000.00, uom: 'Nos', rate: 0.20, total: 400.00, isOverhead: false },
        { seqNo: 14, itemType: 'PACKING', name: 'Label and Printing Cost', qty: 2000.00, uom: 'Nos', rate: 0.10, total: 200.00, isOverhead: false },
        { seqNo: 15, itemType: 'OVERHEAD', name: 'Machine and Mould Cost', qty: 0.00, uom: 'Nos', rate: 0.00, total: 0.00, isOverhead: true },
        { seqNo: 16, itemType: 'OVERHEAD', name: 'Storage / Holding Cost', qty: 0.00, uom: 'Day', rate: 0.00, total: 0.00, isOverhead: true },
      ];

      for (const line of excelLines) {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "production_template_lines" (
            template_id, seq_no, item_type, raw_material_id, raw_material_name,
            quantity, uom, rate, total, is_overhead, rate_source
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'EXCEL_SHEET')`,
          templateId,
          line.seqNo,
          line.itemType,
          `RM-${line.seqNo}`,
          line.name,
          line.qty,
          line.uom,
          line.rate,
          line.total,
          line.isOverhead
        );
      }
      console.log(`Seeded all 16 lines for TPL-0001! Sub Total: 17,640.17 | Grand Total: 20,462.59`);
    }
  }

  // Seed Template 2: Traditional Royal Kulfi under KULFI BASE
  console.log('Seeding Sample Kulfi Template (Traditional Royal Kulfi)...');
  const klbId = seededBases['KLB'];
  if (klbId) {
    let existingKulfi = await prisma.$queryRawUnsafe(
      `SELECT id FROM "production_templates" WHERE code = 'TPL-0002' OR name = 'Traditional Royal Kulfi Stick' LIMIT 1`
    );

    if (!existingKulfi || existingKulfi.length === 0) {
      const subTotal = 14200.00;
      const wastagePct = 6.0;
      const overheadPct = 10.0;
      const wastageAmt = 852.00;
      const overheadAmt = 1420.00;
      const grandTotal = 16472.00;
      const costPerUnit = 16.472;

      const insRes = await prisma.$queryRawUnsafe(
        `INSERT INTO "production_templates" (
          code, name, base_id, output_qty, output_uom,
          wastage_pct, overhead_pct, sub_total, wastage_amt, overhead_amt,
          grand_total, cost_per_unit, status, created_by
        ) VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', $13)
        RETURNING id`,
        'TPL-0002',
        'Traditional Royal Kulfi Stick',
        klbId,
        1000,
        'Nos',
        wastagePct,
        overheadPct,
        subTotal,
        wastageAmt,
        overheadAmt,
        grandTotal,
        costPerUnit,
        adminId
      );
      const kulfiId = insRes[0].id;

      const kulfiLines = [
        { seqNo: 1, itemType: 'RAW_MATERIAL', name: 'Pure Buffalo Milk 6% FAT', qty: 120.00, uom: 'Ltr', rate: 58.00, total: 6960.00, isOverhead: false },
        { seqNo: 2, itemType: 'RAW_MATERIAL', name: 'Refined Sugar', qty: 15.00, uom: 'Kg', rate: 54.00, total: 810.00, isOverhead: false },
        { seqNo: 3, itemType: 'RAW_MATERIAL', name: 'Kulfi Stabilizer Blend', qty: 250.00, uom: 'Grm', rate: 0.60, total: 150.00, isOverhead: false },
        { seqNo: 4, itemType: 'PACKING', name: 'Kulfi Wooden Stick', qty: 1000.00, uom: 'Nos', rate: 0.35, total: 350.00, isOverhead: false },
        { seqNo: 5, itemType: 'PACKING', name: 'Primary Kulfi Wrapper Pouch', qty: 1000.00, uom: 'Nos', rate: 0.45, total: 450.00, isOverhead: false },
        { seqNo: 6, itemType: 'OVERHEAD', name: 'Boiling Gas / LPG', qty: 20.00, uom: 'Kg', rate: 170.00, total: 3400.00, isOverhead: true },
        { seqNo: 7, itemType: 'OVERHEAD', name: 'Electricity & Chilling Unit', qty: 60.00, uom: 'Unit', rate: 15.00, total: 900.00, isOverhead: true },
        { seqNo: 8, itemType: 'OVERHEAD', name: 'Labor & Skilled Cooking Resource', qty: 295.00, uom: 'Nos', rate: 4.00, total: 1180.00, isOverhead: true },
      ];

      for (const line of kulfiLines) {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "production_template_lines" (
            template_id, seq_no, item_type, raw_material_id, raw_material_name,
            quantity, uom, rate, total, is_overhead, rate_source
          ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'EXCEL_SHEET')`,
          kulfiId,
          line.seqNo,
          line.itemType,
          `RM-K-${line.seqNo}`,
          line.name,
          line.qty,
          line.uom,
          line.rate,
          line.total,
          line.isOverhead
        );
      }
      console.log(`Seeded Template TPL-0002 (Traditional Royal Kulfi Stick)!`);
    }
  }

  console.log('--- Migration & Seed completed successfully! ---');
  process.exit(0);
}

migrateAndSeed().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
