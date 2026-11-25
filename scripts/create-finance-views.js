const { PrismaClient } = require('E:/MANUFACTURING_ERP/apps/backend/node_modules/@prisma/client');

const prisma = new PrismaClient({
  datasources: { db: { url: 'process.env.DATABASE_URL' } }
});

async function run(sql, desc) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('✓ ' + desc);
  } catch (err) {
    console.error('Error on: ' + desc, err.message);
    throw err;
  }
}

async function main() {
  console.log('--- Step 3: Creating Finance SQL Views ---');

  // 1. Drop existing views if any
  await run(`DROP VIEW IF EXISTS v_finance_documents CASCADE;`, 'Dropped v_finance_documents if exists');
  await run(`DROP VIEW IF EXISTS v_quotation_pipeline CASCADE;`, 'Dropped v_quotation_pipeline if exists');
  await run(`DROP VIEW IF EXISTS v_party_ledger CASCADE;`, 'Dropped v_party_ledger if exists');
  await run(`DROP VIEW IF EXISTS v_gst_register CASCADE;`, 'Dropped v_gst_register if exists');
  await run(`DROP VIEW IF EXISTS v_cash_bank_book CASCADE;`, 'Dropped v_cash_bank_book if exists');
  await run(`DROP VIEW IF EXISTS v_aging_payables CASCADE;`, 'Dropped v_aging_payables if exists');
  await run(`DROP VIEW IF EXISTS v_aging_receivables CASCADE;`, 'Dropped v_aging_receivables if exists');

  // 2. Create v_finance_documents
  await run(`
    CREATE OR REPLACE VIEW v_finance_documents AS
    WITH raw_docs AS (
      -- 1. Raw Material Purchase Orders
      SELECT 
        'PURCHASE_ORDER'::text AS doc_type,
        po.id::text AS doc_id,
        po."referenceNo"::text AS doc_no,
        po."createdAt"::date AS doc_date,
        COALESCE(po.due_date, (po."createdAt"::date + COALESCE(p.credit_days, 30)))::date AS due_date,
        COALESCE(po."supplierId", 'LOCAL-PURCHASE')::text AS party_id,
        COALESCE(p.name, s.name, 'LOCAL PURCHASE')::text AS party_name,
        'PAYABLE'::text AS direction,
        ROUND(COALESCE(po.subtotal, 0), 2) AS subtotal,
        ROUND(COALESCE(po.cgst, 0), 2) AS tax_cgst,
        ROUND(COALESCE(po.sgst, 0), 2) AS tax_sgst,
        ROUND(COALESCE(po.igst, 0), 2) AS tax_igst,
        ROUND(COALESCE(po.shipping, 0) + COALESCE(po.other_charges, 0), 2) AS other_charges,
        ROUND(COALESCE(po.round_off, 0), 2) AS round_off,
        ROUND(COALESCE(po.grand_total, 0), 2) AS grand_total,
        CASE 
          WHEN po.status::text = 'CANCELLED' THEN 'CANCELLED'
          WHEN po.status::text = 'COMPLETED' THEN 'Closed'
          ELSE 'Approved'
        END::text AS document_status,
        CASE 
          WHEN COALESCE(po.total_received_qty, 0) >= COALESCE(po.quantity, 1) THEN 'COMPLETE'
          WHEN COALESCE(po.total_received_qty, 0) > 0 THEN 'PARTIAL'
          ELSE 'PENDING'
        END::text AS fulfilment_status,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'PURCHASE_ORDER' AND pa.doc_id = po.id
        ), 0)::numeric(14,2) AS paid_amount,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'PURCHASE_ORDER' AND pa.doc_id = po.id AND pa.kind = 'ADVANCE'
        ), 0)::numeric(14,2) AS advance_amount
      FROM "RawMaterialPO" po
      LEFT JOIN parties p ON p.id = po."supplierId"
      LEFT JOIN "Supplier" s ON s.id = po."supplierId"

      UNION ALL

      -- 2. Capital Asset POs
      SELECT 
        'ASSET_PO'::text AS doc_type,
        apo.id::text AS doc_id,
        apo.po_no::text AS doc_no,
        COALESCE(apo.po_date::date, apo.created_at::date) AS doc_date,
        COALESCE(apo.payment_due_date::date, (apo.created_at::date + 30)) AS due_date,
        COALESCE(p.id, apo.vendor_code, 'V-' || MD5(apo.vendor_name))::text AS party_id,
        COALESCE(p.name, apo.vendor_name, 'Unknown Vendor')::text AS party_name,
        'PAYABLE'::text AS direction,
        ROUND(COALESCE(apo.subtotal, 0), 2) AS subtotal,
        ROUND(COALESCE(apo.cgst, 0), 2) AS tax_cgst,
        ROUND(COALESCE(apo.sgst, 0), 2) AS tax_sgst,
        ROUND(COALESCE(apo.igst, 0), 2) AS tax_igst,
        ROUND(COALESCE(apo.shipping_charges, 0) + COALESCE(apo.other_charges, 0) + COALESCE(apo.freight, 0) + COALESCE(apo.packing_charges, 0) + COALESCE(apo.insurance, 0), 2) AS other_charges,
        ROUND(COALESCE(apo.round_off, 0), 2) AS round_off,
        ROUND(COALESCE(apo.grand_total, 0), 2) AS grand_total,
        COALESCE(apo.status, 'Approved')::text AS document_status,
        CASE 
          WHEN apo.status = 'Closed' THEN 'COMPLETE'
          ELSE 'PARTIAL'
        END::text AS fulfilment_status,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'ASSET_PO' AND pa.doc_id = apo.id
        ), 0)::numeric(14,2) AS paid_amount,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'ASSET_PO' AND pa.doc_id = apo.id AND pa.kind = 'ADVANCE'
        ), 0)::numeric(14,2) AS advance_amount
      FROM asset_pos apo
      LEFT JOIN parties p ON p.id = apo.vendor_code OR p.id = ('V-' || MD5(apo.vendor_name))

      UNION ALL

      -- 3. Expenses
      SELECT 
        'EXPENSE'::text AS doc_type,
        e.id::text AS doc_id,
        e."expenseNumber"::text AS doc_no,
        e.date::date AS doc_date,
        (e.date::date + 30)::date AS due_date,
        COALESCE(p.id, e."supplierId", 'EXP-PARTY-' || SUBSTRING(MD5(COALESCE(e."supplierName", e.title, e.category, 'General')), 1, 16))::text AS party_id,
        COALESCE(p.name, e."supplierName", e.title, e.category, 'General Payee')::text AS party_name,
        'PAYABLE'::text AS direction,
        ROUND(COALESCE(e."taxableAmount", e.amount, 0), 2) AS subtotal,
        ROUND(COALESCE(e."cgstAmount", 0), 2) AS tax_cgst,
        ROUND(COALESCE(e."sgstAmount", 0), 2) AS tax_sgst,
        ROUND(COALESCE(e."igstAmount", 0), 2) AS tax_igst,
        ROUND(COALESCE(e."shippingAmount", 0) + COALESCE(e."packingAmount", 0) + COALESCE(e."loadingAmount", 0) + COALESCE(e."otherCharges", 0), 2) AS other_charges,
        ROUND(COALESCE(e."roundOff", 0), 2) AS round_off,
        ROUND(COALESCE(e."totalAmount", 0), 2) AS grand_total,
        'Approved'::text AS document_status,
        'COMPLETE'::text AS fulfilment_status,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'EXPENSE' AND pa.doc_id = e.id
        ), 0)::numeric(14,2) AS paid_amount,
        0::numeric(14,2) AS advance_amount
      FROM "Expense" e
      LEFT JOIN parties p ON p.id = e."supplierId"

      UNION ALL

      -- 4. Customer Orders (Sales Orders)
      SELECT 
        'SALES_ORDER'::text AS doc_type,
        co.id::text AS doc_id,
        co.doc_no::text AS doc_no,
        co.created_at::date AS doc_date,
        COALESCE(co.due_date::date, (co.created_at::date + COALESCE(p.credit_days, 30)))::date AS due_date,
        COALESCE(co.customer_id, 'UNKNOWN-CUST')::text AS party_id,
        COALESCE(p.name, co.customer_name, 'Unknown Customer')::text AS party_name,
        'RECEIVABLE'::text AS direction,
        ROUND(COALESCE(co.total_subtotal, 0), 2) AS subtotal,
        ROUND(COALESCE(co.cgst, 0), 2) AS tax_cgst,
        ROUND(COALESCE(co.sgst, 0), 2) AS tax_sgst,
        ROUND(COALESCE(co.igst, 0), 2) AS tax_igst,
        ROUND(COALESCE(co.freight, 0) + COALESCE(co.loading_charges, 0) + COALESCE(co.packing_charges, 0) + COALESCE(co.insurance, 0) + COALESCE(co.other_charges, 0), 2) AS other_charges,
        ROUND(COALESCE(co.round_off, 0), 2) AS round_off,
        ROUND(COALESCE(co.grand_total, 0), 2) AS grand_total,
        COALESCE(co.status, 'Approved')::text AS document_status,
        CASE 
          WHEN co.status ILIKE '%Delivered%' OR co.status ILIKE '%Completed%' THEN 'COMPLETE'
          WHEN co.status ILIKE '%Partial%' THEN 'PARTIAL'
          ELSE 'PENDING'
        END::text AS fulfilment_status,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'SALES_ORDER' AND pa.doc_id = co.id
        ), 0)::numeric(14,2) AS paid_amount,
        COALESCE((
          SELECT SUM(pa.amount)
          FROM payment_allocations pa
          WHERE pa.doc_type = 'SALES_ORDER' AND pa.doc_id = co.id AND pa.kind = 'ADVANCE'
        ), 0)::numeric(14,2) AS advance_amount
      FROM customer_orders co
      LEFT JOIN parties p ON p.id = co.customer_id
      WHERE co.type = 'Sales Order'
    )
    SELECT 
      doc_type,
      doc_id,
      doc_no,
      doc_date,
      due_date,
      party_id,
      party_name,
      direction,
      subtotal,
      tax_cgst,
      tax_sgst,
      tax_igst,
      other_charges,
      round_off,
      grand_total,
      paid_amount,
      advance_amount,
      ROUND((grand_total - paid_amount), 2) AS balance,
      document_status,
      fulfilment_status,
      CASE
        WHEN document_status = 'CANCELLED' THEN 'VOID'
        WHEN paid_amount > grand_total + 1 THEN 'OVERPAID'
        WHEN (grand_total - paid_amount) <= 1 THEN 'PAID'
        WHEN paid_amount = 0 THEN 'UNPAID'
        WHEN advance_amount > 0 AND fulfilment_status IN ('PENDING', 'PARTIAL') THEN 'ADVANCE_PAID'
        ELSE 'PARTIALLY_PAID'
      END::text AS payment_status,
      ((grand_total - paid_amount) > 1 AND due_date < CURRENT_DATE) AS is_overdue,
      GREATEST((CURRENT_DATE - due_date), 0)::int AS overdue_days,
      CASE
        WHEN due_date >= CURRENT_DATE THEN 'Current'
        WHEN CURRENT_DATE - due_date <= 30 THEN '0-30'
        WHEN CURRENT_DATE - due_date <= 60 THEN '31-60'
        WHEN CURRENT_DATE - due_date <= 90 THEN '61-90'
        ELSE '90+'
      END::text AS age_bucket
    FROM raw_docs;
  `, 'Created v_finance_documents');

  // 3. Create v_quotation_pipeline
  await run(`
    CREATE OR REPLACE VIEW v_quotation_pipeline AS
    SELECT 
      co.id,
      co.doc_no,
      co.created_at::date AS doc_date,
      co.customer_id,
      COALESCE(p.name, co.customer_name, 'Unknown Customer') AS customer_name,
      ROUND(COALESCE(co.total_subtotal, 0), 2) AS subtotal,
      ROUND(COALESCE(co.cgst, 0), 2) AS tax_cgst,
      ROUND(COALESCE(co.sgst, 0), 2) AS tax_sgst,
      ROUND(COALESCE(co.igst, 0), 2) AS tax_igst,
      ROUND(COALESCE(co.grand_total, 0), 2) AS grand_total,
      co.status,
      co.quotation_note,
      co.created_at
    FROM customer_orders co
    LEFT JOIN parties p ON p.id = co.customer_id
    WHERE co.type = 'Quotation';
  `, 'Created v_quotation_pipeline');

  // 4. Create v_party_ledger
  await run(`
    CREATE OR REPLACE VIEW v_party_ledger AS
    SELECT 
      p.id AS party_id,
      p.name AS party_name,
      p.type AS party_type,
      d.doc_date AS txn_date,
      d.doc_no AS ref_no,
      d.doc_type AS txn_type,
      'Bill / Order' AS description,
      CASE WHEN d.direction = 'RECEIVABLE' THEN d.grand_total ELSE 0 END AS debit,
      CASE WHEN d.direction = 'PAYABLE' THEN d.grand_total ELSE 0 END AS credit
    FROM v_finance_documents d
    JOIN parties p ON p.id = d.party_id

    UNION ALL

    SELECT 
      p.id AS party_id,
      p.name AS party_name,
      p.type AS party_type,
      pay.pay_date AS txn_date,
      pay.payment_no AS ref_no,
      'PAYMENT' AS txn_type,
      COALESCE(pay.notes, 'Payment Settlement') AS description,
      CASE WHEN pay.direction = 'OUT' THEN pay.amount ELSE 0 END AS debit,
      CASE WHEN pay.direction = 'IN' THEN pay.amount ELSE 0 END AS credit
    FROM payments pay
    JOIN parties p ON p.id = pay.party_id
    WHERE pay.is_reversed = false;
  `, 'Created v_party_ledger');

  // 5. Create v_gst_register
  await run(`
    CREATE OR REPLACE VIEW v_gst_register AS
    WITH monthly_data AS (
      SELECT 
        TO_CHAR(doc_date, 'YYYY-MM') AS month_key,
        -- Input Tax Credit (ITC) from Payables
        SUM(CASE WHEN direction = 'PAYABLE' THEN tax_cgst ELSE 0 END) AS itc_cgst,
        SUM(CASE WHEN direction = 'PAYABLE' THEN tax_sgst ELSE 0 END) AS itc_sgst,
        SUM(CASE WHEN direction = 'PAYABLE' THEN tax_igst ELSE 0 END) AS itc_igst,
        SUM(CASE WHEN direction = 'PAYABLE' THEN (tax_cgst + tax_sgst + tax_igst) ELSE 0 END) AS total_itc,
        -- Output Tax Liability from Receivables
        SUM(CASE WHEN direction = 'RECEIVABLE' THEN tax_cgst ELSE 0 END) AS output_cgst,
        SUM(CASE WHEN direction = 'RECEIVABLE' THEN tax_sgst ELSE 0 END) AS output_sgst,
        SUM(CASE WHEN direction = 'RECEIVABLE' THEN tax_igst ELSE 0 END) AS output_igst,
        SUM(CASE WHEN direction = 'RECEIVABLE' THEN (tax_cgst + tax_sgst + tax_igst) ELSE 0 END) AS total_output
      FROM v_finance_documents
      GROUP BY TO_CHAR(doc_date, 'YYYY-MM')
    )
    SELECT 
      month_key,
      ROUND(itc_cgst, 2) AS itc_cgst,
      ROUND(itc_sgst, 2) AS itc_sgst,
      ROUND(itc_igst, 2) AS itc_igst,
      ROUND(total_itc, 2) AS total_itc,
      ROUND(output_cgst, 2) AS output_cgst,
      ROUND(output_sgst, 2) AS output_sgst,
      ROUND(output_igst, 2) AS output_igst,
      ROUND(total_output, 2) AS total_output,
      GREATEST(ROUND(total_output - total_itc, 2), 0) AS net_gst_payable,
      GREATEST(ROUND(total_itc - total_output, 2), 0) AS carry_forward_itc
    FROM monthly_data
    ORDER BY month_key DESC;
  `, 'Created v_gst_register');

  // 6. Create v_cash_bank_book
  await run(`
    CREATE OR REPLACE VIEW v_cash_bank_book AS
    SELECT 
      b.id AS bank_account_id,
      b.name AS account_name,
      b.type AS account_type,
      p.pay_date,
      p.payment_no,
      p.mode,
      p.direction,
      pt.name AS party_name,
      p.reference_no,
      p.notes,
      CASE WHEN p.direction = 'IN' THEN p.amount ELSE 0 END AS deposit_amount,
      CASE WHEN p.direction = 'OUT' THEN p.amount ELSE 0 END AS withdrawal_amount,
      p.is_reversed,
      p.created_at
    FROM payments p
    JOIN bank_accounts b ON b.id = p.bank_account_id
    JOIN parties pt ON pt.id = p.party_id
    ORDER BY p.pay_date DESC, p.id DESC;
  `, 'Created v_cash_bank_book');

  // 7. Create v_aging_payables & v_aging_receivables
  await run(`
    CREATE OR REPLACE VIEW v_aging_payables AS
    SELECT 
      party_name,
      ROUND(SUM(balance), 2) AS total_outstanding,
      ROUND(SUM(CASE WHEN age_bucket = 'Current' THEN balance ELSE 0 END), 2) AS current_due,
      ROUND(SUM(CASE WHEN age_bucket = '0-30' THEN balance ELSE 0 END), 2) AS bucket_0_30,
      ROUND(SUM(CASE WHEN age_bucket = '31-60' THEN balance ELSE 0 END), 2) AS bucket_31_60,
      ROUND(SUM(CASE WHEN age_bucket = '61-90' THEN balance ELSE 0 END), 2) AS bucket_61_90,
      ROUND(SUM(CASE WHEN age_bucket = '90+' THEN balance ELSE 0 END), 2) AS bucket_90_plus
    FROM v_finance_documents
    WHERE direction = 'PAYABLE' AND balance > 1
    GROUP BY party_name
    ORDER BY total_outstanding DESC;
  `, 'Created v_aging_payables');

  await run(`
    CREATE OR REPLACE VIEW v_aging_receivables AS
    SELECT 
      party_name,
      ROUND(SUM(balance), 2) AS total_outstanding,
      ROUND(SUM(CASE WHEN age_bucket = 'Current' THEN balance ELSE 0 END), 2) AS current_due,
      ROUND(SUM(CASE WHEN age_bucket = '0-30' THEN balance ELSE 0 END), 2) AS bucket_0_30,
      ROUND(SUM(CASE WHEN age_bucket = '31-60' THEN balance ELSE 0 END), 2) AS bucket_31_60,
      ROUND(SUM(CASE WHEN age_bucket = '61-90' THEN balance ELSE 0 END), 2) AS bucket_61_90,
      ROUND(SUM(CASE WHEN age_bucket = '90+' THEN balance ELSE 0 END), 2) AS bucket_90_plus
    FROM v_finance_documents
    WHERE direction = 'RECEIVABLE' AND balance > 1
    GROUP BY party_name
    ORDER BY total_outstanding DESC;
  `, 'Created v_aging_receivables');

  console.log('✓ All Finance SQL views created and verified successfully!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Views creation error:', e);
  process.exit(1);
});
