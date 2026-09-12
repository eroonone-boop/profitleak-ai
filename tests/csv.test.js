/* =============================================================
   ProfitLeak AI — CSV export/import tests
   Run with:  node tests/csv.test.js      (no dependencies needed)
   ============================================================= */
'use strict';

const assert = require('node:assert/strict');
const { CSV, SAMPLE_PRODUCTS } = require('../js/data.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.error('  \u2717 ' + name); console.error('    ' + (e && e.message)); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }
const DATA_KEYS = ['name', 'sellingPrice', 'purchaseCost', 'adCostPerSale', 'shippingCost',
                   'platformFees', 'discountPerSale', 'returnCostPerSale', 'unitsSold'];

console.log('\nProfitLeak AI \u2014 CSV tests\n');

/* ---------- export ---------- */
const csvText = CSV.toCsv(SAMPLE_PRODUCTS);
const lines = csvText.trim().split('\n');
test('export: header row matches spec', () =>
  assert.equal(lines[0], 'Name,Selling Price,Purchase Cost,Ad Cost per Sale,Shipping Cost,Platform Fees,Discount per Sale,Return Cost per Sale,Units Sold'));
test('export: one line per product', () => assert.equal(lines.length, 7));
test('export: values are in the right columns', () => {
  const c = lines[1].split(',');
  assert.equal(c[0], 'Wireless Earbuds Pro');
  assert.equal(c[1], '49.99');
  assert.equal(c[8], '320');
});

/* ---------- round trip ---------- */
test('round trip: all 6 products survive, none skipped', () => {
  const back = CSV.fromCsv(csvText);
  assert.equal(back.products.length, 6);
  assert.equal(back.skipped, 0);
});
test('round trip: every field is preserved', () => {
  const back = CSV.fromCsv(csvText).products;
  SAMPLE_PRODUCTS.forEach((s, i) => {
    DATA_KEYS.forEach(k => assert.equal(String(back[i][k]), String(s[k]), s.name + ' / ' + k));
  });
});
test('round trip: imported products get fresh ids', () => {
  const back = CSV.fromCsv(csvText).products;
  assert.ok(back.every(p => p.id && !SAMPLE_PRODUCTS.some(s => s.id === p.id)));
});

/* ---------- tricky CSV input ---------- */
test('names with commas and quotes round-trip correctly', () => {
  const tricky = CSV.toCsv([{ name: 'Candle "Set", Lavender', sellingPrice: 29, purchaseCost: 10,
    adCostPerSale: 4, shippingCost: 9.5, platformFees: 4, discountPerSale: 0, returnCostPerSale: 2.5, unitsSold: 210 }]);
  const back = CSV.fromCsv(tricky);
  assert.equal(back.products[0].name, 'Candle "Set", Lavender');
});
test('CRLF line endings are handled', () => {
  const back = CSV.fromCsv('Name,Selling Price,Units Sold\r\nThing,5,2\r\nOther,7,3\r\n');
  assert.equal(back.products.length, 2);
});
test('lowercase / alternative headers are accepted', () => {
  const back = CSV.fromCsv('name,price,units\nWidget,9.99,4\n');
  assert.equal(back.products[0].sellingPrice, 9.99);
  assert.equal(back.products[0].unitsSold, 4);
});
test('missing cost columns default to $0', () => {
  const back = CSV.fromCsv('Name,Selling Price,Units Sold\nSimple,10,5\n');
  const p = back.products[0];
  assert.equal(p.purchaseCost, 0);
  assert.equal(p.shippingCost, 0);
  assert.ok(near(p.sellingPrice, 10) && p.unitsSold === 5);
});
test('blank cost cells count as $0', () => {
  const back = CSV.fromCsv('Name,Selling Price,Ad Cost per Sale,Units Sold\nBlanks,10,,5\n');
  assert.equal(back.products[0].adCostPerSale, 0);
});

/* ---------- invalid rows are skipped, not imported ---------- */
const FULL_HEADER = 'Name,Selling Price,Purchase Cost,Ad Cost per Sale,Shipping Cost,Platform Fees,Discount per Sale,Return Cost per Sale,Units Sold';
test('invalid rows (price 0, bad units, missing name, negative cost) are skipped', () => {
  const res = CSV.fromCsv(FULL_HEADER + '\nGood,10,2,1,1,0.5,0,0,5\nNoPrice,0,2,1,1,0,0,0,5\nBadUnits,10,2,1,1,0,0,0,0.5\n,2,1,1,1,0,0,0,5\nNegAd,10,2,-1,1,0,0,0,5\n');
  assert.equal(res.products.length, 1);
  assert.equal(res.skipped, 4);
  assert.equal(res.products[0].name, 'Good');
});
test('wrong header (no Name/Selling Price/Units) is rejected', () => {
  const res = CSV.fromCsv('Foo,Bar,Baz\n1,2,3\n');
  assert.equal(res.products.length, 0);
  assert.ok(res.missingColumns.includes('Product name'));
  assert.ok(res.missingColumns.includes('Selling price'));
  assert.ok(res.missingColumns.includes('Units sold'));
});
test('empty input is safe', () => {
  const res = CSV.fromCsv('');
  assert.equal(res.products.length, 0);
  assert.equal(res.skipped, 0);
});
test('imported numbers are real numbers, not strings', () => {
  const p = CSV.fromCsv(FULL_HEADER + '\nTypes,12.5,3.25,1.5,0.75,0.5,0.25,0.1,10\n').products[0];
  assert.ok(typeof p.sellingPrice === 'number' && typeof p.unitsSold === 'number');
});

/* ---------- per-row validation errors (v1.5) ---------- */
test('invalid rows report clear per-row reasons', () => {
  const res = CSV.fromCsv(FULL_HEADER + '\n,10,2,1,1,0,0,0,5\nBadPrice,abc,2,1,1,0,0,0,5\nNegAd,10,2,-1,1,0,0,0,5\nHalfUnits,10,2,1,1,0,0,0,2.5\nZeroPrice,0,2,1,1,0,0,0,5\n');
  assert.equal(res.products.length, 0);
  assert.equal(res.errors.length, 5);
  const reasons = res.errors.map(e => e.reason);
  assert.ok(reasons.includes('Missing product name'));
  assert.ok(reasons.includes('Selling price must be a number greater than $0'));
  assert.ok(reasons.some(r => r.includes('Negative value in') && r.includes('Advertising cost per sale')));
  assert.ok(reasons.includes('Units sold must be a whole number of at least 1'));
});
test('invalid numbers in cost columns are named', () => {
  const res = CSV.fromCsv(FULL_HEADER + '\nX,10,abc,2,1,0,0,0,5\n');
  assert.ok(res.errors[0].reason.includes('Invalid number in') && res.errors[0].reason.includes('Purchase cost'));
});
test('errors carry the CSV line number (header = line 1)', () => {
  const res = CSV.fromCsv(FULL_HEADER + '\nOk,10,2,1,1,0,0,0,5\n,10,2,1,1,0,0,0,5\n');
  assert.equal(res.products.length, 1);
  assert.equal(res.errors[0].row, 3);
  assert.equal(res.errors[0].reason, 'Missing product name');
});
test('mixed file: valid rows import, invalid rows explained', () => {
  const res = CSV.fromCsv(FULL_HEADER + '\nGood,10,2,1,1,0,0,0,5\n,0,x,-1,q,,0,0,z\n');
  assert.equal(res.products.length, 1);
  assert.equal(res.errors.length, 1);
  assert.equal(res.skipped, 1);
  assert.equal(res.rowCount, 2);
});
test('template round-trip: the two example rows import cleanly', () => {
  const template = CSV.toCsv([
    { name: 'Example: Wireless Earbuds', sellingPrice: 49.99, purchaseCost: 18.50,
      adCostPerSale: 6.00, shippingCost: 4.50, platformFees: 7.00,
      discountPerSale: 2.00, returnCostPerSale: 1.50, unitsSold: 320 },
    { name: 'Example: Cotton T-Shirt (costs can be 0)', sellingPrice: 19.00, purchaseCost: 6.50,
      adCostPerSale: 3.20, shippingCost: 3.80, platformFees: 2.85,
      discountPerSale: 0, returnCostPerSale: 0.60, unitsSold: 150 }
  ]);
  const res = CSV.fromCsv(template);
  assert.equal(res.products.length, 2);
  assert.equal(res.errors.length, 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
