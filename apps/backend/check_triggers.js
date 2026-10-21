const prisma = require('./src/database/prisma');

async function main() {
  const triggers = await prisma.$queryRawUnsafe(`
    SELECT trigger_name, event_manipulation, action_statement 
    FROM information_schema.triggers 
    WHERE event_object_table = 'production_batches'
  `);
  console.log('Triggers:', JSON.stringify(triggers, null, 2));

  // Check column defaults on production_batches
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, column_default, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'production_batches' AND column_name IN ('reference_no', 'batch_no')
  `);
  console.log('Columns:', JSON.stringify(cols, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
