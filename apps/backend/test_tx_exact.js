const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable' } }
});

async function main() {
  const id = 'f426ea36-dd9b-44ab-9532-172cbf9cebcb';
  
  // First set status back to 'In Progress'
  await prisma.$executeRawUnsafe(`UPDATE production_batches SET status = 'In Progress' WHERE id = $1`, id);

  const batch = (await prisma.$queryRawUnsafe(`SELECT * FROM production_batches WHERE id = $1`, id))[0];
  console.log('Batch before complete:', batch.status);

  // Now run the EXACT transaction from completeProduction
  try {
    await prisma.$transaction(async (tx) => {
      const finalStatus = 'Completed';
      const qcStatus = 'EXEMPT';
      const finalOutput = 62.35;
      const totalRejects = 0;
      const yieldsList = [{ seq: 1, productName: 'DESI MALAI' }];
      const subBatchLetter = 'A';
      const notes = '';
      const operatorName = 'ADMIN MASTER';
      const finalLabour = 4200;
      const finalEb = 10200;
      const finalUnits = 1200;
      const finalRate = 8.5;
      const stagesPayload = null;
      const finalOverhead = 1069.12;
      const subTotalCost = 1000;
      const totalBatchCost = 15000;
      const unitCost = 200;

      const res = await tx.$executeRawUnsafe(`
        UPDATE production_batches
        SET 
          status = $2,
          qc_status = $3,
          quarantine_stock = $4,
          good_quantity = $5,
          actual_output = $5,
          rejected_quantity = $6,
          product_yields = $7::jsonb,
          note = COALESCE(note, '') || ' ' || $8,
          completed_at = CURRENT_TIMESTAMP,
          complete_date = CURRENT_TIMESTAMP,
          completed_by = $9,
          labour_total_cost = COALESCE($10, labour_total_cost),
          eb_total_cost = COALESCE($11, eb_total_cost),
          eb_units_kwh = COALESCE($12, eb_units_kwh),
          eb_rate_per_unit = COALESCE($13, eb_rate_per_unit),
          timeline_stages = COALESCE($14::jsonb, timeline_stages),
          overhead_amt = COALESCE($15, overhead_amt),
          sub_total = COALESCE($16, sub_total),
          grand_total = COALESCE($17, grand_total),
          total_cost = COALESCE($17, total_cost),
          cost_per_unit = COALESCE($18, cost_per_unit),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, id, finalStatus, qcStatus, 
         0, 
         finalOutput, 
         totalRejects,
         JSON.stringify(yieldsList),
         notes ? `[Sub-Run ${subBatchLetter}]: ${notes}` : `[Sub-Run ${subBatchLetter}] Completed`, 
         operatorName,
         finalLabour,
         finalEb,
         finalUnits,
         finalRate,
         stagesPayload ? JSON.stringify(stagesPayload) : null,
         finalOverhead,
         subTotalCost,
         totalBatchCost,
         unitCost);

      console.log('Rows affected inside transaction:', res);
    });

    const after = (await prisma.$queryRawUnsafe(`SELECT id, status, good_quantity, actual_output FROM production_batches WHERE id = $1`, id))[0];
    console.log('Batch after complete:', after);
  } catch (err) {
    console.error('Transaction error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

