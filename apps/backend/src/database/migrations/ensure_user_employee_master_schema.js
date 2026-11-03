const prisma = require('../prisma');

let isEnsured = false;

async function ensureUserEmployeeMasterSchema() {
  if (isEnsured) return;

  const alterStatements = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contact_no" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dob" TIMESTAMP WITHOUT TIME ZONE;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "doj" TIMESTAMP WITHOUT TIME ZONE;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" VARCHAR(20);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blood_group" VARCHAR(20);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "father_name" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "father_contact" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mother_name" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mother_contact" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "husband_name" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "husband_contact" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spouse_name" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "spouse_contact" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "present_address" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permanent_address" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aadhar" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pan" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "epfo_no" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "esi_no" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank_account_name" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank_account_no" VARCHAR(100);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank_branch" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank_ifsc" VARCHAR(50);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "family_remarks" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gross_pay" NUMERIC(12, 2);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "yearly_ctc" NUMERIC(12, 2);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "working_hours" VARCHAR(100);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "family_photos" JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selfie_photo" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selfie_location" VARCHAR(255);`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cv" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "present_address_proof" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permanent_address_proof" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aadhar_doc" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pan_doc" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bank_proof" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "family_doc" TEXT;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contacts" JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emails" JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "has_app_access" BOOLEAN DEFAULT true;`,
    // Migrate any 6-digit VTE00000x IDs to 4-digit VTE000x format
    `UPDATE "User" SET "emp_id" = regexp_replace("emp_id", '^VTE-?0*([0-9]+)$', 'VTE' || lpad('\\1', 4, '0')) WHERE "emp_id" ~* '^VTE-?0{4,}[0-9]+$';`
  ];

  for (const sql of alterStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      // Catch individually so one column limitation cannot block the others
    }
  }

  isEnsured = true;
}

if (require.main === module) {
  ensureUserEmployeeMasterSchema()
    .then(() => {
      console.log('✅ Employee Master User schema columns ensured successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration error:', err.message);
      process.exit(1);
    });
}

module.exports = { ensureUserEmployeeMasterSchema };

