// 1. MUST BE FIRST: Load env variables
const env = require('./config/env'); 

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection caught at:', promise, 'reason:', reason);
});

// 2. Load app (which uses Prisma)
const app = require('./app');
const { ensureProductionBatchesRedesignSchema } = require('./database/migrations/ensure_production_batches_redesign_schema');
const { ensureUserEmployeeMasterSchema } = require('./database/migrations/ensure_user_employee_master_schema');
const { ensureExpenseAndAssetSchema } = require('./database/migrations/ensure_expense_and_asset_schema');
const { ensureBankStatementSchema } = require('./database/migrations/ensure_bank_statement_schema');

app.listen(env.PORT, async () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  try {
    await ensureBankStatementSchema();
  } catch (err) {
    console.error('Initial bank statement schema check notice:', err.message);
  }
  try {
    await ensureExpenseAndAssetSchema();
  } catch (err) {
    console.error('Initial expense/asset schema check notice:', err.message);
  }
  try {
    await ensureProductionBatchesRedesignSchema();
  } catch (err) {
    console.error('Initial schema check notice:', err.message);
  }
  try {
    await ensureUserEmployeeMasterSchema();
  } catch (err) {
    console.error('Initial user schema check notice:', err.message);
  }
});