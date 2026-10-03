const axios = require('axios');
const prisma = require('../database/prisma');

async function testApi() {
  console.log('--- TESTING SALES & BILLING API ENDPOINTS ---');
  const baseUrl = 'http://localhost:5000/api';

  // 1. Fetch system user with MAIN_MASTER role
  let user = await prisma.user.findFirst({ where: { role: 'MAIN_MASTER' } });
  if (!user) user = await prisma.user.findFirst();
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { id: user.id, email: user.email, role: 'MAIN_MASTER', name: user.name },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '1d' }
  );
  const headers = { Authorization: `Bearer ${token}` };

  // 2. Test Customer Lookup
  console.log('\n[1] Testing Customer Lookup:');
  const custRes = await axios.get(`${baseUrl}/parties/customers/lookup?search=Krishna`, { headers });
  console.log(`Found ${custRes.data.length} customer(s). Top match:`, custRes.data[0]?.name, 'GSTIN:', custRes.data[0]?.gstin);

  // 3. Test Product Search
  console.log('\n[2] Testing Product Search:');
  const prodRes = await axios.get(`${baseUrl}/products/search?q=Gallon`, { headers });
  console.log(`Found ${prodRes.data.length} product(s). Top match:`, prodRes.data[0]?.name, 'Price: ₹' + prodRes.data[0]?.salePrice);
  
  // Find product that has seeded batches
  const batchSample = await prisma.productionBatchNew.findFirst({
    where: { remainingQty: { gt: 0 } },
    include: { product: true }
  });
  const testProduct = batchSample?.product || prodRes.data[0];
  console.log(`Using product for testing: ${testProduct.name} (ID: ${testProduct.id})`);

  // 4. Test Product Available Batches
  console.log('\n[3] Testing Available Batches:');
  const batchRes = await axios.get(`${baseUrl}/products/${testProduct.id}/available-batches`, { headers });
  console.log(`Found ${batchRes.data.length} active batch(es) for product ${testProduct.name}:`);
  batchRes.data.forEach(b => console.log(`  -> Batch ${b.batchNo || b.referenceNo}: remaining ${b.remainingQty}, exp: ${b.expiryDate}`));

  // 5. Test POS Order Creation
  console.log('\n[4] Testing Fast POS Counter Checkout (POST /api/orders/pos):');
  const walkinCust = await prisma.customer.findFirst({ where: { name: { contains: 'Walk-in' } } });
  const posPayload = {
    customerId: walkinCust ? walkinCust.id : undefined,
    customerName: 'Counter Cash Customer',
    customerPhone: '9840099881',
    paymentMethod: 'CASH',
    amountPaid: 2000,
    counterId: 'COUNTER-01',
    cashierName: 'Admin Cashier',
    items: [
      {
        productId: testProduct.id,
        quantity: 2,
        unitPrice: Number(testProduct.salePrice),
        discountPercent: 5,
        hsnCode: testProduct.hsnCode || '21050000',
        gstRate: 18,
      }
    ]
  };

  const posResponse = await axios.post(`${baseUrl}/orders/pos`, posPayload, { headers });
  console.log(`✅ POS Order Created: DocNo = ${posResponse.data.docNo || posResponse.data.orderNo}, ID = ${posResponse.data.id}`);
  console.log(`   Grand Total: ₹${posResponse.data.grandTotal}, Status: ${posResponse.data.orderStatus}, Payment: ${posResponse.data.paymentStatus}`);

  // 6. Test B2B Invoice Creation with Auto-FEFO Batch Allocation
  console.log('\n[5] Testing B2B Tax Invoice (POST /api/orders/invoice):');
  const b2bCust = await prisma.customer.findFirst({ where: { gstin: { startsWith: '33' } } });
  const b2bPayload = {
    customerId: b2bCust.id,
    paymentMethod: 'CREDIT',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    invoiceDiscount: 50,
    charges: {
      freight: 150,
      loading: 50,
      insurance: 0,
      otherCharges: 0,
    },
    items: [
      {
        productId: testProduct.id,
        quantity: 10,
        unitPrice: Number(testProduct.salePrice),
        discountPercent: 10,
        hsnCode: '21050000',
        gstRate: 18,
        batchAllocationMethod: 'FEFO', // Automatic FEFO
      }
    ]
  };

  const invResponse = await axios.post(`${baseUrl}/orders/invoice`, b2bPayload, { headers });
  console.log(`✅ B2B Invoice Created: DocNo = ${invResponse.data.docNo || invResponse.data.orderNo}, ID = ${invResponse.data.id}`);
  console.log(`   Subtotal: ₹${invResponse.data.subtotal}, Tax: ₹${invResponse.data.taxAmount}, Total: ₹${invResponse.data.grandTotal}`);

  // 7. Test Order Full Details API
  console.log('\n[6] Testing Order Full Details (GET /api/orders/:id/details):');
  const detailsRes = await axios.get(`${baseUrl}/orders/${invResponse.data.id}/details`, { headers });
  const doc = detailsRes.data;
  console.log(`✅ Fetched Details for ${doc.docNo}:`);
  console.log(`   Customer: ${doc.customer?.name} (${doc.customer?.gstin})`);
  console.log(`   Company: ${doc.company?.companyName} (${doc.company?.companyGstin})`);
  console.log(`   Items Count: ${doc.items?.length}`);
  if (doc.items && doc.items[0]?.batchAllocations) {
    console.log(`   Batch Allocations:`, doc.items[0].batchAllocations.map(a => `${a.batchNo}: ${a.allocatedQty} units`));
  }

  console.log('\n🎉 ALL SALES ENDPOINTS VERIFIED & FUNCTIONING AS EXPECTED!');
}

testApi()
  .catch((err) => {
    console.error('API Test Error:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
