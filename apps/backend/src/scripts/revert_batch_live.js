const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function revertBatch() {
  const batchId = 'b219a89f-0939-4dc6-9fdf-e8e738db3d1a';
  console.log(`Starting reversion of batch ${batchId} on live production DB...`);

  // Check columns of InventoryBatch
  const ibCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'InventoryBatch'
  `);
  console.log('InventoryBatch column names:', ibCols.map(c => c.column_name));

  const hasNetQty = ibCols.some(c => c.column_name === 'netQty');
  const hasAvailableQty = ibCols.some(c => c.column_name === 'availableQty');

  console.log(`InventoryBatch hasNetQty: ${hasNetQty}, hasAvailableQty: ${hasAvailableQty}`);

  // Fetch current batch details
  const [batch] = await prisma.$queryRawUnsafe(`
    SELECT id, reference_no, status, actual_output, good_quantity, rejected_quantity, qc_status, note
    FROM production_batches
    WHERE id = $1
  `, batchId);

  console.log('Current batch state:', batch);

  // Run everything inside an atomic transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update production_batches back to In Progress
    await tx.$executeRawUnsafe(`
      UPDATE production_batches
      SET status = 'In Progress',
          actual_output = NULL,
          good_quantity = 0,
          rejected_quantity = 0,
          completed_at = NULL,
          completed_by = NULL,
          yield_percentage = NULL,
          product_yields = '[]'::jsonb,
          note = TRIM(REPLACE(COALESCE(note, ''), '[Sub-Run A] Completed', '')),
          qc_status = 'EXEMPT',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, batchId);
    console.log('1. production_batches updated to In Progress and yields cleared.');

    // 2. Unlock merge
    await tx.$executeRawUnsafe(`
      UPDATE production_batch_merge
      SET locked = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE batch_id = $1;
    `, batchId);
    console.log('2. production_batch_merge unlocked.');

    // 3. Delete batch outputs and output details
    const deletedOutput = await tx.$executeRawUnsafe(`
      DELETE FROM production_batch_output WHERE batch_id = $1;
    `, batchId);
    const deletedDetails = await tx.$executeRawUnsafe(`
      DELETE FROM production_output_details WHERE batch_id = $1;
    `, batchId);
    console.log(`3. Deleted ${deletedOutput} output rows and ${deletedDetails} output detail rows.`);

    // 4. Reset actual_qty in production_batch_items
    await tx.$executeRawUnsafe(`
      UPDATE production_batch_items
      SET actual_qty = 0
      WHERE batch_id = $1;
    `, batchId);
    console.log('4. Reset actual_qty in production_batch_items.');

    // 5. Revert finished products stock and remove product_stock_movements
    await tx.$executeRawUnsafe(`
      UPDATE products
      SET current_stock = GREATEST(0, current_stock - 40),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'ffbdcb53-0461-411e-8d58-432384f86f39';
    `); // DESI MALAI (K101)
    await tx.$executeRawUnsafe(`
      UPDATE products
      SET current_stock = GREATEST(0, current_stock - 1711),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'aade9870-6446-4dd3-b6b4-552423a6ed12';
    `); // Alphonso Mango (K110)

    const deletedMovements = await tx.$executeRawUnsafe(`
      DELETE FROM product_stock_movements WHERE batch_id = $1;
    `, batchId);
    console.log(`5. Reverted finished products stock (-40 DESI MALAI, -1711 Alphonso Mango) and deleted ${deletedMovements} stock movements.`);

    // 6. Set RM usage status back to ALLOCATED
    const updatedRmUsage = await tx.$executeRawUnsafe(`
      UPDATE production_batch_rm_usage
      SET status = 'ALLOCATED'
      WHERE batch_id = $1;
    `, batchId);
    console.log(`6. Set ${updatedRmUsage} RM usages back to ALLOCATED.`);

    // 7. Restore Raw Material inventory stock
    await tx.$executeRawUnsafe(`UPDATE "RawMaterial" SET "currentStock" = "currentStock" + 160, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '1ee4933f-92d2-4d8f-86f3-8aa8c769eaf5'`); // Milk
    await tx.$executeRawUnsafe(`UPDATE "RawMaterial" SET "currentStock" = "currentStock" + 15, "updatedAt" = CURRENT_TIMESTAMP WHERE id = 'c972c514-8d1d-45d0-9483-32b74ebc385f'`); // LPG
    await tx.$executeRawUnsafe(`UPDATE "RawMaterial" SET "currentStock" = "currentStock" + 0.38, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '0fc04172-2fe2-4146-b4cf-045fdaa943a7'`); // Stabilizer
    await tx.$executeRawUnsafe(`UPDATE "RawMaterial" SET "currentStock" = "currentStock" + 12.8, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '8dcb12bc-44fe-42f3-b8d5-87496094a071'`); // Sugar
    await tx.$executeRawUnsafe(`UPDATE "RawMaterial" SET "currentStock" = "currentStock" + 0.0045, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '38057e4e-ffc2-4339-99e7-fabc33585eec'`); // Rabdi
    console.log('7. Restored RawMaterial stocks.');

    // 8. Restore InventoryBatch netQty if column exists
    if (hasNetQty) {
      await tx.$executeRawUnsafe(`UPDATE "InventoryBatch" SET "netQty" = "netQty" + 160, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '152b25c3-3219-4e5b-ae6a-d78e7aa31390'`);
      await tx.$executeRawUnsafe(`UPDATE "InventoryBatch" SET "netQty" = "netQty" + 15, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '1591fdf1-b82c-43cb-99f1-df05a4096479'`);
      await tx.$executeRawUnsafe(`UPDATE "InventoryBatch" SET "netQty" = "netQty" + 0.38, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '55ae57c1-c389-4e4a-b528-c9be1e6c0dd2'`);
      await tx.$executeRawUnsafe(`UPDATE "InventoryBatch" SET "netQty" = "netQty" + 12.8, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '526dd60d-8bb8-49e0-b288-51550c0f8c9b'`);
      await tx.$executeRawUnsafe(`UPDATE "InventoryBatch" SET "netQty" = "netQty" + 0.0045, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '9c899600-4526-44f7-8747-128c83d60830'`);
      console.log('8. Restored InventoryBatch netQty.');
    }
  });

  // Verify updated state
  const [revertedBatch] = await prisma.$queryRawUnsafe(`
    SELECT id, reference_no, status, actual_output, good_quantity, rejected_quantity, yield_percentage, product_yields, completed_at, completed_by, qc_status, note
    FROM production_batches
    WHERE id = $1
  `, batchId);
  console.log('Reverted batch state:', revertedBatch);

  const remainingOutputs = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM production_batch_output WHERE batch_id = $1`, batchId);
  console.log('Remaining outputs in production_batch_output:', remainingOutputs);

  const remainingDetails = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM production_output_details WHERE batch_id = $1`, batchId);
  console.log('Remaining details in production_output_details:', remainingDetails);

  const remainingMovements = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM product_stock_movements WHERE batch_id = $1`, batchId);
  console.log('Remaining movements in product_stock_movements:', remainingMovements);

  const [merge] = await prisma.$queryRawUnsafe(`SELECT batch_id, locked FROM production_batch_merge WHERE batch_id = $1`, batchId);
  console.log('Merge state:', merge);

  const usages = await prisma.$queryRawUnsafe(`SELECT id, status, internal_batch_no, required_qty, actual_used_qty FROM production_batch_rm_usage WHERE batch_id = $1`, batchId);
  console.table(usages);

  console.log('✅ Batch reversion completed successfully!');
  await prisma.$disconnect();
}

revertBatch().catch((err) => {
  console.error('Reversion failed:', err);
  process.exit(1);
});

