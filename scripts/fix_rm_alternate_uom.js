const path = require('path');
const backendNodeModules = path.resolve(__dirname, '../apps/backend/node_modules');
const dotenv = require(path.join(backendNodeModules, 'dotenv'));
const { PrismaClient } = require(path.join(backendNodeModules, '@prisma/client'));
dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });
const prisma = new PrismaClient();

async function run() {
  console.log('--- Inspecting & Upgrading Raw Materials Alternate UOM via SQL ---');
  
  // 1. Update all kg raw materials
  const resKg = await prisma.$executeRawUnsafe(`
    UPDATE "RawMaterial"
    SET 
      "hasAlternateUom" = true,
      "alternateUom" = 'gm',
      "conversionFactor" = 1000,
      "baseUomQty" = 1,
      "alternateUomQty" = 1000
    WHERE LOWER("unitId") IN ('kg', 'kgs', 'kilogram', 'kilograms')
      AND ("hasAlternateUom" IS NOT TRUE OR "alternateUom" IS NULL OR "conversionFactor" <= 1);
  `);
  console.log('Updated kg materials count:', resKg);

  // 2. Update all liter raw materials
  const resLtr = await prisma.$executeRawUnsafe(`
    UPDATE "RawMaterial"
    SET 
      "hasAlternateUom" = true,
      "alternateUom" = 'ml',
      "conversionFactor" = 1000,
      "baseUomQty" = 1,
      "alternateUomQty" = 1000
    WHERE LOWER("unitId") IN ('liter', 'ltr', 'l', 'litre', 'litres', 'liters')
      AND ("hasAlternateUom" IS NOT TRUE OR "alternateUom" IS NULL OR "conversionFactor" <= 1);
  `);
  console.log('Updated liter materials count:', resLtr);

  // 3. Verify RM-00078 and RM-00079
  const rms = await prisma.$queryRawUnsafe(`
    SELECT code, name, "unitId", "hasAlternateUom", "alternateUom", "conversionFactor"
    FROM "RawMaterial"
    WHERE code IN ('RM-00078', 'RM-00079');
  `);
  console.log('Verified RM-00078 and RM-00079:', rms);

  await prisma.$disconnect();
}

run().catch(console.error);
