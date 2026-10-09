/**
 * Standalone Repair Script for Multi-Item GRN Batches
 * Run with: node src/scripts/repair_production_batches.js
 * 
 * Safely inspects and repairs any lumped batches in the database:
 * 1. Restores lumped batches to their proper line-item quantity (e.g. 11.45 KG -> 6.45 KG)
 * 2. Creates missing inventory batches for the remaining items (e.g. 5.00 KG for PACKING ROLL 130MM)
 * 3. Reconciles RawMaterial currentStock balances
 */

const prisma = require('../database/prisma');
const { autoHealMultiItemGrnBatches } = require('../modules/grn/grn.helper');

async function main() {
  console.log('=== MULTI-ITEM GRN BATCH AUDIT & REPAIR SCRIPT ===\n');

  // Find all GRNs that have multiple items
  const grns = await prisma.gRNReceive.findMany({
    include: {
      items: true,
      inventoryBatches: true,
      po: true,
      labTest: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${grns.length} total GRN records in database.`);

  let repairedCount = 0;

  for (const grn of grns) {
    if (!grn.items || grn.items.length <= 1) continue;

    console.log(`\nChecking multi-item GRN: ${grn.referenceNo} (PO: ${grn.po?.referenceNo || grn.poId || 'N/A'})`);
    console.log(` - Items (${grn.items.length}):`);
    grn.items.forEach(it => {
      console.log(`    * ${it.rmName} (${it.rmId}) -> Expected: ${it.expectedQty}, Received: ${it.actualReceivedQty}`);
    });

    console.log(` - Current Batches (${grn.inventoryBatches.length}):`);
    grn.inventoryBatches.forEach(b => {
      console.log(`    * ${b.batchNumber}: ${b.rawMaterialName} -> NetQty: ${b.netQty} (${b.status})`);
    });

    // Run auto-healing
    const healed = await autoHealMultiItemGrnBatches(grn, prisma, grn.po);
    if (healed) {
      repairedCount++;
      console.log(` ✅ REPAIRED: ${grn.referenceNo} batches reconciled successfully!`);

      // Fetch refreshed batches
      const updatedBatches = await prisma.inventoryBatch.findMany({
        where: { grnId: grn.id },
        orderBy: { createdAt: 'desc' }
      });
      console.log(` - New Batches (${updatedBatches.length}):`);
      updatedBatches.forEach(b => {
        console.log(`    * ${b.batchNumber}: ${b.rawMaterialName} -> NetQty: ${b.netQty} (${b.status})`);
      });
    } else {
      console.log(` - Already consistent. No changes needed.`);
    }
  }

  console.log(`\n=== SUMMARY: Repaired ${repairedCount} GRN(s) ===`);
}

main()
  .catch(err => {
    console.error('Repair error:', err);
  })
  .finally(() => prisma.$disconnect());
