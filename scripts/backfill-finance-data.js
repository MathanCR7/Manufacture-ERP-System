const { PrismaClient } = require('E:/MANUFACTURING_ERP/apps/backend/node_modules/@prisma/client');

const prisma = new PrismaClient({
  datasources: { db: { url: 'process.env.DATABASE_URL' } }
});

async function main() {
  console.log('--- Step 2: Backfilling Historical Payments ---');

  // Check default bank account
  const bankAccs = await prisma.$queryRawUnsafe(`SELECT id, type FROM bank_accounts ORDER BY id ASC;`);
  const bankAccMap = {};
  bankAccs.forEach(b => { bankAccMap[b.type] = b.id; });
  const defaultBankId = bankAccMap['BANK'] || bankAccs[0].id;
  const defaultCashId = bankAccMap['CASH'] || bankAccs[0].id;

  // Clear existing migrated payments if re-running
  await prisma.$executeRawUnsafe(`DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE is_migrated = true);`);
  await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE is_migrated = true;`);
  console.log('✓ Cleaned prior migrated entries');

  let paySeq = 1;
  function getNextPayNo(direction) {
    const prefix = direction === 'IN' ? 'RCT' : 'PAY';
    const numStr = String(paySeq++).padStart(6, '0');
    return `${prefix}-${numStr}`;
  }

  // 1. Backfill RawMaterialPOs
  const rmPOs = await prisma.$queryRawUnsafe(`
    SELECT id, "referenceNo", "supplierId", subtotal, grand_total, "paymentStatus", paid_amount, "payment_mode", "payment_date", "createdAt"
    FROM "RawMaterialPO"
    ORDER BY "createdAt" ASC;
  `);

  let rmPaidCount = 0;
  let rmTotalPaid = 0;

  for (const po of rmPOs) {
    const paidAmt = Number(po.paid_amount) || (po.paymentStatus === 'PAID' ? Number(po.grand_total) : 0);
    if (paidAmt > 0) {
      rmPaidCount++;
      rmTotalPaid += paidAmt;

      // Ensure party exists
      let partyId = po.supplierId;
      if (!partyId) {
        partyId = 'LOCAL-PURCHASE';
      }

      const mode = (po.payment_mode && ['CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS'].includes(po.payment_mode.toUpperCase()))
        ? po.payment_mode.toUpperCase()
        : 'BANK';
      const bankId = mode === 'CASH' ? defaultCashId : defaultBankId;
      const payDate = po.payment_date || po.createdAt || new Date();
      const payNo = getNextPayNo('OUT');

      const paymentRows = await prisma.$queryRawUnsafe(`
        INSERT INTO payments (payment_no, direction, party_id, bank_account_id, pay_date, mode, amount, notes, is_migrated, created_at)
        VALUES ($1, 'OUT', $2, $3, $4::date, $5, $6, $7, true, $8)
        RETURNING id;
      `, payNo, partyId, bankId, payDate, mode, paidAmt, `Historical payment for PO ${po.referenceNo}`, payDate);

      const paymentId = paymentRows[0].id;

      await prisma.$executeRawUnsafe(`
        INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, amount, created_at)
        VALUES ($1, 'PURCHASE_ORDER', $2, 'AGAINST_BILL', $3, $4);
      `, paymentId, po.id, paidAmt, payDate);
    }
  }
  console.log(`✓ Backfilled ${rmPaidCount} RawMaterialPO payments totaling ₹${rmTotalPaid.toFixed(2)}`);

  // 2. Backfill Capital Asset POs
  const assetPOs = await prisma.$queryRawUnsafe(`
    SELECT id, po_no, vendor_code, vendor_name, vendor_gstin, address, status, grand_total, po_date, created_at
    FROM asset_pos
    ORDER BY created_at ASC;
  `);

  let assetPaidCount = 0;
  let assetTotalPaid = 0;

  for (const apo of assetPOs) {
    const grandTotal = Number(apo.grand_total) || 0;
    const vendorPartyId = apo.vendor_code || 'V-' + apo.vendor_name.replace(/\s+/g, '-').toUpperCase().slice(0, 20);

    // Ensure party
    await prisma.$executeRawUnsafe(`
      INSERT INTO parties (id, type, name, gstin, address, credit_days)
      VALUES ($1, 'SUPPLIER', $2, $3, $4, 30)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    `, vendorPartyId, apo.vendor_name, apo.vendor_gstin, apo.address);

    // Create milestones for each Asset PO
    if (apo.status === 'Closed') {
      // 100% paid milestone
      const msRows = await prisma.$queryRawUnsafe(`
        INSERT INTO payment_milestones (po_id, label, percent, amount, status, created_at)
        VALUES ($1, 'Full Payment Upon Commissioning', 100.00, $2, 'PAID', $3)
        RETURNING id;
      `, apo.id, grandTotal, apo.created_at);

      const milestoneId = msRows[0].id;
      const payNo = getNextPayNo('OUT');
      const payDate = apo.po_date || apo.created_at || new Date();

      const payRows = await prisma.$queryRawUnsafe(`
        INSERT INTO payments (payment_no, direction, party_id, bank_account_id, pay_date, mode, amount, notes, is_migrated, created_at)
        VALUES ($1, 'OUT', $2, $3, $4::date, 'BANK', $5, $6, true, $7)
        RETURNING id;
      `, payNo, vendorPartyId, defaultBankId, payDate, grandTotal, `Asset purchase settlement for ${apo.po_no}`, payDate);

      await prisma.$executeRawUnsafe(`
        INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, milestone_id, amount, created_at)
        VALUES ($1, 'ASSET_PO', $2, 'MILESTONE', $3, $4, $5);
      `, payRows[0].id, apo.id, milestoneId, grandTotal, payDate);

      assetPaidCount++;
      assetTotalPaid += grandTotal;
    } else {
      // Approved status (e.g. KGMS 125 KVA DG set) -> milestones created as pending
      const m1Amt = Number((grandTotal * 0.30).toFixed(2));
      const m2Amt = Number((grandTotal * 0.60).toFixed(2));
      const m3Amt = Number((grandTotal - m1Amt - m2Amt).toFixed(2));

      await prisma.$executeRawUnsafe(`
        INSERT INTO payment_milestones (po_id, label, percent, amount, status, created_at)
        VALUES 
          ($1, 'Advance 30%', 30.00, $2, 'PENDING', $5),
          ($1, 'Delivery 60%', 60.00, $3, 'PENDING', $5),
          ($1, 'Commissioning & Handover 10%', 10.00, $4, 'PENDING', $5);
      `, apo.id, m1Amt, m2Amt, m3Amt, apo.created_at);
    }
  }
  console.log(`✓ Backfilled ${assetPaidCount} Asset PO payments totaling ₹${assetTotalPaid.toFixed(2)}`);

  // 3. Backfill Expenses
  const expenses = await prisma.$queryRawUnsafe(`
    SELECT id, "expenseNumber", title, category, date, "totalAmount", "paymentStatus", "paidAmount", "paymentMode", "supplierId", "supplierName", "supplierGstin"
    FROM "Expense"
    ORDER BY date ASC;
  `);

  let expPaidCount = 0;
  let expTotalPaid = 0;

  for (const exp of expenses) {
    const isPaid = exp.paymentStatus === 'PAID';
    const paidAmt = isPaid ? (Number(exp.paidAmount) || Number(exp.totalAmount)) : (Number(exp.paidAmount) || 0);

    if (paidAmt > 0) {
      expPaidCount++;
      expTotalPaid += paidAmt;

      // Ensure party for expense
      let partyId = exp.supplierId;
      if (!partyId) {
        const partyName = exp.supplierName || exp.title || exp.category || 'General Expense Payee';
        partyId = 'EXP-PARTY-' + Buffer.from(partyName).toString('hex').slice(0, 16);
        await prisma.$executeRawUnsafe(`
          INSERT INTO parties (id, type, name, gstin, credit_days)
          VALUES ($1, 'SUPPLIER', $2, $3, 0)
          ON CONFLICT (id) DO NOTHING;
        `, partyId, partyName, exp.supplierGstin || null);
      }

      const mode = (exp.paymentMode && ['CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS'].includes(exp.paymentMode.toUpperCase()))
        ? exp.paymentMode.toUpperCase()
        : 'CASH';
      const bankId = mode === 'CASH' ? defaultCashId : defaultBankId;
      const payDate = exp.date || new Date();
      const payNo = getNextPayNo('OUT');

      const payRows = await prisma.$queryRawUnsafe(`
        INSERT INTO payments (payment_no, direction, party_id, bank_account_id, pay_date, mode, amount, notes, is_migrated, created_at)
        VALUES ($1, 'OUT', $2, $3, $4::date, $5, $6, $7, true, $8)
        RETURNING id;
      `, payNo, partyId, bankId, payDate, mode, paidAmt, `Historical expense payment for ${exp.expenseNumber}`, payDate);

      await prisma.$executeRawUnsafe(`
        INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, amount, created_at)
        VALUES ($1, 'EXPENSE', $2, 'AGAINST_BILL', $3, $4);
      `, payRows[0].id, exp.id, paidAmt, payDate);
    }
  }
  console.log(`✓ Backfilled ${expPaidCount} Expense payments totaling ₹${expTotalPaid.toFixed(2)}`);

  console.log('✓ All historical payments successfully backfilled!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Backfill error:', e);
  process.exit(1);
});
