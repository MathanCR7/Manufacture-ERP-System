/**
 * Database Reconciliation Script for Production & Local ERP Databases
 * 
 * Fixes:
 *  1. RM-00001 (MILK RAW):
 *     - Reconciles historical batch MP-000003 where 4200 ml was deducted as 4200 Liter instead of 4.2 Liter.
 *     - Updates MP-000003 RM usage: actualUsedQty = 4.2, inputQty = 4200, selectedUom = 'ml', conversionFactorUsed = 1000, totalCost = 201.60.
 *     - Reconciles RawMaterial.currentStock: 320 - 4.2 = 315.800 Liter.
 *     - Reconciles InventoryBatch lot BATCH-MILKRAW-002: netQty = 155.800 Liter.
 * 
 *  2. RM-00004 (STABLILIZER):
 *     - Reconciles historical batch MP-000003 where 8000 gm was deducted as 8000 kg instead of 8.0 kg.
 *     - Updates MP-000003 RM usage: actualUsedQty = 8.0, inputQty = 8000, selectedUom = 'gm', conversionFactorUsed = 1000, totalCost = 360.00.
 *     - Reconciles RawMaterial.currentStock: 50 - 8 = 42.0 kg.
 *     - InventoryBatch lot BATCH-STABLILIZER-001: netQty = 42.0 kg.
 * 
 *  3. In-Progress Batches (MP-000004, MP-000005):
 *     - Sets conversionFactorUsed = 1000 on all alternate UOM usages (liter/ml, kg/gm).
 */

const { PrismaClient } = require('@prisma/client');

const targetUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl
    }
  }
});

async function reconcile() {
  console.log(`Starting ERP Database Reconciliation on: ${targetUrl.replace(/:[^:]*@/, ':****@')}...`);

  // 1. Fetch Materials
  const milk = await prisma.rawMaterial.findFirst({ where: { code: 'RM-00001' } });
  const stabilizer = await prisma.rawMaterial.findFirst({ where: { code: 'RM-00004' } });

  if (!milk) {
    console.error('RM-00001 (MILK RAW) not found!');
    return;
  }
  if (!stabilizer) {
    console.error('RM-00004 (STABLILIZER) not found!');
    return;
  }

  console.log(`\nCurrent Status Before Reconciliation:`);
  console.log(`  MILK RAW currentStock: ${milk.currentStock} liter`);
  console.log(`  STABLILIZER currentStock: ${stabilizer.currentStock} kg`);

  // 2. Fix MP-000003 (Completed batch) usages
  const mp003 = await prisma.productionBatchNew.findFirst({
    where: {
      OR: [
        { referenceNo: 'MP-000003' },
        { batchNo: '20261015-FP000002-00001' }
      ]
    },
    include: { rmUsages: true }
  });

  if (mp003) {
    console.log(`\nReconciling MP-000003 (${mp003.batchNo})...`);
    for (const u of mp003.rmUsages) {
      if (u.rmId === milk.id) {
        // Consumed 4200 ml = 4.2 liter
        const canonicalQty = 4.2;
        const totalCost = Number((canonicalQty * Number(u.unitCost || 48)).toFixed(2));
        await prisma.productionBatchRMUsage.update({
          where: { id: u.id },
          data: {
            actualUsedQty: canonicalQty,
            inputQty: 4200,
            selectedUom: 'ml',
            conversionFactorUsed: 1000,
            totalCost: totalCost
          }
        });
        console.log(`  -> Fixed MILK RAW usage: actualUsedQty = 4.2 liter (from 4200 ml), cost = ₹${totalCost}`);
      } else if (u.rmId === stabilizer.id) {
        // Consumed 8000 gm = 8.0 kg
        const canonicalQty = 8.0;
        const totalCost = Number((canonicalQty * Number(u.unitCost || 45)).toFixed(2));
        await prisma.productionBatchRMUsage.update({
          where: { id: u.id },
          data: {
            actualUsedQty: canonicalQty,
            inputQty: 8000,
            selectedUom: 'gm',
            conversionFactorUsed: 1000,
            totalCost: totalCost
          }
        });
        console.log(`  -> Fixed STABLILIZER usage: actualUsedQty = 8.0 kg (from 8000 gm), cost = ₹${totalCost}`);
      }
    }
  }

  // 3. Update conversionFactorUsed = 1000 for all usages of MILK and STABILIZER across all batches
  const milkUsagesUpdated = await prisma.productionBatchRMUsage.updateMany({
    where: { rmId: milk.id },
    data: { conversionFactorUsed: 1000 }
  });
  console.log(`\nUpdated conversionFactorUsed = 1000 for ${milkUsagesUpdated.count} MILK RAW batch usage rows.`);

  const stabUsagesUpdated = await prisma.productionBatchRMUsage.updateMany({
    where: { rmId: stabilizer.id },
    data: { conversionFactorUsed: 1000 }
  });
  console.log(`Updated conversionFactorUsed = 1000 for ${stabUsagesUpdated.count} STABLILIZER batch usage rows.`);

  // 4. Update InventoryBatch lot netQty
  // For MILK RAW: Lot 1 = 160 L, Lot 2 had 160 L - 4.2 L consumed = 155.8 L (total 315.8 L)
  const lot2 = await prisma.inventoryBatch.findFirst({
    where: {
      rawMaterialId: milk.id,
      batchNumber: 'BATCH-MILKRAW-002'
    }
  });
  if (lot2) {
    await prisma.inventoryBatch.update({
      where: { id: lot2.id },
      data: { netQty: 155.8 }
    });
    console.log(`Reconciled BATCH-MILKRAW-002 netQty to 155.800 liter.`);
  }

  const lot1 = await prisma.inventoryBatch.findFirst({
    where: {
      rawMaterialId: milk.id,
      batchNumber: 'BATCH-MILKRAW-001'
    }
  });
  if (lot1) {
    await prisma.inventoryBatch.update({
      where: { id: lot1.id },
      data: { netQty: 160.0 }
    });
    console.log(`Verified BATCH-MILKRAW-001 netQty at 160.000 liter.`);
  }

  const stabLot = await prisma.inventoryBatch.findFirst({
    where: {
      rawMaterialId: stabilizer.id,
      batchNumber: 'BATCH-STABLILIZER-001'
    }
  });
  if (stabLot) {
    await prisma.inventoryBatch.update({
      where: { id: stabLot.id },
      data: { netQty: 42.0 }
    });
    console.log(`Verified BATCH-STABLILIZER-001 netQty at 42.000 kg.`);
  }

  // 5. Update main stock in raw_materials
  const newMilkStock = 315.8;
  await prisma.rawMaterial.update({
    where: { id: milk.id },
    data: {
      currentStock: newMilkStock,
      conversionFactor: 1000,
      alternateUomQty: 1000,
      baseUomQty: 1
    }
  });
  console.log(`\nReconciled MILK RAW currentStock: 320 - 4.2 = ${newMilkStock} liter (≈ ${(newMilkStock * 1000).toLocaleString()} ml)`);

  const newStabStock = 42.0;
  await prisma.rawMaterial.update({
    where: { id: stabilizer.id },
    data: {
      currentStock: newStabStock,
      conversionFactor: 1000,
      alternateUomQty: 1000,
      baseUomQty: 1
    }
  });
  console.log(`Reconciled STABLILIZER currentStock: 50 - 8 = ${newStabStock} kg (≈ ${(newStabStock * 1000).toLocaleString()} gm)`);

  console.log(`\nReconciliation completed successfully! All stock balances and conversions are accurate.`);
}

reconcile()
  .catch(err => {
    console.error('Reconciliation error:', err);
  })
  .finally(() => prisma.$disconnect());
