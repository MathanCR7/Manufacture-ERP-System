const prisma = require('./database/prisma');

async function main() {
  const targetId = '4b4a-4336-a975-cfeb09c33129';
  console.log("Searching for ID:", targetId);

  // Search User
  const u = await prisma.user.findUnique({ where: { id: targetId } });
  if (u) console.log("User:", u);

  // Search ProductionBatchNew
  const b = await prisma.productionBatchNew.findUnique({ where: { id: targetId } });
  if (b) console.log("ProductionBatchNew:", b);

  // Search ProductionLoss
  const pl = await prisma.productionLoss.findUnique({ where: { id: targetId } });
  if (pl) console.log("ProductionLoss:", pl);

  // Search FinishedProduct
  const p = await prisma.finishedProduct.findUnique({ where: { id: targetId } });
  if (p) console.log("FinishedProduct:", p);

  // Search RawMaterial
  const rm = await prisma.rawMaterial.findUnique({ where: { id: targetId } });
  if (rm) console.log("RawMaterial:", rm);
}

main().catch(err => console.error("ERROR:", err));
