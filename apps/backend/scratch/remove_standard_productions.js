const prisma = require('../src/database/prisma');

async function removeStandardProductions() {
  try {
    const stdBatches = await prisma.$queryRawUnsafe(`
      SELECT id, reference_no FROM production_batches WHERE production_type = 'STANDARD'
    `);
    console.log(`Found ${stdBatches.length} STANDARD batches to delete.`);

    if (stdBatches.length === 0) {
      console.log('No STANDARD batches to delete.');
      return;
    }

    const batchIds = stdBatches.map(b => b.id);
    console.log('Batch IDs to remove:', batchIds);

    await prisma.$transaction(async (tx) => {
      // 1. Delete production_batch_allocations (has fkey to batch_id and usage_id)
      const delPba = await tx.$executeRawUnsafe(`
        DELETE FROM production_batch_allocations WHERE batch_id = ANY($1::text[])
      `, batchIds);
      console.log(`Deleted ${delPba} rows from production_batch_allocations.`);

      // 2. Delete production_batch_rm_usage
      const delUsage = await tx.$executeRawUnsafe(`
        DELETE FROM production_batch_rm_usage WHERE batch_id = ANY($1::text[])
      `, batchIds);
      console.log(`Deleted ${delUsage} rows from production_batch_rm_usage.`);

      // 3. Delete production_batch_rm_line
      const delLine = await tx.$executeRawUnsafe(`
        DELETE FROM production_batch_rm_line WHERE batch_id = ANY($1::text[])
      `, batchIds);
      console.log(`Deleted ${delLine} rows from production_batch_rm_line.`);

      // 4. Delete production_batch_merge
      const delMerge = await tx.$executeRawUnsafe(`
        DELETE FROM production_batch_merge WHERE batch_id = ANY($1::text[])
      `, batchIds);
      console.log(`Deleted ${delMerge} rows from production_batch_merge.`);

      // 5. Delete production_batch_allocation (mould allocations)
      const delAlloc = await tx.$executeRawUnsafe(`
        DELETE FROM production_batch_allocation WHERE batch_id = ANY($1::text[])
      `, batchIds);
      console.log(`Deleted ${delAlloc} rows from production_batch_allocation.`);

      // 6. Delete other dependent tables if any exist
      const childTables = [
        'production_loss',
        'lab_production_test',
        'product_stock_movements',
        'batch_allocations',
        'production_batch_items',
        'production_batch_labour',
        'production_batch_utilities',
        'production_batch_output',
        'production_batch_labels',
        'production_labour_logs',
        'production_machine_logs',
        'production_utility_logs',
        'production_output_details',
        'production_barcode_labels',
        'production_batch_costing'
      ];

      for (const table of childTables) {
        try {
          const colName = table === 'production_loss' || table === 'lab_production_test' 
            ? 'production_batch_id' 
            : 'batch_id';
          const delCount = await tx.$executeRawUnsafe(`
            DELETE FROM "${table}" WHERE "${colName}"::text = ANY($1::text[])
          `, batchIds);
          if (delCount > 0) {
            console.log(`Deleted ${delCount} rows from ${table}.`);
          }
        } catch (tableErr) {
          // table might not exist or column different, ignore
        }
      }

      // 7. Delete from production_batches
      const delBatches = await tx.$executeRawUnsafe(`
        DELETE FROM production_batches WHERE id = ANY($1::text[])
      `, batchIds);
      console.log(`Successfully deleted ${delBatches} batches from production_batches!`);
    });

    // Verification
    const remaining = await prisma.$queryRawUnsafe(`
      SELECT count(*) as count FROM production_batches WHERE production_type = 'STANDARD'
    `);
    console.log(`Remaining STANDARD batches in database: ${remaining[0].count}`);

    const allBatches = await prisma.$queryRawUnsafe(`
      SELECT count(*) as count FROM production_batches
    `);
    console.log(`Total production_batches remaining in database: ${allBatches[0].count}`);

  } catch (err) {
    console.error('Error removing standard productions:', err);
  } finally {
    await prisma.$disconnect();
  }
}

removeStandardProductions();
