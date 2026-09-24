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

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

/**
 * Resolve correct UOM UUID for an item batch based on item details, RM master, and PO.
 * Supports passing pre-fetched active UOM list to prevent excessive DB queries during transactions.
 */
async function resolveBatchUomId(item, rm, po, tx = prisma, cachedUoms = null) {
  const uoms = cachedUoms || await tx.uOM.findMany({ where: { isActive: true } });

  // 1. Try matching from poItem in po.items
  let poItem = null;
  if (Array.isArray(po?.items)) {
    poItem = po.items.find(i =>
      i.id === item.rmId ||
      i.rmId === item.rmId ||
      i.code === item.rmId ||
      (i.name && item.rmName && i.name.trim().toLowerCase() === item.rmName.trim().toLowerCase())
    );
  }

  const matchByText = (val) => {
    if (!val) return null;
    const rawVal = typeof val === 'object' ? (val.abbreviation || val.name) : val;
    const trimmed = String(rawVal).trim().toLowerCase();
    if (!trimmed) return null;
    return uoms.find(u => {
      const abbr = (u.abbreviation || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      return abbr === trimmed || name === trimmed ||
        (trimmed === 'l' && (abbr === 'liter' || abbr === 'litre' || name === 'liter')) ||
        (trimmed === 'litre' && (abbr === 'liter' || name === 'liter'));
    });
  };

  // 2. Prioritize looking up UOM by label / abbreviation / unitId from poItem or rm
  const candidateLabel = poItem?.uomLabel || poItem?.uom || item?.uomLabel || rm?.unitId || rm?.consumptionUnit;
  const m1 = matchByText(candidateLabel);
  if (m1) return m1.id;

  // 3. Check if poItem or item has a valid UOM UUID
  const candidateUuid = poItem?.uomId || item?.uomId;
  if (candidateUuid && isUuid(candidateUuid)) {
    const existing = uoms.find(u => u.id === candidateUuid);
    if (existing) return existing.id;
  }

  // 4. Fallback to rm.unitId if rm is found
  if (rm?.unitId) {
    const m2 = matchByText(rm.unitId);
    if (m2) return m2.id;
  }

  // 5. Fallback to po.uomId if available
  if (po?.uomId) {
    const m3 = uoms.find(u => u.id === po.uomId);
    if (m3) return m3.id;
  }

  // 6. Fallback to first active UOM
  return uoms[0]?.id || null;
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
  const existingGrn = await tx.gRNReceive.findFirst({
    where: { poId: po.id },
    include: { items: true, inventoryBatches: true }
  });
  
  if (existingGrn && existingGrn.inventoryBatches && existingGrn.inventoryBatches.length > 0) {
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

  const grnItemsData = [];
  for (const item of parsedItems) {
    const itemRmId = item.rmId || item.code || po.rmId;
    const itemRmName = item.name || item.materialName || po.name;
    const isLabRequired = item.labTestRequired !== false;

    if (Array.isArray(item.batches) && item.batches.length > 0) {
      item.batches.forEach((b, bIdx) => {
        const bQty = Number(b.quantity ?? b.batchQuantity ?? 0);
        if (bQty > 0 || item.batches.length === 1) {
          grnItemsData.push({
            rmId: itemRmId,
            rmName: itemRmName,
            expectedQty: bIdx === 0 ? Number(item.quantity || bQty) : 0,
            actualReceivedQty: bQty,
            batchQuantity: bQty,
            returnQty: 0,
            batchNumber: (b.batchNumber || item.batchNumber || '').trim() || null,
            mfgDate: b.mfgDate ? new Date(b.mfgDate) : (item.mfgDate ? new Date(item.mfgDate) : new Date()),
            expiryDate: b.expDate ? new Date(b.expDate) : (item.expiryDate ? new Date(item.expiryDate) : (item.expDate ? new Date(item.expDate) : null)),
            inspectionStatus: 'ACCEPTED',
            coaRequired: false,
            rejectedQty: 0,
            labTestRequired: isLabRequired,
          });
        }
      });
    } else {
      const qty = Number(item.quantity || po.quantity || 0);
      grnItemsData.push({
        rmId: itemRmId,
        rmName: itemRmName,
        expectedQty: qty,
        actualReceivedQty: qty,
        batchQuantity: qty,
        returnQty: 0,
        batchNumber: (item.batchNumber || '').trim() || null,
        mfgDate: item.mfgDate ? new Date(item.mfgDate) : new Date(),
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : (item.expDate ? new Date(item.expDate) : null),
        inspectionStatus: 'ACCEPTED',
        coaRequired: false,
        rejectedQty: 0,
        labTestRequired: isLabRequired,
      });
    }
  }

  let grn = existingGrn;
  if (!grn) {
    const referenceNo = await generateReferenceNo(tx, 'GRNReceive', 'GRN');
    grn = await tx.gRNReceive.create({
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
  } else if (isAllExempt) {
    grn = await tx.gRNReceive.update({
      where: { id: grn.id },
      data: { status: 'LAB_APPROVED', inventoryStatus: 'UPLOADED', isExempt: true },
      include: { items: true, po: { include: { supplier: true, uom: true } } }
    });
  }

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
        const batchUomId = await resolveBatchUomId(item, rm, po, tx);

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
            uomId: batchUomId,
            storageLocation: null,
            mfgDate: item.mfgDate ? new Date(item.mfgDate) : new Date(),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            status: 'AVAILABLE',
            addedBy: reqUserId,
          }
        });
        console.log(`[PO RECEIVED DIRECT] InventoryBatch ${batchNum} created for ${item.rmName} (+${acceptedQty}) with UOM ${batchUomId}`);
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
  resolveBatchUomId,
};
