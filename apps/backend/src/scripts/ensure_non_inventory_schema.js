const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('Ensuring NonInventoryItem columns for Alternate UOM & metadata...');
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "NonInventoryItem" 
    ADD COLUMN IF NOT EXISTS "hasAlternateUom" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "alternateUom" TEXT,
    ADD COLUMN IF NOT EXISTS "baseUomQty" DECIMAL(15,4) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS "alternateUomQty" DECIMAL(15,4) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(15,4) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS "consumptionUnit" TEXT,
    ADD COLUMN IF NOT EXISTS "hsnCode" TEXT,
    ADD COLUMN IF NOT EXISTS "description" TEXT;
  `);

  console.log('Successfully updated NonInventoryItem columns.');
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
