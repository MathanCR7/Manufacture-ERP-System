const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupMouldAndBulkMasters() {
  console.log('Running setup for Mould and Bulk Storage Unit Masters...');

  // 1. Ensure bulk_storage_units table exists
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "bulk_storage_units" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "unit_code" VARCHAR(50) UNIQUE NOT NULL,
      "unit_name" VARCHAR(150) NOT NULL,
      "unit_type" VARCHAR(50) NOT NULL DEFAULT 'Tub',
      "capacity_ml" NUMERIC(12, 2) NOT NULL DEFAULT 1000,
      "nominal_volume_ltr" NUMERIC(10, 3) NOT NULL DEFAULT 1.000,
      "tare_weight_kg" NUMERIC(10, 3) DEFAULT 0,
      "material" VARCHAR(100) DEFAULT 'Food Grade Plastic PP',
      "standard_waste_percent" NUMERIC(5, 2) DEFAULT 0.5,
      "description" TEXT,
      "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      "linked_raw_materials" JSONB DEFAULT '[]'::jsonb,
      "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('bulk_storage_units table verified/created.');

  // 2. Ensure linked_raw_materials column exists on production_moulds and ice_cream_moulds
  await prisma.$executeRawUnsafe(`ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "linked_raw_materials" JSONB DEFAULT '[]'::jsonb;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ice_cream_moulds" ADD COLUMN IF NOT EXISTS "linked_raw_materials" JSONB DEFAULT '[]'::jsonb;`);
  console.log('linked_raw_materials columns verified on mould tables.');

  // 3. Find IDs of stick & roll raw materials for linking
  const rawMaterials = await prisma.rawMaterial.findMany({
    where: {
      OR: [
        { code: { in: ['RM-00119', 'RM-00120', 'RM-00155', 'RM-00156', 'RM-00131', 'RM-00132', 'RM-00138', 'RM-00121'] } },
        { name: { contains: 'STICK', mode: 'insensitive' } },
        { name: { contains: 'ROLL', mode: 'insensitive' } }
      ]
    }
  });

  const getRm = (code, fallbackName, fallbackUom = 'pcs') => {
    const found = rawMaterials.find(r => r.code === code) || rawMaterials.find(r => r.name.toLowerCase().includes(fallbackName.toLowerCase()));
    if (found) {
      return {
        rawMaterialId: found.id,
        rmCode: found.code,
        rmName: found.name,
        uom: found.consumptionUnit || found.uom || fallbackUom
      };
    }
    return {
      rawMaterialId: null,
      rmCode: code,
      rmName: fallbackName,
      uom: fallbackUom
    };
  };

  const rmStick65 = getRm('RM-00119', 'STICK 65 MM (Wooden Stick)', 'pcs');
  const rmStick144 = getRm('RM-00120', 'STICK 144 MM (Wooden Stick)', 'pcs');
  const rmRoll130 = getRm('RM-00155', 'PACKING ROLL 130MM', 'rolls');
  const rmRoll170 = getRm('RM-00156', 'PACKING ROLL 170MM', 'rolls');
  const rmGallonBox = getRm('RM-00121', 'GALLON BOX 4LTR', 'box');
  const rmPet5L = getRm('RM-00138', 'PET 5LTR CAN', 'pcs');

  // 4. Reference moulds with linked RMs
  const referenceMoulds = [
    {
      mould_code: 'SG-2006',
      mould_name: 'Egypt Small (SG 2006)',
      mould_category: '2000 Series',
      model_number: 'SG-2006',
      capacity_ml: 18,
      cavity_count: 42,
      total_nominal_capacity_ml: 756,
      tray_length_mm: 325,
      tray_width_mm: 245,
      tray_height_mm: 160,
      dimension_text: '5N Mould / Delivery 210 NOS',
      material: 'Stainless Steel 304',
      machine_type: 'Brine tank line',
      specification_status: 'VERIFIED',
      supplier_name: 'Satnam Group',
      status: 'ACTIVE',
      linked_raw_materials: [
        { ...rmStick65, quantityPerUnit: 1, role: 'STICK' },
        { ...rmRoll130, quantityPerUnit: 0.001, role: 'WRAPPER' }
      ]
    },
    {
      mould_code: 'SG-3006',
      mould_name: 'Flat Stick (SG 3006)',
      mould_category: '3000 Series',
      model_number: 'SG-3006',
      capacity_ml: 40,
      cavity_count: 50,
      total_nominal_capacity_ml: 2000,
      tray_length_mm: 325,
      tray_width_mm: 260,
      tray_height_mm: 160,
      dimension_text: '10N Mould / Delivery 500 NOS',
      material: 'Stainless Steel 304',
      machine_type: 'Brine tank line',
      specification_status: 'VERIFIED',
      supplier_name: 'Satnam Group',
      status: 'ACTIVE',
      linked_raw_materials: [
        { ...rmStick144, quantityPerUnit: 1, role: 'STICK' },
        { ...rmRoll170, quantityPerUnit: 0.001, role: 'WRAPPER' }
      ]
    },
    {
      mould_code: 'SG-8112',
      mould_name: 'Kulfi Small (SG 8112)',
      mould_category: '8000 Series',
      model_number: 'SG-8112',
      capacity_ml: 50,
      cavity_count: 42,
      total_nominal_capacity_ml: 2100,
      tray_length_mm: 325,
      tray_width_mm: 245,
      tray_height_mm: 160,
      dimension_text: '20N Mould / Delivery 840 NOS',
      material: 'Stainless Steel 304',
      machine_type: 'Brine tank line',
      specification_status: 'VERIFIED',
      supplier_name: 'Satnam Group',
      status: 'ACTIVE',
      linked_raw_materials: [
        { ...rmStick144, quantityPerUnit: 1, role: 'STICK' },
        { ...rmRoll170, quantityPerUnit: 0.001, role: 'WRAPPER' }
      ]
    },
    {
      mould_code: 'SG-8115',
      mould_name: 'Kulfi Large (SG 8115)',
      mould_category: '8000 Series',
      model_number: 'SG-8115',
      capacity_ml: 70,
      cavity_count: 42,
      total_nominal_capacity_ml: 2940,
      tray_length_mm: 325,
      tray_width_mm: 245,
      tray_height_mm: 160,
      dimension_text: '10N Mould / Delivery 420 NOS',
      material: 'Stainless Steel 304',
      machine_type: 'Brine tank line',
      specification_status: 'VERIFIED',
      supplier_name: 'Satnam Group',
      status: 'ACTIVE',
      linked_raw_materials: [
        { ...rmStick144, quantityPerUnit: 1, role: 'STICK' },
        { ...rmRoll170, quantityPerUnit: 0.001, role: 'WRAPPER' }
      ]
    }
  ];

  for (const m of referenceMoulds) {
    const jsonStr = JSON.stringify(m.linked_raw_materials);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "production_moulds" (
        "mould_code", "mould_name", "mould_category", "model_number",
        "capacity_ml", "cavity_count",
        "tray_length_mm", "tray_width_mm", "tray_height_mm",
        "dimension_text", "material", "machine_type",
        "specification_status", "supplier_name", "status", "linked_raw_materials"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb
      )
      ON CONFLICT ("mould_code") DO UPDATE SET
        "mould_name" = EXCLUDED."mould_name",
        "capacity_ml" = EXCLUDED."capacity_ml",
        "cavity_count" = EXCLUDED."cavity_count",
        "dimension_text" = EXCLUDED."dimension_text",
        "linked_raw_materials" = CASE 
          WHEN "production_moulds"."linked_raw_materials" IS NULL OR "production_moulds"."linked_raw_materials" = '[]'::jsonb 
          THEN EXCLUDED."linked_raw_materials" 
          ELSE "production_moulds"."linked_raw_materials" 
        END,
        "updated_at" = CURRENT_TIMESTAMP;
    `, m.mould_code, m.mould_name, m.mould_category, m.model_number,
       m.capacity_ml, m.cavity_count,
       m.tray_length_mm, m.tray_width_mm, m.tray_height_mm,
       m.dimension_text, m.material, m.machine_type,
       m.specification_status, m.supplier_name, m.status, jsonStr);
  }
  console.log('Reference moulds seeded into production_moulds.');

  // 5. Reference bulk storage units with linked RMs
  const referenceBulkUnits = [
    {
      unit_code: 'BLK-1000ML',
      unit_name: 'Liter (1,000 ml)',
      unit_type: 'Liter',
      capacity_ml: 1000,
      nominal_volume_ltr: 1.0,
      tare_weight_kg: 0.05,
      material: 'Food Grade Plastic PP Tub',
      standard_waste_percent: 0.5,
      description: 'Standard 1 Litre Ice Cream Container / Tub',
      status: 'ACTIVE',
      linked_raw_materials: [
        { rawMaterialId: null, rmCode: 'PKG-TUB-1L', rmName: '1L Ice Cream Tub & Lid', uom: 'pcs', quantityPerUnit: 1, role: 'CONTAINER' }
      ]
    },
    {
      unit_code: 'BLK-2000ML',
      unit_name: 'Gallon (2,000 ml)',
      unit_type: 'Gallon',
      capacity_ml: 2000,
      nominal_volume_ltr: 2.0,
      tare_weight_kg: 0.09,
      material: 'Food Grade Plastic Gallon Tub',
      standard_waste_percent: 0.5,
      description: 'Standard 2 Litre / Half Gallon Bulk Container',
      status: 'ACTIVE',
      linked_raw_materials: [
        { ...rmGallonBox, quantityPerUnit: 0.5, role: 'PACKAGING' },
        { rawMaterialId: null, rmCode: 'PKG-GAL-2L', rmName: '2L Gallon Tub with Handle', uom: 'pcs', quantityPerUnit: 1, role: 'CONTAINER' }
      ]
    },
    {
      unit_code: 'BLK-5000ML',
      unit_name: 'Tub (5 Litres)',
      unit_type: 'Tub',
      capacity_ml: 5000,
      nominal_volume_ltr: 5.0,
      tare_weight_kg: 0.18,
      material: 'Commercial Food Grade HDPE Tub',
      standard_waste_percent: 0.5,
      description: '5 Litres Bulk Catering / Parlour Tub',
      status: 'ACTIVE',
      linked_raw_materials: [
        { ...rmPet5L, quantityPerUnit: 1, role: 'CONTAINER' }
      ]
    },
    {
      unit_code: 'BLK-20000ML',
      unit_name: 'Can (20 Litres)',
      unit_type: 'Can',
      capacity_ml: 20000,
      nominal_volume_ltr: 20.0,
      tare_weight_kg: 0.65,
      material: 'Commercial Stainless Steel / Heavy-Duty HDPE Can',
      standard_waste_percent: 0.2,
      description: '20 Litres Commercial Ice Cream Can for Dispensing & Parlours',
      status: 'ACTIVE',
      linked_raw_materials: [
        { rawMaterialId: null, rmCode: 'PKG-CAN-20L', rmName: '20L Commercial Ice Cream Can', uom: 'pcs', quantityPerUnit: 1, role: 'CONTAINER' }
      ]
    }
  ];

  for (const b of referenceBulkUnits) {
    const jsonStr = JSON.stringify(b.linked_raw_materials);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "bulk_storage_units" (
        "unit_code", "unit_name", "unit_type",
        "capacity_ml", "nominal_volume_ltr", "tare_weight_kg",
        "material", "standard_waste_percent", "description",
        "status", "linked_raw_materials"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
      )
      ON CONFLICT ("unit_code") DO UPDATE SET
        "unit_name" = EXCLUDED."unit_name",
        "unit_type" = EXCLUDED."unit_type",
        "capacity_ml" = EXCLUDED."capacity_ml",
        "nominal_volume_ltr" = EXCLUDED."nominal_volume_ltr",
        "material" = EXCLUDED."material",
        "linked_raw_materials" = CASE 
          WHEN "bulk_storage_units"."linked_raw_materials" IS NULL OR "bulk_storage_units"."linked_raw_materials" = '[]'::jsonb 
          THEN EXCLUDED."linked_raw_materials" 
          ELSE "bulk_storage_units"."linked_raw_materials" 
        END,
        "updated_at" = CURRENT_TIMESTAMP;
    `, b.unit_code, b.unit_name, b.unit_type,
       b.capacity_ml, b.nominal_volume_ltr, b.tare_weight_kg,
       b.material, b.standard_waste_percent, b.description,
       b.status, jsonStr);
  }
  console.log('Reference bulk storage units seeded into bulk_storage_units.');
}

if (require.main === module) {
  setupMouldAndBulkMasters()
    .then(() => {
      console.log('Setup successfully completed!');
      return prisma.$disconnect();
    })
    .catch(err => {
      console.error('Setup failed:', err);
      return prisma.$disconnect();
    });
}

module.exports = setupMouldAndBulkMasters;
