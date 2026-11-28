const defaultPrisma = require('../prisma');

let isEnsured = false;

/**
 * Ensures all tables, indexes, and initial bank account syncs for the
 * Bank Statement + GST Review module exist (idempotent & non-destructive).
 */
async function ensureBankStatementSchema(prisma = defaultPrisma, force = false) {
  if (isEnsured && !force) return { applied: 0, errors: [] };

  const statements = [
    // 1. Bank Statement Accounts (company-isolated)
    `CREATE TABLE IF NOT EXISTS bank_statement_accounts (
      id BIGSERIAL PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'default',
      legacy_bank_account_id BIGINT,
      account_name TEXT NOT NULL,
      bank_name TEXT,
      account_number TEXT NOT NULL DEFAULT '',
      ifsc_code TEXT DEFAULT '',
      account_type TEXT NOT NULL DEFAULT 'BANK',
      branch_name TEXT DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT false,
      notes TEXT DEFAULT '',
      opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `ALTER TABLE bank_statement_accounts ADD COLUMN IF NOT EXISTS branch_name TEXT DEFAULT '';`,
    `ALTER TABLE bank_statement_accounts ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;`,
    `ALTER TABLE bank_statement_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE bank_statement_accounts ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';`,
    `ALTER TABLE bank_statement_accounts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;`,
    `UPDATE bank_statement_accounts SET sort_order = id::int WHERE sort_order = 0;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_bsa_company_legacy
      ON bank_statement_accounts (company_id, legacy_bank_account_id)
      WHERE legacy_bank_account_id IS NOT NULL;`,
    `CREATE INDEX IF NOT EXISTS idx_bsa_company_active
      ON bank_statement_accounts (company_id, is_active);`,

    // 2. Import Batches
    `CREATE TABLE IF NOT EXISTS bank_import_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      bank_account_id BIGINT NOT NULL REFERENCES bank_statement_accounts(id),
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'xlsx',
      uploaded_by TEXT NOT NULL,
      uploaded_by_name TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      total_rows INT NOT NULL DEFAULT 0,
      saved_rows INT NOT NULL DEFAULT 0,
      duplicate_rows INT NOT NULL DEFAULT 0,
      possible_rows INT NOT NULL DEFAULT 0,
      error_rows INT NOT NULL DEFAULT 0,
      total_debit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      total_credit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      notes TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_bib_company_account
      ON bank_import_batches (company_id, bank_account_id, uploaded_at DESC);`,

    // 3. Bank Transactions (12 original columns + extracted + keys + optimistic concurrency + soft delete)
    `CREATE TABLE IF NOT EXISTS bank_txn (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      bank_account_id BIGINT NOT NULL REFERENCES bank_statement_accounts(id),
      batch_id UUID REFERENCES bank_import_batches(id),
      sort_order INT NOT NULL DEFAULT 0,
      txn_date DATE NOT NULL,
      value_date DATE,
      description TEXT NOT NULL,
      ref_no TEXT NOT NULL DEFAULT '',
      branch_code TEXT NOT NULL DEFAULT '',
      debit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      credit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      balance DECIMAL(18,2),
      remarks TEXT NOT NULL DEFAULT '',
      txn_month TEXT NOT NULL,
      fin_year TEXT NOT NULL,
      txn_type TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT '',
      utr TEXT NOT NULL DEFAULT '',
      party_name TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL,
      source_key TEXT NOT NULL,
      version INT NOT NULL DEFAULT 1,
      possible_duplicate BOOLEAN NOT NULL DEFAULT false,
      keep_possible BOOLEAN NOT NULL DEFAULT false,
      balance_gap_flag BOOLEAN NOT NULL DEFAULT false,
      balance_gap_diff DECIMAL(18,2) DEFAULT 0.00,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      deleted_at TIMESTAMPTZ,
      deleted_by TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_txn_dedupe
      ON bank_txn (company_id, bank_account_id, dedupe_key)
      WHERE is_deleted = false;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_txn_source
      ON bank_txn (company_id, bank_account_id, source_key)
      WHERE is_deleted = false;`,
    `CREATE INDEX IF NOT EXISTS idx_bank_txn_query
      ON bank_txn (company_id, is_deleted, txn_date DESC, bank_account_id);`,
    `CREATE INDEX IF NOT EXISTS idx_bank_txn_fy
      ON bank_txn (company_id, is_deleted, fin_year, bank_account_id);`,

    // 4. GST Review Metadata per transaction
    `CREATE TABLE IF NOT EXISTS bank_txn_gst (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      txn_id UUID NOT NULL UNIQUE REFERENCES bank_txn(id) ON DELETE CASCADE,
      treatment TEXT NOT NULL DEFAULT 'Unreviewed',
      suggested_treatment TEXT NOT NULL DEFAULT 'Unreviewed',
      suggestion_reason TEXT NOT NULL DEFAULT '',
      invoice_no TEXT NOT NULL DEFAULT '',
      invoice_date DATE,
      gstin TEXT NOT NULL DEFAULT '',
      hsn_sac TEXT NOT NULL DEFAULT '',
      taxable_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      cgst_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      sgst_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      igst_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      total_tax DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      found_in_gstr2b TEXT NOT NULL DEFAULT 'Not Checked',
      ims_status TEXT NOT NULL DEFAULT 'Pending',
      is_reviewed BOOLEAN NOT NULL DEFAULT false,
      needs_recheck BOOLEAN NOT NULL DEFAULT false,
      notes TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT,
      reviewed_by_name TEXT,
      reviewed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_btg_company_reviewed
      ON bank_txn_gst (company_id, is_reviewed, treatment);`,

    // 5. Many-to-many Bank Transaction <-> Invoice Link / Allocation Table
    `CREATE TABLE IF NOT EXISTS bank_txn_invoice_allocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      txn_id UUID NOT NULL REFERENCES bank_txn(id) ON DELETE CASCADE,
      invoice_source TEXT NOT NULL,
      invoice_id TEXT,
      invoice_no TEXT NOT NULL,
      invoice_date DATE,
      party_name TEXT NOT NULL DEFAULT '',
      party_gstin TEXT NOT NULL DEFAULT '',
      invoice_taxable DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      invoice_cgst DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      invoice_sgst DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      invoice_igst DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      invoice_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      allocated_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      needs_recheck BOOLEAN NOT NULL DEFAULT false,
      is_deleted BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_btia_txn
      ON bank_txn_invoice_allocations (company_id, txn_id)
      WHERE is_deleted = false;`,
    `CREATE INDEX IF NOT EXISTS idx_btia_invoice
      ON bank_txn_invoice_allocations (company_id, invoice_source, invoice_no)
      WHERE is_deleted = false;`,

    // 6. Imported GSTR-2B Entries for cross-verification
    `CREATE TABLE IF NOT EXISTS bank_gstr2b_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      fin_year TEXT NOT NULL DEFAULT '',
      return_period TEXT NOT NULL DEFAULT '',
      supplier_gstin TEXT NOT NULL,
      supplier_name TEXT NOT NULL DEFAULT '',
      invoice_no TEXT NOT NULL,
      invoice_date DATE,
      taxable_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      cgst_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      sgst_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      igst_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      invoice_value DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      itc_availability TEXT NOT NULL DEFAULT 'Yes',
      ims_status TEXT NOT NULL DEFAULT 'Pending',
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_gstr2b_inv
      ON bank_gstr2b_entries (company_id, supplier_gstin, invoice_no);`,

    // 7. Audit Log Table (written atomically in same transaction as data change)
    `CREATE TABLE IF NOT EXISTS bank_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      txn_id UUID,
      batch_id UUID,
      before_data JSONB,
      after_data JSONB,
      changed_by TEXT NOT NULL,
      changed_by_name TEXT,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_bal_company_time
      ON bank_audit_log (company_id, changed_at DESC);`
  ];

  let applied = 0;
  const errors = [];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      applied += 1;
    } catch (err) {
      errors.push({ sql, message: err.message });
      console.warn('[ensureBankStatementSchema] Warning:', err.message);
    }
  }

  // Note: Default / demo accounts from legacy bank_accounts are intentionally NOT auto-seeded
  // into bank_statement_accounts so users can add their real bank/cash/UPI accounts manually via Bank Master.

  if (errors.length === 0) {
    isEnsured = true;
  }

  return { applied, errors };
}

if (require.main === module) {
  ensureBankStatementSchema(defaultPrisma, true)
    .then(async (res) => {
      console.log(`Bank Statement schema check completed (${res.applied} statements, ${res.errors.length} warnings).`);
      await defaultPrisma.$disconnect();
      if (res.errors.length > 0) process.exit(1);
    })
    .catch(async (err) => {
      console.error('Bank Statement schema migration failed:', err);
      await defaultPrisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { ensureBankStatementSchema };
