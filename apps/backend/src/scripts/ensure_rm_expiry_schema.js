const prisma = require('../database/prisma');

async function ensureSchema() {
  console.log('Ensuring schema updates for RM Batch Expiry and Wastage tracking...');

  const queries = [
    // RMWasteItem columns
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "batchId" TEXT;`,
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "batchNumber" TEXT;`,
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "mfgBatchNo" TEXT;`,
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "mfgDate" TIMESTAMP(3);`,
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);`,
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "weight" TEXT;`,
    `ALTER TABLE "RMWasteItem" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`,

    // InventoryBatch columns
    `ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "wastedQty" DECIMAL(65,30) NOT NULL DEFAULT 0;`,
    `ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "weight" TEXT;`,
    `ALTER TABLE "InventoryBatch" ADD COLUMN IF NOT EXISTS "mfgBatchNo" TEXT;`,

    // GRNReceiveItem columns
    `ALTER TABLE "GRNReceiveItem" ADD COLUMN IF NOT EXISTS "weight" TEXT;`,
    `ALTER TABLE "GRNReceiveItem" ADD COLUMN IF NOT EXISTS "mfgBatchNo" TEXT;`,
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log('Executed:', q);
    } catch (err) {
      console.error('Query error:', q, err.message);
    }
  }

  console.log('Schema verification complete!');
  process.exit(0);
}

ensureSchema().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
