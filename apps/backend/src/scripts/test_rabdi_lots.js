const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function run() {
  const rmId = '38057e4e-ffc2-4339-99e7-fabc33585eec';
  const rm = await prisma.rawMaterial.findUnique({
    where: { id: rmId }
  });
  console.log('RM:', rm);

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      OR: [{ rawMaterialId: rmId }, { rawMaterialName: rm?.name }]
    },
    include: {
      po: true,
      grn: true
    }
  });
  console.log('InventoryBatches for RABDI:', batches);

  const grnItems = await prisma.gRNReceiveItem.findMany({
    where: {
      OR: [{ rmId: rmId }, { rmName: rm?.name }]
    },
    include: {
      grn: { include: { po: true } }
    }
  });
  console.log('GRN Items for RABDI:', grnItems);

  await prisma.$disconnect();
}

run().catch(console.error);
