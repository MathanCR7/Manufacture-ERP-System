const prisma = require('../database/prisma');

/**
 * Migration Script: Upgrades legacy truncated batch numbers (e.g. BATCH-PACKINGR-001)
 * to full descriptive, independent batch numbers (e.g. BATCH-PACKINGROLL170MM-001 and BATCH-PACKINGROLL130MM-001).
 *
 * Safe & Non-Destructive:
 * - Does NOT change quantities, dates, or inventory links.
 * - Updates InventoryBatch, GRNReceiveItem, and RawMaterialPO.items JSON.
 */
async function migrateLegacyBatches(dryRun = false) {
  console.log(`\n======================================================`);
  console.log(`📦 BATCH NUMBER MODERNIZATION SCRIPT (Dry Run: ${dryRun})`);
  console.log(`======================================================\n`);

  // Fetch all inventory batches in chronological order
  const batches = await prisma.inventoryBatch.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${batches.length} total inventory batches to check.\n`);

  // Track sequences per unique raw material clean name
  // Map: cleanName -> { seqCounter, baseMap: { oldBaseBatch -> newBaseBatch } }
  const materialSeqMap = new Map();
  const batchRenameMap = new Map(); // oldBatchNumber -> newBatchNumber

  for (const b of batches) {
    const rawName = b.rawMaterialName || '';
    const cleanFull = (rawName || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    const oldShort = cleanFull.slice(0, 8);

    // Extract sub-batch suffix (e.g. "-A", "-B") if present
    const subMatch = b.batchNumber.match(/-([A-Z])$/);
    const subSuffix = subMatch ? `-${subMatch[1]}` : '';
    const oldBaseBatch = b.batchNumber.replace(/-[A-Z]$/, '');

    // Check if this batch used the old truncated prefix or needs upgrading
    const isOldTruncated = cleanFull.length > 8 && (
      oldBaseBatch.startsWith(`BATCH-${oldShort}-`) ||
      oldBaseBatch.startsWith(`BATCH-${oldShort}`)
    );

    if (isOldTruncated) {
      if (!materialSeqMap.has(cleanFull)) {
        materialSeqMap.set(cleanFull, { counter: 0, baseMap: new Map() });
      }
      const matInfo = materialSeqMap.get(cleanFull);

      let newBaseBatch;
      if (matInfo.baseMap.has(oldBaseBatch)) {
        newBaseBatch = matInfo.baseMap.get(oldBaseBatch);
      } else {
        matInfo.counter++;
        newBaseBatch = `BATCH-${cleanFull}-${String(matInfo.counter).padStart(3, '0')}`;
        matInfo.baseMap.set(oldBaseBatch, newBaseBatch);
      }

      const newBatchNumber = `${newBaseBatch}${subSuffix}`;

      if (newBatchNumber !== b.batchNumber) {
        batchRenameMap.set(b.id, {
          batch: b,
          oldBatchNumber: b.batchNumber,
          newBatchNumber,
          rawName,
        });
      }
    }
  }

  console.log(`Batches to modernize: ${batchRenameMap.size}\n`);

  let updatedCount = 0;
  for (const [id, item] of batchRenameMap.entries()) {
    console.log(`[RENAME] ${item.rawName}`);
    console.log(`   ${item.oldBatchNumber}  -->  ${item.newBatchNumber}`);

    if (!dryRun) {
      // 1. Update InventoryBatch
      await prisma.inventoryBatch.update({
        where: { id },
        data: { batchNumber: item.newBatchNumber }
      });

      // 2. Update GRNReceiveItem if linked
      await prisma.gRNReceiveItem.updateMany({
        where: { batchNumber: item.oldBatchNumber },
        data: { batchNumber: item.newBatchNumber }
      });

      // 3. Update RawMaterialPO items JSON if linked
      if (item.batch.poId) {
        const po = await prisma.rawMaterialPO.findUnique({ where: { id: item.batch.poId } });
        if (po && Array.isArray(po.items)) {
          const updatedItems = po.items.map(it => {
            let itCopy = { ...it };
            if (itCopy.batchNumber === item.oldBatchNumber) {
              itCopy.batchNumber = item.newBatchNumber;
            }
            if (itCopy.baseBatchNumber === item.oldBatchNumber.replace(/-[A-Z]$/, '')) {
              itCopy.baseBatchNumber = item.newBatchNumber.replace(/-[A-Z]$/, '');
            }
            if (Array.isArray(itCopy.batches)) {
              itCopy.batches = itCopy.batches.map(subB => {
                if (subB.batchNumber === item.oldBatchNumber) {
                  return { ...subB, batchNumber: item.newBatchNumber };
                }
                return subB;
              });
            }
            return itCopy;
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

  // Also modernize unreceived or active POs
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
  console.log(`✅ COMPLETE: ${updatedCount} inventory batches and ${updatedPoCount} PO records modernized.`);
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
