const prisma = require('../../database/prisma');

class LiveRateController {
  async getLiveRate(req, res, next) {
    try {
      const { rawMaterialId, uomId, targetUom, allocatedQty, batchId, poId } = req.query;

      if (!rawMaterialId && !batchId && !poId) {
        return res.status(400).json({ error: 'rawMaterialId, batchId, or poId is required' });
      }

      // 1. If batchId is provided, look up the exact InventoryBatch and its source PO / GRN
      if (batchId) {
        const batch = await prisma.inventoryBatch.findFirst({
          where: {
            OR: [
              { id: batchId },
              { batchNumber: batchId }
            ]
          },
          include: {
            po: {
              include: { supplier: true, uom: true }
            },
            grn: {
              include: { po: { include: { supplier: true, uom: true } } }
            },
            uom: true
          }
        });

        if (batch) {
          const sourcePo = batch.po || batch.grn?.po;
          const poBatchQty = Number(batch.receivedQty || batch.netQty || 1);
          
          let poLineRate = null;
          let poLineAmount = null;
          let poLineQty = poBatchQty;
          let poLineUom = batch.uom?.abbreviation || batch.uom?.name || 'units';

          if (sourcePo) {
            // Find specific item inside sourcePo.items array if available
            if (Array.isArray(sourcePo.items) && sourcePo.items.length > 0) {
              const matchedItem = sourcePo.items.find(it => 
                it.id === batch.rawMaterialId || 
                it.rmId === batch.rawMaterialId ||
                it.name?.toLowerCase() === batch.rawMaterialName?.toLowerCase()
              );

              if (matchedItem) {
                poLineQty = Number(matchedItem.quantity || poBatchQty);
                poLineRate = Number(matchedItem.unitPrice || matchedItem.rate || 0);
                poLineAmount = Number(matchedItem.subtotal || matchedItem.amount || (poLineQty * poLineRate));
                poLineUom = matchedItem.uomLabel || matchedItem.uom || poLineUom;
              }
            }

            // Fallback to sourcePo root amounts if not found in items array
            if (poLineRate === null || poLineRate === 0) {
              poLineQty = Number(sourcePo.quantity || poBatchQty);
              poLineAmount = Number(sourcePo.grandTotal || sourcePo.amount || sourcePo.subtotal || 0);
              poLineRate = poLineQty > 0 ? (poLineAmount / poLineQty) : 0;
              poLineUom = sourcePo.uom?.abbreviation || sourcePo.uom?.name || poLineUom;
            }
          }

          // If still no PO rate, check RawMaterial catalog
          if (!poLineRate || poLineRate === 0) {
            const rm = await prisma.rawMaterial.findFirst({
              where: { OR: [{ id: batch.rawMaterialId }, { code: batch.rawMaterialId }] }
            });
            poLineRate = Number(rm?.ratePerUnit || 0);
            poLineAmount = poLineRate * poLineQty;
          }

          // Proportional calculation for requested quantity:
          // If taking 4 out of 8, amount is proportionally half!
          const reqQty = allocatedQty !== undefined ? Number(allocatedQty) : poLineQty;
          const proportionalFactor = poLineQty > 0 ? (reqQty / poLineQty) : 1;
          const proportionalAmount = Number((poLineAmount * proportionalFactor).toFixed(2));
          const effectiveRate = reqQty > 0 ? Number((proportionalAmount / reqQty).toFixed(4)) : poLineRate;

          return res.json({
            rate: effectiveRate,
            baseRate: poLineRate,
            allocatedQty: reqQty,
            allocatedAmount: proportionalAmount,
            poOriginalQty: poLineQty,
            poTotalAmount: poLineAmount,
            poNo: sourcePo?.referenceNo || sourcePo?.id || batch.batchNumber,
            poDate: sourcePo?.createdAt || batch.createdAt,
            supplier: sourcePo?.supplier?.name || 'Verified Supplier',
            uom: poLineUom,
            batchNumber: batch.batchNumber,
            source: sourcePo ? 'SELECTED_PO_BATCH' : 'WAREHOUSE_LOT',
            note: poLineQty > 0 && reqQty !== poLineQty 
              ? `Proportionally calculated: ${reqQty} out of ${poLineQty} ${poLineUom} (${(proportionalFactor * 100).toFixed(1)}% of ₹${poLineAmount.toFixed(2)})`
              : 'Full batch rate applied'
          });
        }
      }

      // 2. Fetch Latest Approved / Ordered PO for the raw material
      const candidateRms = await prisma.rawMaterial.findMany({
        where: {
          OR: [
            { id: rawMaterialId },
            { code: rawMaterialId },
            { name: { equals: rawMaterialId, mode: 'insensitive' } }
          ]
        },
        include: { category: true }
      });
      const rm = candidateRms[0];

      // Query rawMaterialPO ordered by createdAt desc
      const pos = await prisma.rawMaterialPO.findMany({
        where: {
          status: { not: 'DELETED' }
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { supplier: true, uom: true }
      });

      let matchedPo = null;
      let matchedItem = null;

      for (const po of pos) {
        if (Array.isArray(po.items) && po.items.length > 0) {
          const it = po.items.find(item => 
            (rawMaterialId && (item.id === rawMaterialId || item.rmId === rawMaterialId)) ||
            (rm && (item.id === rm.id || item.rmId === rm.id || item.rmId === rm.code || item.name?.toLowerCase() === rm.name?.toLowerCase()))
          );
          if (it) {
            matchedPo = po;
            matchedItem = it;
            break;
          }
        }

        // Check root PO rmId
        if (po.rmId === rawMaterialId || (rm && (po.rmId === rm.id || po.rmId === rm.code))) {
          matchedPo = po;
          matchedItem = {
            quantity: Number(po.quantity),
            rate: po.quantity > 0 ? Number(po.amount) / Number(po.quantity) : 0,
            amount: Number(po.amount),
            uom: po.uom?.abbreviation || po.uom?.name
          };
          break;
        }
      }

      if (matchedPo && matchedItem) {
        const poQty = Number(matchedItem.quantity || 1);
        let poRate = Number(matchedItem.unitPrice || matchedItem.rate || (poQty > 0 ? Number(matchedItem.subtotal || matchedItem.amount || 0) / poQty : 0));
        let poTotalAmt = Number(matchedItem.subtotal || matchedItem.amount || (poQty * poRate));
        const poUomStr = (matchedItem.uomLabel || matchedItem.uom || matchedPo.uom?.abbreviation || 'KG').toUpperCase();
        const reqUomStr = (targetUom || poUomStr).toUpperCase();

        // Unit conversion (e.g. Kg to Grm)
        let conversionRatio = 1.0;
        if (poUomStr === 'KG' && (reqUomStr === 'GRM' || reqUomStr === 'G' || reqUomStr === 'GRAM')) {
          conversionRatio = 0.001; // 1 Grm = 0.001 Kg, so rate per Grm is rate / 1000
        } else if ((poUomStr === 'GRM' || poUomStr === 'G') && reqUomStr === 'KG') {
          conversionRatio = 1000;
        } else if (poUomStr === 'LTR' && (reqUomStr === 'ML' || reqUomStr === 'MILLILITER')) {
          conversionRatio = 0.001;
        } else if ((poUomStr === 'ML') && reqUomStr === 'LTR') {
          conversionRatio = 1000;
        }

        const effectiveUnitRate = Number((poRate * conversionRatio).toFixed(4));
        const reqQty = allocatedQty !== undefined ? Number(allocatedQty) : poQty;
        const proportionalAmount = Number((reqQty * effectiveUnitRate).toFixed(2));

        return res.json({
          rate: effectiveUnitRate,
          baseRate: poRate,
          allocatedQty: reqQty,
          allocatedAmount: proportionalAmount,
          poOriginalQty: poQty,
          poTotalAmount: poTotalAmt,
          poNo: matchedPo.referenceNo || `PO-${matchedPo.id.slice(0, 8)}`,
          poDate: matchedPo.createdAt,
          supplier: matchedPo.supplier?.name || 'Verified Supplier',
          uom: reqUomStr,
          source: 'LATEST_PO',
          note: `Live rate from PO #${matchedPo.referenceNo || matchedPo.id.slice(0, 8)} (${matchedPo.supplier?.name || 'Supplier'})`
        });
      }

      // 3. Fallback: RawMaterial Master Catalog rate
      if (rm) {
        const masterRate = Number(rm.ratePerUnit || 0);
        const reqQty = allocatedQty !== undefined ? Number(allocatedQty) : 1;
        const reqUomStr = (targetUom || rm.consumptionUnit || 'Units').toUpperCase();

        return res.json({
          rate: masterRate,
          baseRate: masterRate,
          allocatedQty: reqQty,
          allocatedAmount: Number((reqQty * masterRate).toFixed(2)),
          poOriginalQty: null,
          poTotalAmount: null,
          poNo: 'MASTER-CATALOG',
          poDate: rm.updatedAt || rm.createdAt,
          supplier: 'Default Item Master Rate',
          uom: reqUomStr,
          source: 'MASTER_CATALOG',
          note: 'Master catalog default rate (No historical PO found)'
        });
      }

      // 4. Fallback: Non-Inventory / Overhead Item Catalog
      const nonInv = await prisma.nonInventoryItem.findFirst({
        where: {
          OR: [
            { id: rawMaterialId },
            { code: rawMaterialId },
            { name: { equals: rawMaterialId, mode: 'insensitive' } }
          ]
        }
      });

      if (nonInv) {
        const costRate = Number(nonInv.ratePerUnit || 0);
        const reqQty = allocatedQty !== undefined ? Number(allocatedQty) : 1;

        return res.json({
          rate: costRate,
          baseRate: costRate,
          allocatedQty: reqQty,
          allocatedAmount: Number((reqQty * costRate).toFixed(2)),
          poOriginalQty: null,
          poTotalAmount: null,
          poNo: 'OVERHEAD-HEAD',
          poDate: nonInv.updatedAt || nonInv.createdAt,
          supplier: 'Cost Head Master',
          uom: nonInv.consumptionUnit || 'Units',
          source: 'OVERHEAD_CATALOG',
          note: 'Non-inventory overhead fixed cost head'
        });
      }

      // Default safe response if nothing found
      return res.json({
        rate: 0,
        baseRate: 0,
        allocatedQty: allocatedQty ? Number(allocatedQty) : 0,
        allocatedAmount: 0,
        poOriginalQty: null,
        poTotalAmount: null,
        poNo: 'N/A',
        poDate: new Date(),
        supplier: 'Manual Input Required',
        uom: targetUom || 'Units',
        source: 'DEFAULT_ZERO',
        note: 'Please enter unit rate manually'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LiveRateController();
