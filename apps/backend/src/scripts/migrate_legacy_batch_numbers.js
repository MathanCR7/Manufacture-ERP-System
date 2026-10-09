const prisma = require('../database/prisma');

/**
 * Migration Script: Upgrades legacy truncated batch numbers (e.g. BATCH-PACKINGR-001)
 * to full descriptive batch numbers (e.g. BATCH-PACKINGROLL170MM-001).
 *
 * Safe & Non-Destructive:
 * - Does NOT change quantities, dates, or inventory links.
 * - Updates InventoryBatch, GRNReceiveItem, and RawMaterialPO.items JSON.
 */
async function migrateLegacyBatches(dryRun = false) {
  console.log(`\n======================================================`);
  console.log(`📦 BATCH NUMBER MODERNIZATION SCRIPT (Dry Run: ${dryRun})`);
  console.log(`======================================================\n`);

  const batches = await prisma.inventoryBatch.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${batches.length} total inventory batches to check.\n`);
  let updatedCount = 0;

  for (const b of batches) {
    const rawName = b.rawMaterialName || '';
    const cleanFull = rawName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    const oldShort = cleanFull.slice(0, 8);

    if (cleanFull.length > 8 && b.batchNumber.startsWith(`BATCH-${oldShort}-`)) {
      const newBatchNumber = b.batchNumber.replace(`BATCH-${oldShort}-`, `BATCH-${cleanFull}-`);
      console.log(`[RENAME] Batch ${b.id}:`);
      console.log(`   Material: "${rawName}"`);
      console.log(`   Old Batch: ${b.batchNumber}  ->  New Batch: ${newBatchNumber}`);

      if (!dryRun) {
        // 1. Update InventoryBatch
        await prisma.inventoryBatch.update({
          where: { id: b.id },
          data: { batchNumber: newBatchNumber }
        });

        // 2. Update GRNReceiveItem if linked
        await prisma.gRNReceiveItem.updateMany({
          where: { batchNumber: b.batchNumber },
          data: { batchNumber: newBatchNumber }
        });

        // 3. Update RawMaterialPO items JSON if applicable
        if (b.poId) {
          const po = await prisma.rawMaterialPO.findUnique({ where: { id: b.poId } });
          if (po && Array.isArray(po.items)) {
            const updatedItems = po.items.map(it => {
              let changed = false;
              let itemCopy = { ...it };
              if (itemCopy.batchNumber === b.batchNumber) {
                itemCopy.batchNumber = newBatchNumber;
                changed = true;
              }
              if (itemCopy.baseBatchNumber === b.batchNumber || (itemCopy.baseBatchNumber && itemCopy.baseBatchNumber.startsWith(`BATCH-${oldShort}-`))) {
                itemCopy.baseBatchNumber = itemCopy.baseBatchNumber.replace(`BATCH-${oldShort}-`, `BATCH-${cleanFull}-`);
                changed = true;
              }
              if (Array.isArray(itemCopy.batches)) {
                itemCopy.batches = itemCopy.batches.map(subB => {
                  if (subB.batchNumber === b.batchNumber || (subB.batchNumber && subB.batchNumber.startsWith(`BATCH-${oldShort}-`))) {
                    return {
                      ...subB,
                      batchNumber: subB.batchNumber.replace(`BATCH-${oldShort}-`, `BATCH-${cleanFull}-`)
                    };
                  }
                  return subB;
                });
              }
              return itemCopy;
            });

            await prisma.rawMaterialPO.update({
              where: { id: po.id },
              data: { items: updatedItems }
            });
          }
        }
      }
      updatedCount++;
    }
  }

  // Also check all unreceived or active PO items
  const pos = await prisma.rawMaterialPO.findMany({
    where: { status: { in: ['PENDING', 'ORDERED', 'PARTIALLY_RECEIVED', 'APPROVED'] } }
  });

  let updatedPoCount = 0;
  for (const po of pos) {
    if (!Array.isArray(po.items) || po.items.length === 0) continue;
    let poModified = false;
    const updatedItems = po.items.map(it => {
      const cleanFull = (it.name || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
      const oldShort = cleanFull.slice(0, 8);
      if (cleanFull.length > 8) {
        let itCopy = { ...it };
        if (itCopy.batchNumber && itCopy.batchNumber.startsWith(`BATCH-${oldShort}-`)) {
          itCopy.batchNumber = itCopy.batchNumber.replace(`BATCH-${oldShort}-`, `BATCH-${cleanFull}-`);
          poModified = true;
        }
        if (itCopy.baseBatchNumber && itCopy.baseBatchNumber.startsWith(`BATCH-${oldShort}-`)) {
          itCopy.baseBatchNumber = itCopy.baseBatchNumber.replace(`BATCH-${oldShort}-`, `BATCH-${cleanFull}-`);
          poModified = true;
        }
        if (Array.isArray(itCopy.batches)) {
          itCopy.batches = itCopy.batches.map(b => {
            if (b.batchNumber && b.batchNumber.startsWith(`BATCH-${oldShort}-`)) {
              poModified = true;
              return { ...b, batchNumber: b.batchNumber.replace(`BATCH-${oldShort}-`, `BATCH-${cleanFull}-`) };
            }
            return b;
          });
        }
        return itCopy;
      }
      return it;
    });

    if (poModified && !dryRun) {
      await prisma.rawMaterialPO.update({
        where: { id: po.id },
        data: { items: updatedItems }
      });
      console.log(`[PO UPDATED] ${po.referenceNo} batch numbers modernized.`);
      updatedPoCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`✅ COMPLETE: ${updatedCount} inventory batches and ${updatedPoCount} PO records updated.`);
  console.log(`======================================================\n`);
}

const isDryRun = process.argv.includes('--dry-run');
migrateLegacyBatches(isDryRun)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
