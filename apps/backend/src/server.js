// 1. MUST BE FIRST: Load env variables
const env = require('./config/env'); 

// 2. Load app (which uses Prisma)
const app = require('./app');

app.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
});