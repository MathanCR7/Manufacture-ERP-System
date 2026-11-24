const { PrismaClient } = require('@prisma/client');

const PROD_URL = 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable';

const orderMappings = [
  { id: 'fe65afda-ea70-4205-ad68-8a8811849967', old: 'QT/26-27/0001',    newVal: 'QT0001262710' },
  { id: '9bc54c13-5267-4703-8870-330be9085af3', old: 'SO/26-27/10/0001', newVal: 'SO0001262710' },
  { id: '40ec33af-990e-41a3-828b-b6dd8bafda56', old: 'SO/26-27/10/0002', newVal: 'SO0002262710' },
  { id: '4c506b24-4ff8-4c62-8d23-4513587a80a4', old: 'SO/26-27/10/0003', newVal: 'SO0003262710' },
  { id: 'dd3092d3-0991-428c-a596-c9c3618df131', old: 'QT/26-27/10/0001', newVal: 'QT0002262710' },
  { id: '521301f8-a53b-4fc5-9921-3cac5d78bcc2', old: 'QT/26-27/10/0002', newVal: 'QT0003262710' },
  { id: '6b4335f1-531a-4665-9a83-a9f356e26f91', old: 'QT/26-27/11/0001', newVal: 'QT0001262711' },
  { id: 'c082d1ae-c5a2-44f0-8921-62e4447c5e3c', old: 'QT/26-27/11/0002', newVal: 'QT0002262711' },
  { id: 'c4fd7836-fa40-46b2-8a6a-c2080f4407d6', old: 'SO/26-27/11/0001', newVal: 'SO0001262711' },
  { id: '6508bac0-def4-4143-9ef2-610ebd03f106', old: 'SO/26-27/11/0002', newVal: 'SO0002262711' },
  { id: '83cb715a-98ce-4a60-8663-d4568e4cfdc0', old: 'SO/26-27/11/0003', newVal: 'SO0003262711' },
];

async function migrateDb(dbName, prisma) {
  console.log(`\n==================================================`);
  console.log(`MIGRATING DATABASE: ${dbName}`);
  console.log(`==================================================`);

  const existingOrders = await prisma.customerOrder.findMany({
    select: { id: true, docNo: true, referenceNo: true, type: true, createdAt: true }
  });
  console.log(`Found ${existingOrders.length} orders in ${dbName}.`);

  const existingIds = new Set(existingOrders.map(o => o.id));

  // Execute order updates in a transaction
  await prisma.$transaction(async (tx) => {
    for (const mapping of orderMappings) {
      if (!existingIds.has(mapping.id)) {
        console.log(`  Skipping ${mapping.id} (not present in ${dbName})`);
        continue;
      }

      console.log(`  Updating ${mapping.id}: ${mapping.old} -> ${mapping.newVal}`);
      await tx.customerOrder.update({
        where: { id: mapping.id },
        data: {
          docNo: mapping.newVal,
          referenceNo: mapping.newVal,
          documentSeries: mapping.newVal.startsWith('SO') ? 'SO' : (mapping.newVal.startsWith('QT') ? 'QT' : 'INV')
        }
      });
    }

    // Synchronize document series
    const targetSeries = [
      { type: 'SO', prefix: 'SO', financialYear: '26-27/10', currentNo: 3 },
      { type: 'SO', prefix: 'SO', financialYear: '26-27/11', currentNo: 3 },
      { type: 'QT', prefix: 'QT', financialYear: '26-27/10', currentNo: 3 },
      { type: 'QT', prefix: 'QT', financialYear: '26-27/11', currentNo: 2 },
    ];

    for (const s of targetSeries) {
      const existing = await tx.documentSeries.findUnique({
        where: {
          type_financialYear: {
            type: s.type,
            financialYear: s.financialYear
          }
        }
      });

      if (existing) {
        const nextNo = Math.max(existing.currentNo || 0, s.currentNo);
        await tx.documentSeries.update({
          where: { id: existing.id },
          data: { currentNo: nextNo }
        });
        console.log(`  Updated series ${s.type} [${s.financialYear}] currentNo -> ${nextNo}`);
      } else {
        await tx.documentSeries.create({
          data: s
        });
        console.log(`  Created series ${s.type} [${s.financialYear}] currentNo -> ${s.currentNo}`);
      }
    }
  });

  // Verify updated orders
  const updatedOrders = await prisma.customerOrder.findMany({
    select: { id: true, docNo: true, referenceNo: true, type: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\nVerified orders in ${dbName}:`);
  console.table(updatedOrders.map(o => ({
    id: o.id.slice(0, 8),
    docNo: o.docNo,
    refNo: o.referenceNo,
    type: o.type,
    date: o.createdAt.toISOString().slice(0, 10)
  })));

  const updatedSeries = await prisma.documentSeries.findMany({
    orderBy: [{ type: 'asc' }, { financialYear: 'asc' }]
  });
  console.log(`\nVerified documentSeries in ${dbName}:`);
  console.table(updatedSeries.map(s => ({
    type: s.type,
    financialYear: s.financialYear,
    currentNo: s.currentNo
  })));
}

async function main() {
  const prismaLocal = new PrismaClient();
  const prismaProd = new PrismaClient({
    datasources: { db: { url: PROD_URL } }
  });

  try {
    await migrateDb('LOCAL DATABASE', prismaLocal);
  } catch (err) {
    console.error('Error migrating Local DB:', err);
  }

  try {
    await migrateDb('PRODUCTION LIVE DATABASE', prismaProd);
  } catch (err) {
    console.error('Error migrating Production DB:', err);
  }

  await prismaLocal.$disconnect();
  await prismaProd.$disconnect();
  console.log('\nAll database migrations completed successfully!');
}

main().catch(console.error);
