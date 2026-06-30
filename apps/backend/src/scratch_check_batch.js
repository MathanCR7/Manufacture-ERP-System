const prisma = require('./database/prisma');

async function main() {
  const batches = await prisma.productionBatchNew.findMany({
    include: { product: true }
  });
  console.log("BATCHES:", batches.map(b => ({
    id: b.id,
    referenceNo: b.referenceNo,
    status: b.status,
    deletedAt: b.deletedAt,
    productId: b.productId,
    productName: b.product?.name
  })));
}

main().catch(err => console.error("ERROR:", err));
