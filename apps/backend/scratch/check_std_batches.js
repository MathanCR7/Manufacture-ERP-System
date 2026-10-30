const prisma = require('../src/database/prisma');

async function checkTables() {
  try {
    const stdBatches = await prisma.$queryRawUnsafe(`
      SELECT id, reference_no, production_type, status FROM production_batches WHERE production_type = 'STANDARD'
    `);
    console.log(`Found ${stdBatches.length} STANDARD batches in production_batches.`);

    try {
      const prods = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM productions`);
      console.log('Legacy productions table count:', prods[0].count);
    } catch (_) {
      console.log('No legacy productions table.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
