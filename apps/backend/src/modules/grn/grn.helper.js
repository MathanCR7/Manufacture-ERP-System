const prisma = require('../../database/prisma');
const { generateReferenceNo } = require('../../utils/referenceGenerator');

/**
 * Generate sequential batch number per raw material.
 */
async function getNextBatchForRM(rmId, rmName, tx = prisma) {
  const cleanName = (rmName || 'RM')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);

  const invCount = await tx.inventoryBatch.count({
    where: rmId ? {
      OR: [
        { rawMaterialId: rmId },
        { rawMaterialName: { equals: rmName, mode: 'insensitive' } },
        { batchNumber: { startsWith: `BATCH-${cleanName}-` } }
      ]
    } : {
      OR: [
        { rawMaterialName: { equals: rmName, mode: 'insensitive' } },
        { batchNumber: { startsWith: `BATCH-${cleanName}-` } }
      ]
    }
  });

  const grnCount = await tx.gRNReceiveItem.count({
    where: {
      ...(rmId ? {
        OR: [
          { rmId: rmId },
          { rmName: { equals: rmName, mode: 'insensitive' } },
          { batchNumber: { startsWith: `BATCH-${cleanName}-` } }
        ]
      } : {
        OR: [
          { rmName: { equals: rmName, mode: 'insensitive' } },
          { batchNumber: { startsWith: `BATCH-${cleanName}-` } }
        ]
      }),
      batchNumber: { not: null }
    }
  });

  // Also inspect existing batch numbers starting with BATCH-${cleanName}- to find maximum sequence used
  const prefixBatches = await tx.inventoryBatch.findMany({
    where: {
      batchNumber: { startsWith: `BATCH-${cleanName}-` }
    },
    select: { batchNumber: true }
  });

  let maxFoundSeq = 0;
  for (const b of prefixBatches) {
    const m = b.batchNumber.match(new RegExp(`^BATCH-${cleanName}-(\\d+)`, 'i'));
    if (m && m[1]) {
      const parsed = parseInt(m[1], 10);
      if (!isNaN(parsed) && parsed > maxFoundSeq) {
        maxFoundSeq = parsed;
      }
    }
  }

  let nextSeq = Math.max(invCount, grnCount, maxFoundSeq) + 1;
  let batchNumber = `BATCH-${cleanName || 'RM'}-${String(nextSeq).padStart(3, '0')}`;

  // Guarantee absolute uniqueness across all inventory batches
  while (await tx.inventoryBatch.findUnique({ where: { batchNumber } })) {
    nextSeq++;
    batchNumber = `BATCH-${cleanName || 'RM'}-${String(nextSeq).padStart(3, '0')}`;
  }

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
  // If an existing GRN or batches exist, clean them up first so direct receive executes fresh and cleanly
  const existingGrn = await tx.gRNReceive.findFirst({
    where: { poId: po.id },
    include: { items: true, inventoryBatches: true }
  });
  if (existingGrn) {
    await cleanupPOReceiptsAndBatches({ poId: po.id, tx });
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
      labTestRequired: false
    }];
  }

  const grnItemsData = [];
  for (const item of parsedItems) {
    const itemRmId = item.rmId || item.code || po.rmId;
    const itemRmName = item.name || item.materialName || po.name;
    const itemRawMaterialId = item.id || null;
    const itemCategory = item.category || item.categoryName || null;

    if (Array.isArray(item.batches) && item.batches.length > 0) {
      item.batches.forEach((b, bIdx) => {
        const bQty = Number(b.quantity ?? b.batchQuantity ?? 0);
        if (bQty > 0 || item.batches.length === 1) {
          grnItemsData.push({
            rawMaterialUuid: itemRawMaterialId,
            itemCategory: itemCategory,
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
            labTestRequired: false,
          });
        }
      });
    } else {
      const qty = Number(item.quantity || po.quantity || 0);
      grnItemsData.push({
        rawMaterialUuid: itemRawMaterialId,
        itemCategory: itemCategory,
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
        labTestRequired: false,
      });
    }
  }

  const referenceNo = await generateReferenceNo(tx, 'GRNReceive', 'GRN');
  const grn = await tx.gRNReceive.create({
    data: {
      referenceNo,
      poId: po.id,
      receivedDate: new Date(),
      amountPaid: po.grandTotal ? Number(po.grandTotal) : Number(po.amount || 0),
      refundAmount: 0,
      discrepancyNotes: null,
      receivedBy: reqUserId,
      status: 'LAB_APPROVED',
      inventoryStatus: 'UPLOADED',
      isExempt: true,
      vehicleNumber: po.vehicleNumber || null,
      transporterName: po.transporterName || null,
      transportMode: po.transportMode || 'ROAD',
      invoiceNumber: po.supplierInvoiceNo || null,
      invoiceDate: po.supplierInvoiceDate ? new Date(po.supplierInvoiceDate) : null,
      isShortDelivery: false,
      isFinalDelivery: true,
      items: {
        create: grnItemsData.map(({ rawMaterialUuid, itemCategory, ...rest }) => rest)
      }
    },
    include: { items: true, po: { include: { supplier: true, uom: true } } }
  });

  // Direct inventory update for all received items
  let totalReceivedSum = 0;
  for (const item of grnItemsData) {
    const acceptedQty = Number(item.actualReceivedQty || item.expectedQty || 0);
    if (acceptedQty <= 0) continue;
    totalReceivedSum += acceptedQty;

    let rm = (item.rawMaterialUuid && isUuid(item.rawMaterialUuid)) 
      ? await tx.rawMaterial.findUnique({ where: { id: item.rawMaterialUuid } }) 
      : null;

    if (!rm && item.rmId) {
      if (isUuid(item.rmId)) {
        rm = await tx.rawMaterial.findUnique({ where: { id: item.rmId } });
      }
      if (!rm) {
        rm = await tx.rawMaterial.findFirst({
          where: { OR: [{ code: item.rmId }, { id: item.rmId }] }
        });
      }
    }
    if (!rm && po.rmId) {
      if (isUuid(po.rmId)) {
        rm = await tx.rawMaterial.findUnique({ where: { id: po.rmId } });
      }
      if (!rm) {
        rm = await tx.rawMaterial.findFirst({
          where: { OR: [{ code: po.rmId }, { id: po.rmId }] }
        });
      }
    }
    if (!rm && item.itemCategory) {
      rm = await tx.rawMaterial.findFirst({
        where: {
          name: { equals: item.rmName, mode: 'insensitive' },
          category: { name: { equals: item.itemCategory, mode: 'insensitive' } }
        }
      });
    }
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
      const cleanName = (item.rmName || rm.name || 'RM')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 24);
      const oldShort = cleanName.slice(0, 8);

      if (batchNum && cleanName.length > 8 && batchNum.startsWith(`BATCH-${oldShort}-`)) {
        batchNum = batchNum.replace(new RegExp(`^BATCH-${oldShort}-`, 'i'), `BATCH-${cleanName}-`);
      }

      if (!batchNum) {
        const auto = await getNextBatchForRM(item.rmId, item.rmName, tx);
        batchNum = auto.batchNumber;
      }
      let clash = await tx.inventoryBatch.findUnique({ where: { batchNumber: batchNum } });
      if (clash) {
        const auto = await getNextBatchForRM(item.rmId, item.rmName, tx);
        batchNum = auto.batchNumber;
        while (await tx.inventoryBatch.findUnique({ where: { batchNumber: batchNum } })) {
          batchNum = `${auto.batchNumber}-${Date.now().toString().slice(-4)}`;
        }
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
          receivedQty: acceptedQty,
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
      console.log(`[DIRECT PO RECEIPT] InventoryBatch ${batchNum} created for ${item.rmName} (+${acceptedQty}) with UOM ${batchUomId}`);
    }
  }

  // Update PO status to RECEIVED, deliveredStatus to FULLY_DELIVERED, and totalReceivedQty
  await tx.rawMaterialPO.update({
    where: { id: po.id },
    data: {
      status: 'RECEIVED',
      deliveredStatus: 'FULLY_DELIVERED',
      totalReceivedQty: totalReceivedSum,
    }
  });

  return { grn, isAllExempt: true, finalPoStatus: 'RECEIVED' };
}

/**
 * Fully reverts and removes all GRN receipts, inventory batches, lab tests, and stock increments for a PO.
 * Used when a PO is reverted to PENDING (Draft), ORDERED (Undo Receive), deleted, or cleaned up.
 *
 * @param {Object} params
 * @param {string} params.poId - The UUID of the RawMaterialPO
 * @param {Object} [params.tx=prisma] - Prisma transaction client or default prisma
 * @returns {Promise<Object>} Summary of deleted records and reverted stock
 */
async function cleanupPOReceiptsAndBatches({ poId, tx = prisma }) {
  if (!poId) return { success: false, reason: 'No poId provided' };

  // 0. Fetch the PO record for fallback fields (rmId, name)
  const po = await tx.rawMaterialPO.findUnique({ where: { id: poId } }).catch(() => null);

  // 1. Fetch all GRN receipts associated with this PO
  const grns = await tx.gRNReceive.findMany({
    where: { poId },
    include: {
      items: true,
      labTest: {
        include: {
          testResults: true,
          labUsages: true,
        }
      },
      inventoryBatches: true,
    }
  });

  const grnIds = grns.map(g => g.id);

  // 2. Fetch all inventory batches associated with this PO or its GRNs
  const batches = await tx.inventoryBatch.findMany({
    where: {
      OR: [
        { poId: poId },
        ...(grnIds.length > 0 ? [{ grnId: { in: grnIds } }] : [])
      ]
    }
  });

  // 3. Revert inventory stock on RawMaterial for all batches
  const stockReversals = [];
  for (const batch of batches) {
    const qtyToDeduct = Number(batch.netQty ?? batch.receivedQty ?? 0);
    if (qtyToDeduct > 0) {
      let rm = null;
      if (batch.rawMaterialId) {
        rm = await tx.rawMaterial.findUnique({ where: { id: batch.rawMaterialId } });
      }
      if (!rm && batch.rawMaterialName) {
        rm = await tx.rawMaterial.findFirst({
          where: { name: { equals: batch.rawMaterialName, mode: 'insensitive' } }
        });
      }
      if (!rm && po?.rmId) {
        rm = await tx.rawMaterial.findFirst({
          where: { OR: [{ id: po.rmId }, { code: po.rmId }] }
        });
      }
      if (!rm && po?.name) {
        rm = await tx.rawMaterial.findFirst({
          where: { name: { equals: po.name, mode: 'insensitive' } }
        });
      }
      if (rm) {
        const currentStockNum = Number(rm.currentStock || 0);
        const newStock = Math.max(0, currentStockNum - qtyToDeduct);
        await tx.rawMaterial.update({
          where: { id: rm.id },
          data: { currentStock: newStock }
        });
        stockReversals.push({
          rawMaterialId: rm.id,
          rawMaterialName: rm.name,
          deductedQty: qtyToDeduct,
          oldStock: currentStockNum,
          newStock
        });
        console.log(`[CLEANUP PO ${poId}] Reverted stock for RM ${rm.name} (-${qtyToDeduct}) -> ${newStock}`);
      }
    }
  }

  // 3b. Fallback: If no batches existed but GRN items had received qty and uploaded inventory status, revert that stock
  if (batches.length === 0 && grns.length > 0) {
    for (const g of grns) {
      if (g.inventoryStatus === 'UPLOADED' && Array.isArray(g.items)) {
        for (const it of g.items) {
          const qty = Number(it.actualReceivedQty || 0);
          if (qty > 0) {
            let rm = null;
            if (it.rmId) {
              rm = await tx.rawMaterial.findFirst({
                where: { OR: [{ id: it.rmId }, { code: it.rmId }] }
              });
            }
            if (!rm && it.rmName) {
              rm = await tx.rawMaterial.findFirst({
                where: { name: { equals: it.rmName, mode: 'insensitive' } }
              });
            }
            if (!rm && po?.rmId) {
              rm = await tx.rawMaterial.findFirst({
                where: { OR: [{ id: po.rmId }, { code: po.rmId }] }
              });
            }
            if (rm) {
              const currentStockNum = Number(rm.currentStock || 0);
              const newStock = Math.max(0, currentStockNum - qty);
              await tx.rawMaterial.update({
                where: { id: rm.id },
                data: { currentStock: newStock }
              });
              stockReversals.push({
                rawMaterialId: rm.id,
                rawMaterialName: rm.name,
                deductedQty: qty,
                oldStock: currentStockNum,
                newStock
              });
              console.log(`[CLEANUP PO ${poId}] Fallback item reverted stock for RM ${rm.name} (-${qty}) -> ${newStock}`);
            }
          }
        }
      }
    }
  }

  // 4. Delete inventory batches
  const deletedBatches = await tx.inventoryBatch.deleteMany({
    where: {
      OR: [
        { poId: poId },
        ...(grnIds.length > 0 ? [{ grnId: { in: grnIds } }] : [])
      ]
    }
  });

  // 5. Gather all lab test IDs
  const dbLabTests = grnIds.length > 0 ? await tx.gRNLabTest.findMany({
    where: { grnId: { in: grnIds } },
    select: { id: true }
  }) : [];
  const labTestIds = Array.from(new Set([
    ...grns.map(g => g.labTest?.id).filter(Boolean),
    ...dbLabTests.map(l => l.id)
  ]));

  // 6. Delete lab inventory usages
  if (labTestIds.length > 0) {
    await tx.labInventoryUsage.deleteMany({
      where: { labTestId: { in: labTestIds } }
    });
  }

  // 7. Delete GRN lab test results
  if (labTestIds.length > 0) {
    await tx.gRNLabTestResult.deleteMany({
      where: { labTestId: { in: labTestIds } }
    });
  }

  // 8. Delete GRN lab tests
  if (grnIds.length > 0) {
    await tx.gRNLabTest.deleteMany({
      where: { grnId: { in: grnIds } }
    });
  }

  // 9. Delete purchase returns linked to this PO or its GRNs
  await tx.purchaseReturn.deleteMany({
    where: {
      OR: [
        { poId: poId },
        ...(grnIds.length > 0 ? [{ grnId: { in: grnIds } }] : [])
      ]
    }
  });

  // 10. Delete GRN receive items
  if (grnIds.length > 0) {
    await tx.gRNReceiveItem.deleteMany({
      where: { grnId: { in: grnIds } }
    });
  }

  // 11. Delete GRN receives
  const deletedGrns = await tx.gRNReceive.deleteMany({
    where: {
      OR: [
        { poId: poId },
        ...(grnIds.length > 0 ? [{ id: { in: grnIds } }] : [])
      ]
    }
  });

  // 12. Reset PO fulfillment and receipt status fields
  await tx.rawMaterialPO.update({
    where: { id: poId },
    data: {
      totalReceivedQty: 0,
      deliveredStatus: 'PENDING',
      lockedAt: null,
    }
  });

  console.log(`[CLEANUP PO ${poId}] Success: deleted ${deletedGrns.count} GRNs, ${deletedBatches.count} Batches, and reset PO receipt state.`);

  return {
    success: true,
    deletedGrnsCount: deletedGrns.count,
    deletedBatchesCount: deletedBatches.count,
    stockReversals,
  };
}

/**
 * Auto-heals and reconciles missing InventoryBatches or lumped quantities for multi-item GRNs.
 */
async function autoHealMultiItemGrnBatches(grn, tx = prisma, parentPo = null) {
  if (!grn || !Array.isArray(grn.items) || grn.items.length === 0) return false;

  const isCleared = grn.status === 'LAB_APPROVED' || grn.isExempt === true || grn.inventoryStatus === 'UPLOADED' || grn.labTest?.overallDecision === 'APPROVED';
  if (!isCleared) return false;

  const acceptedItems = grn.items.filter(it => 
    (it.inspectionStatus === 'ACCEPTED' || !it.inspectionStatus) &&
    (Number(it.actualReceivedQty) - Number(it.returnQty || it.rejectedQty || 0)) > 0
  );
  if (acceptedItems.length === 0) return false;

  let existingBatches = await tx.inventoryBatch.findMany({
    where: { grnId: grn.id },
    include: { uom: true },
    orderBy: { createdAt: 'desc' }
  });

  let modified = false;

  for (const it of acceptedItems) {
    const acceptedQty = Math.max(0, Number(it.actualReceivedQty) - Number(it.returnQty || it.rejectedQty || 0));
    if (acceptedQty <= 0) continue;

    const matchingBatch = existingBatches.find(b =>
      (b.rawMaterialId && (b.rawMaterialId === it.rmId || b.rawMaterialId === it.id)) ||
      (b.rawMaterialName && it.rmName && b.rawMaterialName.trim().toLowerCase() === it.rmName.trim().toLowerCase())
    );

    if (!matchingBatch) {
      let rm = await tx.rawMaterial.findFirst({
        where: { OR: [{ code: it.rmId }, { id: it.rmId }] }
      });
      if (!rm && it.rmName) {
        rm = await tx.rawMaterial.findFirst({
          where: { name: { equals: it.rmName, mode: 'insensitive' } }
        });
      }

      // Check if another batch in this GRN was lumped with this item's quantity
      const lumpedBatch = existingBatches.find(b => Number(b.netQty) > acceptedQty);
      if (lumpedBatch) {
        const matchingItemForLumped = acceptedItems.find(ai =>
          (ai.rmId === lumpedBatch.rawMaterialId) ||
          (ai.rmName && lumpedBatch.rawMaterialName && ai.rmName.trim().toLowerCase() === lumpedBatch.rawMaterialName.trim().toLowerCase())
        );
        if (matchingItemForLumped) {
          const properLumpedQty = Math.max(0, Number(matchingItemForLumped.actualReceivedQty) - Number(matchingItemForLumped.returnQty || matchingItemForLumped.rejectedQty || 0));
          if (Number(lumpedBatch.netQty) > properLumpedQty) {
            await tx.inventoryBatch.update({
              where: { id: lumpedBatch.id },
              data: {
                receivedQty: properLumpedQty,
                netQty: properLumpedQty
              }
            });
            lumpedBatch.netQty = properLumpedQty;
            lumpedBatch.receivedQty = properLumpedQty;
            modified = true;
          }
        }
      }

      // Generate unique batch number for this missing item
      let uniqueBatchNum = it.batchNumber?.trim();
      if (!uniqueBatchNum || (await tx.inventoryBatch.findUnique({ where: { batchNumber: uniqueBatchNum } }))) {
        const auto = await getNextBatchForRM(it.rmId, it.rmName, tx);
        uniqueBatchNum = auto.batchNumber;
        while (await tx.inventoryBatch.findUnique({ where: { batchNumber: uniqueBatchNum } })) {
          uniqueBatchNum = `BATCH-${(it.rmName || 'RM').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)}-${Date.now().toString().slice(-4)}`;
        }
      }

      const category = rm ? await tx.rMCategory.findUnique({ where: { id: rm.categoryId } }) : null;
      const poObj = parentPo || grn.po || (grn.poId ? await tx.rawMaterialPO.findUnique({ where: { id: grn.poId } }) : null);
      const batchUomId = await resolveBatchUomId(it, rm, poObj, tx);

      const newBatch = await tx.inventoryBatch.create({
        data: {
          batchNumber: uniqueBatchNum,
          poId: grn.poId,
          grnId: grn.id,
          rawMaterialId: rm?.id || it.rmId,
          rawMaterialName: it.rmName || rm?.name || 'Raw Material',
          rmCategory: category?.name || null,
          supplierId: poObj?.supplierId || grn.supplierId || null,
          receivedQty: it.actualReceivedQty,
          sampleQty: 0,
          netQty: acceptedQty,
          uomId: batchUomId,
          storageLocation: null,
          mfgDate: it.mfgDate ? new Date(it.mfgDate) : null,
          expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
          status: 'AVAILABLE',
          addedBy: grn.receivedBy || poObj?.createdBy,
        },
        include: { uom: true }
      });

      existingBatches.push(newBatch);

      // Reconcile RM currentStock
      if (rm) {
        const currentInvSum = await tx.inventoryBatch.aggregate({
          where: { rawMaterialId: rm.id, status: 'AVAILABLE' },
          _sum: { netQty: true }
        });
        if (currentInvSum._sum.netQty != null) {
          await tx.rawMaterial.update({
            where: { id: rm.id },
            data: { currentStock: currentInvSum._sum.netQty }
          });
        }
      }
      modified = true;
    }
  }

  if (modified) {
    grn.inventoryBatches = existingBatches;
  }
  return modified;
}

module.exports = {
  getNextBatchForRM,
  receivePOAndProcess,
  resolveBatchUomId,
  cleanupPOReceiptsAndBatches,
  autoHealMultiItemGrnBatches,
};
