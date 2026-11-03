const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const sampleUsers = [
  {
    email: 'admin@kulfierp.com',
    name: 'ADMIN MASTER',
    empId: 'VTE000001',
    role: 'MAIN_MASTER',
    contactNo: '+91 98401 12345',
    contacts: ['+91 98401 12345', '+91 98401 67890'],
    emails: ['admin@kulfierp.com'],
    gender: 'Male',
    bloodGroup: 'O+',
    dob: new Date('1985-05-15'),
    doj: new Date('2020-01-01'),
    fatherName: 'RAMASWAMY IYER',
    fatherContact: '+91 94440 12345',
    motherName: 'LAKSHMI AMMAL',
    motherContact: '+91 94440 67890',
    presentAddress: 'No. 12, Anna Nagar West Extension, Chennai - 600101',
    permanentAddress: 'No. 12, Anna Nagar West Extension, Chennai - 600101',
    grossPay: 85000.00,
    yearlyCtc: 1020000.00,
    workingHours: '8 hrs/day',
    pan: 'ABCDE1234F',
    aadhar: '1234 5678 9012',
    epfoNo: 'TN/MAS/0012345/000/0001',
    esiNo: '51000123450000001',
    bankName: 'HDFC Bank',
    bankAccountNo: '50100234567890',
    bankIfsc: 'HDFC0000123',
    bankBranch: 'Anna Nagar, Chennai',
    bankAccountName: 'ADMIN MASTER',
    familyRemarks: 'Head of Administration and Plant Operations'
  },
  {
    email: 'supervisor@kulfierp.com',
    name: 'FACTORY SUPERVISOR',
    empId: 'VTE000002',
    role: 'SUPERVISOR',
    contactNo: '+91 98402 23456',
    contacts: ['+91 98402 23456', '+91 98402 78901'],
    emails: ['supervisor@kulfierp.com'],
    gender: 'Male',
    bloodGroup: 'B+',
    dob: new Date('1988-08-20'),
    doj: new Date('2021-03-15'),
    fatherName: 'SUNDARAM PILLAI',
    fatherContact: '+91 94441 23456',
    motherName: 'MEENAKSHI',
    motherContact: '+91 94441 78901',
    presentAddress: 'Plot 45, SIDCO Industrial Estate, Ambattur, Chennai - 600058',
    permanentAddress: 'Plot 45, SIDCO Industrial Estate, Ambattur, Chennai - 600058',
    grossPay: 45000.00,
    yearlyCtc: 540000.00,
    workingHours: '8 hrs/day',
    pan: 'FGHIJ2345K',
    aadhar: '2345 6789 0123',
    epfoNo: 'TN/MAS/0012345/000/0002',
    esiNo: '51000123450000002',
    bankName: 'State Bank of India',
    bankAccountNo: '30123456789',
    bankIfsc: 'SBIN0001234',
    bankBranch: 'Ambattur, Chennai',
    bankAccountName: 'FACTORY SUPERVISOR',
    familyRemarks: 'Supervises Floor Lines and Merge Processing'
  },
  {
    email: 'accountant@kulfierp.com',
    name: 'PURCHASE ACCOUNTANT',
    empId: 'VTE000003',
    role: 'PURCHASE_ACCOUNTANT',
    contactNo: '+91 98403 34567',
    contacts: ['+91 98403 34567', '+91 98403 89012'],
    emails: ['accountant@kulfierp.com'],
    gender: 'Female',
    bloodGroup: 'A+',
    dob: new Date('1992-11-10'),
    doj: new Date('2022-06-01'),
    fatherName: 'KRISHNAMURTHY',
    fatherContact: '+91 94442 34567',
    motherName: 'SARADHA',
    motherContact: '+91 94442 89012',
    presentAddress: 'No. 88, T. Nagar Main Road, Chennai - 600017',
    permanentAddress: 'No. 88, T. Nagar Main Road, Chennai - 600017',
    grossPay: 38000.00,
    yearlyCtc: 456000.00,
    workingHours: '8 hrs/day',
    pan: 'KLMNO3456P',
    aadhar: '3456 7890 1234',
    epfoNo: 'TN/MAS/0012345/000/0003',
    esiNo: '51000123450000003',
    bankName: 'ICICI Bank',
    bankAccountNo: '001205001234',
    bankIfsc: 'ICIC0000012',
    bankBranch: 'T. Nagar, Chennai',
    bankAccountName: 'PURCHASE ACCOUNTANT',
    familyRemarks: 'Purchase Orders and Raw Material Invoices'
  },
  {
    email: 'receiver@kulfierp.com',
    name: 'MATERIALS RECEIVER',
    empId: 'VTE000004',
    role: 'MATERIALS_RECEIVER',
    contactNo: '+91 98404 45678',
    contacts: ['+91 98404 45678', '+91 98404 90123'],
    emails: ['receiver@kulfierp.com'],
    gender: 'Male',
    bloodGroup: 'AB+',
    dob: new Date('1990-04-25'),
    doj: new Date('2022-08-10'),
    fatherName: 'MURUGESAN',
    fatherContact: '+91 94443 45678',
    motherName: 'VASANTHA',
    motherContact: '+91 94443 90123',
    presentAddress: 'Door 15, Warehouse Line, Madhavaram, Chennai - 600060',
    permanentAddress: 'Door 15, Warehouse Line, Madhavaram, Chennai - 600060',
    grossPay: 32000.00,
    yearlyCtc: 384000.00,
    workingHours: '8 hrs/day',
    pan: 'PQRST4567U',
    aadhar: '4567 8901 2345',
    epfoNo: 'TN/MAS/0012345/000/0004',
    esiNo: '51000123450000004',
    bankName: 'Axis Bank',
    bankAccountNo: '912010012345678',
    bankIfsc: 'UTIB0000123',
    bankBranch: 'Madhavaram, Chennai',
    bankAccountName: 'MATERIALS RECEIVER',
    familyRemarks: 'Gate Entry & GRN Verification'
  },
  {
    email: 'lab@kulfierp.com',
    name: 'LAB ASSISTANT',
    empId: 'VTE000005',
    role: 'LAB_ASSISTANT',
    contactNo: '+91 98405 56789',
    contacts: ['+91 98405 56789', '+91 98405 01234'],
    emails: ['lab@kulfierp.com'],
    gender: 'Female',
    bloodGroup: 'O-',
    dob: new Date('1994-02-18'),
    doj: new Date('2023-01-10'),
    fatherName: 'VENKATESAN',
    fatherContact: '+91 94444 56789',
    motherName: 'KALYANI',
    motherContact: '+91 94444 01234',
    presentAddress: 'No. 22, Gandhi Road, Guindy, Chennai - 600032',
    permanentAddress: 'No. 22, Gandhi Road, Guindy, Chennai - 600032',
    grossPay: 30000.00,
    yearlyCtc: 360000.00,
    workingHours: '8 hrs/day',
    pan: 'UVWXY5678Z',
    aadhar: '5678 9012 3456',
    epfoNo: 'TN/MAS/0012345/000/0005',
    esiNo: '51000123450000005',
    bankName: 'Canara Bank',
    bankAccountNo: '1234101012345',
    bankIfsc: 'CNRB0001234',
    bankBranch: 'Guindy, Chennai',
    bankAccountName: 'LAB ASSISTANT',
    familyRemarks: 'Quality Control and Lab Sample Analysis'
  },
  {
    email: 'production@kulfierp.com',
    name: 'PRODUCTION STAFF',
    empId: 'VTE000006',
    role: 'PRODUCTION_STAFF',
    contactNo: '+91 98406 67890',
    contacts: ['+91 98406 67890', '+91 98406 12345'],
    emails: ['production@kulfierp.com'],
    gender: 'Male',
    bloodGroup: 'B+',
    dob: new Date('1995-07-12'),
    doj: new Date('2023-04-01'),
    fatherName: 'SELVAM',
    fatherContact: '+91 94445 67890',
    motherName: 'MARIAMMAL',
    motherContact: '+91 94445 12345',
    presentAddress: 'Shop 7, Factory Quarters, Thirumazhisai, Chennai - 600124',
    permanentAddress: 'Shop 7, Factory Quarters, Thirumazhisai, Chennai - 600124',
    grossPay: 25000.00,
    yearlyCtc: 300000.00,
    workingHours: '8 hrs/day',
    pan: 'ZABCD6789E',
    aadhar: '6789 0123 4567',
    epfoNo: 'TN/MAS/0012345/000/0006',
    esiNo: '51000123450000006',
    bankName: 'Indian Overseas Bank',
    bankAccountNo: '012301000012345',
    bankIfsc: 'IOBA0000123',
    bankBranch: 'Thirumazhisai, Chennai',
    bankAccountName: 'PRODUCTION STAFF',
    familyRemarks: 'Mould Tray and Freezing Line Operator'
  }
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  for (const u of sampleUsers) {
    const existing = await prisma.user.findFirst({
      where: { email: u.email },
      select: { id: true, email: true }
    });

    if (!existing) {
      await prisma.user.create({
        data: {
          ...u,
          passwordHash
        },
        select: { id: true }
      });
      console.log(`Created user: ${u.email} with role: ${u.role}`);
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: u,
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
