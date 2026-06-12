const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const pos = await prisma.assetPO.findMany({
    select: {
      id: true,
      poNo: true,
      supplierQuoteRef: true,
      createdAt: true
    }
  });
  console.log('--- PURCHASE ORDERS ---');
  console.log(pos);

  const grpos = await prisma.assetGRPO.findMany({
    select: {
      id: true,
      grpoNo: true,
      poNo: true
    }
  });
  console.log('--- GRPOs ---');
  console.log(grpos);

  process.exit(0);
}

run();
