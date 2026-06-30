const prisma = require('./database/prisma');

async function main() {
  console.log("Checking recent error logs...");
  const logs = await prisma.errorLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("LOGS:", logs);
}

main().catch(err => console.error("ERROR:", err));
