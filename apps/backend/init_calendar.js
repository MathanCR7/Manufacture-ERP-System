const prisma = require('./src/database/prisma');

async function init() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OperationsCalendarEvent" (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date VARCHAR(20) NOT NULL,
        time VARCHAR(20),
        priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
        note TEXT,
        notified BOOLEAN NOT NULL DEFAULT false,
        "createdBy" VARCHAR(100),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('OperationsCalendarEvent table exists and ready in PostgreSQL.');
    const count = await prisma.$queryRawUnsafe('SELECT count(*)::int as count FROM "OperationsCalendarEvent";');
    console.log('Row count:', count);
  } catch (err) {
    console.error('Init table error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

init();
