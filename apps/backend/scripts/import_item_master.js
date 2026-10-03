const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

function loadProductRows() {
  const localXlsx = path.join(__dirname, 'Vitta_Item_Master_Upload.xlsx');
  const localJson = path.join(__dirname, 'vitta_item_master_data.json');
  const winPath = 'C:/Users/matha/Downloads/Vitta Item Master Upload 230926.xlsx';

  if (fs.existsSync(localXlsx)) {
    const wb = xlsx.readFile(localXlsx);
    return { rows: xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]), source: localXlsx };
  }
  if (fs.existsSync(localJson)) {
    return { rows: JSON.parse(fs.readFileSync(localJson, 'utf8')), source: localJson };
  }
  if (fs.existsSync(winPath)) {
    const wb = xlsx.readFile(winPath);
    return { rows: xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]), source: winPath };
  }
  throw new Error('Could not find item master source data file (looked for local .xlsx, local .json, and Windows download path).');
}

async function importItemMaster(dryRun = false) {
  const { rows, source } = loadProductRows();
  console.log(`\n======================================================`);
  console.log(`VITTA ITEM MASTER IMPORT UTILITY`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (Simulating)' : 'LIVE EXECUTION'}`);
  console.log(`Source File: ${source}`);
  console.log(`======================================================\n`);
  console.log(`✓ Loaded ${rows.length} product rows from source.`);

  // 2. Fetch Admin User
  const adminUser = await prisma.user.findFirst();
  if (!adminUser) throw new Error('No user found in database to assign as createdBy.');
  console.log(`✓ Default Creator User: ${adminUser.name} (${adminUser.id})`);

  // 3. Fetch or Create UOMs
  let pcsUom = await prisma.uOM.findFirst({
    where: { OR: [{ abbreviation: { equals: 'pcs', mode: 'insensitive' } }, { name: { equals: 'Pieces', mode: 'insensitive' } }] }
  });
  if (!pcsUom) {
    pcsUom = await prisma.uOM.create({ data: { name: 'Pieces', abbreviation: 'pcs' } });
  }

  let ltrUom = await prisma.uOM.findFirst({
    where: { OR: [{ abbreviation: { equals: 'ltr', mode: 'insensitive' } }, { name: { equals: 'Litres', mode: 'insensitive' } }] }
  });
  if (!ltrUom) {
    ltrUom = await prisma.uOM.create({ data: { name: 'Litres', abbreviation: 'Ltr' } });
  }
  console.log(`✓ UOMs resolved: Pieces (${pcsUom.id}), Litres (${ltrUom.id})`);

  // 4. Pre-create Categories (Group) and Subcategories (Category)
  const uniqueGroups = [...new Set(rows.map(r => String(r['Group'] || 'Other').trim()))];
  console.log(`\n✓ Found ${uniqueGroups.length} unique Groups to map as Product Categories:`, uniqueGroups);

  const categoryMap = {}; // groupName -> categoryRecord
  const subcategoryMap = {}; // `${groupName}__${catName}` -> subcategoryRecord

  for (const groupName of uniqueGroups) {
    let cat = await prisma.productCategory.findFirst({
      where: { name: { equals: groupName, mode: 'insensitive' } }
    });
    if (!cat && !dryRun) {
      cat = await prisma.productCategory.create({
        data: { name: groupName, description: `${groupName} Product Line` }
      });
      console.log(`  + Created Product Category: "${groupName}"`);
    } else if (cat) {
      // console.log(`  = Found existing Category: "${groupName}"`);
    }
    categoryMap[groupName] = cat || { id: 'simulated-cat-id', name: groupName };
  }

  const usedSubcatCodes = {}; // categoryId -> Set of codes

  for (const r of rows) {
    const groupName = String(r['Group'] || 'Other').trim();
    const catName = String(r['Category'] || 'General').trim();
    const key = `${groupName}__${catName}`;

    if (!subcategoryMap[key]) {
      const parentCat = categoryMap[groupName];
      let subcat = parentCat?.id !== 'simulated-cat-id'
        ? await prisma.productSubcategory.findFirst({
            where: { categoryId: parentCat.id, name: { equals: catName, mode: 'insensitive' } }
          })
        : null;

      if (!subcat && !dryRun && parentCat?.id) {
        if (!usedSubcatCodes[parentCat.id]) {
          const existing = await prisma.productSubcategory.findMany({
            where: { categoryId: parentCat.id },
            select: { code: true }
          });
          usedSubcatCodes[parentCat.id] = new Set(existing.map(e => e.code));
        }

        let baseCode = catName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'SUB';
        let candidate = baseCode;
        let count = 1;
        while (usedSubcatCodes[parentCat.id].has(candidate)) {
          candidate = `${baseCode.slice(0, 4)}_${count++}`;
        }
        usedSubcatCodes[parentCat.id].add(candidate);

        subcat = await prisma.productSubcategory.create({
          data: {
            categoryId: parentCat.id,
            name: catName,
            code: candidate,
            description: `${catName} under ${groupName}`,
            status: 'ACTIVE',
            hsnCodeDefault: '21050000',
            defaultUomId: pcsUom.id
          }
        });
        console.log(`  + Created Subcategory: "${catName}" (code: ${candidate}) under "${groupName}"`);
      }
      subcategoryMap[key] = subcat || { id: 'simulated-subcat-id', name: catName };
    }
  }

  // 5. If not dry run, perform Clean Wipe of previous test data as requested
  if (!dryRun) {
    console.log(`\n--- Purging old test product references & products (User Choice A3) ---`);
    await prisma.batchAllocation.deleteMany({});
    console.log(`  - Cleared Batch Allocations`);
    await prisma.productStockMovement.deleteMany({});
    console.log(`  - Cleared Stock Movements`);
    await prisma.salesCampaign.deleteMany({});
    console.log(`  - Cleared Sales Campaigns`);
    await prisma.salesReturnItem.deleteMany({});
    await prisma.salesReturn.deleteMany({});
    console.log(`  - Cleared Sales Returns`);
    await prisma.customerOrderItem.deleteMany({});
    await prisma.customerOrderDelivery.deleteMany({});
    await prisma.customerOrder.deleteMany({});
    console.log(`  - Cleared Test Customer Orders`);
    await prisma.labProductionTestNew.deleteMany({});
    await prisma.productionLossProduct.deleteMany({});
    await prisma.productionBatchRMUsage.deleteMany({});
    await prisma.productionBatchNew.deleteMany({});
    console.log(`  - Cleared Test Production Batches`);
    await prisma.inventoryBatch.deleteMany({});
    console.log(`  - Cleared Inventory Batches`);
    await prisma.productStockLevel.deleteMany({});
    console.log(`  - Cleared Product Stock Levels`);
    await prisma.productLearnedRecipeItem.deleteMany({});
    await prisma.productLearnedRecipe.deleteMany({});
    await prisma.productBOM.deleteMany({});
    console.log(`  - Cleared Old Product BOMs`);
    await prisma.productNonInventoryCost.deleteMany({});
    await prisma.productStage.deleteMany({});
    await prisma.productWastage.deleteMany({});
    
    const delCount = await prisma.finishedProduct.deleteMany({});
    console.log(`  ✓ Successfully wiped ${delCount.count} previous finished products.`);
  }

  // 6. Insert All 207 Items
  console.log(`\n--- Processing and inserting 207 items from Excel ---`);
  let inserted = 0;
  let onRequesters = 0;

  for (const r of rows) {
    const code = String(r['Item Code'] || '').trim();
    const name = String(r['Product Name'] || '').trim();
    const groupName = String(r['Group'] || 'Other').trim();
    const catName = String(r['Category'] || 'General').trim();
    const size = String(r['Size ML'] || '').trim();
    const cavity = String(r['Cavity'] || '').trim();
    const series = String(r['Series'] || '').trim();
    const description = String(r['Description'] || `${groupName} ${catName} ${name} ${size}`).trim();

    // Determine Sale Price: strictly use Factory Price, set 0 for "On Request" (User Choice A1 & A2)
    let salePrice = 0;
    const rawPrice = r['Factory Price'];
    const isOnRequest = typeof rawPrice === 'string' && rawPrice.toLowerCase().includes('request');
    if (typeof rawPrice === 'number' && !isNaN(rawPrice)) {
      salePrice = rawPrice;
    } else {
      onRequesters++;
      salePrice = 0; // "On Request"
    }

    // Determine UOM: 4Ltr Gallons map to 'Ltr', everything else to 'pcs'
    const isGallon = size.toLowerCase().includes('4ltr') || groupName.toLowerCase().includes('gallon');
    const assignedUom = isGallon ? ltrUom : pcsUom;

    const parentCat = categoryMap[groupName];
    const subcatKey = `${groupName}__${catName}`;
    const subcat = subcategoryMap[subcatKey];

    const productPayload = {
      code,
      name,
      productName: name,
      sku: code,
      brand: 'Vitta',
      description,
      size,
      categoryId: parentCat.id,
      subcategoryId: subcat?.id || null,
      unitId: assignedUom.id,
      stockMethod: 'FIFO',
      salePrice,
      totalCost: 0,
      totalRawMaterialCost: 0,
      totalNonInventoryCost: 0,
      profitMargin: 0,
      cgst: 2.50, // 5% GST split
      sgst: 2.50,
      igst: 5.00,
      openingStock: 0,
      currentStock: 0,
      alertLevel: 10,
      createdBy: adminUser.id,
      specifications: {
        serialNo: r['Serial No'] || null,
        series,
        itemCode: code,
        group: groupName,
        category: catName,
        productName: name,
        cavity,
        sizeML: size,
        factoryPrice: salePrice,
        gstPercent: 5,
        gstValue: typeof r['GST Value'] === 'number' ? r['GST Value'] : Number((salePrice * 0.05).toFixed(2)),
        totalWithGst: typeof r['Total'] === 'number' ? r['Total'] : Number((salePrice > 0 ? salePrice * 1.05 : 0).toFixed(2)),
        hsnCode: '21050000',
        priceMode: isOnRequest ? 'ON_REQUEST' : 'STANDARD'
      }
    };

    if (!dryRun) {
      const createdProd = await prisma.finishedProduct.create({ data: productPayload });
      await prisma.productStockLevel.create({
        data: {
          productId: createdProd.id,
          minLevel: 10,
          maxLevel: 500,
          reorderPoint: 25,
          updatedBy: adminUser.id
        }
      });
    }
    inserted++;
  }

  console.log(`\n======================================================`);
  console.log(`IMPORT COMPLETE!`);
  console.log(`Total Products ${dryRun ? 'Simulated' : 'Imported'}: ${inserted}`);
  console.log(`Products with "On Request" (Price set to 0.00): ${onRequesters}`);
  console.log(`GST Applied: 5.00% (CGST 2.5%, SGST 2.5%, IGST 5.0%) across all items`);
  console.log(`HSN Code: 21050000`);
  console.log(`======================================================\n`);
}

// Check arguments: node import_item_master.js --live
const isLive = process.argv.includes('--live');
importItemMaster(!isLive)
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Import Error:', err);
    prisma.$disconnect();
    process.exit(1);
  });
