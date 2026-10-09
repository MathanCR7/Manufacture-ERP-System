const prisma = require('../database/prisma');

async function backfillExistingBatches() {
  console.log('Backfilling weight, mfgBatchNo, and expiryDate for existing InventoryBatches...');

  const batches = await prisma.inventoryBatch.findMany({
    include: {
      po: true,
      grn: { include: { items: true, labTest: { include: { testResults: true } } } }
    }
  });

  for (const b of batches) {
    const updateData = {};

    // 1. Check GRN item
    const grnItem = b.grn?.items?.find(i => i.batchNumber === b.batchNumber || i.rmId === b.rawMaterialId);
    if (grnItem) {
      if (!b.weight && grnItem.weight) updateData.weight = grnItem.weight;
      if (!b.mfgBatchNo && grnItem.mfgBatchNo) updateData.mfgBatchNo = grnItem.mfgBatchNo;
      if (!b.expiryDate && grnItem.expiryDate) updateData.expiryDate = grnItem.expiryDate;
      if (!b.mfgDate && grnItem.mfgDate) updateData.mfgDate = grnItem.mfgDate;
    }

    // 2. Check Lab Test Result
    const labResult = b.grn?.labTest?.testResults?.find(tr => tr.grnItemId === grnItem?.id || tr.rmId === b.rawMaterialId);
    if (labResult?.expiryDate) {
      updateData.expiryDate = labResult.expiryDate;
    }

    // 3. Check PO items JSON
    if (b.po && Array.isArray(b.po.items)) {
      for (const it of b.po.items) {
        if (Array.isArray(it.batches)) {
          const matchingSb = it.batches.find(sb => sb.batchNumber === b.batchNumber);
          if (matchingSb) {
            if (!b.weight && !updateData.weight && matchingSb.weight) updateData.weight = matchingSb.weight;
            if (!b.mfgBatchNo && !updateData.mfgBatchNo && matchingSb.mfgBatchNo) updateData.mfgBatchNo = matchingSb.mfgBatchNo;
            if (!b.expiryDate && !updateData.expiryDate && matchingSb.expDate) {
              const d = new Date(matchingSb.expDate);
              if (!isNaN(d.getTime())) updateData.expiryDate = d;
            }
            if (!b.mfgDate && !updateData.mfgDate && matchingSb.mfgDate) {
              const d = new Date(matchingSb.mfgDate);
              if (!isNaN(d.getTime())) updateData.mfgDate = d;
            }
          }
        }
        if (!updateData.weight && it.weight) updateData.weight = it.weight;
        if (!updateData.mfgBatchNo && it.mfgBatchNo) updateData.mfgBatchNo = it.mfgBatchNo;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.inventoryBatch.update({
        where: { id: b.id },
        data: updateData
      });
      console.log(`Updated batch ${b.batchNumber}:`, updateData);
    }
  }

  console.log('Backfill complete!');
  process.exit(0);
}

backfillExistingBatches().catch(e => {
  console.error(e);
  process.exit(1);
});
