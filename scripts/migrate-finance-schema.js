const path = require('path');
require('../apps/backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../apps/backend/.env') });
const prisma = require('../apps/backend/src/database/prisma');

async function run(sql, desc) {
  try {
    await prisma.$executeRawUnsafe(sql);
    if (desc) console.log('✓ ' + desc);
  } catch (err) {
    console.error('Error on: ' + (desc || sql), err.message);
    throw err;
  }
}

async function main() {
  console.log('--- Step 1: Applying Database Migrations ---');

  // 1. Create parties table
  await run(`
    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('SUPPLIER', 'CUSTOMER', 'BOTH')),
      name TEXT NOT NULL,
      gstin TEXT,
      state_code TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      credit_days INT DEFAULT 30,
      credit_limit NUMERIC(14,2) DEFAULT 0,
      opening_balance NUMERIC(14,2) DEFAULT 0,
      opening_balance_type TEXT DEFAULT 'DR' CHECK (opening_balance_type IN ('DR', 'CR')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `, 'parties table verified');

  // 2. Populate parties from Supplier and Customer tables
  await run(`
    INSERT INTO parties (id, type, name, gstin, state_code, phone, email, address, credit_days, credit_limit, opening_balance, opening_balance_type)
    SELECT 
      s.id, 
      'SUPPLIER', 
      s.name, 
      s.gstin, 
      SUBSTRING(COALESCE(s.gstin, ''), 1, 2), 
      s.phone, 
      s.email, 
      s.address, 
      30, 
      COALESCE(s."creditLimit", 0), 
      COALESCE(s."openingBalance", 0), 
      CASE WHEN s."balanceType" = 'CR' THEN 'CR' ELSE 'DR' END
    FROM "Supplier" s
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      gstin = EXCLUDED.gstin,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address
  `, 'parties populated from Supplier');

  await run(`
    INSERT INTO parties (id, type, name, gstin, state_code, phone, email, address, credit_days, credit_limit, opening_balance, opening_balance_type)
    SELECT 
      c.id, 
      'CUSTOMER', 
      c.name, 
      c.gstin, 
      SUBSTRING(COALESCE(c.gstin, ''), 1, 2), 
      c.phone, 
      c.email, 
      c.address, 
      COALESCE(c.payment_terms_days, 30), 
      COALESCE(c."creditLimit", 0), 
      COALESCE(c."openingBalance", 0), 
      CASE WHEN c."balanceType" = 'CR' THEN 'CR' ELSE 'DR' END
    FROM "Customer" c
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      gstin = EXCLUDED.gstin,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      address = EXCLUDED.address,
      credit_days = EXCLUDED.credit_days
  `, 'parties populated from Customer');

  // Vendor codes in asset_pos
  await run(`
    INSERT INTO parties (id, type, name, gstin, state_code, address, credit_days)
    SELECT DISTINCT 
      COALESCE(vendor_code, 'V-' || MD5(vendor_name)) as id,
      'SUPPLIER',
      vendor_name,
      vendor_gstin,
      SUBSTRING(COALESCE(vendor_gstin, ''), 1, 2),
      address,
      30
    FROM asset_pos
    WHERE vendor_name IS NOT NULL
    ON CONFLICT (id) DO NOTHING
  `, 'parties populated from asset_pos');

  await run(`
    INSERT INTO parties (id, type, name, credit_days)
    VALUES ('LOCAL-PURCHASE', 'SUPPLIER', 'LOCAL PURCHASE', 0)
    ON CONFLICT (id) DO NOTHING
  `, 'LOCAL-PURCHASE party ensured');

  // 3. Create bank_accounts
  await run(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('BANK', 'CASH', 'UPI')),
      account_number TEXT,
      bank_name TEXT,
      ifsc_code TEXT,
      opening_balance NUMERIC(14,2) DEFAULT 0,
      current_balance NUMERIC(14,2) DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `, 'bank_accounts table verified');

  const bankAccCount = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM bank_accounts;`);
  if (bankAccCount[0].cnt === 0) {
    await run(`
      INSERT INTO bank_accounts (name, type, account_number, bank_name, ifsc_code, opening_balance, current_balance)
      VALUES 
        ('Main Cash Register', 'CASH', 'CASH-001', 'Factory Cash Drawer', '', 50000.00, 50000.00),
        ('HDFC Current Account', 'BANK', '50200012345678', 'HDFC Bank Ltd', 'HDFC0001234', 500000.00, 500000.00),
        ('ICICI Operational Account', 'BANK', '001105001234', 'ICICI Bank Ltd', 'ICIC0000011', 250000.00, 250000.00),
        ('UPI Company QR', 'UPI', 'icecream@hdfcbank', 'HDFC UPI Merchant', '', 25000.00, 25000.00)
    `, 'Seeded standard bank & cash accounts');
  }

  // 4. Create payment_milestones
  await run(`
    CREATE TABLE IF NOT EXISTS payment_milestones (
      id BIGSERIAL PRIMARY KEY,
      po_id TEXT REFERENCES asset_pos(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      percent NUMERIC(5,2) NOT NULL,
      due_date DATE,
      amount NUMERIC(14,2) NOT NULL,
      status TEXT DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `, 'payment_milestones verified');

  // 5. Create payments
  await run(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      payment_no TEXT UNIQUE NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('OUT', 'IN')),
      party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
      bank_account_id BIGINT REFERENCES bank_accounts(id),
      pay_date DATE NOT NULL DEFAULT CURRENT_DATE,
      mode TEXT NOT NULL CHECK (mode IN ('CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS')),
      reference_no TEXT,
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      reversed_of BIGINT REFERENCES payments(id),
      is_reversed BOOLEAN DEFAULT false,
      notes TEXT,
      is_migrated BOOLEAN DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `, 'payments table verified');

  // 6. Create payment_allocations
  await run(`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id BIGSERIAL PRIMARY KEY,
      payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL CHECK (doc_type IN ('PURCHASE_ORDER', 'ASSET_PO', 'EXPENSE', 'SALES_ORDER', 'SALES_INVOICE')),
      doc_id TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('ADVANCE', 'AGAINST_BILL', 'MILESTONE')),
      milestone_id BIGINT REFERENCES payment_milestones(id),
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `, 'payment_allocations table verified');

  await run(`CREATE INDEX IF NOT EXISTS idx_pay_alloc_doc ON payment_allocations(doc_type, doc_id)`, 'Index idx_pay_alloc_doc');
  await run(`CREATE INDEX IF NOT EXISTS idx_pay_alloc_payment ON payment_allocations(payment_id)`, 'Index idx_pay_alloc_payment');

  // 7. Add missing columns to RawMaterialPO
  await run(`ALTER TABLE "RawMaterialPO" ADD COLUMN IF NOT EXISTS round_off NUMERIC(14,2) DEFAULT 0`, 'Added round_off to RawMaterialPO');
  await run(`ALTER TABLE "RawMaterialPO" ADD COLUMN IF NOT EXISTS due_date DATE`, 'Added due_date to RawMaterialPO');

  // Fix PO-000009 round off data discrepancy (5600 + 280 != 5959)
  await run(`
    UPDATE "RawMaterialPO" 
    SET round_off = 79.00 
    WHERE "referenceNo" = 'PO-000009' AND (round_off IS NULL OR round_off = 0)
  `, 'PO-000009 round_off set to 79.00');

  console.log('✓ All database migrations applied successfully!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
