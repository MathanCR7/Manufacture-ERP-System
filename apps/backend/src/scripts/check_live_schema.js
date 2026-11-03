const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function run() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'production_batch_allocation'
    ORDER BY ordinal_position;
  `);
  console.log('Columns of production_batch_allocation:');
  console.table(cols);

  const allocCols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'production_batch_allocations'
    ORDER BY ordinal_position;
  `);
  console.log('Columns of production_batch_allocations:');
  console.table(allocCols);

  await prisma.$disconnect();
}

run().catch(console.error);
