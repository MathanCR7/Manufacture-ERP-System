const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const pStaff = await prisma.user.upsert({
    where: { email: 'production@kulfi.com' },
    update: {},
    create: {
      name: 'Production Staff',
      email: 'production@kulfi.com',
      passwordHash,
      role: 'PRODUCTION_STAFF',
      isActive: true
    }
  });

  const sTeam = await prisma.user.upsert({
    where: { email: 'sales@kulfi.com' },
    update: {},
    create: {
      name: 'Sales Team',
      email: 'sales@kulfi.com',
      passwordHash,
      role: 'SALES_TEAM',
      isActive: true
    }
  });

  console.log('Production Staff User:', pStaff.email, 'password123');
  console.log('Sales Team User:', sTeam.email, 'password123');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
