const assert = require('assert');
const {
  toMl,
  round2,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays
} = require('./productionCalculation');

console.log('🧪 RUNNING PRODUCTION CALCULATION MODULE UNIT TESTS...\n');

let passedCount = 0;
let totalCount = 0;

function it(desc, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// ── 1. Unit Conversions & Densities ──
console.log('--- 1. Unit Conversions & Densities ---');
it('converts ml directly without alteration', () => {
  assert.strictEqual(toMl(500, 'ml'), 500);
});

it('converts litres to ml (1000x)', () => {
  assert.strictEqual(toMl(2.5, 'L'), 2500);
  assert.strictEqual(toMl(100, 'liter'), 100000);
});

it('converts grams to ml using density 1.0', () => {
  assert.strictEqual(toMl(500, 'g', 1.0), 500);
});

it('converts kilograms to ml using density 1.0', () => {
  assert.strictEqual(toMl(20, 'kg', 1.0), 20000);
});

it('converts grams and kg with non-standard density 0.6', () => {
  // 60g / 0.6 = 100ml
  assert.strictEqual(round2(toMl(60, 'g', 0.6)), 100);
  // 6kg = 6000g / 0.6 = 10000ml
  assert.strictEqual(round2(toMl(6, 'kg', 0.6)), 10000);
});

it('throws when converting solid piece units (pcs, nos, box)', () => {
  assert.throws(() => toMl(10, 'pcs'), /cannot be converted/i);
  assert.throws(() => toMl(5, 'nos'), /cannot be converted/i);
});

it('throws on invalid or non-positive density', () => {
  assert.throws(() => toMl(10, 'kg', 0), /Density must be greater than 0/);
  assert.throws(() => toMl(10, 'kg', -1), /Density must be greater than 0/);
});

// ── 2. Evaporation & Merge Rules ──
console.log('\n--- 2. Evaporation & Merge Rules ---');
it('excludes unmerged lines from total before evaporation', () => {
  const result = calculateEvaporation({
    lines: [
      { rawMaterialName: 'Milk', uom: 'L', takenQty: 10, density: 1.0, merged: true, evaporates: true },
      { rawMaterialName: 'Flavour', uom: 'ml', takenQty: 500, density: 1.0, merged: false, evaporates: false }
    ],
    evaporationPct: 5
  });
  assert.strictEqual(result.totalBeforeEvapMl, 10000);
});

it('handles 0% evaporation rate', () => {
  const result = calculateEvaporation({
    lines: [
      { rawMaterialName: 'Milk', uom: 'L', takenQty: 50, density: 1.0, merged: true, evaporates: true }
    ],
    evaporationPct: 0
  });
  assert.strictEqual(result.totalBeforeEvapMl, 50000);
  assert.strictEqual(result.evaporatedMl, 0);
  assert.strictEqual(result.mixAfterEvapMl, 50000);
});

it('handles 100% evaporation rate', () => {
  const result = calculateEvaporation({
    lines: [
      { rawMaterialName: 'Water', uom: 'L', takenQty: 10, density: 1.0, merged: true, evaporates: true }
    ],
    evaporationPct: 100
  });
  assert.strictEqual(result.totalBeforeEvapMl, 10000);
  assert.strictEqual(result.evaporatedMl, 10000);
  assert.strictEqual(result.mixAfterEvapMl, 0);
});

it('does not evaporate materials when evaporation checkbox is unchecked', () => {
  const result = calculateEvaporation({
    lines: [
      { rawMaterialName: 'Sugar', uom: 'kg', takenQty: 25, density: 1.0, merged: true, evaporates: false }
    ],
    evaporationPct: 10
  });
  assert.strictEqual(result.totalBeforeEvapMl, 25000);
  assert.strictEqual(result.evaporatedMl, 0);
  assert.strictEqual(result.mixAfterEvapMl, 25000);
});

it('warns when taken quantity exceeds available warehouse stock', () => {
  const result = calculateEvaporation({
    lines: [
      { rawMaterialName: 'Milk', uom: 'L', availableQty: 50, takenQty: 60, density: 1.0, merged: true, evaporates: true }
    ],
    evaporationPct: 5
  });
  assert.strictEqual(result.hasWarnings, true);
  assert.strictEqual(result.warnings[0].type, 'EXCEEDS_AVAILABLE');
});

// ── 3. Reference Test Scenario from Master Prompt ──
console.log('\n--- 3. MASTER PROMPT REFERENCE TEST SCENARIO ---');
it('executes Reference Scenario: Milk 100L, Sugar 20kg, SMP 8kg, Stabilizer 0.5kg, Essence 0.2L at 5% evap', () => {
  const lines = [
    { rawMaterialName: 'Milk', uom: 'L', availableQty: 200, requiredQty: 100, takenQty: 100, density: 1.0, evaporates: true, merged: true },
    { rawMaterialName: 'Sugar', uom: 'kg', availableQty: 50, requiredQty: 20, takenQty: 20, density: 1.0, evaporates: false, merged: true },
    { rawMaterialName: 'SMP', uom: 'kg', availableQty: 20, requiredQty: 8, takenQty: 8, density: 1.0, evaporates: true, merged: true },
    { rawMaterialName: 'Stabilizer', uom: 'kg', availableQty: 5, requiredQty: 0.5, takenQty: 0.5, density: 1.0, evaporates: true, merged: true },
    { rawMaterialName: 'Essence', uom: 'L', availableQty: 1, requiredQty: 0.2, takenQty: 0.2, density: 1.0, evaporates: true, merged: true }
  ];

  const evapResult = calculateEvaporation({
    lines,
    evaporationPct: 5.0,
    mergeStage: 'Before freezing'
  });

  // Expected from prompt:
  // Total before: 128,700 ml
  // Evaporated: 5,435 ml
  // Mix after: 123,265 ml
  assert.strictEqual(evapResult.totalBeforeEvapMl, 128700, `Expected totalBefore 128700, got ${evapResult.totalBeforeEvapMl}`);
  assert.strictEqual(evapResult.evaporatedMl, 5435, `Expected evaporated 5435, got ${evapResult.evaporatedMl}`);
  assert.strictEqual(evapResult.mixAfterEvapMl, 123265, `Expected mixAfter 123265, got ${evapResult.mixAfterEvapMl}`);

  // Sequential finished products allocation
  // Product 1: SG-5011 (50 ml, 50 cavities, 40 trays, 2% waste)
  // Product 2: SB-8002 (60 ml, 30 cavities, 12 trays, 3% waste)
  const allocResult = calculateAllocations({
    availableMixMl: evapResult.mixAfterEvapMl,
    allocations: [
      {
        productId: 'PROD-01',
        productName: 'Chocobar 50ml',
        mouldCode: 'SG-5011',
        capacityMl: 50,
        cavities: 50,
        trays: 40,
        wasteMode: 'PERCENT',
        wasteValue: 2
      },
      {
        productId: 'PROD-02',
        productName: 'Kulfi 60ml',
        mouldCode: 'SB-8002',
        capacityMl: 60,
        cavities: 30,
        trays: 12,
        wasteMode: 'PERCENT',
        wasteValue: 3
      }
    ]
  });

  assert.strictEqual(allocResult.isValid, true, 'Allocations should be valid');

  const p1 = allocResult.allocations[0];
  // Expected: used 100,000 ml, waste 2,000 ml, 1,960 pieces, left 23,265 ml
  assert.strictEqual(p1.mixUsedMl, 100000, `Product 1 mixUsed expected 100000, got ${p1.mixUsedMl}`);
  assert.strictEqual(p1.wasteMl, 2000, `Product 1 waste expected 2000, got ${p1.wasteMl}`);
  assert.strictEqual(p1.goodPieces, 1960, `Product 1 pieces expected 1960, got ${p1.goodPieces}`);
  assert.strictEqual(p1.mixLeftAfterThisProduct, 23265, `Product 1 left expected 23265, got ${p1.mixLeftAfterThisProduct}`);

  const p2 = allocResult.allocations[1];
  // Expected: used 21,600 ml, waste 648 ml, 349 pieces, left 1,665 ml
  assert.strictEqual(p2.mixUsedMl, 21600, `Product 2 mixUsed expected 21600, got ${p2.mixUsedMl}`);
  assert.strictEqual(p2.wasteMl, 648, `Product 2 waste expected 648, got ${p2.wasteMl}`);
  assert.strictEqual(p2.goodPieces, 349, `Product 2 pieces expected 349, got ${p2.goodPieces}`);
  assert.strictEqual(p2.mixLeftAfterThisProduct, 1665, `Product 2 left expected 1665, got ${p2.mixLeftAfterThisProduct}`);
  assert.strictEqual(allocResult.remainingMixAfterAllMl, 1665);
});

// ── 4. Allocation Edge Cases ──
console.log('\n--- 4. Allocation Edge Cases ---');
it('fails validation on over-allocation (mix goes negative)', () => {
  const result = calculateAllocations({
    availableMixMl: 5000,
    allocations: [
      { productId: 'P1', capacityMl: 50, cavities: 20, trays: 10, wasteMode: 'PERCENT', wasteValue: 0 } // 50 * 20 * 10 = 10,000 ml > 5,000 ml
    ]
  });
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.errors[0].type, 'INSUFFICIENT_MIX');
});

it('fails validation when wastage exceeds mix used', () => {
  const result = calculateAllocations({
    availableMixMl: 10000,
    allocations: [
      { productId: 'P1', capacityMl: 50, cavities: 10, trays: 1, wasteMode: 'PERCENT', wasteValue: 105 } // 105% waste
    ]
  });
  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.errors[0].type, 'EXCESSIVE_WASTE');
});

it('calculates fill all remaining whole trays correctly', () => {
  // 1,665 ml remaining, mould is 60ml x 30 cavities = 1,800 ml/tray -> 0 trays
  assert.strictEqual(computeMaxTrays(1665, 60, 30), 0);
  // 23,265 ml remaining, mould is 60ml x 30 = 1,800 ml/tray -> floor(23265 / 1800) = 12 trays
  assert.strictEqual(computeMaxTrays(23265, 60, 30), 12);
});

console.log(`\n🎉 ALL ${passedCount}/${totalCount} UNIT TESTS PASSED SUCCESSFULLY!`);
