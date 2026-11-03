const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function run() {
  const pbs = await prisma.$queryRawUnsafe(`
    SELECT id, batch_no, status, mould_allocations
    FROM production_batches
    WHERE mould_allocations::text LIKE '%RABDI%' OR mould_allocations::text LIKE '%OSSORO%';
  `);
  console.log(`Found ${pbs.length} production batches with RABDI:`);
  for (const b of pbs) {
    console.log(`=== Batch: ${b.batch_no} (${b.id}) ===`);
    console.log(JSON.stringify(b.mould_allocations, null, 2));
  }

  // Also check all In-Progress batches
  const inProg = await prisma.$queryRawUnsafe(`
    SELECT id, batch_no, status, mould_allocations
    FROM production_batches
    WHERE status ILIKE '%progress%'
    ORDER BY created_at DESC LIMIT 5;
  `);
  console.log(`Found ${inProg.length} in-progress batches:`);
  for (const b of inProg) {
    console.log(`=== Batch: ${b.batch_no} (${b.id}) ===`);
    console.log(JSON.stringify(b.mould_allocations, null, 2));
  }

  await prisma.$disconnect();
}

run().catch(console.error);
