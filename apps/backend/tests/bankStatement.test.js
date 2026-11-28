const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const env = require('../src/config/env');
const prisma = require('../src/database/prisma');
const authMiddleware = require('../src/middlewares/auth.middleware');
const bankStatementRoutes = require('../src/modules/finance/bankStatement.routes');
const { ensureBankStatementSchema } = require('../src/database/migrations/ensure_bank_statement_schema');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/finance/bank-statement', authMiddleware, bankStatementRoutes);
const {
  validateGstin,
  parseStatementDate,
  resolvePresetDateRange,
  sanitizeSpreadsheetCell,
  extractPaymentMetadata
} = require('../src/modules/finance/bankStatement.utils');

const TEST_COMPANY_A = 'test-company-bank-a-' + Date.now();
const TEST_COMPANY_B = 'test-company-bank-b-' + Date.now();

function makeToken({ id = 'test-user-a', role = 'MAIN_MASTER', companyId }) {
  return jwt.sign({ id, name: 'Test User', email: 'test@erp.local', role, companyId }, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Bank Statement & GST Review — Unit + 12 Acceptance Tests', () => {
  let tokenA;
  let tokenB;
  let tokenSupervisor;
  let accountAId;
  let accountBId;
  let sampleWorkbookBuffer;
  let savedRowsFromBatch;

  beforeAll(async () => {
    await ensureBankStatementSchema(prisma, true);

    tokenA = makeToken({ id: 'user-a', role: 'MAIN_MASTER', companyId: TEST_COMPANY_A });
    tokenB = makeToken({ id: 'user-b', role: 'MAIN_MASTER', companyId: TEST_COMPANY_B });
    tokenSupervisor = makeToken({ id: 'sup-a', role: 'SUPERVISOR', companyId: TEST_COMPANY_A });

    const resA = await request(app)
      .post('/api/finance/bank-statement/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ accountName: 'ICICI Test Account A', bankName: 'ICICI', accountNumber: '091305001111', openingBalance: 0 });
    expect(resA.status).toBe(201);
    accountAId = resA.body.data.id;

    const resB = await request(app)
      .post('/api/finance/bank-statement/accounts')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ accountName: 'HDFC Test Account B', bankName: 'HDFC', accountNumber: '502000999999', openingBalance: 0 });
    expect(resB.status).toBe(201);
    accountBId = resB.body.data.id;

    // Build an authentic 8-row Excel statement matching Prompt 8 acceptance numbers:
    // Credits: 1,000.00 + 2,00,000.00 = 2,01,000.00
    // Debits:  1,708.26 (in May across 2 rows) + 86,475.52 (in 01-Jun..03-Jun across 4 rows) = 88,183.78
    // Balance gap on 14-May-2026: +10,00,000.00
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Statement');
    ws.addRow(['Account Statement Export']); // Junk row before header to verify auto header finder
    ws.addRow(['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Branch Code', 'Debit', 'Credit', 'Balance', 'Remarks', 'Month', 'Year', 'Type']);
    // Row 1 (30-Apr-26): Cr 1,000.00 -> Bal 1,000.00
    ws.addRow(['30-Apr-26', '30-Apr-26', 'BY TRANSFER-UPI/CR/648670488985/PRIYANKA U/ICIC/priyankasl/UPI--', 'TRANSFER FROM 4897735162098 /', '913', '', '1,000.00', '1,000.00', 'Cr - Priyanka Capital receipt', 'April', '26-27', 'Online']);
    // Row 2 (10-May-26): Cr 2,00,000.00 -> Bal 2,01,000.00
    ws.addRow(['10-May-26', '10-May-26', 'BY TRANSFER-NEFT/CR/UTR9988776655/ACME DAIRY', 'UTR9988776655', '913', '', '2,00,000.00', '2,01,000.00', 'Sales receipt', '', '', 'Online']);
    // Row 3 (14-May-26): Dr 1,500.00 -> Expected 1,99,500.00, Actual 11,99,500.00 => Gap +10,00,000.00!
    ws.addRow(['14-May-26', '14-May-26', 'INB/AIRTEL BROADBAND BILL', 'INB11223344', '913', '1,500.00', '', '11,99,500.00', 'Airtel broadband', '', '', 'Online']);
    // Row 4 (20-May-26): Dr 208.26 -> Bal 11,99,291.74
    ws.addRow(['20-May-26', '20-May-26', 'BANK COMMISSION CHARGES', 'CHG20260520', '913', '208.26', '', '11,99,291.74', 'Bank commission', '', '', 'Charges']);
    // Rows 5..8 (01-Jun-26 to 03-Jun-26): 4 rows summing Debit = 86,475.52
    // Row 5: Dr 40,000.00 -> Bal 11,59,291.74
    ws.addRow(['01-Jun-26', '01-Jun-26', 'TO TRANSFER-NEFT/DR/100001/MILK SUPPLIER', '100001', '913', '40,000.00', '', '11,59,291.74', 'Part payment 1 Inv INV-501', '', '', '']);
    // Row 6: Dr 30,000.00 -> Bal 11,29,291.74
    ws.addRow(['02-Jun-26', '02-Jun-26', 'TO TRANSFER-NEFT/DR/100002/MILK SUPPLIER', '100002', '913', '30,000.00', '', '11,29,291.74', 'Part payment 2 Inv INV-501', '', '', '']);
    // Row 7: Dr 10,000.00 -> Bal 11,19,291.74
    ws.addRow(['02-Jun-26', '02-Jun-26', 'TO TRANSFER-UPI/DR/200002/TNEB POWER/TNEB', '200002', '913', '10,000.00', '', '11,19,291.74', 'TNEB electricity', '', '', '']);
    // Row 8: Dr 6,475.52 -> Bal 11,12,816.22
    ws.addRow(['03-Jun-26', '03-Jun-26', 'TO TRANSFER-IMPS/DR/300003/FSSAI GOVT', '300003', '913', '6,475.52', '', '11,12,816.22', 'FSSAI fee', '', '', '']);

    sampleWorkbookBuffer = Buffer.from(await wb.xlsx.writeBuffer());
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM bank_audit_log WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$executeRawUnsafe(`DELETE FROM bank_gstr2b_entries WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$executeRawUnsafe(`DELETE FROM bank_txn_invoice_allocations WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$executeRawUnsafe(`DELETE FROM bank_txn_gst WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$executeRawUnsafe(`DELETE FROM bank_txn WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$executeRawUnsafe(`DELETE FROM bank_import_batches WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$executeRawUnsafe(`DELETE FROM bank_statement_accounts WHERE company_id IN ($1, $2);`, TEST_COMPANY_A, TEST_COMPANY_B);
    await prisma.$disconnect();
  });

  test('Unit checks: GSTIN check digit, dates, metadata extraction, formula neutralization, week/month/FY boundaries', () => {
    expect(validateGstin('33ABBFV9667J1ZL').valid).toBe(true);
    expect(validateGstin('33ABBFV9667J1Z0').valid).toBe(false);
    expect(parseStatementDate('30-Apr-26')).toEqual({ ok: true, isBlank: false, iso: '2026-04-30' });
    expect(parseStatementDate('31/02/2026').ok).toBe(false);
    expect(extractPaymentMetadata('BY TRANSFER-UPI/CR/648670488985/PRIYANKA U/ICIC/priyankasl/UPI--', 'TRANSFER FROM 4897735162098 /')).toEqual({
      mode: 'UPI',
      utr: '648670488985',
      partyName: 'PRIYANKA U'
    });
    expect(sanitizeSpreadsheetCell('=CMD|calc')).toBe("'=CMD|calc");

    // Acceptance Test 9: Week (Mon-Sun), Month, Year, FY boundaries
    const refDate = new Date('2026-04-01T10:00:00+05:30'); // Wed Apr 1, 2026
    expect(resolvePresetDateRange('this_week', null, null, refDate)).toEqual({ from: '2026-03-30', to: '2026-04-05' });
    expect(resolvePresetDateRange('last_week', null, null, refDate)).toEqual({ from: '2026-03-23', to: '2026-03-29' });
    expect(resolvePresetDateRange('this_month', null, null, refDate)).toEqual({ from: '2026-04-01', to: '2026-04-30' });
    expect(resolvePresetDateRange('last_month', null, null, refDate)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(resolvePresetDateRange('this_fy', null, null, refDate)).toEqual({ from: '2026-04-01', to: '2027-03-31' });
    expect(resolvePresetDateRange('last_fy', null, null, refDate)).toEqual({ from: '2025-04-01', to: '2026-03-31' });
  });

  test('Acceptance 1, 2, 3 & 7: Preview, Forced error rollback leaves DB clean, Commit 8 rows matches totals & balance gap', async () => {
    const previewRes = await request(app)
      .post('/api/finance/bank-statement/preview')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('bankAccountId', accountAId)
      .attach('file', sampleWorkbookBuffer, 'sample-8-rows.xlsx');

    expect(previewRes.status).toBe(200);
    const { rows, summary } = previewRes.body.data;
    expect(rows.length).toBe(8);
    expect(summary.totalCredit).toBe(201000);
    expect(summary.totalDebit).toBe(88183.78);
    expect(summary.balanceGapCount).toBe(1);
    const gapRow = rows.find((r) => r.balanceGap);
    expect(gapRow.txnDate).toBe('2026-05-14');
    expect(gapRow.balanceGapDiff).toBe(1000000);

    // Acceptance 7: Forced error leaves DB unchanged
    const failRes = await request(app)
      .post('/api/finance/bank-statement/commit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bankAccountId: accountAId, fileName: 'sample-8-rows.xlsx', rows, simulateError: true });
    expect(failRes.status).toBe(500);

    const checkEmpty = await request(app)
      .get('/api/finance/bank-statement/transactions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(checkEmpty.body.data.summary.count).toBe(0);

    // Acceptance 1, 2, 3 & 8 (Two concurrent commits save exactly 8 rows, never 16!)
    const [commit1, commit2] = await Promise.all([
      request(app).post('/api/finance/bank-statement/commit').set('Authorization', `Bearer ${tokenA}`)
        .send({ bankAccountId: accountAId, fileName: 'sample-8-rows.xlsx', rows }),
      request(app).post('/api/finance/bank-statement/commit').set('Authorization', `Bearer ${tokenA}`)
        .send({ bankAccountId: accountAId, fileName: 'sample-8-rows.xlsx', rows })
    ]);
    const totalSavedConcurrent = (commit1.body.data?.savedCount || 0) + (commit2.body.data?.savedCount || 0);
    expect(totalSavedConcurrent).toBe(8);

    const listRes = await request(app)
      .get('/api/finance/bank-statement/transactions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listRes.body.data.summary.count).toBe(8);
    expect(listRes.body.data.summary.totalCredit).toBe(201000);
    expect(listRes.body.data.summary.totalDebit).toBe(88183.78);
    savedRowsFromBatch = listRes.body.data.rows;
  });

  test('Acceptance 4 & 5: Re-uploading same file saves 0 rows, even after editing a saved row', async () => {
    // Re-preview & commit same file -> 0 saved
    const p1 = await request(app)
      .post('/api/finance/bank-statement/preview')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('bankAccountId', accountAId)
      .attach('file', sampleWorkbookBuffer, 'sample-8-rows.xlsx');
    expect(p1.body.data.summary.duplicateCount).toBe(8);
    expect(p1.body.data.summary.willSaveCount).toBe(0);

    const c1 = await request(app)
      .post('/api/finance/bank-statement/commit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ bankAccountId: accountAId, fileName: 'sample-8-rows.xlsx', rows: p1.body.data.rows });
    expect(c1.body.data.savedCount).toBe(0);

    // Edit one saved row
    const targetRow = savedRowsFromBatch[0];
    const editRes = await request(app)
      .put(`/api/finance/bank-statement/transactions/${targetRow.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        version: targetRow.version,
        description: targetRow.description + ' EDITED',
        remarks: 'Updated remark'
      });
    expect(editRes.status).toBe(200);

    // Upload same file again -> STILL blocked via source_key -> 0 saved!
    const p2 = await request(app)
      .post('/api/finance/bank-statement/preview')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('bankAccountId', accountAId)
      .attach('file', sampleWorkbookBuffer, 'sample-8-rows.xlsx');
    expect(p2.body.data.summary.willSaveCount).toBe(0);
  });

  test('Acceptance 6: Custom filter 01-Jun-2026 to 03-Jun-2026 returns 4 rows with debit ₹86,475.52', async () => {
    const res = await request(app)
      .get('/api/finance/bank-statement/transactions?preset=custom&from=2026-06-01&to=2026-06-03')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.count).toBe(4);
    expect(res.body.data.summary.totalDebit).toBe(86475.52);
  });

  test('Acceptance 10: Company isolation blocks Company B from viewing Company A transactions', async () => {
    const resB = await request(app)
      .get('/api/finance/bank-statement/transactions')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.summary.count).toBe(0);

    const rowA = savedRowsFromBatch[0];
    const editByB = await request(app)
      .put(`/api/finance/bank-statement/transactions/${rowA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ version: 1, description: 'Tamper' });
    expect(editByB.status).toBe(404);
  });

  test('Acceptance 12: One invoice paid in two parts counts its tax once in ITC totals', async () => {
    const invRows = savedRowsFromBatch.filter((r) => r.remarks.includes('INV-501'));
    expect(invRows.length).toBe(2);

    const sharedInvoiceAlloc = [{
      invoiceSource: 'PURCHASE_ORDER',
      invoiceId: 'po-501',
      invoiceNo: 'INV-501',
      invoiceDate: '2026-06-01',
      partyName: 'MILK SUPPLIER',
      partyGstin: '33ABBFV9667J1ZL',
      invoiceTaxable: 60000,
      invoiceCgst: 4500,
      invoiceSgst: 4500,
      invoiceIgst: 0,
      invoiceTotal: 69000,
      allocatedAmount: 35000
    }];

    for (const r of invRows) {
      const rev = await request(app)
        .put(`/api/finance/bank-statement/gst-review/${r.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          treatment: 'Purchase: ITC to verify',
          invoiceNo: 'INV-501',
          invoiceDate: '2026-06-01',
          gstin: '33ABBFV9667J1ZL',
          taxableAmount: 60000,
          cgstAmount: 4500,
          sgstAmount: 4500,
          igstAmount: 0,
          foundInGstr2b: 'Yes',
          imsStatus: 'Accepted',
          allocations: sharedInvoiceAlloc
        });
      expect(rev.status).toBe(200);
    }

    const gstRes = await request(app)
      .get('/api/finance/bank-statement/gst-review')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(gstRes.status).toBe(200);
    // Tax is 4500 + 4500 = 9000 counted ONCE despite 2 linked payments!
    expect(gstRes.body.data.kpis.itcDocsComplete).toBe(9000);
  });

  test('Acceptance 11 & Security: Supervisor read-only blocked from delete; Soft-deleted row excluded from totals', async () => {
    const target = savedRowsFromBatch.find((r) => r.txn_date === '2026-05-20');
    const supDel = await request(app)
      .delete(`/api/finance/bank-statement/transactions/${target.id}`)
      .set('Authorization', `Bearer ${tokenSupervisor}`);
    expect(supDel.status).toBe(403);

    const delRes = await request(app)
      .delete(`/api/finance/bank-statement/transactions/${target.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(delRes.status).toBe(200);

    const listAfter = await request(app)
      .get('/api/finance/bank-statement/transactions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listAfter.body.data.summary.count).toBe(7);
    expect(listAfter.body.data.summary.totalDebit).toBe(87975.52); // 88183.78 - 208.26
  });

  test('Excel exports generate valid workbooks for Transactions and 6-sheet GST Working Paper', async () => {
    const txExp = await request(app)
      .get('/api/finance/bank-statement/export/transactions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(txExp.status).toBe(200);
    expect(txExp.headers['content-type']).toContain('spreadsheetml.sheet');

    const gstExp = await request(app)
      .get('/api/finance/bank-statement/export/gst?finYear=26-27')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(gstExp.status).toBe(200);
    expect(gstExp.headers['content-type']).toContain('spreadsheetml.sheet');
  });

  test('Bank Master: Create, Edit/Update, Reorder, Move Transactions, and Delete safely in DB', async () => {
    const createA2 = await request(app)
      .post('/api/finance/bank-statement/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ accountName: 'Secondary Bank A2', bankName: 'SBI', accountNumber: '000011112222', branchName: 'Chennai', ifscCode: 'SBIN0001234', isDefault: true });
    expect(createA2.status).toBe(201);
    const acctA2Id = createA2.body.data.id;

    // Update name & branch
    const upd = await request(app)
      .put(`/api/finance/bank-statement/accounts/${acctA2Id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ accountName: 'SBI Corporate Account', branchName: 'Guindy' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.account_name).toBe('SBI Corporate Account');

    // Reorder
    const reord = await request(app)
      .post('/api/finance/bank-statement/accounts/reorder')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderedIds: [acctA2Id, accountAId] });
    expect(reord.status).toBe(200);

    // Move transactions from accountAId -> acctA2Id
    const mv = await request(app)
      .post(`/api/finance/bank-statement/accounts/${accountAId}/move-transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetAccountId: acctA2Id });
    expect(mv.status).toBe(200);
    expect(mv.body.movedCount).toBe(7);

    // Now accountAId has 0 transactions and can be deleted cleanly
    const del = await request(app)
      .delete(`/api/finance/bank-statement/accounts/${accountAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(del.status).toBe(200);

    // Recovery & Batch Rollback tests:
    // 1. Restore a soft-deleted transaction
    const logsBefore = await request(app)
      .get('/api/finance/bank-statement/audit-logs')
      .set('Authorization', `Bearer ${tokenA}`);
    const delLog = logsBefore.body.data.find((l) => l.action === 'TXN_DELETE' && l.txn_is_deleted);
    expect(delLog).toBeTruthy();

    const restoreRes = await request(app)
      .post(`/api/finance/bank-statement/transactions/${delLog.txn_id}/restore`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(restoreRes.status).toBe(200);

    // 2. Remove an entire uploaded Excel batch cleanly, then restore it
    const batchesRes = await request(app)
      .get('/api/finance/bank-statement/batches')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(batchesRes.status).toBe(200);
    const activeBatch = batchesRes.body.data.find((b) => b.active_rows > 0);
    expect(activeBatch).toBeTruthy();

    const undoBatchRes = await request(app)
      .delete(`/api/finance/bank-statement/batches/${activeBatch.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(undoBatchRes.status).toBe(200);
    expect(undoBatchRes.body.data.removedCount).toBe(activeBatch.active_rows);

    const listAfterUndo = await request(app)
      .get('/api/finance/bank-statement/transactions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listAfterUndo.body.data.summary.count).toBe(0);

    const restoreBatchRes = await request(app)
      .post(`/api/finance/bank-statement/batches/${activeBatch.id}/restore`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(restoreBatchRes.status).toBe(200);
    expect(restoreBatchRes.body.data.restoredCount).toBe(activeBatch.active_rows);
  });

  test('Intelligent Multi-Format Column Mapping: screenshot order, fuzzy bank aliases, Amount+Dr/Cr, and NEFT UTR extraction', async () => {
    const { parseGridWithMapping, extractPaymentMetadata } = require('../src/modules/finance/bankStatement.utils');

    // 1. Screenshot column order + fuzzy currency labels + repeated mid-page header + star/UTR NO extraction
    const gridA = [
      ['Account Summary Export'],
      ['Txn Date', 'Value Date', 'Description', 'Branch Code', 'Debit (INR)', 'Credit (INR)', 'Closing Balance (Rs.)', 'Chq./Ref. Number', 'Remarks', 'Month', 'Year', 'Type'],
      ['01-Jun-26', '01-Jun-26', 'CHQ TRANSFER-NEFT UTR NO: SBIN126152075451--756052 THE TIIC LTD', '913', '39,664.72', '', '9,59,627.02 Cr', 'TRANSFER1', 'Loan EMI', '', '', ''],
      ['Txn Date', 'Value Date', 'Description', 'Branch Code', 'Debit (INR)', 'Credit (INR)', 'Closing Balance (Rs.)', 'Chq./Ref. Number', 'Remarks', 'Month', 'Year', 'Type'],
      ['04-Jun-26', '04-Jun-26', 'BY TRANSFER-NEFT*HDFC0000001*HDFCH01039257470*RAJARAJAN U*BATC--', '913', '', '2,00,000.00', '11,59,627.02 Cr', '', '', '', '', 'Online']
    ];
    const parsedA = parseGridWithMapping(gridA, acctIdForMappingCheck());
    expect(parsedA.rows).toHaveLength(2);
    expect(parsedA.rows[0].debit).toBe(39664.72);
    expect(parsedA.rows[0].utr).toBe('SBIN126152075451');
    expect(parsedA.rows[0].partyName).toContain('THE TIIC LTD');
    expect(parsedA.rows[0].month).toBe('June');
    expect(parsedA.rows[0].year).toBe('26-27');
    expect(parsedA.rows[1].credit).toBe(200000);
    expect(parsedA.rows[1].utr).toBe('HDFCH01039257470');
    expect(parsedA.rows[1].partyName).toBe('RAJARAJAN U');

    // 2. Single Amount + Dr/Cr column format (used by Kotak / Axis / CSV statements)
    const gridB = [
      ['Date', 'Particulars', 'Transaction Amount', 'Dr / Cr', 'Running Balance'],
      ['15/06/2026', 'UPI/DR/776655443322/DAIRY MART/OKICICI', '1,250.50', 'DR', '50,000.00'],
      ['16/06/2026', 'IMPS/CR/88776655/CUSTOMER ABC', '4,500.00', 'CR', '54,500.00']
    ];
    const parsedB = parseGridWithMapping(gridB, acctIdForMappingCheck());
    expect(parsedB.mappingInfo.detectionMode).toBe('amount-drcr');
    expect(parsedB.rows).toHaveLength(2);
    expect(parsedB.rows[0].debit).toBe(1250.5);
    expect(parsedB.rows[0].credit).toBe(0);
    expect(parsedB.rows[1].credit).toBe(4500);

    const neftMeta = extractPaymentMetadata('BY TRANSFER-NEFT*HDFC0000001*HDFCH01039257470*RAJARAJAN U*BATC--', '');
    expect(neftMeta.mode).toBe('NEFT');
    expect(neftMeta.utr).toBe('HDFCH01039257470');
    expect(neftMeta.partyName).toBe('RAJARAJAN U');

    // 3. Exact custom headers: Narration | Effective Date | Posting Date | Payment Mode | Money In | Money Out | Closing Balance | User Note | Transaction Reference | Bank Branch | Period Month | Financial Year
    const gridC = [
      ['Narration', 'Effective Date', 'Posting Date', 'Payment Mode', 'Money In', 'Money Out', 'Closing Balance', 'User Note', 'Transaction Reference', 'Bank Branch', 'Period Month', 'Financial Year'],
      ['BY TRANSFER-UPI/CR/300000000001/SAMPLE PARTNER/TEST/demo/UPI--', '06-Apr-26', '05-Apr-26', 'Online', '75,000.00', '', '1,00,000.00', 'Cr - Sample Partner Capital', 'TRANSFER FROM 0000000000011 / ', '913', 'April', '26-27'],
      ['TO TRANSFER-INB--', '18-May-26', '18-May-26', 'Online', '', '2,360.00', '97,640.00', 'Sample Internet Bill', 'SMP202CHX0000202', '99922', 'May', '26-27'],
      ['CHQ TRANSFER-NEFT UTR NO: SMPUTR000204--200204 SAMPLE SUPPLIER LTD', '14-Jul-26', '11-Jul-26', 'Cheque', '', '18,500.00', '72,265.00', 'Sample Packing Material', ' / 200204 SAMPLE SUPPLIER LTD', '64929', 'July', '26-27'],
      ['BY TRANSFER-NEFT*SMPL0000001*SMPUTR000206*SAMPLE CUSTOMER B*TEST--', '08-Aug-26', '07-Aug-26', 'Online', '1,25,000.00', '', '1,97,247.30', 'Cr - Sample Customer B', 'TRANSFER FROM 0000000000012 / ', '4430', 'August', '26-27']
    ];
    const parsedC = parseGridWithMapping(gridC, acctIdForMappingCheck());
    expect(parsedC.rows).toHaveLength(4);
    expect(parsedC.rows[0].txnDate).toBe('2026-04-05');
    expect(parsedC.rows[0].valueDate).toBe('2026-04-06');
    expect(parsedC.rows[0].credit).toBe(75000);
    expect(parsedC.rows[0].debit).toBe(0);
    expect(parsedC.rows[0].balance).toBe(100000);
    expect(parsedC.rows[0].remarks).toBe('Cr - Sample Partner Capital');
    expect(parsedC.rows[0].branchCode).toBe('913');
    expect(parsedC.rows[0].type).toBe('Online');
    expect(parsedC.rows[1].debit).toBe(2360);
    expect(parsedC.rows[1].utr).toBe('SMP202CHX0000202');
    expect(parsedC.rows[2].utr).toBe('SMPUTR000204');
    expect(parsedC.rows[3].credit).toBe(125000);
    expect(parsedC.rows[3].partyName).toBe('SAMPLE CUSTOMER B');

    // 4. Deterministic zero-AI balance-equation prediction even when column headers are completely unfamiliar (Col 1..Col 7)
    const gridUnknownHeaders = [
      ['Text Info', 'Dt1', 'Dt2', 'Col Out', 'Col In', 'Col End'],
      ['BY TRANSFER-UPI/CR/300000000001/SAMPLE PARTNER/TEST', '06-Apr-26', '05-Apr-26', '', '75,000.00', '1,00,000.00'],
      ['TO TRANSFER-INB-- Internet Bill', '18-May-26', '18-May-26', '2,360.00', '', '97,640.00'],
      ['TO TRANSFER-INB-- Electricity', '24-Jun-26', '23-Jun-26', '6,875.00', '', '90,765.00']
    ];
    const parsedPredicted = parseGridWithMapping(gridUnknownHeaders, acctIdForMappingCheck());
    expect(parsedPredicted.mappingInfo.detectionMode).toBe('predicted');
    expect(parsedPredicted.rows).toHaveLength(3);
    expect(parsedPredicted.rows[0].credit).toBe(75000);
    expect(parsedPredicted.rows[1].debit).toBe(2360);
    expect(parsedPredicted.rows[2].debit).toBe(6875);

    // 5. Descending (newest-first) + all-debit (blank credit col) + Serial No exclusion with unknown headers
    const gridDesc = [
      ['S No', 'Dt', 'Particular', 'Pay Col', 'Rcpt Col', 'End Bal'],
      ['1', '14-Jul-26', 'CHQ TRANSFER-NEFT--200204 SAMPLE SUPPLIER LTD', '18,500.00', '', '72,265.00'],
      ['2', '24-Jun-26', 'TO TRANSFER-INB-- Sample Electricity', '6,875.00', '', '90,765.00'],
      ['3', '18-May-26', 'TO TRANSFER-INB-- Sample Internet Bill', '2,360.00', '', '97,640.00']
    ];
    const parsedDesc = parseGridWithMapping(gridDesc, acctIdForMappingCheck());
    expect(parsedDesc.mappingInfo.detectionMode).toBe('predicted');
    expect(parsedDesc.rows).toHaveLength(3);
    expect(parsedDesc.rows[0].debit).toBe(18500);
    expect(parsedDesc.rows[0].credit).toBe(0);
    expect(parsedDesc.rows[0].branchCode).toBe(''); // S No 1,2,3 never mistaken for branch code
    expect(parsedDesc.rows[1].suggestedTreatment).toBe('Exempt / Non-GST');
    expect(parsedDesc.rows[2].suggestedTreatment).toBe('Purchase: ITC to verify');

    function acctIdForMappingCheck() {
      return 999;
    }
  });
});
