const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable' } }
});

async function main() {
  const id = 'f426ea36-dd9b-44ab-9532-172cbf9cebcb';
  
  try {
    const updated = await prisma.productionBatchNew.update({
      where: { id },
      data: {
        status: 'Completed',
        goodQuantity: 62.35,
        actualOutput: 62.35,
        completedAt: new Date(),
        completeDate: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('Prisma ORM update succeeded:');
    console.log({ id: updated.id, status: updated.status, goodQuantity: updated.goodQuantity });
  } catch (e) {
    console.error('Error updating via Prisma ORM:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

