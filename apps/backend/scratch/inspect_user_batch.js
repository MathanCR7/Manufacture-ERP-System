const prisma = require('../src/database/prisma');

async function inspectUserBatch() {
  const id = '917dc6b8-6b32-4bbd-b098-d5c8b7c074ac';
  try {
    const b = await prisma.$queryRawUnsafe(`SELECT * FROM production_batches WHERE id = $1`, id);
    console.log('Batch row:', b);

    const rmLines = await prisma.$queryRawUnsafe(`SELECT * FROM production_batch_rm_line WHERE batch_id = $1`, id);
    console.log('RM Lines:', rmLines);

    const usages = await prisma.$queryRawUnsafe(`SELECT * FROM production_batch_rm_usage WHERE batch_id = $1`, id);
    console.log('RM Usages:', usages);

    const allocs = await prisma.$queryRawUnsafe(`SELECT * FROM production_batch_allocations WHERE batch_id = $1`, id);
    console.log('Allocations in production_batch_allocations:', allocs);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

inspectUserBatch();
