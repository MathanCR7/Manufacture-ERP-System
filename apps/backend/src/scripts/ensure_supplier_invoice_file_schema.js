const prisma = require('../database/prisma');

async function main() {
  console.log('Ensuring supplier_invoice_file column on RawMaterialPO...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "RawMaterialPO" ADD COLUMN IF NOT EXISTS "supplier_invoice_file" TEXT;`);
    console.log('Successfully added supplier_invoice_file column to RawMaterialPO table.');
  } catch (err) {
    console.error('Error executing ALTER TABLE:', err.message);
  }

  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'RawMaterialPO' AND column_name = 'supplier_invoice_file';
  `);
  console.log('Column check result:', columns);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
