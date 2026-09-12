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
test('rec: names the biggest cost causing the loss (advertising)', () =>
  assert.ok(phoneRecs.includes('The biggest cost causing this loss is advertising at $5.50 per sale') &&
            phoneRecs.includes('42% of your selling price') && phoneRecs.includes('$2,750.00 across all 500 units')));
test('rec: fastest fix quantified (cut ads by $0.76 to break even)', () =>
  assert.ok(phoneRecs.includes('The fastest fix: cut advertising by $0.76 per sale (to $4.74) and you break even')));

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
test('rec: healthy product still names its biggest cost + upside', () =>
  assert.ok(earbudsRecs.includes('Your biggest cost is purchase cost at $18.50 per sale (37% of your price)') &&
            earbudsRecs.includes('would add about $592.00 in profit across your 320 units')));

/* ---------- 6b) Biggest-cost edge cases & one-line recommendations ---------- */
const spread = { sellingPrice: 5, purchaseCost: 2, adCostPerSale: 1.5, shippingCost: 1.5,
  platformFees: 1, discountPerSale: 1, returnCostPerSale: 1, unitsSold: 1 };
const spreadM = calc.computeMetrics(spread);
const spreadRecs = calc.buildRecommendations(spread, spreadM, calc.detectIssues(spread, spreadM)).join('\n');
test('rec: honest when the biggest cost alone can\u2019t fix the loss', () =>
  assert.ok(spreadRecs.includes('Even cutting purchase cost to $0.00 would still leave you losing $1.00 per sale') &&
            spreadRecs.includes('price increase to $8.00')));

test('short rec: losing product names biggest cost', () => {
  const r = calc.shortRecommendation(phone, pm);
  assert.ok(r.includes('Losing $0.76/sale') && r.includes('Biggest cost: advertising \u2014 42% of price'));
});
test('short rec: low-margin product names biggest cost', () => {
  const r = calc.shortRecommendation(yoga, ym);
  assert.ok(r.includes('Thin 2.6% margin') && r.includes('Biggest cost: purchase cost \u2014 33% of price'));
});
test('short rec: healthy product', () =>
  assert.ok(calc.shortRecommendation(byName('Wireless Earbuds Pro'), em).includes('Healthy 21% margin after all costs')));

const pure = { sellingPrice: 10, purchaseCost: 0, adCostPerSale: 0, shippingCost: 0,
  platformFees: 0, discountPerSale: 0, returnCostPerSale: 0, unitsSold: 10 };
const pureM = calc.computeMetrics(pure);
test('edge: zero-cost product keeps 100% margin', () =>
  assert.ok(near(pureM.trueProfit, 100) && near(pureM.profitMargin, 100) && calc.getStatus(pureM) === 'PROFITABLE'));
test('edge: zero-cost product has no biggest cost', () => assert.equal(calc.biggestCost(pure), null));
test('edge: zero-cost product still gets a recommendation', () =>
  assert.ok(calc.buildRecommendations(pure, pureM, []).length >= 1));

/* ---------- 6c) Arithmetic identities on extra number vectors ---------- */
const vectors = [
  [19.99, 7.25, 3.10, 2.47, 2.99, 1.50, 0.80, 37],
  [249.00, 101.11, 22.20, 14.00, 31.06, 10.00, 6.40, 3],
  [0.99, 0.30, 0.20, 0.15, 0.12, 0.05, 0.02, 9999]
];
vectors.forEach((v, i) => {
  const p = { sellingPrice: v[0], purchaseCost: v[1], adCostPerSale: v[2], shippingCost: v[3],
              platformFees: v[4], discountPerSale: v[5], returnCostPerSale: v[6], unitsSold: v[7] };
  const m = calc.computeMetrics(p);
  test('vector ' + i + ': total cost equals sum of all six parts', () =>
    assert.ok(near(m.totalCost, m.purchaseTotal + m.adTotal + m.shippingTotal + m.feesTotal + m.discountTotal + m.returnsTotal, 1e-9)));
  test('vector ' + i + ': true profit = revenue \u2212 total cost', () =>
    assert.ok(near(m.trueProfit, m.revenue - m.totalCost, 1e-9)));
  test('vector ' + i + ': per-unit profit \u00D7 units = true profit', () =>
    assert.ok(near(m.profitPerUnit * p.unitsSold, m.trueProfit, 1e-6)));
});

/* ---------- 6d) Smart Profit Diagnosis ---------- */
test('diagnosis: phone case leak = advertising, 40% of total costs', () => {
  const d = calc.diagnose(phone, pm);
  assert.equal(d.biggest.key, 'ad');
  assert.ok(d.sentence.includes('Your biggest profit leak is advertising. It represents 40% of your total costs'));
  assert.ok(d.sentence.includes('$5.50 of the $13.75 you spend on every sale'));
});
test('diagnosis: action for phone case = reduce advertising cost (+$550 if cut 20%)', () => {
  const d = calc.diagnose(phone, pm);
  assert.equal(d.action.title, 'Reduce advertising cost');
  assert.ok(d.action.detail.includes('\u2212$1.10 per sale'));
  assert.ok(d.action.detail.includes('about $550.00 in profit across your 500 units sold'));
});
test('diagnosis: losing product also gets a break-even price action', () => {
  const d = calc.diagnose(phone, pm);
  assert.ok(d.action.secondary.includes('increasing your selling price to $13.75'));
});
test('diagnosis: candle leak = purchase cost, 33% of total costs', () => {
  const d = calc.diagnose(candle, cm);
  assert.equal(d.biggest.key, 'purchase');
  assert.ok(d.sentence.includes('purchase cost. It represents 33% of your total costs'));
});
test('diagnosis: earbuds leak = purchase cost, 47% of total costs', () => {
  const d = calc.diagnose(byName('Wireless Earbuds Pro'), em);
  assert.equal(d.biggest.key, 'purchase');
  assert.ok(d.sentence.includes('purchase cost. It represents 47% of your total costs'));
});
test('diagnosis: share of costs is consistent with the breakdown', () => {
  const d = calc.diagnose(candle, cm);
  const sum = calc.costBreakdown(candle).reduce((s, c) => s + c.total, 0);
  assert.ok(near(d.biggest.total / sum * 100, d.biggest.shareOfCosts, 1e-6));
});
test('diagnosis: zero-cost product has no leak', () => {
  const d = calc.diagnose(pure, pureM);
  assert.equal(d.biggest, null);
  assert.ok(d.sentence.includes('No costs recorded'));
  assert.equal(d.action.title, 'Nothing to fix');
});

/* ---------- 6e) What-If Simulator math ---------- */
test('what-if: cutting phone-case ads to $0 improves profit by $2,750', () => {
  const r = calc.simulate(phone, { adCostPerSale: 0 });
  assert.ok(near(r.metrics.trueProfit, 2370) && near(r.diffTotal, 2750) && near(r.diffPerUnit, 5.5));
});
test('what-if: raising earbuds price by $1 adds $320', () => {
  const r = calc.simulate(byName('Wireless Earbuds Pro'), { sellingPrice: 50.99 });
  assert.ok(near(r.diffTotal, 320));
});
test('what-if: cutting candle purchase cost to $9 adds $210', () => {
  const r = calc.simulate(candle, { purchaseCost: 9 });
  assert.ok(near(r.diffTotal, 210));
});
test('what-if: higher shipping reduces profit', () => {
  const r = calc.simulate(byName('Silicone Baking Mat Set'), { shippingCost: 5 });
  assert.ok(near(r.diffTotal, -645));
});
test('what-if: no changes = zero difference, same numbers', () => {
  const r = calc.simulate(candle, {});
  assert.ok(near(r.diffTotal, 0) && near(r.diffPerUnit, 0));
  assert.ok(near(r.metrics.trueProfit, cm.trueProfit));
});
test('what-if: combined changes compose correctly', () => {
  const r = calc.simulate(phone, { sellingPrice: 14.99, adCostPerSale: 2 });
  assert.ok(near(r.diffTotal, 2750) && near(r.metrics.trueProfit, 2370));
});

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
