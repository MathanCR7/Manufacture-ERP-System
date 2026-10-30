const prisma = require('../src/database/prisma');

async function m() {
  try {
    const b = await prisma.$queryRawUnsafe(`
      SELECT id, reference_no, production_type, status, created_at 
      FROM production_batches 
      ORDER BY created_at DESC
    `);
    console.log('production_batches count:', b.length);
    console.table(b);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

m();
