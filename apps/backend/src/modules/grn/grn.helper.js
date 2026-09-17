const prisma = require('../../database/prisma');
const { generateReferenceNo } = require('../../utils/referenceGenerator');

/**
 * Generate sequential batch number per raw material.
 */
async function getNextBatchForRM(rmId, rmName, tx = prisma) {
  const cleanName = (rmName || 'RM')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);

  const invCount = await tx.inventoryBatch.count({
    where: {
      OR: [
        { rawMaterialId: rmId },
        { rawMaterialName: { equals: rmName, mode: 'insensitive' } }
      ]
    }
  });

  const grnCount = await tx.gRNReceiveItem.count({
    where: {
      OR: [
        { rmId: rmId },
        { rmName: { equals: rmName, mode: 'insensitive' } }
      ],
      batchNumber: { not: null }
    }
  });

  const nextSeq = Math.max(invCount, grnCount) + 1;
  const batchNumber = `BATCH-${cleanName || 'RM'}-${String(nextSeq).padStart(3, '0')}`;
  return {
    sequence: nextSeq,
    batchNumber,
    nextBatchNumber: batchNumber,
    batchLabel: `Batch ${nextSeq}`,
  };
}

/**
 * Processes a PO that has status RECEIVED:
 * - If items do not require lab test (labTestRequired === false):
 *     Directly updates raw material inventory stock with a generated batch number.
 * - If items require lab test (labTestRequired === true):
 *     Creates GRN with status PENDING_LAB so it goes directly to the Lab Test queue.
 * - If all items are lab-exempt, marks GRN as LAB_APPROVED, inventoryStatus UPLOADED, and PO as APPROVED.
 */
async function receivePOAndProcess({ po, reqUserId, tx = prisma }) {
  // Check if GRN already exists for this PO
  const existingGrn = await tx.gRNReceive.findFirst({ where: { poId: po.id } });
  if (existingGrn) {
    return { grn: existingGrn, alreadyExists: true };
  }

  // Parse items from PO
  let parsedItems = [];
  if (Array.isArray(po.items) && po.items.length > 0) {
    parsedItems = po.items;
  } else if (po.rmId && po.name) {
    parsedItems = [{
      rmId: po.rmId,
      name: po.name,
      quantity: Number(po.quantity),
      labTestRequired: true
    }];
  }

  const isAllExempt = parsedItems.length > 0 && parsedItems.every(i => i.labTestRequired === false);
  const grnStatus = isAllExempt ? 'LAB_APPROVED' : 'PENDING_LAB';
  const inventoryStatus = isAllExempt ? 'UPLOADED' : 'NOT_UPLOADED';

  const referenceNo = await generateReferenceNo(tx, 'GRNReceive', 'GRN');

  const grnItemsData = parsedItems.map(item => ({
    rmId: item.rmId || item.code || po.rmId,
    rmName: item.name || item.materialName || po.name,
    expectedQty: Number(item.quantity || po.quantity || 0),
    actualReceivedQty: Number(item.quantity || po.quantity || 0),
    returnQty: 0,
    batchNumber: item.batchNumber || null,
    mfgDate: item.mfgDate ? new Date(item.mfgDate) : new Date(),
    expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
    inspectionStatus: 'ACCEPTED',
    coaRequired: false,
    rejectedQty: 0,
    labTestRequired: item.labTestRequired !== false,
  }));

  const grn = await tx.gRNReceive.create({
    data: {
      referenceNo,
      poId: po.id,
      receivedDate: new Date(),
      amountPaid: po.grandTotal ? Number(po.grandTotal) : Number(po.amount || 0),
      refundAmount: 0,
      discrepancyNotes: null,
      receivedBy: reqUserId,
      status: grnStatus,
      inventoryStatus: inventoryStatus,
      isExempt: isAllExempt,
      vehicleNumber: po.vehicleNumber || null,
      transporterName: po.transporterName || null,
      transportMode: po.transportMode || 'ROAD',
      invoiceNumber: po.supplierInvoiceNo || null,
      invoiceDate: po.supplierInvoiceDate ? new Date(po.supplierInvoiceDate) : null,
      isShortDelivery: false,
      items: {
        create: grnItemsData
      }
    },
    include: { items: true, po: { include: { supplier: true, uom: true } } }
  });

  // Direct inventory update for exempt items
  for (const item of grnItemsData) {
    if (item.labTestRequired === false) {
      const acceptedQty = item.actualReceivedQty;
      if (acceptedQty <= 0) continue;

      let rm = await tx.rawMaterial.findFirst({ where: { code: item.rmId } });
      if (!rm && item.rmName) {
        rm = await tx.rawMaterial.findFirst({ where: { name: { equals: item.rmName, mode: 'insensitive' } } });
      }
      if (!rm && po.name) {
        rm = await tx.rawMaterial.findFirst({ where: { name: { equals: po.name, mode: 'insensitive' } } });
      }

      if (rm) {
        // Increment stock
        await tx.rawMaterial.update({
          where: { id: rm.id },
          data: { currentStock: { increment: acceptedQty } }
        });

        // Generate sequential batch number
        let batchNum = item.batchNumber;
        if (!batchNum) {
          const auto = await getNextBatchForRM(item.rmId, item.rmName, tx);
          batchNum = auto.batchNumber;
        }
        const clash = await tx.inventoryBatch.findUnique({ where: { batchNumber: batchNum } });
        if (clash) {
          batchNum = `${batchNum}-${Date.now().toString().slice(-4)}`;
        }

        const category = await tx.rMCategory.findUnique({ where: { id: rm.categoryId } });

        await tx.inventoryBatch.create({
          data: {
            batchNumber: batchNum,
            poId: po.id,
            grnId: grn.id,
            rawMaterialId: rm.id,
            rawMaterialName: item.rmName || rm.name,
            rmCategory: category?.name || null,
            supplierId: po.supplierId || null,
            receivedQty: item.actualReceivedQty,
            sampleQty: 0,
            netQty: acceptedQty,
            uomId: po.uomId,
            storageLocation: null,
            mfgDate: item.mfgDate ? new Date(item.mfgDate) : new Date(),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            status: 'AVAILABLE',
            addedBy: reqUserId,
          }
        });
        console.log(`[PO RECEIVED DIRECT] InventoryBatch ${batchNum} created for ${item.rmName} (+${acceptedQty})`);
      }
    }
  }

  // Update PO status to APPROVED if all exempt, otherwise keep RECEIVED
  const finalPoStatus = isAllExempt ? 'APPROVED' : 'RECEIVED';
  await tx.rawMaterialPO.update({
    where: { id: po.id },
    data: { status: finalPoStatus }
  });

  return { grn, isAllExempt, finalPoStatus };
}

module.exports = {
  getNextBatchForRM,
  receivePOAndProcess,
};
