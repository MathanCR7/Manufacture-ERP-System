const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      name: 'Admin Master',
      email: 'admin@kulfierp.com',
      passwordHash,
      role: 'MAIN_MASTER',
    },
    {
      name: 'Factory Supervisor',
      email: 'supervisor@kulfierp.com',
      passwordHash,
      role: 'SUPERVISOR',
    },
    {
      name: 'Purchase Accountant',
      email: 'accountant@kulfierp.com',
      passwordHash,
      role: 'PURCHASE_ACCOUNTANT',
    },
    {
      name: 'Materials Receiver',
      email: 'receiver@kulfierp.com',
      passwordHash,
      role: 'MATERIALS_RECEIVER',
    },
    {
      name: 'Lab Assistant',
      email: 'lab@kulfierp.com',
      passwordHash,
      role: 'LAB_ASSISTANT',
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email }
    });
    if (!existing) {
      await prisma.user.create({
        data: u,
      });
      console.log(`Created user: ${u.email} with role: ${u.role}`);
    } else {
      console.log(`User already exists: ${u.email}`);
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
