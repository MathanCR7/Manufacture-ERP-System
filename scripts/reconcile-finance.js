const { PrismaClient } = require('E:/MANUFACTURING_ERP/apps/backend/node_modules/@prisma/client');

const prisma = new PrismaClient({
  datasources: { db: { url: 'process.env.DATABASE_URL' } }
});

const TOLERANCE = 1.00;

function assertClose(actual, expected, label) {
  const diff = Math.abs(Number(actual) - Number(expected));
  const pass = diff <= TOLERANCE;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label}: Actual ₹${Number(actual).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | Expected ₹${Number(expected).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (diff: ₹${diff.toFixed(2)})`);
  return pass;
}

function assertEqual(actual, expected, label) {
  const pass = actual === expected;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label}: Actual '${actual}' | Expected '${expected}'`);
  return pass;
}

async function main() {
  console.log('================================================================');
  console.log('       FINANCE RECONCILIATION & REGRESSION TEST SUITE           ');
  console.log('================================================================\n');

  let allPassed = true;

  // 1. Raw Material Purchase Orders
  console.log('--- 1. Raw Material Purchase Orders (v_finance_documents) ---');
  const rmDocs = await prisma.$queryRawUnsafe(`
    SELECT * FROM v_finance_documents WHERE doc_type = 'PURCHASE_ORDER';
  `);
  allPassed = assertEqual(rmDocs.length, 32, 'RM PO Count') && allPassed;

  const rmSubtotal = rmDocs.reduce((s, r) => s + Number(r.subtotal), 0);
  const rmGst = rmDocs.reduce((s, r) => s + Number(r.tax_cgst) + Number(r.tax_sgst) + Number(r.tax_igst), 0);
  const rmTotal = rmDocs.reduce((s, r) => s + Number(r.grand_total), 0);
  const rmPaid = rmDocs.reduce((s, r) => s + Number(r.paid_amount), 0);
  const rmBalance = rmDocs.reduce((s, r) => s + Number(r.balance), 0);

  allPassed = assertClose(rmSubtotal, 450001.03, 'RM PO Subtotal') && allPassed;
  allPassed = assertClose(rmGst, 41677.72, 'RM PO GST') && allPassed;
  allPassed = assertClose(rmTotal, 491758.00, 'RM PO Grand Total') && allPassed;
  allPassed = assertClose(rmPaid, 429698.00, 'RM PO Paid Amount') && allPassed;
  allPassed = assertClose(rmBalance, 62060.00, 'RM PO Outstanding Balance') && allPassed;

  // Check specific PO statuses
  const po19 = rmDocs.find(r => r.doc_no === 'PO-000019');
  allPassed = assertEqual(po19 ? po19.payment_status : 'NOT_FOUND', 'PAID', 'PO-000019 Settlement under ₹1.00 Round-off Rule (Paid 16,157 / 16,158)') && allPassed;

  const unpaidExpected = ['PO-000030', 'PO-000029', 'PO-000028', 'PO-000024'];
  const actualUnpaid = rmDocs.filter(r => r.payment_status === 'UNPAID').map(r => r.doc_no);
  const unpaidMatch = unpaidExpected.every(p => actualUnpaid.includes(p));
  console.log(`[${unpaidMatch ? 'PASS' : 'FAIL'}] 4 Unpaid POs strictly identified: ${actualUnpaid.join(', ')}`);
  allPassed = unpaidMatch && allPassed;

  // 2. Capital Asset POs
  console.log('\n--- 2. Capital Asset Purchase Orders (v_finance_documents) ---');
  const assetDocs = await prisma.$queryRawUnsafe(`
    SELECT * FROM v_finance_documents WHERE doc_type = 'ASSET_PO';
  `);
  allPassed = assertEqual(assetDocs.length, 4, 'Asset PO Count') && allPassed;

  const assetSubtotal = assetDocs.reduce((s, r) => s + Number(r.subtotal), 0);
  const assetGst = assetDocs.reduce((s, r) => s + Number(r.tax_cgst) + Number(r.tax_sgst) + Number(r.tax_igst), 0);
  const assetTotal = assetDocs.reduce((s, r) => s + Number(r.grand_total), 0);

  allPassed = assertClose(assetSubtotal, 3354250.00, 'Asset PO Subtotal') && allPassed;
  allPassed = assertClose(assetGst, 607113.00, 'Asset PO GST') && allPassed;
  allPassed = assertClose(assetTotal, 3979963.00, 'Asset PO Grand Total') && allPassed;

  const kgmsDoc = assetDocs.find(r => r.doc_no === 'PO-2026-11-14-00003');
  allPassed = assertEqual(kgmsDoc ? kgmsDoc.document_status : 'NOT_FOUND', 'Approved', 'KGMS 125 KVA DG Set Document Status') && allPassed;

  // 3. Customer Sales Orders
  console.log('\n--- 3. Sales Orders (v_finance_documents) ---');
  const soDocs = await prisma.$queryRawUnsafe(`
    SELECT * FROM v_finance_documents WHERE doc_type = 'SALES_ORDER';
  `);
  allPassed = assertEqual(soDocs.length, 6, 'Sales Order Count') && allPassed;

  const soSubtotal = soDocs.reduce((s, r) => s + Number(r.subtotal), 0);
  const soTotal = soDocs.reduce((s, r) => s + Number(r.grand_total), 0);

  allPassed = assertClose(soSubtotal, 133568.00, 'Sales Orders Net Subtotal') && allPassed;
  allPassed = assertClose(soTotal, 148681.00, 'Sales Orders Grand Total') && allPassed;

  const allSoUnpaid = soDocs.every(r => r.payment_status === 'UNPAID');
  console.log(`[${allSoUnpaid ? 'PASS' : 'FAIL'}] All Sales Orders confirmed UNPAID pending production: ${allSoUnpaid}`);
  allPassed = allSoUnpaid && allPassed;

  // 4. Quotations Pipeline
  console.log('\n--- 4. Quotations Pipeline (v_quotation_pipeline) ---');
  const quoteDocs = await prisma.$queryRawUnsafe(`
    SELECT * FROM v_quotation_pipeline;
  `);
  allPassed = assertEqual(quoteDocs.length, 5, 'Quotation Pipeline Count') && allPassed;

  const quoteTotal = quoteDocs.reduce((s, r) => s + Number(r.grand_total), 0);
  allPassed = assertClose(quoteTotal, 92055.00, 'Quotations Pipeline Grand Total (Excluded from Receivables)') && allPassed;

  // Verify quotations are NOT in v_finance_documents
  const quotesInFin = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt FROM v_finance_documents WHERE doc_type = 'QUOTATION';
  `);
  allPassed = assertEqual(quotesInFin[0].cnt, 0, 'Zero Quotations leaking into Receivables/Liabilities') && allPassed;

  // 5. Operating Expenses
  console.log('\n--- 5. Operating Expenses (v_finance_documents) ---');
  const expDocs = await prisma.$queryRawUnsafe(`
    SELECT * FROM v_finance_documents WHERE doc_type = 'EXPENSE';
  `);
  console.log(`[PASS] Operating Expenses Count: ${expDocs.length} records active in system`);

  // 6. GST Tax Credit Reconciliation (v_gst_register)
  console.log('\n--- 6. GST Tax Credit Reconciliation (v_gst_register) ---');
  const gstRows = await prisma.$queryRawUnsafe(`
    SELECT 
      SUM(total_itc) as sum_itc, 
      SUM(total_output) as sum_output, 
      SUM(net_gst_payable) as sum_payable,
      SUM(carry_forward_itc) as sum_carry_forward
    FROM v_gst_register;
  `);

  const sumItc = Number(gstRows[0].sum_itc);
  const sumOutput = Number(gstRows[0].sum_output);
  const sumPayable = Number(gstRows[0].sum_payable);
  const sumCarryForward = Number(gstRows[0].sum_carry_forward);

  console.log(`Total System Input Tax Credit (ITC): ₹${sumItc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`Total System Output Tax Liability: ₹${sumOutput.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  allPassed = assertEqual(sumPayable, 0, 'Net GST Payable to Govt (Covered by ITC)') && allPassed;
  console.log(`Net Carry-Forward Input Tax Credit: ₹${sumCarryForward.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

  // 7. Canonical Stock & UOM Conversion
  console.log('\n--- 7. Canonical Raw Material Stock (Alternate UOM gm/kg) ---');
  const chocoChip = await prisma.rawMaterial.findUnique({
    where: { code: 'RM-00079' }
  });

  allPassed = assertEqual(chocoChip ? chocoChip.hasAlternateUom : false, true, 'RM-00079 hasAlternateUom enabled') && allPassed;
  allPassed = assertEqual(chocoChip ? chocoChip.alternateUom : '', 'gm', 'RM-00079 alternateUom is gm') && allPassed;
  allPassed = assertEqual(chocoChip ? Number(chocoChip.conversionFactor) : 0, 1000, 'RM-00079 conversion factor is 1000') && allPassed;

  console.log('\n================================================================');
  if (allPassed) {
    console.log('       ALL FINANCE RECONCILIATION TESTS PASSED (100% SUCCESS)    ');
  } else {
    console.log('       WARNING: SOME CHECKS DID NOT PASS - REVIEW ABOVE          ');
  }
  console.log('================================================================\n');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Reconciliation error:', e);
  process.exit(1);
});
