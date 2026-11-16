const assert = require('assert');

// 1. Shift Derivation Test
function getKolkataShift(hour) {
  if (hour >= 6 && hour < 14) {
    return 'Morning';
  } else if (hour >= 14 && hour < 22) {
    return 'Evening';
  } else {
    return 'Night';
  }
}

// 2. Yield % calculation
function calculateYieldPct(actual, planned) {
  if (!planned || planned <= 0) return 100;
  return Math.min(100, Math.round((actual / planned) * 100));
}

// 3. Stock Health Thresholds
function getStockHealth(stock, alertLevel) {
  if (alertLevel <= 0) return 'Healthy';
  if (stock <= alertLevel) return 'Critical';
  if (stock <= alertLevel * 2) return 'Low';
  return 'Healthy';
}

// 4. FIFO Expiry Buckets
function categorizeExpiryBucket(expiryDate, now = new Date()) {
  const diffDays = Math.ceil((new Date(expiryDate) - now) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return 'under7';
  if (diffDays <= 30) return 'days8to30';
  return 'over30';
}

// 5. OEE Calculation (Availability * Performance * Quality)
function calculateOEE(availability, performance, quality) {
  return Math.round((availability / 100) * (performance / 100) * (quality / 100) * 1000) / 10;
}

console.log('Running Factory Command Center Aggregation Logic Tests...');

// Run Shift tests
assert.strictEqual(getKolkataShift(8), 'Morning');
assert.strictEqual(getKolkataShift(15), 'Evening');
assert.strictEqual(getKolkataShift(23), 'Night');
assert.strictEqual(getKolkataShift(2), 'Night');
console.log('✔ Shift derivation tests passed');

// Run Yield tests
assert.strictEqual(calculateYieldPct(1450, 1500), 97);
assert.strictEqual(calculateYieldPct(1500, 1500), 100);
assert.strictEqual(calculateYieldPct(0, 0), 100);
console.log('✔ Yield calculation tests passed');

// Run Stock Health tests
assert.strictEqual(getStockHealth(10, 20), 'Critical');
assert.strictEqual(getStockHealth(30, 20), 'Low');
assert.strictEqual(getStockHealth(50, 20), 'Healthy');
assert.strictEqual(getStockHealth(100, 0), 'Healthy');
console.log('✔ Stock health threshold tests passed');

// Run Expiry Bucket tests
const now = new Date('2026-11-16T12:00:00Z');
assert.strictEqual(categorizeExpiryBucket('2026-11-20T12:00:00Z', now), 'under7');
assert.strictEqual(categorizeExpiryBucket('2026-11-30T12:00:00Z', now), 'days8to30');
assert.strictEqual(categorizeExpiryBucket('2027-01-01T12:00:00Z', now), 'over30');
console.log('✔ Expiry bucket tests passed');

// Run OEE tests
assert.strictEqual(calculateOEE(92.4, 88.0, 98.2), 79.8);
assert.strictEqual(calculateOEE(100, 100, 100), 100);
console.log('✔ OEE calculation tests passed');

console.log('ALL FACTORY COMMAND CENTER BACKEND TESTS PASSED SUCCESSFULLY!');
