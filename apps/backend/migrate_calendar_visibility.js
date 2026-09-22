const prisma = require('./src/database/prisma');

async function migrate() {
  try {
    console.log('Migrating OperationsCalendarEvent table to include allowedRoles, creatorName, creatorRole...');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OperationsCalendarEvent"
      ADD COLUMN IF NOT EXISTS "allowedRoles" JSONB DEFAULT '["ALL"]'::jsonb,
      ADD COLUMN IF NOT EXISTS "creatorName" VARCHAR(255) DEFAULT 'System User',
      ADD COLUMN IF NOT EXISTS "creatorRole" VARCHAR(100) DEFAULT 'SUPERVISOR';
    `);

    console.log('Columns added successfully.');

    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'OperationsCalendarEvent'
    `);
    console.log('Updated columns:', cols);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
