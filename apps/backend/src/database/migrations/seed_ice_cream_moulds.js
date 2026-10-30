const prisma = require('../prisma');

const MOULD_SEEDS = [
  {
    mouldCode: 'SG-2006',
    mouldName: 'Egypt Small (SG 2006)',
    mouldCategory: '2000 Series',
    modelNumber: 'SG-2006',
    capacityMl: 18.00,
    cavityCount: 42,
    totalNominalCapacityMl: 756.00,
    trayLengthMm: 325,
    trayWidthMm: 245,
    trayHeightMm: 160,
    dimensionText: '5N Mould / Delivery 210 NOS',
    material: 'Stainless Steel 304',
    machineType: 'Brine tank line',
    dimensionSource: 'Satnam Group / Manufacturer',
    specificationStatus: 'VERIFIED',
    supplierId: 'SUP-SATNAM-01',
    supplierName: 'Satnam Group',
    status: 'ACTIVE'
  },
  {
    mouldCode: 'SG-3006',
    mouldName: 'Flat Stick (SG 3006)',
    mouldCategory: '3000 Series',
    modelNumber: 'SG-3006',
    capacityMl: 40.00,
    cavityCount: 50,
    totalNominalCapacityMl: 2000.00,
    trayLengthMm: 325,
    trayWidthMm: 260,
    trayHeightMm: 160,
    dimensionText: '10N Mould / Delivery 500 NOS',
    material: 'Stainless Steel 304',
    machineType: 'Brine tank line',
    dimensionSource: 'Satnam Group / Manufacturer',
    specificationStatus: 'VERIFIED',
    supplierId: 'SUP-SATNAM-01',
    supplierName: 'Satnam Group',
    status: 'ACTIVE'
  },
  {
    mouldCode: 'SG-8112',
    mouldName: 'Kulfi Small (SG 8112)',
    mouldCategory: '8000 Series',
    modelNumber: 'SG-8112',
    capacityMl: 50.00,
    cavityCount: 42,
    totalNominalCapacityMl: 2100.00,
    trayLengthMm: 325,
    trayWidthMm: 245,
    trayHeightMm: 160,
    dimensionText: '20N Mould / Delivery 840 NOS',
    material: 'Stainless Steel 304',
    machineType: 'Brine tank line',
    dimensionSource: 'Satnam Group / Manufacturer',
    specificationStatus: 'VERIFIED',
    supplierId: 'SUP-SATNAM-01',
    supplierName: 'Satnam Group',
    status: 'ACTIVE'
  },
  {
    mouldCode: 'SG-8115',
    mouldName: 'Kulfi Large (SG 8115)',
    mouldCategory: '8000 Series',
    modelNumber: 'SG-8115',
    capacityMl: 70.00,
    cavityCount: 42,
    totalNominalCapacityMl: 2940.00,
    trayLengthMm: 325,
    trayWidthMm: 245,
    trayHeightMm: 160,
    dimensionText: '10N Mould / Delivery 420 NOS',
    material: 'Stainless Steel 304',
    machineType: 'Brine tank line',
    dimensionSource: 'Satnam Group / Manufacturer',
    specificationStatus: 'VERIFIED',
    supplierId: 'SUP-SATNAM-01',
    supplierName: 'Satnam Group',
    status: 'ACTIVE'
  }
];

async function seedIceCreamMoulds(customPrisma = null) {
  const db = customPrisma || prisma;
  console.log(`🔄 Syncing Ice Cream Moulds Catalogue (Total ${MOULD_SEEDS.length} active moulds)...`);

  const activeCodes = MOULD_SEEDS.map(m => m.mouldCode);

  // 1. Remove previous moulds not in the active list from both tables
  try {
    const deletedCount1 = await db.$executeRawUnsafe(`
      DELETE FROM "ice_cream_moulds" 
      WHERE "mould_code" NOT IN (${activeCodes.map((_, i) => `$${i + 1}`).join(', ')});
    `, ...activeCodes);
    console.log(`Cleaned ${deletedCount1} previous moulds from ice_cream_moulds.`);
  } catch (err) {
    console.warn('Notice removing old moulds from ice_cream_moulds:', err.message);
  }

  try {
    const deletedCount2 = await db.$executeRawUnsafe(`
      DELETE FROM "production_moulds" 
      WHERE "mould_code" NOT IN (${activeCodes.map((_, i) => `$${i + 1}`).join(', ')});
    `, ...activeCodes);
    console.log(`Cleaned ${deletedCount2} previous moulds from production_moulds.`);
  } catch (err) {
    console.warn('Notice removing old moulds from production_moulds:', err.message);
  }

  // 2. Insert or update the verified moulds in ice_cream_moulds table
  // Note: total_nominal_capacity_ml is a GENERATED column in Postgres on ice_cream_moulds
  let icCount = 0;
  for (const m of MOULD_SEEDS) {
    try {
      await db.$executeRawUnsafe(`
        INSERT INTO "ice_cream_moulds" (
          "mould_code", "mould_name", "mould_category", "model_number",
          "capacity_ml", "cavity_count",
          "length_mm", "width_mm", "height_mm",
          "material", "machine_type", "dimension_source",
          "specification_status", "supplier_id", "supplier_name", "status"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT ("mould_code") DO UPDATE SET
          "mould_name" = EXCLUDED."mould_name",
          "mould_category" = EXCLUDED."mould_category",
          "model_number" = EXCLUDED."model_number",
          "capacity_ml" = EXCLUDED."capacity_ml",
          "cavity_count" = EXCLUDED."cavity_count",
          "length_mm" = EXCLUDED."length_mm",
          "width_mm" = EXCLUDED."width_mm",
          "height_mm" = EXCLUDED."height_mm",
          "material" = EXCLUDED."material",
          "machine_type" = EXCLUDED."machine_type",
          "dimension_source" = EXCLUDED."dimension_source",
          "specification_status" = EXCLUDED."specification_status",
          "supplier_name" = EXCLUDED."supplier_name",
          "status" = EXCLUDED."status",
          "updated_at" = CURRENT_TIMESTAMP;
      `,
        m.mouldCode,
        m.mouldName,
        m.mouldCategory,
        m.modelNumber,
        m.capacityMl,
        m.cavityCount,
        m.trayLengthMm,
        m.trayWidthMm,
        m.trayHeightMm,
        m.material,
        m.machineType,
        m.dimensionSource,
        m.specificationStatus,
        m.supplierId,
        m.supplierName,
        m.status
      );
      icCount++;
    } catch (err) {
      console.warn(`Notice inserting into ice_cream_moulds ${m.mouldCode}:`, err.message);
    }
  }

  // 3. Insert or update the verified moulds in production_moulds table (used by ice_cream_mould view on Live)
  let pmCount = 0;
  for (const m of MOULD_SEEDS) {
    try {
      await db.$executeRawUnsafe(`
        INSERT INTO "production_moulds" (
          "mould_code", "mould_name", "mould_category", "model_number",
          "capacity_ml", "cavity_count",
          "tray_length_mm", "tray_width_mm", "tray_height_mm",
          "dimension_text", "material", "machine_type",
          "specification_status", "supplier_id", "supplier_name", "status"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT ("mould_code") DO UPDATE SET
          "mould_name" = EXCLUDED."mould_name",
          "mould_category" = EXCLUDED."mould_category",
          "model_number" = EXCLUDED."model_number",
          "capacity_ml" = EXCLUDED."capacity_ml",
          "cavity_count" = EXCLUDED."cavity_count",
          "tray_length_mm" = EXCLUDED."tray_length_mm",
          "tray_width_mm" = EXCLUDED."tray_width_mm",
          "tray_height_mm" = EXCLUDED."tray_height_mm",
          "dimension_text" = EXCLUDED."dimension_text",
          "material" = EXCLUDED."material",
          "machine_type" = EXCLUDED."machine_type",
          "specification_status" = EXCLUDED."specification_status",
          "supplier_name" = EXCLUDED."supplier_name",
          "status" = EXCLUDED."status",
          "updated_at" = CURRENT_TIMESTAMP;
      `,
        m.mouldCode,
        m.mouldName,
        m.mouldCategory,
        m.modelNumber,
        m.capacityMl,
        m.cavityCount,
        m.trayLengthMm,
        m.trayWidthMm,
        m.trayHeightMm,
        m.dimensionText,
        m.material,
        m.machineType,
        m.specificationStatus,
        m.supplierId,
        m.supplierName,
        m.status
      );
      pmCount++;
    } catch (err) {
      console.warn(`Notice inserting into production_moulds ${m.mouldCode}:`, err.message);
    }
  }

  // 4. Ensure view ice_cream_mould exists and is valid
  try {
    await db.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW ice_cream_mould AS 
      SELECT 
        id, 
        mould_code, 
        mould_name, 
        mould_category, 
        model_number, 
        capacity_ml, 
        cavity_count, 
        total_nominal_capacity_ml, 
        tray_length_mm, 
        tray_width_mm, 
        tray_height_mm, 
        cavity_length_mm, 
        cavity_width_mm, 
        cavity_depth_mm, 
        dimension_text::varchar(255) AS dimension_text, 
        material, 
        machine_type, 
        specification_status, 
        supplier_id, 
        supplier_name, 
        status, 
        created_at, 
        updated_at
      FROM production_moulds;
    `);
  } catch (viewErr) {
    console.log('View creation notice (view may already point to production_moulds):', viewErr.message);
  }

  console.log(`✅ Synced ${icCount} to ice_cream_moulds and ${pmCount} to production_moulds.`);
}

module.exports = { seedIceCreamMoulds, MOULD_SEEDS };
