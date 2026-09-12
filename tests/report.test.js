/* =============================================================
   ProfitLeak AI — Profit Report tests
   Run with:  node tests/report.test.js      (no dependencies needed)
   Verifies the report numbers against hand-calculated values.
   ============================================================= */
'use strict';

const assert = require('node:assert/strict');
const calc = require('../js/calc.js');      // must load first: sets global.PL_CALC
const report = require('../js/report.js');
const { SAMPLE_PRODUCTS } = require('../js/data.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.error('  \u2717 ' + name); console.error('    ' + (e && e.message)); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }
const byName = n => SAMPLE_PRODUCTS.find(p => p.name === n);

console.log('\nProfitLeak AI \u2014 Profit Report tests\n');

/* ---------- empty input ---------- */
test('no products \u2192 no report', () => {
  assert.equal(report.buildReport([]), null);
  assert.equal(report.buildReport(null), null);
});

/* ---------- business summary (all 6 samples) ---------- */
const r = report.buildReport(SAMPLE_PRODUCTS);
const s = r.summary;

test('summary: 6 products', () => assert.equal(s.count, 6));
test('summary: revenue $55,574.90', () => assert.ok(near(s.revenue, 55574.90, 0.01)));
test('summary: total costs $49,155.50', () => assert.ok(near(s.totalCost, 49155.50, 0.01)));
test('summary: true profit $6,419.40', () => assert.ok(near(s.trueProfit, 6419.40, 0.01)));
test('summary: overall margin ~11.55%', () => assert.ok(s.margin > 11.5 && s.margin < 11.6));
test('summary: 2 profitable / 2 losing', () =>
  assert.ok(s.profitable === 2 && s.losing === 2));

/* ---------- top performers ---------- */
test('top5: exactly 5 rows, sorted best first', () => {
  assert.equal(r.top5.length, 5);
  for (let i = 1; i < r.top5.length; i++) {
    assert.ok(r.top5[i - 1].m.trueProfit >= r.top5[i].m.trueProfit);
  }
});
test('top5: #1 is Wireless Earbuds Pro at $3,356.80', () => {
  assert.equal(r.top5[0].p.name, 'Wireless Earbuds Pro');
  assert.ok(near(r.top5[0].m.trueProfit, 3356.80, 0.01));
});
test('top5: #2 is Silicone Baking Mat Set at $2,855.20', () => {
  assert.equal(r.top5[1].p.name, 'Silicone Baking Mat Set');
  assert.ok(near(r.top5[1].m.trueProfit, 2855.20, 0.01));
});

/* ---------- biggest losses ---------- */
test('worst5: only losing products (2 of them)', () => {
  assert.equal(r.worst5.length, 2);
  assert.ok(r.worst5.every(x => x.m.trueProfit < 0));
});
test('worst5: #1 is Clear Phone Case at \u2212$380.00', () => {
  assert.equal(r.worst5[0].p.name, 'Clear Phone Case');
  assert.ok(near(r.worst5[0].m.trueProfit, -380, 0.01));
});
test('worst5: #2 is Lavender Candle Set at \u2212$210.00', () =>
  assert.ok(near(r.worst5[1].m.trueProfit, -210, 0.01)));

/* ---------- profit leaks (aggregated cost categories) ---------- */
test('leaks: all six categories present', () => assert.equal(r.leaks.length, 6));
test('leaks: sorted largest first', () => {
  for (let i = 1; i < r.leaks.length; i++) {
    assert.ok(r.leaks[i - 1].total >= r.leaks[i].total);
  }
});
test('leaks: #1 is Purchase at $18,595.00 (38% of costs)', () => {
  assert.equal(r.leaks[0].key, 'purchase');
  assert.ok(near(r.leaks[0].total, 18595, 0.01));
  assert.ok(Math.round(r.leaks[0].shareOfCosts) === 38);
});
test('leaks: #2 is Advertising at $10,265.00', () => {
  assert.equal(r.leaks[1].key, 'ad');
  assert.ok(near(r.leaks[1].total, 10265, 0.01));
});
test('leaks: category totals sum exactly to total costs', () => {
  const sum = r.leaks.reduce((a, l) => a + l.total, 0);
  assert.ok(near(sum, s.totalCost, 0.01));
});
test('leaks: shares sum to ~100%', () => {
  const sum = r.leaks.reduce((a, l) => a + l.shareOfCosts, 0);
  assert.ok(near(sum, 100, 0.001));
});

/* ---------- smart recommendations ---------- */
test('recommendations: at least 4, all non-empty strings', () => {
  assert.ok(r.recommendations.length >= 4);
  assert.ok(r.recommendations.every(x => typeof x === 'string' && x.length > 10));
});
test('recommendation: names the worst product with its real loss', () =>
  assert.ok(r.recommendations.some(x => x.includes('Clear Phone Case') && x.includes('\u2212$380.00'))));
test('recommendation: largest cost category with exact total', () =>
  assert.ok(r.recommendations.some(x => x.includes('purchase cost at $18,595.00') && x.includes('38%'))));
test('recommendation: 10% cut of the top leak is worth $1,859.50', () =>
  assert.ok(r.recommendations.some(x => x.includes('$1,859.50'))));
test('recommendation: names the best product', () =>
  assert.ok(r.recommendations.some(x => x.includes('Wireless Earbuds Pro'))));
test('recommendation: quotes the overall margin (11.6%)', () =>
  assert.ok(r.recommendations.some(x => x.includes('11.6%'))));

/* ---------- report date ---------- */
test('generatedAt is a Date', () => assert.ok(r.generatedAt instanceof Date));
test('fmtDate formats like "September 12, 2026 \u00B7 09:05"', () =>
  assert.equal(report.fmtDate(new Date(2026, 8, 12, 9, 5)), 'September 12, 2026 \u00B7 09:05'));

/* ---------- rendering ---------- */
const html = report.renderHtml(r);
test('render: title, date and all five sections present', () => {
  ['Profit Report', 'Business summary', 'Top performers', 'Biggest losses',
   'Profit leaks', 'Smart recommendations', 'Generated'].forEach(k =>
    assert.ok(html.includes(k), k));
});
test('render: every product appears in the tables', () => {
  SAMPLE_PRODUCTS.forEach(p => assert.ok(html.includes(p.name), p.name));
});
test('render: summary values appear ($55,574.90 / $6,419.40)', () =>
  assert.ok(html.includes('$55,574.90') && html.includes('$6,419.40')));
test('render: leak rows include the category totals ($18,595.00)', () =>
  assert.ok(html.includes('$18,595.00') && html.includes('$10,265.00')));

/* ---------- smaller portfolios ---------- */
test('single profitable product: no losses section content', () => {
  const one = report.buildReport([byName('Wireless Earbuds Pro')]);
  assert.equal(one.top5.length, 1);
  assert.equal(one.worst5.length, 0);
  assert.ok(report.renderHtml(one).includes('No losing products'));
});
test('all-losing portfolio flags every product', () => {
  const losing = report.buildReport([byName('Clear Phone Case'), byName('Lavender Candle Set')]);
  assert.equal(losing.worst5.length, 2);
  assert.equal(losing.summary.profitable, 0);
  assert.ok(losing.recommendations.some(x => x.includes('losing money')));
});
test('free-plan trio (3 products) reports correctly', () => {
  const trio = report.buildReport(['Wireless Earbuds Pro', 'Mini Bluetooth Speaker', 'Clear Phone Case'].map(byName));
  assert.equal(trio.summary.count, 3);
  assert.ok(near(trio.summary.revenue, 32889.20, 0.01));
  assert.ok(near(trio.summary.trueProfit, 3624.20, 0.01));
  assert.equal(trio.summary.losing, 1);
  assert.ok(near(trio.leaks[0].total, 11320, 0.01)); // purchase 5920+3900+1500
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
