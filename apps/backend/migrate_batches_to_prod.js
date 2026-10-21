const prisma = require('./src/database/prisma');

async function migrateLegacyBatches() {
  console.log('--- Migrating legacy MP- batches to PRODYYYYMMDD-XXXX format ---');

  const batches = await prisma.productionBatchNew.findMany({
    where: {
      referenceNo: { startsWith: 'MP-' }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${batches.length} batches with legacy MP- referenceNo.`);

  // Track per-day sequence counters
  const dayCounters = {};

  for (const b of batches) {
    const d = b.startDate ? new Date(b.startDate) : (b.createdAt ? new Date(b.createdAt) : new Date());
    const validDate = isNaN(d.getTime()) ? new Date() : d;

    const year = validDate.getFullYear().toString();
    const month = String(validDate.getMonth() + 1).padStart(2, '0');
    const day = String(validDate.getDate()).padStart(2, '0');
    const datePrefix = `PROD${year}${month}${day}`;

    // Get current max sequence for this day in DB
    if (!dayCounters[datePrefix]) {
      const existingToday = await prisma.productionBatchNew.findMany({
        where: { referenceNo: { startsWith: `${datePrefix}-` } },
        select: { referenceNo: true }
      });
      let maxSeq = 0;
      existingToday.forEach(e => {
        const parts = e.referenceNo.split('-');
        if (parts[1]) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      dayCounters[datePrefix] = maxSeq;
    }

    dayCounters[datePrefix] += 1;
    const newRefNo = `${datePrefix}-${String(dayCounters[datePrefix]).padStart(4, '0')}`;
    const oldRefNo = b.referenceNo;

    console.log(`Migrating batch ${b.id}: ${oldRefNo} -> ${newRefNo} (Date: ${year}-${month}-${day})`);

    // Update production_batches
    await prisma.productionBatchNew.update({
      where: { id: b.id },
      data: { referenceNo: newRefNo }
    });

    // Update any ProductStockMovement references
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "product_stock_movements" SET reference_no = $1 WHERE reference_no = $2`,
        newRefNo,
        oldRefNo
      );
    } catch (_) {}

    // Update any specifications.lastBatchReference
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "finished_products" SET specifications = jsonb_set(specifications, '{lastBatchReference}', $1::jsonb) WHERE specifications->>'lastBatchReference' = $2`,
        JSON.stringify(newRefNo),
        oldRefNo
      );
    } catch (_) {}
  }

  console.log('--- Migration Completed Successfully ---');

  // Print all batches now
  const allBatches = await prisma.productionBatchNew.findMany({
    select: { id: true, referenceNo: true, batchNo: true, productionType: true, status: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\nCurrent Batches in DB:');
  allBatches.forEach(b => {
    console.log(`[${b.productionType}] ref: ${b.referenceNo} | batchNo: ${b.batchNo} | status: ${b.status}`);
  });
}

migrateLegacyBatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
