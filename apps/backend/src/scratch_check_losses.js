const prisma = require('./database/prisma');

async function main() {
  const losses = await prisma.productionLoss.findMany({
    include: {
      batch: { include: { product: true } },
      responsiblePerson: { select: { name: true } },
      lossProducts: { include: { product: true } },
      lossMaterials: { include: { rawMaterial: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  const formatted = losses.map(loss => {
    const totalCost = Number(loss.batch?.totalCost || 0);
    const lossPercent = totalCost > 0 ? ((Number(loss.totalLoss) / totalCost) * 100).toFixed(2) : '0.00';

    const pCount = loss.lossProducts?.length || 0;
    const mCount = loss.lossMaterials?.length || 0;

    return {
      id: loss.id,
      referenceNo: loss.batch?.referenceNo,
      productName: loss.batch?.product?.name,
      totalLoss: Number(loss.totalLoss),
      summary: `${pCount} products, ${mCount} materials`,
      lossPercent: `${lossPercent}%`,
      date: loss.date,
      responsiblePerson: loss.responsiblePerson?.name
    };
  });

  console.log("LOSSES:", formatted);
}

main().catch(err => console.error("ERROR:", err));
