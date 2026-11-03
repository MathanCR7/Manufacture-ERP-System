const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function run() {
  const batch = await prisma.$queryRawUnsafe(`
    SELECT id, batch_no, status, product_id, quantity, actual_output, mould_allocations, product_yields
    FROM production_batches
    WHERE batch_no = 'PROD20260823-0001';
  `);
  console.log('Batch PROD20260823-0001:');
  console.log(JSON.stringify(batch, null, 2));

  const rmLines = await prisma.$queryRawUnsafe(`
    SELECT * FROM production_batch_rm_line
    WHERE batch_id = $1;
  `, batch[0].id);
  console.log('RM Lines:', rmLines);

  const allocs = await prisma.$queryRawUnsafe(`
    SELECT * FROM "production_batch_allocations"
    WHERE batch_id = $1;
  `, batch[0].id);
  console.log('Allocations in production_batch_allocations:', allocs);

  const allocSingular = await prisma.$queryRawUnsafe(`
    SELECT * FROM production_batch_allocation
    WHERE batch_id = $1;
  `, batch[0].id);
  console.log('Allocations in production_batch_allocation:', allocSingular);

  await prisma.$disconnect();
}

run().catch(console.error);
