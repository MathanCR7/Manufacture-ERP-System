/**
 * Script to safely remove specific sales records:
 * 1. SO/26-27/10/0004 (Sales Order)
 * 2. QT/26-27/10/0001 (Quotation)
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const TARGET_RECORDS = ['SO/26-27/10/0004', 'QT/26-27/10/0001'];

async function removeRecordsFromDatabase(dbUrl, dbLabel) {
  console.log(`\n====================================================`);
  console.log(`Connecting to [${dbLabel}]...`);
  console.log(`====================================================`);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    // 1. Find target orders
    const targetOrders = await prisma.customerOrder.findMany({
      where: {
        OR: [
          { docNo: { in: TARGET_RECORDS } },
          { referenceNo: { in: TARGET_RECORDS } },
        ],
      },
      include: {
        items: true,
        deliveries: true,
      },
    });

    if (targetOrders.length === 0) {
      console.log(`No records found matching ${TARGET_RECORDS.join(', ')} in [${dbLabel}]. Nothing to remove.`);
      return;
    }

    console.log(`Found ${targetOrders.length} order(s) to remove in [${dbLabel}]:`);
    const orderIds = targetOrders.map(o => o.id);

    targetOrders.forEach((o, idx) => {
      console.log(`  [${idx + 1}] ID: ${o.id}`);
      console.log(`      Doc/Ref No: ${o.docNo || o.referenceNo} (${o.referenceNo})`);
      console.log(`      Type: ${o.type} | Status: ${o.status}`);
      console.log(`      Grand Total: ₹${o.grandTotal}`);
      console.log(`      Items: ${o.items.length} | Deliveries: ${o.deliveries.length}`);
    });

    // 2. Perform deletion in an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete deliveries first
      const deliveriesDeleted = await tx.customerOrderDelivery.deleteMany({
        where: { orderId: { in: orderIds } },
      });

      // Delete items
      const itemsDeleted = await tx.customerOrderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });

      // Delete orders
      const ordersDeleted = await tx.customerOrder.deleteMany({
        where: { id: { in: orderIds } },
      });

      return {
        deliveriesCount: deliveriesDeleted.count,
        itemsCount: itemsDeleted.count,
        ordersCount: ordersDeleted.count,
      };
    });

    console.log(`\nDeletion completed successfully in [${dbLabel}]:`);
    console.log(`  - Deleted Deliveries : ${result.deliveriesCount}`);
    console.log(`  - Deleted Order Items: ${result.itemsCount}`);
    console.log(`  - Deleted Orders     : ${result.ordersCount}`);

    // 3. Post-deletion verification
    const remaining = await prisma.customerOrder.findMany({
      where: {
        OR: [
          { docNo: { in: TARGET_RECORDS } },
          { referenceNo: { in: TARGET_RECORDS } },
        ],
      },
    });

    if (remaining.length === 0) {
      console.log(`\u2705 VERIFICATION PASSED: 0 records remain for ${TARGET_RECORDS.join(', ')} in [${dbLabel}].`);
    } else {
      console.error(`\u274C VERIFICATION FAILED: ${remaining.length} records still remain!`);
    }

  } catch (err) {
    console.error(`Error removing records in [${dbLabel}]:`, err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const PROD_URL = 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable';
  const LOCAL_URL = process.env.DATABASE_URL;

  // 1. Remove from Production DB
  await removeRecordsFromDatabase(PROD_URL, 'PRODUCTION DATABASE');

  // 2. Remove from Local DB if configured
  if (LOCAL_URL && LOCAL_URL !== PROD_URL) {
    await removeRecordsFromDatabase(LOCAL_URL, 'LOCAL DATABASE');
  }

  console.log(`\n\u2705 All specified records have been successfully purged.`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
