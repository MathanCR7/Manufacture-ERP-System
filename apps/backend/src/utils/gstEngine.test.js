const assert = require('assert');
const { calculateOrderGst, getStateCodeFromGstin, numberToIndianWords } = require('./gstEngine');

console.log('--- RUNNING GST ENGINE TEST SUITE ---');

// Test 1: State extraction from GSTIN
assert.strictEqual(getStateCodeFromGstin('33AAAAA0000A1Z5'), '33', 'Tamil Nadu 33 extraction failed');
assert.strictEqual(getStateCodeFromGstin('29ABCDE1234F1Z5'), '29', 'Karnataka 29 extraction failed');
assert.strictEqual(getStateCodeFromGstin('GSTIN-07AAAAA1111A1Z1'), '07', 'Delhi 07 with prefix failed');
assert.strictEqual(getStateCodeFromGstin(null), null);
console.log('✓ Test 1: State extraction from GSTIN passed');

// Test 2: Intra-State calculation (Tamil Nadu 33 -> Tamil Nadu 33)
const intraResult = calculateOrderGst({
  sellerStateCode: '33',
  buyerStateCode: '33',
  items: [
    {
      productId: 'p1',
      productName: 'Ice Cream Tub 1L',
      quantity: 10,
      unitPrice: 200,
      discountPercent: 10, // 2000 - 200 = 1800 taxable
      gstRate: 18,
      hsnCode: '21050000',
    }
  ],
  charges: {
    freight: 100,
    freightGst: true // 18% on 100 = 9 CGST + 9 SGST
  }
});

assert.strictEqual(intraResult.isInterState, false);
assert.strictEqual(intraResult.taxType, 'INTRA_STATE');
assert.strictEqual(intraResult.rawTaxableSubtotal, 1800);
// 18% on 1800 = 324 (162 CGST + 162 SGST)
// + 18% on 100 freight = 18 (9 CGST + 9 SGST)
// Total CGST = 171, Total SGST = 171, Total IGST = 0
assert.strictEqual(intraResult.cgst, 171);
assert.strictEqual(intraResult.sgst, 171);
assert.strictEqual(intraResult.igst, 0);
assert.strictEqual(intraResult.totalTax, 342);
// Net = 1800 + 100 + 342 = 2242
assert.strictEqual(intraResult.grandTotal, 2242);
console.log('✓ Test 2: Intra-State calculation passed');

// Test 3: Inter-State calculation (Tamil Nadu 33 -> Karnataka 29)
const interResult = calculateOrderGst({
  sellerStateCode: '33',
  buyerStateCode: '29',
  items: [
    {
      productId: 'p2',
      productName: 'Kulfi Pack 50ml',
      quantity: 50,
      unitPrice: 30, // 1500 gross
      discountPercent: 0,
      gstRate: 12,
      hsnCode: '21050000',
    }
  ]
});

assert.strictEqual(interResult.isInterState, true);
assert.strictEqual(interResult.taxType, 'INTER_STATE');
assert.strictEqual(interResult.cgst, 0);
assert.strictEqual(interResult.sgst, 0);
// 12% on 1500 = 180 IGST
assert.strictEqual(interResult.igst, 180);
assert.strictEqual(interResult.totalTax, 180);
assert.strictEqual(interResult.grandTotal, 1680);
console.log('✓ Test 3: Inter-State calculation passed');

// Test 4: Unregistered / Walk-in Buyer defaults to Seller State (Intra-state)
const walkInResult = calculateOrderGst({
  sellerStateCode: '33',
  buyerStateCode: null,
  customerGstin: null,
  items: [
    { quantity: 2, unitPrice: 500, gstRate: 18 }
  ]
});
assert.strictEqual(walkInResult.isInterState, false);
assert.strictEqual(walkInResult.cgst, 90);
assert.strictEqual(walkInResult.sgst, 90);
assert.strictEqual(walkInResult.igst, 0);
console.log('✓ Test 4: Unregistered Buyer passed');

// Test 5: Mixed GST Rates & HSN Summary
const mixedResult = calculateOrderGst({
  sellerStateCode: '33',
  buyerStateCode: '33',
  items: [
    { hsnCode: '2105', gstRate: 18, quantity: 1, unitPrice: 1000 }, // Taxable 1000, 90 CGST + 90 SGST
    { hsnCode: '0402', gstRate: 5, quantity: 1, unitPrice: 2000 },  // Taxable 2000, 50 CGST + 50 SGST
    { hsnCode: '9999', gstRate: 0, quantity: 1, unitPrice: 500 },   // Taxable 500, 0 tax
  ]
});
assert.strictEqual(mixedResult.rawTaxableSubtotal, 3500);
assert.strictEqual(mixedResult.cgst, 140);
assert.strictEqual(mixedResult.sgst, 140);
assert.strictEqual(mixedResult.hsnSummary.length, 3);
console.log('✓ Test 5: Mixed GST Rates & HSN Summary passed');

// Test 6: Round Off & Amount In Words
assert.strictEqual(numberToIndianWords(125450), 'Rupees One Lakh Twenty Five Thousand Four Hundred and Fifty Only');
assert.strictEqual(numberToIndianWords(15000000), 'Rupees One Crore Fifty Lakh Only');
console.log('✓ Test 6: Indian Number Words passed');

console.log('ALL GST ENGINE TESTS PASSED SUCCESSFULLY! 🎯');
