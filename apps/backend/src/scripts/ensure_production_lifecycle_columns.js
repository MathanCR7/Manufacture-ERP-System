const prisma = require('../database/prisma');

async function inspectAndExtend() {
  try {
    const cols = await prisma.$queryRawUnsafe(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'production_batches' ORDER BY ordinal_position"
    );
    console.log('Columns in production_batches:', cols.map(c => c.column_name));

    // Ensure columns for pause history, started_by, started_at, sop_guide, timeline_stages
    const alterStatements = [
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "started_by" VARCHAR(150);',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "pause_history" JSONB DEFAULT \'[]\'::jsonb;',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "sop_guide" TEXT;',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "timeline_stages" JSONB DEFAULT \'[]\'::jsonb;',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "pause_reason" TEXT;',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cancelled_reason" TEXT;',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cancelled_by" VARCHAR(150);',
      'ALTER TABLE "production_batches" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);'
    ];

    for (const sql of alterStatements) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('Successfully ensured all lifecycle, pause history & timeline stage columns!');

    // Also check products table for default workflow stages
    const prodCols = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('workflow_stages', 'stages')"
    );
    console.log('Product workflow columns:', prodCols.map(c => c.column_name));

    if (prodCols.length === 0) {
      await prisma.$executeRawUnsafe('ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "workflow_stages" JSONB DEFAULT \'[]\'::jsonb;');
      console.log('Added workflow_stages column to products table.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspectAndExtend();
