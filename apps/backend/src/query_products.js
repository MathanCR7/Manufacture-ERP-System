const prisma = require('./database/prisma');

async function main() {
  const products = await prisma.finishedProduct.findMany({
    orderBy: { code: 'asc' }
  });
  console.log('All Finished Products in DB:');
  products.forEach(p => {
    console.log(`- ID: ${p.id}, Code: ${p.code}, Name: ${p.name}, DeletedAt: ${p.deletedAt}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
