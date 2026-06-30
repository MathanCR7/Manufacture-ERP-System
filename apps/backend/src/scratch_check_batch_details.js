const prisma = require('./database/prisma');

async function main() {
  const batch = await prisma.productionBatchNew.findFirst({
    where: { referenceNo: 'MP-000011' },
    include: {
      product: { include: { unit: true } },
      rmUsages: { include: { rawMaterial: true } }
    }
  });

  console.log("BATCH:", {
    id: batch.id,
    referenceNo: batch.referenceNo,
    productName: batch.product?.name,
    quantity: batch.quantity,
    rmUsages: batch.rmUsages.map(rm => ({
      rmId: rm.rmId,
      rmName: rm.rawMaterial?.name,
      requiredQty: rm.requiredQty,
      availableQty: rm.availableQtyAtTime
    }))
  });
}

main().catch(err => console.error("ERROR:", err));
