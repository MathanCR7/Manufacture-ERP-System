const prisma = require('../database/prisma');

async function main() {
  console.log('Running ALTER TABLE "User"...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "contact_no" text,
      ADD COLUMN IF NOT EXISTS "dob" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "doj" timestamp without time zone,
      ADD COLUMN IF NOT EXISTS "gender" text,
      ADD COLUMN IF NOT EXISTS "blood_group" text,
      ADD COLUMN IF NOT EXISTS "father_name" text,
      ADD COLUMN IF NOT EXISTS "father_contact" text,
      ADD COLUMN IF NOT EXISTS "mother_name" text,
      ADD COLUMN IF NOT EXISTS "mother_contact" text,
      ADD COLUMN IF NOT EXISTS "husband_name" text,
      ADD COLUMN IF NOT EXISTS "husband_contact" text,
      ADD COLUMN IF NOT EXISTS "spouse_name" text,
      ADD COLUMN IF NOT EXISTS "spouse_contact" text,
      ADD COLUMN IF NOT EXISTS "family_remarks" text,
      ADD COLUMN IF NOT EXISTS "family_photos" jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "present_address" text,
      ADD COLUMN IF NOT EXISTS "permanent_address" text,
      ADD COLUMN IF NOT EXISTS "aadhar" text,
      ADD COLUMN IF NOT EXISTS "pan" text,
      ADD COLUMN IF NOT EXISTS "epfo_no" text,
      ADD COLUMN IF NOT EXISTS "esi_no" text,
      ADD COLUMN IF NOT EXISTS "bank_account_name" text,
      ADD COLUMN IF NOT EXISTS "bank_name" text,
      ADD COLUMN IF NOT EXISTS "bank_account_no" text,
      ADD COLUMN IF NOT EXISTS "bank_branch" text,
      ADD COLUMN IF NOT EXISTS "bank_ifsc" text,
      ADD COLUMN IF NOT EXISTS "gross_pay" numeric(12, 2),
      ADD COLUMN IF NOT EXISTS "yearly_ctc" numeric(12, 2),
      ADD COLUMN IF NOT EXISTS "working_hours" text,
      ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb;
  `);

  console.log('Columns in "User" table after migration:');
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'User'
    ORDER BY ordinal_position
  `);
  console.log(cols);
}

main().catch(console.error).finally(() => prisma.$disconnect());

