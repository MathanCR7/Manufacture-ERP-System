const prisma = require('e:/MANUFACTURING_ERP/apps/backend/src/database/prisma');

async function migrateSalesRawMaterials() {
  console.log('=== Starting Sales Raw Materials Schema Migration ===');

  try {
    // 1. Make product_id nullable in customer_order_items
    console.log('1. Making product_id nullable in customer_order_items...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customer_order_items" ALTER COLUMN "product_id" DROP NOT NULL;
    `);

    // 2. Add raw_material_id column
    console.log('2. Adding raw_material_id column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customer_order_items" ADD COLUMN IF NOT EXISTS "raw_material_id" TEXT;
    `);

    // 3. Add foreign key to "RawMaterial" table if not present
    console.log('3. Adding foreign key to RawMaterial...');
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'customer_order_items_raw_material_id_fkey'
        ) THEN
          ALTER TABLE "customer_order_items" 
          ADD CONSTRAINT "customer_order_items_raw_material_id_fkey" 
          FOREIGN KEY ("raw_material_id") REFERENCES "RawMaterial"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 4. Add item_type column ('PRODUCT' or 'RAW_MATERIAL')
    console.log('4. Adding item_type column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customer_order_items" ADD COLUMN IF NOT EXISTS "item_type" VARCHAR(30) DEFAULT 'PRODUCT';
    `);

    // 5. Add is_packing_charge boolean column
    console.log('5. Adding is_packing_charge column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customer_order_items" ADD COLUMN IF NOT EXISTS "is_packing_charge" BOOLEAN DEFAULT false;
    `);

    // 6. Add batch_allocations_data jsonb column
    console.log('6. Adding batch_allocations_data column...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "customer_order_items" ADD COLUMN IF NOT EXISTS "batch_allocations_data" JSONB;
    `);

    console.log('=== Migration completed successfully! ===');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSalesRawMaterials();
