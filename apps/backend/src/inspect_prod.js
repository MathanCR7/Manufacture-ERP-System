const { PrismaClient } = require('@prisma/client');

const prodUrl = 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodUrl
    }
  }
});

async function main() {
  console.log('Connecting to Production DB via Prisma Client...');

  // 1. Inspect Raw Materials
  const rms = await prisma.$queryRawUnsafe(`
    SELECT id, code, name, unit_id, consumption_unit, has_alternate_uom, alternate_uom, 
           conversion_factor, base_uom_qty, alternate_uom_qty, current_stock, opening_stock, rate_per_unit
    FROM "raw_materials"
    WHERE code IN ('RM-00001', 'RM-00002', 'RM-00004')
  `);
  console.log('Production RMs:', rms);

  // 2. Inspect Batch 20261015-FP000002-00003
  const batches = await prisma.$queryRawUnsafe(`
    SELECT id, reference_no, batch_no, status, product_id, quantity 
    FROM "production_batches" 
    WHERE batch_no LIKE '%FP000002-00003%' OR reference_no LIKE '%FP000002-00003%' OR reference_no = 'MP-000005'
  `);
  console.log('Batch in Prod:', batches);

  if (batches.length > 0) {
    const batchId = batches[0].id;
    const usages = await prisma.$queryRawUnsafe(`
      SELECT * FROM "production_batch_rm_usage" WHERE batch_id = '${batchId}'
    `);
    console.log('Batch Usages in Prod:', usages);
  }

  // 3. Inspect all usages of RM-00001 in production
  const rm1Usages = await prisma.$queryRawUnsafe(`
    SELECT u.id, u.batch_id, b.batch_no, b.reference_no, b.status, u.required_qty, u.actual_used_qty, u.selected_uom, u.conversion_factor_used, u.input_qty
    FROM "production_batch_rm_usage" u
    JOIN "production_batches" b ON u.batch_id = b.id
    WHERE u.rm_id = (SELECT id FROM "raw_materials" WHERE code = 'RM-00001')
  `);
  console.log('All Usages of RM-00001 in Prod:', rm1Usages);

  // 4. Check all POs & GRNs for RM-00001
  const pos = await prisma.$queryRawUnsafe(`
    SELECT id, reference_no, status, grand_total, quantity
    FROM "raw_material_pos"
    WHERE rm_id = 'RM-00001' OR rm_id = (SELECT id::text FROM "raw_materials" WHERE code = 'RM-00001')
  `);
  console.log('POs in Prod for RM-00001:', pos);
}

main().catch(console.error).finally(() => prisma.$disconnect());
