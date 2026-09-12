/* =============================================================
   ProfitLeak AI — calculation engine tests
   Run with:  node tests/calc.test.js      (no dependencies needed)
   Verifies every formula, status, flag and recommendation
   against hand-calculated values.
   ============================================================= */
'use strict';

const assert = require('node:assert/strict');
const calc = require('../js/calc.js');
const { SAMPLE_PRODUCTS } = require('../js/data.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.error('  \u2717 ' + name); console.error('    ' + (e && e.message)); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }
function byName(name) { return SAMPLE_PRODUCTS.find(p => p.name === name); }
function types(p) { return calc.detectIssues(p, calc.computeMetrics(p)).map(i => i.type); }

console.log('\nProfitLeak AI \u2014 calculation engine tests\n');

/* ---------- 1) Metrics: Wireless Earbuds Pro (healthy) ---------- */
const em = calc.computeMetrics(byName('Wireless Earbuds Pro'));
test('revenue = selling price \u00D7 units', () => assert.ok(near(em.revenue, 15996.80)));
test('purchase cost total', () => assert.ok(near(em.purchaseTotal, 5920)));
test('advertising cost total', () => assert.ok(near(em.adTotal, 1920)));
test('shipping cost total', () => assert.ok(near(em.shippingTotal, 1440)));
test('fees total', () => assert.ok(near(em.feesTotal, 2240)));
test('discount total', () => assert.ok(near(em.discountTotal, 640)));
test('return cost total', () => assert.ok(near(em.returnsTotal, 480)));
test('total cost = sum of ALL six cost types', () => assert.ok(near(em.totalCost, 12640)));
test('true profit = revenue \u2212 total cost', () => assert.ok(near(em.trueProfit, 3356.80)));
test('profit per unit = price \u2212 total cost per unit', () => assert.ok(near(em.profitPerUnit, 10.49)));
test('profit margin = true profit \u00F7 revenue \u00D7 100', () => assert.ok(near(em.profitMargin, 20.9849, 0.001)));

/* ---------- 2) Metrics: Clear Phone Case (losing) ---------- */
const pm = calc.computeMetrics(byName('Clear Phone Case'));
test('losing product: revenue', () => assert.ok(near(pm.revenue, 6495)));
test('losing product: total cost', () => assert.ok(near(pm.totalCost, 6875)));
test('losing product: true profit \u2212$380', () => assert.ok(near(pm.trueProfit, -380)));
test('losing product: profit per unit \u2212$0.76', () => assert.ok(near(pm.profitPerUnit, -0.76, 1e-9)));
test('losing product: margin \u22125.85%', () => assert.ok(near(pm.profitMargin, -5.8506, 0.001)));

/* ---------- 3) Edge case: single cost type ---------- */
const edge = calc.computeMetrics({ sellingPrice: 10, purchaseCost: 12, adCostPerSale: 0,
  shippingCost: 0, platformFees: 0, discountPerSale: 0, returnCostPerSale: 0, unitsSold: 5 });
test('edge: only purchase cost \u2192 \u2212$10 total', () => assert.ok(near(edge.trueProfit, -10)));
test('edge: profit per unit \u2212$2', () => assert.ok(near(edge.profitPerUnit, -2)));
test('edge: margin \u221220%', () => assert.ok(near(edge.profitMargin, -20)));

/* ---------- 4) Statuses across all sample products ---------- */
test('status: earbuds \u2192 PROFITABLE', () => assert.equal(calc.getStatus(em), 'PROFITABLE'));
test('status: phone case \u2192 LOSING', () => assert.equal(calc.getStatus(pm), 'LOSING'));
test('status: yoga mat \u2192 LOW', () => assert.equal(calc.getStatus(calc.computeMetrics(byName('Eco Yoga Mat'))), 'LOW'));
test('status: candle \u2192 LOSING', () => assert.equal(calc.getStatus(calc.computeMetrics(byName('Lavender Candle Set'))), 'LOSING'));
test('status: speaker \u2192 LOW', () => assert.equal(calc.getStatus(calc.computeMetrics(byName('Mini Bluetooth Speaker'))), 'LOW'));
test('status: baking mats \u2192 PROFITABLE', () => assert.equal(calc.getStatus(calc.computeMetrics(byName('Silicone Baking Mat Set'))), 'PROFITABLE'));

/* ---------- 5) Loss detection flags ---------- */
test('flags: healthy earbuds \u2192 none', () => assert.deepEqual(types(byName('Wireless Earbuds Pro')), []));
test('flags: phone case \u2192 LOSING + HIGH_AD + HIGH_SHIPPING + HIGH_FEES', () =>
  assert.deepEqual(types(byName('Clear Phone Case')), ['LOSING', 'HIGH_AD', 'HIGH_SHIPPING', 'HIGH_FEES']));
test('flags: yoga mat \u2192 LOW_MARGIN + HIGH_SHIPPING + HIGH_FEES + HIGH_DISCOUNT', () =>
  assert.deepEqual(types(byName('Eco Yoga Mat')), ['LOW_MARGIN', 'HIGH_SHIPPING', 'HIGH_FEES', 'HIGH_DISCOUNT']));
test('flags: candle \u2192 LOSING + HIGH_SHIPPING', () =>
  assert.deepEqual(types(byName('Lavender Candle Set')), ['LOSING', 'HIGH_SHIPPING']));
test('flags: speaker \u2192 LOW_MARGIN + HIGH_AD', () =>
  assert.deepEqual(types(byName('Mini Bluetooth Speaker')), ['LOW_MARGIN', 'HIGH_AD']));
test('flags: baking mats \u2192 none', () => assert.deepEqual(types(byName('Silicone Baking Mat Set')), []));

/* ---------- 6) Recommendations built from real numbers ---------- */
const phone = byName('Clear Phone Case');
const phoneIssues = calc.detectIssues(phone, pm);
const phoneRecs = calc.buildRecommendations(phone, pm, phoneIssues).join('\n');
test('rec: ad share quoted as 42% of selling price', () => assert.ok(phoneRecs.includes('42%')));
test('rec: loss per sale quoted ($0.76)', () => assert.ok(phoneRecs.includes('You lose $0.76 on every sale')));
test('rec: avoidable losses quoted ($380.00)', () => assert.ok(phoneRecs.includes('avoid approximately $380.00')));
test('rec: break-even price quoted ($13.75)', () => assert.ok(phoneRecs.includes('to $13.75')));
test('rec: includes the ad-cut advice sentence', () =>
  assert.ok(phoneRecs.includes('Consider reducing advertising cost, increasing the selling price, or reducing the purchase cost.')));

const yoga = byName('Eco Yoga Mat');
const ym = calc.computeMetrics(yoga);
const yogaRecs = calc.buildRecommendations(yoga, ym, calc.detectIssues(yoga, ym)).join('\n');
test('rec: low-margin product quotes per-sale profit ($1.00)', () => assert.ok(yogaRecs.includes('$1.00 per sale')));
test('rec: quotes thin margin (2.6%)', () => assert.ok(yogaRecs.includes('2.6%')));
test('rec: 15%-margin target price ($44.71)', () => assert.ok(yogaRecs.includes('$44.71')));
test('rec: cost cut needed ($4.85)', () => assert.ok(yogaRecs.includes('$4.85')));

const candle = byName('Lavender Candle Set');
const cm = calc.computeMetrics(candle);
const candleRecs = calc.buildRecommendations(candle, cm, calc.detectIssues(candle, cm)).join('\n');
test('rec: candle loss sentence', () => assert.ok(candleRecs.includes('You lose $1.00 on every sale')));
test('rec: biggest cost called out (shipping 33% for candle)', () => assert.ok(candleRecs.includes('33% of your price')));

const earbudsRecs = calc.buildRecommendations(byName('Wireless Earbuds Pro'), em, []).join('\n');
test('rec: healthy product quotes per-sale profit', () => assert.ok(earbudsRecs.includes('$10.49 per sale')));

/* ---------- 7) Portfolio summary (dashboard KPIs) ---------- */
const s = calc.summarizePortfolio(SAMPLE_PRODUCTS);
test('summary: 6 products', () => assert.equal(s.count, 6));
test('summary: total revenue $55,574.90', () => assert.ok(near(s.revenue, 55574.90, 0.01)));
test('summary: total costs $49,155.50', () => assert.ok(near(s.totalCost, 49155.50, 0.01)));
test('summary: true profit $6,419.40', () => assert.ok(near(s.trueProfit, 6419.40, 0.01)));
test('summary: 2 losing / 2 low / 2 profitable', () =>
  assert.ok(s.losing === 2 && s.low === 2 && s.profitable === 2));
test('summary: total losses $590', () => assert.ok(near(s.totalLosses, 590)));
test('summary: overall margin ~11.55%', () => assert.ok(s.margin > 11.5 && s.margin < 11.6));

/* ---------- 8) Formatting helpers ---------- */
test('money: negative formatting uses minus sign', () => assert.equal(calc.money(-0.76), '\u2212$0.76'));
test('money: thousands separators', () => assert.equal(calc.money(1234567.891), '$1,234,567.89'));
test('money: zero', () => assert.equal(calc.money(0), '$0.00'));
test('pct: rounds to whole number', () => assert.equal(calc.pct(42.34), '42%'));
test('pct1: one decimal', () => assert.equal(calc.pct1(2.56), '2.6%'));

/* ---------- 9) Consistency checks over all samples ---------- */
SAMPLE_PRODUCTS.forEach(p => {
  const m = calc.computeMetrics(p);
  test('consistency: ' + p.name + ' \u2014 all metrics finite', () =>
    assert.ok([m.revenue, m.totalCost, m.trueProfit, m.profitPerUnit, m.profitMargin].every(Number.isFinite)));
  test('consistency: ' + p.name + ' \u2014 totals = per-unit \u00D7 units', () =>
    assert.ok(near(m.totalCost, m.totalCostPerUnit * p.unitsSold, 1e-6)));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
