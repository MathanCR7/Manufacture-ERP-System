const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      name: 'ADMIN MASTER',
      email: 'admin@kulfierp.com',
      passwordHash,
      role: 'MAIN_MASTER',
      empId: 'VTE000001',
    },
    {
      name: 'FACTORY SUPERVISOR',
      email: 'supervisor@kulfierp.com',
      passwordHash,
      role: 'SUPERVISOR',
      empId: 'VTE000002',
    },
    {
      name: 'PURCHASE ACCOUNTANT',
      email: 'accountant@kulfierp.com',
      passwordHash,
      role: 'PURCHASE_ACCOUNTANT',
      empId: 'VTE000003',
    },
    {
      name: 'MATERIALS RECEIVER',
      email: 'receiver@kulfierp.com',
      passwordHash,
      role: 'MATERIALS_RECEIVER',
      empId: 'VTE000004',
    },
    {
      name: 'LAB ASSISTANT',
      email: 'lab@kulfierp.com',
      passwordHash,
      role: 'LAB_ASSISTANT',
      empId: 'VTE000005',
    },
    {
      name: 'PRODUCTION STAFF',
      email: 'production@kulfierp.com',
      passwordHash,
      role: 'PRODUCTION_STAFF',
      empId: 'VTE000006',
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findFirst({
      where: { email: u.email },
      select: { id: true, email: true }
    });
    if (!existing) {
      await prisma.user.create({
        data: u,
        select: { id: true }
      });
      console.log(`Created user: ${u.email} with role: ${u.role}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: u.name,
          empId: u.empId,
          role: u.role
        },
        select: { id: true }
      });
      console.log(`Updated user: ${u.email}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
