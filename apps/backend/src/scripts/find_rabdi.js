const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function search() {
  const rms = await prisma.rawMaterial.findMany({
    where: { name: { contains: 'RABDI', mode: 'insensitive' } }
  });
  console.log('RMs:', rms.map(r => ({ id: r.id, name: r.name, code: r.code, uom: r.uom, currentStock: r.currentStock })));

  const batches = await prisma.$queryRawUnsafe(`
    SELECT id, raw_material_id, batch_number, internal_batch_no, po_number, grn_number, supplier_batch_no, available_qty, net_qty, unit_cost, po_rate, expiry_date
    FROM inventory_batches 
    WHERE batch_number ILIKE '%RABDI%' OR internal_batch_no ILIKE '%RABDI%';
  `);
  console.log('Inventory Batches:', batches);

  const prodBatches = await prisma.$queryRawUnsafe(`
    SELECT id, batch_number, status, product_yields, mould_allocations
    FROM production_batches
    WHERE batch_number = 'PROD20260823-0001' OR status = 'IN_PROGRESS'
    ORDER BY created_at DESC LIMIT 3;
  `);
  console.log('Production Batches:');
  for (const pb of prodBatches) {
    console.log(`ID: ${pb.id}, Batch: ${pb.batch_number}, Status: ${pb.status}`);
    console.log('mould_allocations:', JSON.stringify(pb.mould_allocations, null, 2));
  }

  await prisma.$disconnect();
}
search().catch(console.error);
