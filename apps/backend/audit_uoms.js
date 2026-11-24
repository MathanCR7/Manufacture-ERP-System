const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const oldBatch = await p.productionBatch.findMany({
    where: {
      OR: [
        { batchNumber: { contains: '20260823' } },
        { batchCode: { contains: '20260823' } }
      ]
    }
  }).catch(() => []);
  console.log('Old ProductionBatch:', oldBatch);

  // Search in database directly using raw query
  const rawMatches = await p.$queryRawUnsafe(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND data_type IN ('text', 'character varying');
  `);

  console.log('Total text columns:', rawMatches.length);

  for (const col of rawMatches) {
    try {
      const q = `SELECT "${col.column_name}" FROM "${col.table_name}" WHERE "${col.column_name}"::text LIKE '%20260823%' LIMIT 1;`;
      const res = await p.$queryRawUnsafe(q);
      if (res && res.length > 0) {
        console.log(`Found in ${col.table_name}.${col.column_name}:`, res[0]);
      }
    } catch (_) {}
  }

  await p.$disconnect();
}

run().catch(e => console.error(e));
