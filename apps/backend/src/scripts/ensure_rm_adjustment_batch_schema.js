const prisma = require('../database/prisma');

async function main() {
  console.log('Applying schema updates for RM Stock Adjustment batch allocation...');

  const queries = [
    `ALTER TABLE "InventoryBatch" ALTER COLUMN "poId" DROP NOT NULL;`,
    `ALTER TABLE "InventoryBatch" ALTER COLUMN "grnId" DROP NOT NULL;`,
    `ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "adjustmentId" TEXT;`,
    `ALTER TABLE "RMStockAdjustment" ADD COLUMN IF NOT EXISTS "batches" JSONB;`
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log('Successfully executed:', q);
    } catch (err) {
      console.error('Error executing query:', q, err.message);
    }
  }

  console.log('Schema updates completed!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
