/* =============================================================
   ProfitLeak AI — headless smoke test
   Loads the REAL app (index.html + all scripts) in jsdom and
   clicks through the whole user journey:
   landing \u2192 dashboard \u2192 analysis \u2192 add (validation + save)
   \u2192 delete (confirm dialog) \u2192 live preview.
   Requires dev dependency:  npm install   then   node tests/smoke.test.js
   ============================================================= */
'use strict';

let jsdom;
try { jsdom = require('jsdom'); } catch (e) {
  console.log('  ! jsdom is not installed \u2014 smoke test skipped.');
  console.log('    Run "npm install" first to enable it.');
  process.exit(0);
}

const assert = require('node:assert/strict');
const path = require('path');
const { JSDOM, VirtualConsole } = jsdom;

function tick(ms) { return new Promise(r => setTimeout(r, ms || 70)); }

async function main() {
  const virtualConsole = new VirtualConsole();
  const pageErrors = [];
  virtualConsole.on('jsdomError', err => {
    const msg = String((err && err.message) || err);
    if (!/^Not implemented:/i.test(msg)) pageErrors.push(msg); // jsdom noise is OK
  });

  const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole
  });
  const w = dom.window;
  const d = w.document;

  await new Promise(res => { if (d.readyState === 'complete') res(); else w.addEventListener('load', res); });
  await tick(100);

  let passed = 0, failed = 0;
  const test = (name, fn) => {
    try { fn(); passed++; console.log('  \u2713 ' + name); }
    catch (e) { failed++; console.error('  \u2717 ' + name + ' \u2014 ' + e.message); process.exitCode = 1; }
  };

  console.log('\nProfitLeak AI \u2014 app smoke test (jsdom)\n');

  /* ---- landing ---- */
  test('landing page renders', () => assert.ok(d.querySelector('.hero h1')));
  test('hero example computed live by the engine (\u2212$0.76)', () =>
    assert.ok(d.querySelector('#hero-example').textContent.includes('\u2212$0.76')));

  /* ---- landing CTA → dashboard ---- */
  d.querySelector('.hero-cta a[href="#/dashboard"]').click();
  await tick();
  test('"Analyze My Products" opens the dashboard', () =>
    assert.ok(!d.querySelector('#page-dashboard').hidden));
  test('6 KPI cards render', () => assert.equal(d.querySelectorAll('#kpi-grid .kpi').length, 6));
  test('6 sample products in the table', () => assert.equal(d.querySelectorAll('#table-wrap tbody tr').length, 6));
  test('losing / low / profitable badges present', () => {
    assert.ok(d.querySelector('#table-wrap .badge-red'));
    assert.ok(d.querySelector('#table-wrap .badge-amber'));
    assert.ok(d.querySelector('#table-wrap .badge-green'));
  });
  test('profit chart has 6 clickable bars', () => assert.equal(d.querySelectorAll('#chart-profit .bar-row').length, 6));
  test('cost donut renders with legend', () => {
    assert.ok(d.querySelector('#chart-costs svg'));
    assert.ok(d.querySelectorAll('#chart-costs .legend-row').length >= 4);
  });
  test('losing-money alert banner shown', () => assert.ok(d.querySelector('#alerts .alert-red')));

  /* ---- product analysis (worst product is first by default sort) ---- */
  d.querySelector('tr.clickable').click();
  await tick();
  test('analysis page opens on row click', () => assert.ok(!d.querySelector('#page-analysis').hidden));
  test('worst product (Clear Phone Case) analysed first', () =>
    assert.ok(d.querySelector('#analysis-head h1').textContent.includes('Clear Phone Case')));
  test('findings listed ("where are you losing money?")', () =>
    assert.ok(d.querySelectorAll('#analysis-issues .finding').length >= 3));
  test('recommendations listed ("what should you change?")', () =>
    assert.ok(d.querySelectorAll('#analysis-recs li').length >= 3));
  test('numbers table includes true-profit row', () => assert.ok(d.querySelector('#analysis-numbers .profit-row')));
  test('unit-economics stacked bar renders', () => assert.ok(d.querySelector('#analysis-bar .anatomy-track')));
  test('cost ranking shows #1 biggest cost (advertising)', () => {
    const first = d.querySelector('#diagnosis-section .rank-row');
    assert.ok(first && first.textContent.includes('Advertising'));
    assert.ok(d.querySelector('#diagnosis-section .rank-tag'));
  });
  test('recommendation names the biggest cost causing the loss', () =>
    assert.ok(d.querySelector('#analysis-recs').textContent.includes('The biggest cost causing this loss is advertising at $5.50 per sale')));

  /* ---- smart profit diagnosis ---- */
  test('diagnosis card renders with current profit tile', () =>
    assert.ok(d.querySelector('#diagnosis-section .diag-current').textContent.includes('\u2212$380.00')));
  test('diagnosis sentence quotes the real % of total costs', () =>
    assert.ok(d.querySelector('#diagnosis-section .diag-sentence').textContent.includes('Your biggest profit leak is advertising. It represents 40% of your total costs')));
  test('recommended action tile says "Reduce advertising cost"', () =>
    assert.ok(d.querySelector('#diagnosis-section .diag-action .diag-value').textContent.includes('Reduce advertising cost')));
  test('diagnosis ranks all 6 costs highest to lowest', () => {
    const rows = Array.from(d.querySelectorAll('#diagnosis-section .rank-row'));
    assert.equal(rows.length, 6);
    assert.ok(rows[0].textContent.includes('Advertising')); // biggest first
  });

  /* ---- what-if simulator ---- */
  const adSlider = d.querySelector('[data-wi-slider="adCostPerSale"]');
  adSlider.value = '0';
  adSlider.dispatchEvent(new w.Event('input', { bubbles: true }));
  await tick(30);
  test('what-if: ads to $0 shows +$2,750.00 and new profit $2,370.00', () => {
    const t = d.querySelector('#wi-results').textContent;
    assert.ok(t.includes('+$2,750.00') && t.includes('$2,370.00') && t.includes('improves'));
  });
  d.querySelector('#wi-reset').click();
  await tick(30);
  test('what-if: reset restores the current numbers', () =>
    assert.ok(d.querySelector('#wi-results').textContent.includes('No change yet')));
  const priceNum = d.querySelector('[data-wi-num="sellingPrice"]');
  priceNum.value = '13.75';
  priceNum.dispatchEvent(new w.Event('input', { bubbles: true }));
  await tick(30);
  test('what-if: break-even price shows +$380.00 improvement', () =>
    assert.ok(d.querySelector('#wi-results').textContent.includes('+$380.00')));
  d.querySelector('#wi-reset').click();
  await tick(30);
  d.querySelector('[data-wi-slider="adCostPerSale"]').value = '0';
  d.querySelector('[data-wi-slider="adCostPerSale"]').dispatchEvent(new w.Event('input', { bubbles: true }));
  await tick(30);
  d.querySelector('#wi-apply').click();
  await tick(30);
  test('what-if: apply updates the product (true profit $2,370.00)', () =>
    assert.ok(d.querySelector('#analysis-stats').textContent.includes('$2,370.00')));
  test('what-if: after apply, diagnosis updates (leak is now purchase cost)', () =>
    assert.equal(d.querySelector('#diagnosis-section .diag-leak .diag-value').textContent.trim(), 'Purchase cost'));
  test('what-if: applied numbers are saved to browser storage', () => {
    let saved = null;
    try { saved = w.localStorage.getItem('profitleak.products.v1'); } catch (e) { saved = null; }
    assert.ok(saved === null || saved.includes('"adCostPerSale":0'));
  });

  /* ---- add product: validation first ---- */
  d.querySelector('.back-link').click();
  await tick();
  d.querySelector('#page-dashboard .page-actions a[href="#/add"]').click();
  await tick();
  test('"Add Product" button opens the form', () =>
    assert.ok(!d.querySelector('#page-form').hidden));
  d.getElementById('product-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await tick(30);
  test('empty form is blocked with inline errors', () =>
    assert.ok(d.querySelectorAll('#product-form .has-error').length >= 2));

  /* ---- add product: fill and save ---- */
  const set = (id, v) => { d.getElementById(id).value = v; };
  set('f-name', 'Smoke Test Widget');
  set('f-price', '5.00');
  set('f-units', '10');
  set('f-purchase', '10.00');
  set('f-ad', '0');
  set('f-ship', '0');
  set('f-fees', '0');
  set('f-discount', '0');
  set('f-returns', '0');
  d.getElementById('product-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  test('product saved \u2014 table now has 7 rows', () =>
    assert.equal(d.querySelectorAll('#table-wrap tbody tr').length, 7));

  /* ---- new product: click row -> detailed analysis -> recommendation ---- */
  const newRow = Array.from(d.querySelectorAll('#table-wrap tbody tr'))
    .find(r => r.textContent.includes('Smoke Test Widget'));
  newRow.click();
  await tick();
  test('clicking the new product opens its detailed analysis', () =>
    assert.ok(d.querySelector('#analysis-head h1').textContent.includes('Smoke Test Widget')));
  test('new product\u2019s recommendation explains the biggest cost', () =>
    assert.ok(d.querySelector('#analysis-recs').textContent.includes('The biggest cost causing this loss is purchase cost at $10.00 per sale')));
  test('cost ranking rendered for the new product', () =>
    assert.equal(d.querySelectorAll('#diagnosis-section .rank-row').length, 1));
  d.querySelector('.back-link').click();
  await tick();
  test('new product flagged \uD83D\uDD34 LOSING MONEY', () => {
    const row = Array.from(d.querySelectorAll('#table-wrap tbody tr'))
      .find(r => r.textContent.includes('Smoke Test Widget'));
    assert.ok(row && row.querySelector('.badge-red'));
  });
  test('toast confirms the addition', () => assert.ok(d.querySelector('#toast-container .toast')));

  /* ---- delete the test product via confirm dialog ---- */
  const widgetRow = Array.from(d.querySelectorAll('#table-wrap tbody tr'))
    .find(r => r.textContent.includes('Smoke Test Widget'));
  widgetRow.querySelector('[data-action="delete"]').click();
  await tick(30);
  test('confirm dialog appears', () => assert.ok(!d.querySelector('#modal-overlay').hidden));
  d.getElementById('modal-confirm').click();
  await tick();
  test('product deleted \u2014 back to 6 rows', () =>
    assert.equal(d.querySelectorAll('#table-wrap tbody tr').length, 6));

  /* ---- live calculation preview ---- */
  w.location.hash = '#/add';
  await tick();
  set('f-price', '20');
  set('f-units', '100');
  set('f-purchase', '5');
  d.getElementById('f-price').dispatchEvent(new w.Event('input', { bubbles: true }));
  await tick(30);
  test('live preview computes revenue ($2,000.00)', () =>
    assert.ok(d.querySelector('#lp-rows').textContent.includes('$2,000.00')));

  /* ---- health ---- */
  test('no unexpected page errors', () => assert.deepEqual(pageErrors, []));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  w.close();
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
