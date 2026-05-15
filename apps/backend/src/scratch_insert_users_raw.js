require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") 
    VALUES (gen_random_uuid(), 'Production Staff', 'production@kulfi.com', '${passwordHash}', 'PRODUCTION_STAFF', true, NOW(), NOW())
    ON CONFLICT (email) DO NOTHING;
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "User" (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt") 
    VALUES (gen_random_uuid(), 'Sales Team', 'sales@kulfi.com', '${passwordHash}', 'SALES_TEAM', true, NOW(), NOW())
    ON CONFLICT (email) DO NOTHING;
  `);

  console.log('Production Staff User: production@kulfi.com password123');
  console.log('Sales Team User: sales@kulfi.com password123');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
