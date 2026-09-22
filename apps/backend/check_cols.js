const prisma = require('./src/database/prisma');

async function check() {
  try {
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'OperationsCalendarEvent'
    `);
    console.log('Columns:', cols);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
