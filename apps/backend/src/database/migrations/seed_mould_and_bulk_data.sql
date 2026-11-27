-- ==============================================================================
-- Seed Script for Ice Cream Moulds and Bulk Storage Units
-- Applies schema tables, fixes permissions and seeds exact verified masters
-- ==============================================================================

-- 1. Ensure production_moulds table exists
CREATE TABLE IF NOT EXISTS "production_moulds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "mould_code" VARCHAR(50) UNIQUE NOT NULL,
  "mould_name" VARCHAR(150) NOT NULL,
  "mould_category" VARCHAR(50) NOT NULL DEFAULT '2000 Series',
  "model_number" VARCHAR(50),
  "capacity_ml" NUMERIC(12, 2) NOT NULL DEFAULT 50,
  "cavity_count" INT NOT NULL DEFAULT 42,
  "total_nominal_capacity_ml" NUMERIC(12, 2),
  "tray_length_mm" NUMERIC(10, 2),
  "tray_width_mm" NUMERIC(10, 2),
  "tray_height_mm" NUMERIC(10, 2),
  "cavity_length_mm" NUMERIC(10, 2),
  "cavity_width_mm" NUMERIC(10, 2),
  "cavity_depth_mm" NUMERIC(10, 2),
  "dimension_text" VARCHAR(100),
  "material" VARCHAR(100) DEFAULT 'SS 304 Food Grade',
  "machine_type" VARCHAR(100) DEFAULT 'Brine Tank Line 1',
  "specification_status" VARCHAR(30) NOT NULL DEFAULT 'VERIFIED',
  "supplier_id" VARCHAR(50) DEFAULT 'SUP-SATNAM-01',
  "supplier_name" VARCHAR(150) DEFAULT 'Satnam Group',
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "total_sets_in_plant" INT DEFAULT 10,
  "notes" TEXT,
  "linked_raw_materials" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "total_sets_in_plant" INT DEFAULT 10;
ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "production_moulds" ADD COLUMN IF NOT EXISTS "linked_raw_materials" JSONB DEFAULT '[]'::jsonb;

-- 2. Ensure bulk_storage_units table exists
CREATE TABLE IF NOT EXISTS "bulk_storage_units" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_code" VARCHAR(50) UNIQUE NOT NULL,
  "unit_name" VARCHAR(150) NOT NULL,
  "unit_type" VARCHAR(50) NOT NULL DEFAULT 'Gallon',
  "capacity_ml" NUMERIC(12, 2) NOT NULL DEFAULT 2000,
  "nominal_volume_ltr" NUMERIC(10, 3) NOT NULL DEFAULT 2.000,
  "tare_weight_kg" NUMERIC(10, 3) DEFAULT 0.08,
  "material" VARCHAR(100) DEFAULT 'Food Grade Polypropylene',
  "standard_waste_percent" NUMERIC(5, 2) DEFAULT 0.5,
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "linked_raw_materials" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "bulk_storage_units" ADD COLUMN IF NOT EXISTS "linked_raw_materials" JSONB DEFAULT '[]'::jsonb;

-- 3. Grant table permissions
ALTER TABLE "production_moulds" OWNER TO leonex_web_user;
ALTER TABLE "bulk_storage_units" OWNER TO leonex_web_user;
GRANT ALL PRIVILEGES ON TABLE "production_moulds" TO leonex_web_user, erp_user, PUBLIC;
GRANT ALL PRIVILEGES ON TABLE "bulk_storage_units" TO leonex_web_user, erp_user, PUBLIC;

-- 4. Seed the 4 Exact Verified Moulds
-- SG-2006 Egypt Small (18ml, 42 cavities, 756ml nominal)
INSERT INTO "production_moulds" (
  "mould_code", "mould_name", "mould_category", "model_number",
  "capacity_ml", "cavity_count", "total_nominal_capacity_ml",
  "tray_length_mm", "tray_width_mm", "tray_height_mm",
  "dimension_text", "material", "machine_type",
  "specification_status", "supplier_id", "supplier_name", "status", "total_sets_in_plant", "notes",
  "linked_raw_materials"
) VALUES (
  'SG-2006', 'Egypt Small (SG 2006)', '2000 Series', 'SG-2006',
  18, 42, 756,
  325, 245, 160,
  '5N Mould / Delivery 210 NOS', 'Stainless Steel 304', 'Brine tank line',
  'VERIFIED', 'SUP-SATNAM-01', 'Satnam Group', 'ACTIVE', 10, 'Standard 2000 series verified specification mould for small stick format.',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'STICK',
      'uom', 'pcs',
      'rmCode', 'RM-00119',
      'rmName', 'STICK 65 MM',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00119' OR "name" ILIKE '%STICK 65%' LIMIT 1)
    ),
    jsonb_build_object(
      'role', 'WRAPPER',
      'uom', 'rolls',
      'rmCode', 'RM-00155',
      'rmName', 'PACKING ROLL 130MM',
      'quantityPerUnit', 0.001,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00155' OR "name" ILIKE '%ROLL 130%' LIMIT 1)
    )
  )
)
ON CONFLICT ("mould_code") DO UPDATE SET
  "mould_name" = EXCLUDED."mould_name",
  "mould_category" = EXCLUDED."mould_category",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "cavity_count" = EXCLUDED."cavity_count",
  "total_nominal_capacity_ml" = EXCLUDED."total_nominal_capacity_ml",
  "dimension_text" = EXCLUDED."dimension_text",
  "specification_status" = 'VERIFIED',
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "production_moulds"."linked_raw_materials" IS NULL OR "production_moulds"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "production_moulds"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- SG-3006 Flat Stick (40ml, 50 cavities, 2000ml nominal)
INSERT INTO "production_moulds" (
  "mould_code", "mould_name", "mould_category", "model_number",
  "capacity_ml", "cavity_count", "total_nominal_capacity_ml",
  "tray_length_mm", "tray_width_mm", "tray_height_mm",
  "dimension_text", "material", "machine_type",
  "specification_status", "supplier_id", "supplier_name", "status", "total_sets_in_plant", "notes",
  "linked_raw_materials"
) VALUES (
  'SG-3006', 'Flat Stick (SG 3006)', '3000 Series', 'SG-3006',
  40, 50, 2000,
  325, 260, 160,
  '10N Mould / Delivery 500 NOS', 'Stainless Steel 304', 'Brine tank line',
  'VERIFIED', 'SUP-SATNAM-01', 'Satnam Group', 'ACTIVE', 10, 'Standard 3000 series flat stick production mould.',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'STICK',
      'uom', 'pcs',
      'rmCode', 'RM-00120',
      'rmName', 'STICK 144 MM',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00120' OR "name" ILIKE '%STICK 144%' LIMIT 1)
    ),
    jsonb_build_object(
      'role', 'WRAPPER',
      'uom', 'rolls',
      'rmCode', 'RM-00156',
      'rmName', 'PACKING ROLL 170MM',
      'quantityPerUnit', 0.001,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00156' OR "name" ILIKE '%ROLL 170%' LIMIT 1)
    )
  )
)
ON CONFLICT ("mould_code") DO UPDATE SET
  "mould_name" = EXCLUDED."mould_name",
  "mould_category" = EXCLUDED."mould_category",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "cavity_count" = EXCLUDED."cavity_count",
  "total_nominal_capacity_ml" = EXCLUDED."total_nominal_capacity_ml",
  "dimension_text" = EXCLUDED."dimension_text",
  "specification_status" = 'VERIFIED',
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "production_moulds"."linked_raw_materials" IS NULL OR "production_moulds"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "production_moulds"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- SG-8112 Kulfi Small (50ml, 42 cavities, 2100ml nominal)
INSERT INTO "production_moulds" (
  "mould_code", "mould_name", "mould_category", "model_number",
  "capacity_ml", "cavity_count", "total_nominal_capacity_ml",
  "tray_length_mm", "tray_width_mm", "tray_height_mm",
  "dimension_text", "material", "machine_type",
  "specification_status", "supplier_id", "supplier_name", "status", "total_sets_in_plant", "notes",
  "linked_raw_materials"
) VALUES (
  'SG-8112', 'Kulfi Small (SG 8112)', '8000 Series', 'SG-8112',
  50, 42, 2100,
  325, 245, 160,
  '20N Mould / Delivery 840 NOS', 'Stainless Steel 304', 'Brine tank line',
  'VERIFIED', 'SUP-SATNAM-01', 'Satnam Group', 'ACTIVE', 10, 'Traditional Kulfi small mould for 50ml standard stick kulfi.',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'STICK',
      'uom', 'pcs',
      'rmCode', 'RM-00120',
      'rmName', 'STICK 144 MM',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00120' OR "name" ILIKE '%STICK 144%' LIMIT 1)
    ),
    jsonb_build_object(
      'role', 'WRAPPER',
      'uom', 'rolls',
      'rmCode', 'RM-00156',
      'rmName', 'PACKING ROLL 170MM',
      'quantityPerUnit', 0.001,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00156' OR "name" ILIKE '%ROLL 170%' LIMIT 1)
    )
  )
)
ON CONFLICT ("mould_code") DO UPDATE SET
  "mould_name" = EXCLUDED."mould_name",
  "mould_category" = EXCLUDED."mould_category",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "cavity_count" = EXCLUDED."cavity_count",
  "total_nominal_capacity_ml" = EXCLUDED."total_nominal_capacity_ml",
  "dimension_text" = EXCLUDED."dimension_text",
  "specification_status" = 'VERIFIED',
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "production_moulds"."linked_raw_materials" IS NULL OR "production_moulds"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "production_moulds"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- SG-8115 Kulfi Large (70ml, 42 cavities, 2940ml nominal)
INSERT INTO "production_moulds" (
  "mould_code", "mould_name", "mould_category", "model_number",
  "capacity_ml", "cavity_count", "total_nominal_capacity_ml",
  "tray_length_mm", "tray_width_mm", "tray_height_mm",
  "dimension_text", "material", "machine_type",
  "specification_status", "supplier_id", "supplier_name", "status", "total_sets_in_plant", "notes",
  "linked_raw_materials"
) VALUES (
  'SG-8115', 'Kulfi Large (SG 8115)', '8000 Series', 'SG-8115',
  70, 42, 2940,
  325, 245, 160,
  '10N Mould / Delivery 420 NOS', 'Stainless Steel 304', 'Brine tank line',
  'VERIFIED', 'SUP-SATNAM-01', 'Satnam Group', 'ACTIVE', 10, 'Standard 70ml Kulfi large production mould.',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'STICK',
      'uom', 'pcs',
      'rmCode', 'RM-00120',
      'rmName', 'STICK 144 MM',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00120' OR "name" ILIKE '%STICK 144%' LIMIT 1)
    ),
    jsonb_build_object(
      'role', 'WRAPPER',
      'uom', 'rolls',
      'rmCode', 'RM-00156',
      'rmName', 'PACKING ROLL 170MM',
      'quantityPerUnit', 0.001,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00156' OR "name" ILIKE '%ROLL 170%' LIMIT 1)
    )
  )
)
ON CONFLICT ("mould_code") DO UPDATE SET
  "mould_name" = EXCLUDED."mould_name",
  "mould_category" = EXCLUDED."mould_category",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "cavity_count" = EXCLUDED."cavity_count",
  "total_nominal_capacity_ml" = EXCLUDED."total_nominal_capacity_ml",
  "dimension_text" = EXCLUDED."dimension_text",
  "specification_status" = 'VERIFIED',
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "production_moulds"."linked_raw_materials" IS NULL OR "production_moulds"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "production_moulds"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- 5. Seed the 4 Exact Verified Bulk Storage Units
-- BLK-1000ML Liter (1,000 ml)
INSERT INTO "bulk_storage_units" (
  "unit_code", "unit_name", "unit_type",
  "capacity_ml", "nominal_volume_ltr", "tare_weight_kg",
  "material", "standard_waste_percent", "description", "status",
  "linked_raw_materials"
) VALUES (
  'BLK-1000ML', 'Liter (1,000 ml)', 'Liter',
  1000, 1.0, 0.05,
  'Food Grade Plastic PP Tub', 0.5, 'Standard 1 Litre Ice Cream Container / Tub', 'ACTIVE',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'CONTAINER',
      'uom', 'pcs',
      'rmCode', 'PKG-TUB-1L',
      'rmName', '1L Ice Cream Tub & Lid',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'PKG-TUB-1L' OR "name" ILIKE '%1L%Tub%' LIMIT 1)
    )
  )
)
ON CONFLICT ("unit_code") DO UPDATE SET
  "unit_name" = EXCLUDED."unit_name",
  "unit_type" = EXCLUDED."unit_type",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "nominal_volume_ltr" = EXCLUDED."nominal_volume_ltr",
  "material" = EXCLUDED."material",
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "bulk_storage_units"."linked_raw_materials" IS NULL OR "bulk_storage_units"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "bulk_storage_units"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- BLK-2000ML Gallon (2,000 ml)
INSERT INTO "bulk_storage_units" (
  "unit_code", "unit_name", "unit_type",
  "capacity_ml", "nominal_volume_ltr", "tare_weight_kg",
  "material", "standard_waste_percent", "description", "status",
  "linked_raw_materials"
) VALUES (
  'BLK-2000ML', 'Gallon (2,000 ml)', 'Gallon',
  2000, 2.0, 0.09,
  'Food Grade Plastic Gallon Tub', 0.5, 'Standard 2 Litre / Half Gallon Bulk Container', 'ACTIVE',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'PACKAGING',
      'uom', 'box',
      'rmCode', 'RM-00121',
      'rmName', 'GALLON BOX 4LTR',
      'quantityPerUnit', 0.5,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00121' OR "name" ILIKE '%GALLON BOX%' LIMIT 1)
    ),
    jsonb_build_object(
      'role', 'CONTAINER',
      'uom', 'pcs',
      'rmCode', 'PKG-GAL-2L',
      'rmName', '2L Gallon Tub with Handle',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'PKG-GAL-2L' OR "name" ILIKE '%Gallon Tub%' LIMIT 1)
    )
  )
)
ON CONFLICT ("unit_code") DO UPDATE SET
  "unit_name" = EXCLUDED."unit_name",
  "unit_type" = EXCLUDED."unit_type",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "nominal_volume_ltr" = EXCLUDED."nominal_volume_ltr",
  "material" = EXCLUDED."material",
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "bulk_storage_units"."linked_raw_materials" IS NULL OR "bulk_storage_units"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "bulk_storage_units"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- BLK-5000ML Tub (5 Litres)
INSERT INTO "bulk_storage_units" (
  "unit_code", "unit_name", "unit_type",
  "capacity_ml", "nominal_volume_ltr", "tare_weight_kg",
  "material", "standard_waste_percent", "description", "status",
  "linked_raw_materials"
) VALUES (
  'BLK-5000ML', 'Tub (5 Litres)', 'Tub',
  5000, 5.0, 0.18,
  'Commercial Food Grade HDPE Tub', 0.5, '5 Litres Bulk Catering / Parlour Tub', 'ACTIVE',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'CONTAINER',
      'uom', 'pcs',
      'rmCode', 'RM-00138',
      'rmName', 'PET 5LTR CAN',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'RM-00138' OR "name" ILIKE '%PET 5LTR%' LIMIT 1)
    )
  )
)
ON CONFLICT ("unit_code") DO UPDATE SET
  "unit_name" = EXCLUDED."unit_name",
  "unit_type" = EXCLUDED."unit_type",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "nominal_volume_ltr" = EXCLUDED."nominal_volume_ltr",
  "material" = EXCLUDED."material",
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "bulk_storage_units"."linked_raw_materials" IS NULL OR "bulk_storage_units"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "bulk_storage_units"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;

-- BLK-20000ML Can (20 Litres)
INSERT INTO "bulk_storage_units" (
  "unit_code", "unit_name", "unit_type",
  "capacity_ml", "nominal_volume_ltr", "tare_weight_kg",
  "material", "standard_waste_percent", "description", "status",
  "linked_raw_materials"
) VALUES (
  'BLK-20000ML', 'Can (20 Litres)', 'Can',
  20000, 20.0, 0.65,
  'Commercial Stainless Steel / Heavy-Duty HDPE Can', 0.2, '20 Litres Commercial Ice Cream Can for Dispensing & Parlours', 'ACTIVE',
  jsonb_build_array(
    jsonb_build_object(
      'role', 'CONTAINER',
      'uom', 'pcs',
      'rmCode', 'PKG-CAN-20L',
      'rmName', '20L Commercial Ice Cream Can',
      'quantityPerUnit', 1,
      'rawMaterialId', (SELECT "id"::text FROM "raw_materials" WHERE "code" = 'PKG-CAN-20L' OR "name" ILIKE '%20L%Can%' LIMIT 1)
    )
  )
)
ON CONFLICT ("unit_code") DO UPDATE SET
  "unit_name" = EXCLUDED."unit_name",
  "unit_type" = EXCLUDED."unit_type",
  "capacity_ml" = EXCLUDED."capacity_ml",
  "nominal_volume_ltr" = EXCLUDED."nominal_volume_ltr",
  "material" = EXCLUDED."material",
  "status" = 'ACTIVE',
  "linked_raw_materials" = CASE 
    WHEN "bulk_storage_units"."linked_raw_materials" IS NULL OR "bulk_storage_units"."linked_raw_materials" = '[]'::jsonb 
    THEN EXCLUDED."linked_raw_materials" 
    ELSE "bulk_storage_units"."linked_raw_materials" 
  END,
  "updated_at" = CURRENT_TIMESTAMP;
