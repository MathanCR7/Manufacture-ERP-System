const prisma = require('./database/prisma');

async function main() {
  const targetId = '4b4a-4336-a975-cfeb09c33129';
  console.log("Searching old ProductionBatch table for ID:", targetId);

  const b = await prisma.productionBatch.findUnique({ where: { id: targetId } });
  console.log("FOUND:", b);
}

main().catch(err => console.error("ERROR:", err));
