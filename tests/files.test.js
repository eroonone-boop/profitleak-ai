/* =============================================================
   ProfitLeak AI — Pro-only file features tests (v1.19)
   CSV export, CSV import, the CSV template and report printing
   are paid (Pro) features — locked even during the free trial
   sittings. Free users get a clear upgrade dialog and NO file;
   licensed users get everything.
   ============================================================= */
'use strict';

let jsdom;
try { jsdom = require('jsdom'); } catch (e) {
  console.log('  ! jsdom is not installed — files test skipped.');
  process.exit(0);
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = jsdom;

const ROOT = path.join(__dirname, '..');
const STANDALONE = fs.readFileSync(path.join(ROOT, 'ProfitLeak-AI.html'), 'utf-8');
const tick = ms => new Promise(r => setTimeout(r, ms || 80));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.error('  \u2717 ' + name + ' \u2014 ' + e.message); process.exitCode = 1; }
}

const PL_KEY = 'PL-A2C4-E5G7-K9PM-XXXXXX';
const PRODUCTS = [{ id: 'p1', name: 'Wireless Earbuds', sellingPrice: 49.99,
  purchaseCost: 18.5, adCostPerSale: 6, shippingCost: 4.5, platformFees: 7,
  discountPerSale: 2, returnCostPerSale: 1.5, unitsSold: 10, createdAt: '2026-09-01T00:00:00.000Z' }];
const SEED = 'localStorage.setItem("profitleak.products.v1", ' +
  JSON.stringify(JSON.stringify(PRODUCTS)) + ');' +
  'localStorage.setItem("profitleak.onboarded.v1", "1");';
const PRO_SEED = 'localStorage.setItem("profitleak.license.v1",' +
  JSON.stringify(JSON.stringify({ key: PL_KEY, email: 'buyer@example.com', activatedAt: '2026-09-15T00:00:00.000Z' })) + ');' +
  'localStorage.setItem("profitleak.products.v1", ' +
  JSON.stringify(JSON.stringify(PRODUCTS)) + ');' +
  'localStorage.setItem("profitleak.onboarded.v1", "1");';

async function boot(seed) {
  const vc = new VirtualConsole();
  const errs = [];
  vc.on('jsdomError', e => {
    const m = String((e && e.message) || e);
    if (!/^Not implemented:/i.test(m)) errs.push(m);
  });
  const html = STANDALONE.replace('<head>', '<head><script>' + (seed || '') + '</script>');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://profitleak.example/', virtualConsole: vc,
    beforeParse(w) { w.fetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }); } });
  await tick(300);
  return { dom, errs };
}

async function main() {
  console.log('\nProfitLeak AI \u2014 Pro-only file features tests\n');
  console.log('\u2500\u2500 1. Free user (inside the free trial) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const { dom: domF } = await boot(SEED);
  const w = domF.window, d = w.document;
  const downloads = [];
  d.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a) downloads.push(a.getAttribute('download'));
  }, true);
  const dialogUp = () => !d.querySelector('#modal-overlay').hidden &&
    d.querySelector('#modal-title').textContent.includes('Pro feature');
  const closeDialog = () => d.querySelector('#modal-cancel').click();

  w.location.hash = '#/dashboard'; await tick(120);
  test('free trial user: the app itself is open (dashboard visible)', () => {
    assert.ok(!d.querySelector('#page-dashboard').hidden);
  });

  d.querySelector('[data-action="export-csv"]').click(); await tick(120);
  test('Export CSV: blocked with the upgrade dialog', () => {
    assert.ok(dialogUp());
    assert.equal(downloads.length, 0);
  });
  closeDialog(); await tick(60);

  d.querySelector('[data-action="csv-template"]').click(); await tick(120);
  test('CSV template: blocked with the upgrade dialog', () => {
    assert.ok(dialogUp());
    assert.equal(downloads.length, 0);
  });
  closeDialog(); await tick(60);

  d.querySelector('[data-action="import-csv"]').click(); await tick(120);
  test('Import CSV: blocked with the upgrade dialog', () => {
    assert.ok(dialogUp());
    assert.equal(downloads.length, 0);
  });
  closeDialog(); await tick(60);

  w.location.hash = '#/report'; await tick(150);
  let printed = 0;
  w.print = () => { printed++; };
  d.querySelector('#report-print').click(); await tick(120);
  test('Print report: blocked with the upgrade dialog, nothing printed', () => {
    assert.ok(d.querySelector('#report-body'));
    assert.ok(dialogUp());
    assert.equal(printed, 0);
  });
  closeDialog(); await tick(60);

  d.querySelector('[data-action="export-csv"]').click(); await tick(80);
  d.querySelector('#modal-confirm').click(); await tick(150);
  test('confirming the upgrade dialog navigates to #/pricing', () => {
    assert.ok(w.location.hash.indexOf('#/pricing') !== -1);
  });
  test('no file was ever downloaded for the free user', () => {
    assert.equal(downloads.length, 0);
  });
  domF.window.close();

  console.log('\n\u2500\u2500 2. Pro user (licensed) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const { dom: domP } = await boot(PRO_SEED);
  const wp = domP.window, dp = wp.document;
  const dl = [];
  dp.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a) dl.push(a.getAttribute('download'));
  }, true);
  wp.location.hash = '#/dashboard'; await tick(120);
  test('Pro user: recognized (badge in the nav)', () => {
    assert.ok(dp.querySelector('#plan-nav .pro-badge'));
  });
  dp.querySelector('[data-action="export-csv"]').click(); await tick(120);
  test('Pro user: Export CSV downloads the file', () => {
    assert.ok(dl.indexOf('profitleak-products.csv') !== -1);
    assert.ok(dp.querySelector('#modal-overlay').hidden); /* no dialog */
  });
  dp.querySelector('[data-action="csv-template"]').click(); await tick(120);
  test('Pro user: CSV template downloads', () => {
    assert.ok(dl.indexOf('profitleak-template.csv') !== -1);
  });
  wp.location.hash = '#/report'; await tick(150);
  let printedP = 0;
  wp.print = () => { printedP++; };
  dp.querySelector('#report-print').click(); await tick(120);
  test('Pro user: report printing works', () => {
    assert.equal(printedP, 1);
  });
  domP.window.close();

  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log('FILES TESTS: ' + passed + ' passed, ' + failed + ' failed');
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (failed) process.exitCode = 1;
}

main().catch(e => { console.error('FILES FATAL:', e && (e.stack || e)); process.exit(1); });
