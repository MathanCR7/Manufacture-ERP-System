const prisma = require('../../database/prisma');

const getLifecycle = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    let decodedId = id;
    try {
      // In some cases id is doubly encoded or we might want to try parsing it
      // Express decodes params by default, but if it fails we catch it.
      if (id.includes('%')) {
         decodedId = decodeURIComponent(id);
      }
    } catch (e) {
      decodedId = id;
    }

    let searchId = decodedId;
    let parsedData = null;
    try {
      parsedData = JSON.parse(decodedId);
      searchId = parsedData.batchNumber || parsedData.grnNumber || parsedData.poNumber || parsedData.id || decodedId;
    } catch(e) {
      // Not JSON, check if it's the custom pipe-separated QR code
      if (typeof decodedId === 'string' && decodedId.includes('|')) {
        const parts = decodedId.split('|');
        const grnPart = parts.find(p => p.startsWith('GRN:'));
        const idPart = parts.find(p => p.startsWith('ID:'));
        const poPart = parts.find(p => p.startsWith('PO:'));
        
        // Priority: ID (UUID) > GRN > PO
        if (idPart) searchId = idPart.substring(3);
        else if (grnPart) searchId = grnPart.substring(4);
        else if (poPart) searchId = poPart.substring(3);
      }
    }

    // Try GRNReceive first
    let grn = await prisma.gRNReceive.findFirst({
      where: { OR: [{ referenceNo: searchId }, { id: searchId }, { invoiceNumber: searchId }, { challanNumber: searchId }] },
      include: {
        po: { include: { user: { select: { name: true, role: true } }, supplier: { select: { name: true } }, uom: true } },
        items: true,
        labTest: { include: { testResults: true, tester: { select: { name: true } } } },
        inventoryBatch: { include: { uom: true } },
        purchaseReturns: true,
        receiver: { select: { name: true, role: true } }
      }
    });

    // Try PO
    let po = null;
    if (!grn) {
      po = await prisma.rawMaterialPO.findFirst({
        where: { OR: [{ referenceNo: searchId }, { id: searchId }] },
        include: {
          user: { select: { name: true, role: true } },
          supplier: { select: { name: true } },
          uom: true,
          grnReceives: {
            include: {
              items: true,
              labTest: { include: { testResults: true, tester: { select: { name: true } } } },
              inventoryBatch: { include: { uom: true } },
              purchaseReturns: true,
              receiver: { select: { name: true, role: true } }
            }
          }
        }
      });
    }

    // Try inventory batch
    let batch = null;
    if (!grn && !po) {
      batch = await prisma.inventoryBatch.findFirst({
        where: { OR: [{ batchNumber: searchId }, { id: searchId }] },
        include: {
          po: { include: { user: { select: { name: true } }, supplier: { select: { name: true } }, uom: true } },
          grn: {
            include: {
              items: true,
              labTest: { include: { testResults: true, tester: { select: { name: true } } } },
              purchaseReturns: true,
              receiver: { select: { name: true } }
            }
          },
          uom: true
        }
      });
    }

    if (!grn && !po && !batch) {
      return res.status(404).json({ error: 'No lifecycle data found for this ID.', searchedId: searchId, originalPayload: parsedData });
    }

    // Normalize into lifecycle object
    let lifecycle;
    if (grn) {
      lifecycle = {
        searchedId: searchId,
        originalPayload: parsedData,
        po: grn.po,
        grn: { ...grn, po: undefined, labTest: undefined, inventoryBatch: undefined },
        lab: grn.labTest,
        inventory: grn.inventoryBatch,
        purchaseReturns: grn.purchaseReturns || [],
      };
    } else if (po) {
      const firstGrn = po.grnReceives?.[0];
      lifecycle = {
        searchedId: searchId,
        originalPayload: parsedData,
        po: { ...po, grnReceives: undefined },
        grn: firstGrn ? { ...firstGrn, labTest: undefined, inventoryBatch: undefined } : null,
        lab: firstGrn?.labTest || null,
        inventory: firstGrn?.inventoryBatch || null,
        purchaseReturns: firstGrn?.purchaseReturns || [],
        allGrns: po.grnReceives,
      };
    } else {
      lifecycle = {
        searchedId: searchId,
        originalPayload: parsedData,
        po: batch.po,
        grn: batch.grn ? { ...batch.grn, labTest: undefined, inventoryBatch: undefined } : null,
        lab: batch.grn?.labTest || null,
        inventory: { ...batch, po: undefined, grn: undefined },
        purchaseReturns: batch.grn?.purchaseReturns || [],
      };
    }

    res.json(lifecycle);
  } catch (err) { next(err); }
};

module.exports = { getLifecycle };
