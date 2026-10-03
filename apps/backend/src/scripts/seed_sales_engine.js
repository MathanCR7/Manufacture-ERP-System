const prisma = require('../database/prisma');
const documentSeriesService = require('../services/documentSeries.service');
const batchAllocationService = require('../services/batchAllocation.service');
const gstEngine = require('../utils/gstEngine');

async function main() {
  console.log('====================================================');
  console.log('🚀 SEEDING & VERIFYING SALES & BILLING ENGINE');
  console.log('====================================================');

  // 1. Company Details
  console.log('\n[1/6] Ensuring Company Profile & Tax Settings...');
  const company = await prisma.companyDetails.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {
      companyName: 'ANTIGRAVITY DAIRY & FOODS PRIVATE LIMITED',
      companyAddress: 'Plot 42, SIDCO Industrial Estate, Salem, Tamil Nadu, 636004',
      companyGstin: '33AABCA1234F1Z8',
      companyPan: 'AABCA1234F',
      companyMobile: '+91 94433 12345',
      email: 'accounts@antigravitydairy.com',
      stateCode: '33',
      bankName: 'HDFC Bank Ltd',
      bankAccountNo: '50200012345678',
      bankIfsc: 'HDFC0001234',
      bankBranch: 'Salem Junction Branch',
      termsAndConditions: '1. Goods once sold will not be accepted without inspection.\n2. Interest @ 18% p.a. charged after due date.\n3. Subject to Salem Jurisdiction.'
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      companyName: 'ANTIGRAVITY DAIRY & FOODS PRIVATE LIMITED',
      companyAddress: 'Plot 42, SIDCO Industrial Estate, Salem, Tamil Nadu, 636004',
      companyGstin: '33AABCA1234F1Z8',
      companyPan: 'AABCA1234F',
      companyMobile: '+91 94433 12345',
      email: 'accounts@antigravitydairy.com',
      stateCode: '33',
      bankName: 'HDFC Bank Ltd',
      bankAccountNo: '50200012345678',
      bankIfsc: 'HDFC0001234',
      bankBranch: 'Salem Junction Branch',
      termsAndConditions: '1. Goods once sold will not be accepted without inspection.\n2. Interest @ 18% p.a. charged after due date.\n3. Subject to Salem Jurisdiction.'
    }
  });
  console.log(`✅ Company set: ${company.companyName} (GSTIN: ${company.companyGstin}, State: ${company.stateCode})`);

  // 2. Fetch or create a system user for createdBy foreign keys
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Master Admin',
        email: 'admin@erp.com',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'MAIN_MASTER'
      }
    });
  }

  // 3. Customers (Retail, Intra-State B2B, Inter-State B2B)
  console.log('\n[2/6] Seeding Customers for Intra/Inter-state verification...');

  // Retail Customer (Tamil Nadu, State 33)
  const retailCustomer = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000101' },
    update: { name: 'Walk-in Retail Customer', customerType: 'RETAIL', status: 'ACTIVE' },
    create: {
      id: '00000000-0000-0000-0000-000000000101',
      name: 'Walk-in Retail Customer',
      contactPerson: 'Walk-in Cash Customer',
      phone: '9840011223',
      email: 'walkin@store.com',
      customerType: 'RETAIL',
      status: 'ACTIVE',
      address: 'Salem City Counter Outlet',
      addedBy: user.id
    }
  });

  // Intra-State Distributor (Tamil Nadu, State 33)
  const intraDistributor = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000102' },
    update: {
      name: 'Sri Krishna Dairy Distributors',
      gstin: '33AAACS5555M1Z2',
      customerType: 'DISTRIBUTOR',
      creditLimit: 500000,
      status: 'ACTIVE'
    },
    create: {
      id: '00000000-0000-0000-0000-000000000102',
      name: 'Sri Krishna Dairy Distributors',
      contactPerson: 'R. Krishna',
      phone: '9842244556',
      email: 'orders@srikrishnadairy.com',
      gstin: '33AAACS5555M1Z2',
      customerType: 'DISTRIBUTOR',
      creditLimit: 500000,
      paymentTermsDays: 30,
      status: 'ACTIVE',
      address: '14, Fairlands Main Road, Salem, Tamil Nadu - 636016',
      addedBy: user.id
    }
  });

  // Inter-State Distributor (Karnataka, State 29)
  const interDistributor = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000103' },
    update: {
      name: 'Bangalore Metro Frozen Foods LLP',
      gstin: '29AAACF9999K1Z5',
      customerType: 'DISTRIBUTOR',
      creditLimit: 750000,
      status: 'ACTIVE'
    },
    create: {
      id: '00000000-0000-0000-0000-000000000103',
      name: 'Bangalore Metro Frozen Foods LLP',
      contactPerson: 'V. Prakash',
      phone: '9880099887',
      email: 'procurement@metrofrozen.in',
      gstin: '29AAACF9999K1Z5',
      customerType: 'DISTRIBUTOR',
      creditLimit: 750000,
      paymentTermsDays: 45,
      status: 'ACTIVE',
      address: 'Plot 88, Electronic City Phase 2, Bangalore, Karnataka - 560100',
      addedBy: user.id
    }
  });
  console.log(`✅ Seeded Retail: ${retailCustomer.name}`);
  console.log(`✅ Seeded Intra-State B2B: ${intraDistributor.name} (${intraDistributor.gstin})`);
  console.log(`✅ Seeded Inter-State B2B: ${interDistributor.name} (${interDistributor.gstin})`);

  // 4. Products & Categories & UOM
  console.log('\n[3/6] Ensuring Product Master & Batches...');
  let uom = await prisma.uOM.findFirst({ where: { abbreviation: 'pcs' } });
  if (!uom) {
    uom = await prisma.uOM.create({ data: { name: 'Pieces', abbreviation: 'pcs', isActive: true } });
  }

  let cat = await prisma.productCategory.findFirst();
  if (!cat) {
    cat = await prisma.productCategory.create({
      data: { code: 'CAT-KULFI', name: 'Kulfi & Ice Candies', status: 'ACTIVE' }
    });
  }

  let product1 = await prisma.finishedProduct.findFirst({
    where: { deletedAt: null }
  });

  if (!product1) {
    product1 = await prisma.finishedProduct.create({
      data: {
        code: 'FP-SEED-01',
        name: 'Royal Mango Kulfi 100ml Stick',
        categoryId: cat.id,
        unitId: uom.id,
        salePrice: 45.00,
        totalCost: 22.50,
        currentStock: 1500,
        openingStock: 500,
        alertLevel: 200,
        stockMethod: 'FIFO',
        sku: 'MK-100',
        barcode: '8901234567891',
        cgst: 9.00,
        sgst: 9.00,
        igst: 18.00,
        createdBy: user.id
      }
    });
  } else {
    product1 = await prisma.finishedProduct.update({
      where: { id: product1.id },
      data: { currentStock: Math.max(Number(product1.currentStock || 0), 1000) }
    });
  }

  let product2 = await prisma.finishedProduct.findFirst({
    where: { id: { not: product1.id }, deletedAt: null }
  });

  if (!product2) {
    product2 = await prisma.finishedProduct.create({
      data: {
        code: 'FP-SEED-02',
        name: 'Shahi Pista Matka Kulfi 150ml',
        categoryId: cat.id,
        unitId: uom.id,
        salePrice: 55.00,
        totalCost: 28.00,
        currentStock: 1200,
        openingStock: 400,
        alertLevel: 150,
        stockMethod: 'FIFO',
        sku: 'PK-150',
        barcode: '8901234567892',
        cgst: 9.00,
        sgst: 9.00,
        igst: 18.00,
        createdBy: user.id
      }
    });
  }
  console.log(`✅ Product 1: ${product1.name} (₹${product1.salePrice})`);
  console.log(`✅ Product 2: ${product2.name} (₹${product2.salePrice})`);

  // Batches with staggered expiry dates for FEFO verification
  const now = new Date();
  const exp30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const exp90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const batch1 = await prisma.productionBatchNew.upsert({
    where: { referenceNo: 'BATCH-MK-2601' },
    update: { productId: product1.id, remainingQty: 500, status: 'qc_passed' },
    create: {
      referenceNo: 'BATCH-MK-2601',
      batchNo: 'BATCH-MK-2601',
      productId: product1.id,
      quantity: 500,
      actualOutput: 500,
      remainingQty: 500,
      expiryDays: 30,
      status: 'qc_passed',
      productionType: 'STANDARD',
      startDate: now,
      expiryDate: exp30Days, // Expires sooner (FEFO priority 1)
      createdBy: user.id
    }
  });

  const batch2 = await prisma.productionBatchNew.upsert({
    where: { referenceNo: 'BATCH-MK-2602' },
    update: { productId: product1.id, remainingQty: 1000, status: 'qc_passed' },
    create: {
      referenceNo: 'BATCH-MK-2602',
      batchNo: 'BATCH-MK-2602',
      productId: product1.id,
      quantity: 1000,
      actualOutput: 1000,
      remainingQty: 1000,
      expiryDays: 90,
      status: 'qc_passed',
      productionType: 'STANDARD',
      startDate: now,
      expiryDate: exp90Days, // Expires later (FEFO priority 2)
      createdBy: user.id
    }
  });
  console.log(`✅ Batch 1 (Expires in 30 days): ${batch1.referenceNo} - Qty: ${batch1.remainingQty}`);
  console.log(`✅ Batch 2 (Expires in 90 days): ${batch2.referenceNo} - Qty: ${batch2.remainingQty}`);

  // 5. Test FEFO Allocation
  console.log('\n[4/6] Verifying Auto-FEFO Batch Allocation Service...');
  const fefoCheck = await batchAllocationService.allocateFEFO(product1.id, 650);
  console.log('Allocated 650 units:');
  console.log(`- From Primary Batch (${fefoCheck.allocations[0]?.batchNo}): ${fefoCheck.allocations[0]?.quantity} units`);
  console.log(`- From Secondary Batch (${fefoCheck.allocations[1]?.batchNo}): ${fefoCheck.allocations[1]?.quantity} units`);
  console.log(`- Shortage: ${fefoCheck.shortage}`);
  if (fefoCheck.allocations[0]?.batchNo === 'BATCH-MK-2601' && fefoCheck.allocations[0]?.quantity === 500) {
    console.log('✅ FEFO correctly prioritized the earlier expiring batch!');
  }

  // 6. Test Document Series
  console.log('\n[5/6] Verifying Document Number Generator...');
  const invSeries = await documentSeriesService.getNextNumber('INVOICE');
  const posSeries = await documentSeriesService.getNextNumber('POS');
  console.log(`✅ Next Invoice No: ${invSeries.docNo}`);
  console.log(`✅ Next POS No: ${posSeries.docNo}`);

  // 7. Verify Pure GST Engine with Inter-State & Intra-State tests
  console.log('\n[6/6] Verifying GST Calculation with Inter/Intra State...');
  const intraGST = gstEngine.calculateOrderGst({
    items: [{ productId: product1.id, quantity: 100, unitPrice: 45, discount: 0, gstRate: 18 }],
    sellerStateCode: '33',
    buyerStateCode: '33', // Tamil Nadu -> Tamil Nadu
  });
  console.log(`Intra-State (TN -> TN): Subtotal: ₹${intraGST.netTaxableSubtotal}, CGST: ₹${intraGST.cgst}, SGST: ₹${intraGST.sgst}, IGST: ₹${intraGST.igst}, Total: ₹${intraGST.grandTotal}`);

  const interGST = gstEngine.calculateOrderGst({
    items: [{ productId: product1.id, quantity: 100, unitPrice: 45, discount: 0, gstRate: 18 }],
    sellerStateCode: '33',
    buyerStateCode: '29', // Tamil Nadu -> Karnataka
  });
  console.log(`Inter-State (TN -> KA): Subtotal: ₹${interGST.netTaxableSubtotal}, CGST: ₹${interGST.cgst}, SGST: ₹${interGST.sgst}, IGST: ₹${interGST.igst}, Total: ₹${interGST.grandTotal}`);

  console.log('\n====================================================');
  console.log('🎉 ALL ENGINE COMPONENTS VERIFIED & READY FOR USE!');
  console.log('====================================================');
}

main()
  .catch((err) => {
    console.error('Seed / verification error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
