const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('[Migration] Ensuring ExpenseCategory table and Expense columns...');

  // 1. Create ExpenseCategory table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT UNIQUE,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('[Migration] Ensured ExpenseCategory table exists.');

  // 2. Add columns to Expense table
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Expense" 
    ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
    ADD COLUMN IF NOT EXISTS "attachments" TEXT;
  `);
  console.log('[Migration] Ensured Expense table has categoryId and attachments columns.');

  // 3. Create index on Expense.categoryId
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Expense_categoryId_idx" ON "Expense"("categoryId");
  `);

  const countRes = await prisma.$queryRawUnsafe(`SELECT count(*)::int as cnt FROM "ExpenseCategory"`).catch(() => [{ cnt: 0 }]);
  const existingCount = countRes[0]?.cnt || 0;
  if (existingCount === 0) {
    console.log('[Migration] Seeding initial Expense Master categories...');
    const defaults = [
      { code: 'EXP-RM', name: 'Raw Materials', description: 'Raw materials, ingredients, and processing inputs', status: 'ACTIVE' },
      { code: 'EXP-SAL', name: 'Salaries & Labour', description: 'Staff salaries, overtime, and contract labour payments', status: 'ACTIVE' },
      { code: 'EXP-UTL', name: 'Utilities & Bills', description: 'Electricity, water, gas, and power bills', status: 'ACTIVE' },
      { code: 'EXP-MNT', name: 'Repairs & Maintenance', description: 'Factory machinery, equipment, and facility repairs', status: 'ACTIVE' },
      { code: 'EXP-LOG', name: 'Logistics & Transport', description: 'Freight, vehicle fuel, dispatch, and courier costs', status: 'ACTIVE' },
      { code: 'EXP-OFF', name: 'Office Supplies', description: 'Stationery, printing, pantry, and consumable items', status: 'ACTIVE' },
      { code: 'EXP-MKT', name: 'Marketing & Sales', description: 'Advertising, promotion, client meetings, and sales expenses', status: 'ACTIVE' },
      { code: 'EXP-TAX', name: 'Taxes & Fees', description: 'Licensing, local taxes, professional fees, and compliance', status: 'ACTIVE' },
      { code: 'EXP-OTH', name: 'Other Expenditures', description: 'Miscellaneous and general contingency expenses', status: 'ACTIVE' },
    ];

    for (const cat of defaults) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ExpenseCategory" ("id", "code", "name", "description", "status", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${cat.code}', '${cat.name}', '${cat.description}', '${cat.status}', NOW(), NOW())
        ON CONFLICT ("code") DO NOTHING;
      `);
    }
    console.log('[Migration] Seeded default Expense Master categories successfully.');
  }

  // 5. Backfill categoryId on existing Expense records matching category name or code
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Expense" e
      SET "categoryId" = c."id"
      FROM "ExpenseCategory" c
      WHERE e."categoryId" IS NULL AND (
        UPPER(TRIM(e."category")) = UPPER(TRIM(c."name")) OR
        UPPER(TRIM(e."category")) = UPPER(TRIM(c."code")) OR
        REPLACE(UPPER(TRIM(e."category")), ' ', '_') = REPLACE(UPPER(TRIM(c."name")), ' ', '_')
      );
    `);
    console.log('[Migration] Backfilled categoryId on matching existing expenses.');
  } catch (err) {
    console.warn('[Migration] Note on backfilling categoryId:', err.message);
  }

  console.log('[Migration] All Expense Master schema migrations completed successfully.');
}

migrate()
  .catch(err => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
