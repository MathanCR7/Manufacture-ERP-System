const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://leonex_web_user:Leo_1234@66.116.199.153:5432/erp_manufacture?sslmode=disable'
    }
  }
});

async function deleteTwoUsers() {
  console.log('Permanently deleting RAMKUMAR and MATHANPRO from live DB...');

  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM "User" 
    WHERE email IN ('ramkumarpro@gmail.com', 'mathanpro@gmail.com')
       OR emp_id IN ('VTE000007', 'VTE000008');
  `);
  console.log(`Deleted ${deleted} rows.`);

  const remaining = await prisma.$queryRawUnsafe(`
    SELECT emp_id, name, email, role, contact_no, "isActive"
    FROM "User"
    ORDER BY emp_id ASC;
  `);
  console.table(remaining);

  // Calculate next emp ID
  let maxSeq = 0;
  for (const u of remaining) {
    if (!u.emp_id) continue;
    const match = u.emp_id.match(/^VTE-?(\d+)/i) || u.emp_id.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  const nextEmpId = 'VTE' + String(nextSeq).padStart(6, '0');
  console.log(`Verified Next Emp ID will be: ${nextEmpId}`);

  await prisma.$disconnect();
}

deleteTwoUsers().catch(console.error);
