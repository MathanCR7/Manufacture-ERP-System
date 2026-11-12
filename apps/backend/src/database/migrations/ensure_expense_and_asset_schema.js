const defaultPrisma = require('../prisma');

let isEnsured = false;

/**
 * Safely ensures all additive ExpenseCategory, Expense, and Asset item columns & indexes exist.
 * Idempotent and non-destructive: prevents runtime P2022 errors when Prisma schema outpaces
 * production PostgreSQL migrations or when prisma db push is blocked by legacy views/tables.
 */
async function ensureExpenseAndAssetSchema(prisma = defaultPrisma, force = false) {
  if (isEnsured && !force) return { applied: 0, errors: [] };

  const statements = [
    // 1. ExpenseCategory (Expense Master) columns & index
    `ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "expenseWithSupplier" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "defaultGstRate" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "hsnSacCode" TEXT;`,
    `ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "expenseType" TEXT DEFAULT 'INDIRECT';`,
    `CREATE INDEX IF NOT EXISTS "ExpenseCategory_name_idx" ON "ExpenseCategory"("name");`,

    // 2. Expense (Finance Multi-Entry GST / Supplier / Payment / Charges) columns & indexes
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "expenseNumber" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isSupplierExpense" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplierName" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "supplierGstin" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "invoiceNo" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "taxableAmount" DECIMAL(65,30);`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "gstPercentage" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "cgstAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "sgstAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "igstAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(65,30);`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isInterState" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "hsnSacCode" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT DEFAULT 'CASH';`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'PAID';`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentRef" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentImage" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentNotes" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "shippingAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "shippingGstApplicable" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "shippingGstRate" DECIMAL(65,30) DEFAULT 18;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "packingAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "packingGstApplicable" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "packingGstRate" DECIMAL(65,30) DEFAULT 18;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "loadingAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "loadingGstApplicable" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "loadingGstRate" DECIMAL(65,30) DEFAULT 18;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "otherCharges" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "otherChargesLabel" TEXT;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "otherChargesGstApplicable" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "otherChargesGstRate" DECIMAL(65,30) DEFAULT 18;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(65,30) DEFAULT 0;`,
    `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "roundOff" DECIMAL(65,30) DEFAULT 0;`,
    `CREATE INDEX IF NOT EXISTS "Expense_categoryId_idx" ON "Expense"("categoryId");`,
    `CREATE INDEX IF NOT EXISTS "Expense_supplierId_idx" ON "Expense"("supplierId");`,
    `CREATE INDEX IF NOT EXISTS "Expense_expenseNumber_idx" ON "Expense"("expenseNumber");`,

    // 3. Asset management line item remarks columns
    `ALTER TABLE "asset_pq_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`,
    `ALTER TABLE "asset_po_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`,
    `ALTER TABLE "asset_grpo_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`,
    `ALTER TABLE "asset_ap_invoice_items" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`
  ];

  let applied = 0;
  const errors = [];

  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      applied += 1;
    } catch (err) {
      errors.push({ sql, message: err.message });
      console.warn('[ensureExpenseAndAssetSchema] Statement warning:', err.message);
    }
  }

  if (errors.length === 0) {
    isEnsured = true;
  }

  return { applied, errors };
}

if (require.main === module) {
  ensureExpenseAndAssetSchema(defaultPrisma, true)
    .then(async (res) => {
      console.log(`Expense & Asset schema check completed (${res.applied} statements executed, ${res.errors.length} warnings).`);
      await defaultPrisma.$disconnect();
      if (res.errors.length > 0) process.exit(1);
    })
    .catch(async (err) => {
      console.error('Expense & Asset schema migration failed:', err);
      await defaultPrisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { ensureExpenseAndAssetSchema };

