require('dotenv').config();
const prisma = require('./src/database/prisma');
const items = require('./raw_materials.json');

async function main() {
  console.log(`🚀 Loaded ${items.length} raw materials from JSON.`);

  // 1. Group & upsert unique categories
  const categoryMap = {};
  for (const item of items) {
    if (!categoryMap[item.categoryCode]) {
      categoryMap[item.categoryCode] = item.category;
    }
  }

  const categoryDbIds = {};
  for (const [code, name] of Object.entries(categoryMap)) {
    const cat = await prisma.rMCategory.upsert({
      where: { code },
      update: { name, description: `${name} Category` },
      create: { name, code, description: `${name} Category`, status: 'ACTIVE' }
    });
    categoryDbIds[name] = cat.id;
  }
  console.log(`✅ Upserted ${Object.keys(categoryDbIds).length} Categories.`);

  // 2. Safe upsert each raw material (preserves any existing relationships)
  let count = 0;
  for (const item of items) {
    const catId = categoryDbIds[item.category];
    await prisma.rawMaterial.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        categoryId: catId,
        unitId: item.uom,
        openingStock: item.qty,
        currentStock: item.qty,
        description: item.description
      },
      create: {
        code: item.code,
        name: item.name,
        categoryId: catId,
        unitId: item.uom,
        ratePerUnit: 0.00,
        openingStock: item.qty,
        currentStock: item.qty,
        alertLevel: 0.00,
        description: item.description
      }
    });
    count++;
  }

  console.log(`🎉 Successfully imported ${count} Raw Materials into erp_manufacture!`);
}

main()
  .catch(err => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
