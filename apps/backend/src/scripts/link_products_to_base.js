const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Migrating products table to support base_id ---');
  
  // 1. Add base_id column to products if not exists
  await prisma.$executeRawUnsafe(`
    ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES base_master(id) ON DELETE SET NULL;
  `);
  console.log('Verified base_id column in products table.');

  // 2. Fetch bases
  const bases = await prisma.baseMaster.findMany();
  const icb = bases.find(b => b.code === 'ICB');
  const klb = bases.find(b => b.code === 'KLB');
  const fdb = bases.find(b => b.code === 'FDB');

  console.log('Available Bases:', {
    ICB: icb ? { id: icb.id, name: icb.name } : 'missing',
    KLB: klb ? { id: klb.id, name: klb.name } : 'missing',
    FDB: fdb ? { id: fdb.id, name: fdb.name } : 'missing'
  });

  // 3. Update products
  const products = await prisma.finishedProduct.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      specifications: true,
      category: { select: { name: true } }
    }
  });

  let icbCount = 0;
  let klbCount = 0;
  let fdbCount = 0;

  for (const p of products) {
    const group = (p.specifications?.group || p.category?.name || '').toLowerCase();
    const series = (p.specifications?.series || p.code || '').toUpperCase();
    const cat = (p.specifications?.category || '').toLowerCase();

    let targetBase = icb;
    if (group.includes('kulfi') || series.startsWith('K') || group.includes('matka')) {
      targetBase = klb;
      klbCount++;
    } else if (group.includes('fd') || series.startsWith('BFD') || cat.includes('frozen dessert')) {
      targetBase = fdb;
      fdbCount++;
    } else {
      targetBase = icb;
      icbCount++;
    }

    if (targetBase) {
      const specs = p.specifications || {};
      specs.baseId = targetBase.id;
      specs.baseCode = targetBase.code;
      specs.baseName = targetBase.name;

      await prisma.$executeRawUnsafe(
        'UPDATE products SET base_id = $1::uuid, specifications = $2::jsonb WHERE id = $3',
        targetBase.id,
        JSON.stringify(specs),
        p.id
      );
    }
  }

  console.log(`Successfully mapped ${products.length} products to their respective bases:`);
  console.log(`- ICE CREAM BASE (ICB): ${icbCount} products`);
  console.log(`- KULFI BASE (KLB): ${klbCount} products`);
  console.log(`- FD BASE (FDB): ${fdbCount} products`);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
