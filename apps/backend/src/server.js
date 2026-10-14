// 1. MUST BE FIRST: Load env variables
const env = require('./config/env'); 

// 2. Load app (which uses Prisma)
const app = require('./app');
const { ensureProductionBatchesRedesignSchema } = require('./database/migrations/ensure_production_batches_redesign_schema');

app.listen(env.PORT, async () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  try {
    await ensureProductionBatchesRedesignSchema();
  } catch (err) {
    console.error('Initial schema check notice:', err.message);
  }
});