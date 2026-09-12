/* =============================================================
   ProfitLeak AI — FREE/PRO plan tests
   Run with:  node tests/plan.test.js      (no dependencies needed)
   ============================================================= */
'use strict';

const assert = require('node:assert/strict');
const { Store, Plan, SAMPLE_PRODUCTS } = require('../js/data.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.error('  \u2717 ' + name); console.error('    ' + (e && e.message)); }
}

console.log('\nProfitLeak AI \u2014 plan (FREE/PRO) tests\n');

/* ---------- default plan ---------- */
test('default plan is FREE', () => assert.equal(Plan.isPro(), false));
test('free limit is 3 products', () => assert.equal(Plan.freeLimit(), 3));

/* ---------- free slots math ---------- */
test('free slots: 0 products \u2192 3 available', () => assert.equal(Plan.freeSlotsFor(0), 3));
test('free slots: 2 products \u2192 1 available', () => assert.equal(Plan.freeSlotsFor(2), 1));
test('free slots: 3 products \u2192 0 available', () => assert.equal(Plan.freeSlotsFor(3), 0));
test('free slots: 9 products \u2192 0 (never negative)', () => assert.equal(Plan.freeSlotsFor(9), 0));

/* ---------- plan switching ---------- */
test('setPlan(pro) switches to Pro', () => {
  Plan.setPlan('pro');
  assert.equal(Plan.isPro(), true);
});
test('pro slots: unlimited', () => assert.equal(Plan.freeSlotsFor(9999), Infinity));
test('setPlan(free) switches back', () => {
  Plan.setPlan('free');
  assert.equal(Plan.isPro(), false);
});
test('invalid plan values fall back to free', () => {
  Plan.setPlan('pro');
  Plan.setPlan('nonsense');
  assert.equal(Plan.isPro(), false);
});

/* ---------- plan-aware sample data ---------- */
test('free plan seeds 3 sample products (profitable / low / losing)', () => {
  Plan.setPlan('free');
  const seeded = Store.samplesForPlan();
  assert.equal(seeded.length, 3);
  const names = seeded.map(p => p.name);
  assert.ok(names.includes('Wireless Earbuds Pro'));   // profitable
  assert.ok(names.includes('Mini Bluetooth Speaker')); // low profit
  assert.ok(names.includes('Clear Phone Case'));       // losing money
});
test('pro plan loads all 6 sample products', () => {
  Plan.setPlan('pro');
  assert.equal(Store.samplesForPlan().length, SAMPLE_PRODUCTS.length);
});
test('full 6-product library stays intact for engine tests', () =>
  assert.equal(SAMPLE_PRODUCTS.length, 6));

/* ---------- first visit: empty start, welcome + demo via UI ---------- */
test('fresh user starts with an empty dashboard (no auto-seed)', () => {
  Plan.setPlan('free');
  assert.equal(Store.load().length, 0);
});
test('onboarding flag: unset at first, then persistable', () => {
  assert.equal(Store.isOnboarded(), false);
  Store.markOnboarded();
  assert.equal(Store.isOnboarded(), true);
});
test('demo products are identified by id (never user products)', () => {
  assert.ok(Store.isDemoProduct(SAMPLE_PRODUCTS[0]));
  assert.ok(!Store.isDemoProduct({ id: 'p-xyz', name: 'Real product' }));
});

Plan.setPlan('free'); // leave the world in a clean state

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
