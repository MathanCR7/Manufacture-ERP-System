const { PrismaClient } = require('@prisma/client');

const PROD_URL = 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable';

async function updateDbExpenses(dbName, prisma) {
  console.log(`\n==================================================`);
  console.log(`UPDATING EXPENSES IN: ${dbName}`);
  console.log(`==================================================`);

  const allExpenses = await prisma.expense.findMany({
    select: { id: true, expenseNumber: true, title: true, category: true, amount: true, date: true },
    orderBy: { date: 'asc' }
  });

  console.log(`Total expenses found: ${allExpenses.length}`);

  let updatedCount = 0;
  for (const exp of allExpenses) {
    const originalTitle = exp.title || '';
    const upperTitle = originalTitle.trim().toUpperCase();

    if (originalTitle !== upperTitle) {
      console.log(`  Updating ID: ${exp.id.slice(0, 8)} [${exp.expenseNumber || 'NO_NUM'}]`);
      console.log(`    Before: "${originalTitle}"`);
      console.log(`    After:  "${upperTitle}"`);

      await prisma.expense.update({
        where: { id: exp.id },
        data: { title: upperTitle }
      });
      updatedCount++;
    } else {
      console.log(`  Already uppercase: ${exp.id.slice(0, 8)} [${exp.expenseNumber || 'NO_NUM'}] -> "${originalTitle}"`);
    }
  }

  console.log(`Successfully converted ${updatedCount} expenses to UPPERCASE in ${dbName}.`);

  // Verification query
  const verifiedExpenses = await prisma.expense.findMany({
    select: { id: true, expenseNumber: true, title: true, category: true, amount: true, date: true },
    orderBy: { date: 'asc' }
  });

  console.log(`\nVerified Expenses in ${dbName}:`);
  console.table(verifiedExpenses.map(e => ({
    id: e.id.slice(0, 8),
    num: e.expenseNumber,
    title: e.title,
    category: e.category,
    amount: String(e.amount)
  })));
}

async function main() {
  const prismaLocal = new PrismaClient();
  const prismaProd = new PrismaClient({
    datasources: { db: { url: PROD_URL } }
  });

  try {
    await updateDbExpenses('LOCAL DATABASE', prismaLocal);
  } catch (err) {
    console.error('Error on Local DB:', err);
  }

  try {
    await updateDbExpenses('PRODUCTION LIVE DATABASE', prismaProd);
  } catch (err) {
    console.error('Error on Production DB:', err);
  }

  await prismaLocal.$disconnect();
  await prismaProd.$disconnect();
  console.log('\nAll expense migrations to UPPERCASE completed successfully!');
}

main().catch(console.error);
