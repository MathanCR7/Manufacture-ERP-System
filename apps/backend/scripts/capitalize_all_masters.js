const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function capitalizeAll() {
  console.log('--- STARTING CAPITALIZATION OF ALL NAMES & FIELDS ---');

  // 1. Categories
  const categories = await prisma.productCategory.findMany();
  console.log(`Found ${categories.length} categories.`);
  for (const cat of categories) {
    const upperName = (cat.name || '').trim().toUpperCase();
    const upperCode = (cat.code || '').trim().toUpperCase();
    if (cat.name !== upperName || cat.code !== upperCode) {
      await prisma.productCategory.update({
        where: { id: cat.id },
        data: { name: upperName, code: upperCode }
      });
      console.log(`Updated Category [${cat.id}]: "${cat.name}" -> "${upperName}"`);
    }
  }

  // 2. Subcategories
  const subcategories = await prisma.productSubcategory.findMany();
  console.log(`Found ${subcategories.length} subcategories.`);
  for (const sub of subcategories) {
    const upperName = (sub.name || '').trim().toUpperCase();
    const upperCode = (sub.code || '').trim().toUpperCase();
    if (sub.name !== upperName || sub.code !== upperCode) {
      await prisma.productSubcategory.update({
        where: { id: sub.id },
        data: { name: upperName, code: upperCode }
      });
      console.log(`Updated Subcategory [${sub.id}]: "${sub.name}" -> "${upperName}"`);
    }
  }

  // 3. Finished Products
  const products = await prisma.finishedProduct.findMany();
  console.log(`Found ${products.length} finished products.`);
  for (const p of products) {
    const upperName = (p.name || '').trim().toUpperCase();
    const upperBrand = p.brand ? p.brand.trim().toUpperCase() : null;
    const upperMaterial = p.material ? p.material.trim().toUpperCase() : null;
    const upperColor = p.color ? p.color.trim().toUpperCase() : null;
    const upperSize = p.size ? p.size.trim().toUpperCase() : null;
    const upperModel = p.modelNumber ? p.modelNumber.trim().toUpperCase() : null;
    const upperOrigin = p.countryOfOrigin ? p.countryOfOrigin.trim().toUpperCase() : null;
    const upperCategoryPath = p.categoryPathText ? p.categoryPathText.trim().toUpperCase() : null;
    const upperSKU = p.sku ? p.sku.trim().toUpperCase() : null;

    // Also update customAttributes or specifications if any
    let updatedSpecs = p.specifications;
    if (updatedSpecs && typeof updatedSpecs === 'object') {
      const newSpecs = {};
      for (const [k, v] of Object.entries(updatedSpecs)) {
        const upperK = k.toUpperCase();
        const upperV = typeof v === 'string' ? v.toUpperCase() : v;
        newSpecs[upperK] = upperV;
      }
      updatedSpecs = newSpecs;
    }

    await prisma.finishedProduct.update({
      where: { id: p.id },
      data: {
        name: upperName,
        brand: upperBrand,
        material: upperMaterial,
        color: upperColor,
        size: upperSize,
        modelNumber: upperModel,
        countryOfOrigin: upperOrigin,
        categoryPathText: upperCategoryPath,
        sku: upperSKU,
        specifications: updatedSpecs
      }
    });
    console.log(`Updated Product [${p.id}]: "${p.name}" -> "${upperName}"`);
  }

  // 4. Spec Templates
  const templates = await prisma.productSpecTemplate.findMany();
  console.log(`Found ${templates.length} spec templates.`);
  for (const t of templates) {
    const upperName = (t.name || '').trim().toUpperCase();
    if (t.name !== upperName) {
      await prisma.productSpecTemplate.update({
        where: { id: t.id },
        data: { name: upperName }
      });
      console.log(`Updated Template [${t.id}]: "${t.name}" -> "${upperName}"`);
    }
  }

  // 5. Spec Template Fields
  const fields = await prisma.productSpecTemplateField.findMany();
  console.log(`Found ${fields.length} spec template fields.`);
  for (const f of fields) {
    const upperFieldName = (f.fieldName || '').trim().toUpperCase();
    const upperFieldKey = (f.fieldKey || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const upperSection = (f.sectionName || '').trim().toUpperCase();
    const upperPlaceholder = f.placeholder ? f.placeholder.trim().toUpperCase() : null;
    let upperOptions = f.options;
    if (Array.isArray(f.options)) {
      upperOptions = f.options.map(opt => (typeof opt === 'string' ? opt.trim().toUpperCase() : opt));
    }

    await prisma.productSpecTemplateField.update({
      where: { id: f.id },
      data: {
        fieldName: upperFieldName,
        fieldKey: upperFieldKey,
        section: upperSection,
        placeholder: upperPlaceholder,
        options: upperOptions
      }
    });
    console.log(`Updated Field [${f.id}]: "${f.fieldName}" -> "${upperFieldName}"`);
  }

  console.log('--- ALL CATEGORIES, SUBCATEGORIES, PRODUCTS, TEMPLATES & FIELDS CAPITALIZED SUCCESSFULLY ---');
}

capitalizeAll()
  .catch(err => {
    console.error('Error during capitalization:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
