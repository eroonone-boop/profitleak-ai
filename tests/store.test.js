/* =============================================================
   ProfitLeak AI — WhatsApp Orders tests (v1.12)
   1) Seller journey: free user sees the upsell; a licensed Pro
      user saves a WhatsApp number, creates an order link, and the
      store link appears; orders from the feed apply themselves to
      the product (units + profit) with no manual entry.
   2) Public journey: the order page renders for a locked-out
      visitor (never paywalled), the customer orders, the site
      records the order and opens WhatsApp with a prefilled
      message; the store page lists products.
   Network calls are mocked — no real requests.
   ============================================================= */
'use strict';

let jsdom;
try { jsdom = require('jsdom'); } catch (e) {
  console.log('  ! jsdom is not installed — store test skipped.');
  process.exit(0);
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = jsdom;

const ROOT = path.join(__dirname, '..');
const STANDALONE = fs.readFileSync(path.join(ROOT, 'ProfitLeak-AI.html'), 'utf-8');
const tick = ms => new Promise(r => setTimeout(r, ms || 70));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \u2713 ' + name); }
  catch (e) { failed++; console.error('  \u2717 ' + name + ' \u2014 ' + e.message); process.exitCode = 1; }
}

const PL_KEY = 'PL-A2C4-E5G7-K9PM-XXXXXX';
const LICENSE_SEED = 'localStorage.setItem("profitleak.license.v1",' +
  JSON.stringify(JSON.stringify({ key: PL_KEY, email: 'site-checkout', activatedAt: '2026-09-14T00:00:00.000Z' })) + ');' +
  'localStorage.setItem("profitleak.onboarded.v1", "1");' +
  'localStorage.setItem("profitleak.products.v1", ' +
  JSON.stringify(JSON.stringify([{ id: 'test-earbuds', name: 'Wireless Earbuds', sellingPrice: 49.99,
    purchaseCost: 18.5, adCostPerSale: 6, shippingCost: 4.5, platformFees: 7, discountPerSale: 2,
    returnCostPerSale: 1.5, unitsSold: 10, createdAt: '2026-09-01T00:00:00.000Z' }])) + ');';

function mockStore(product, order, orders) {
  const manage = [];
  const orderBodies = [];
  const f = (url, opts) => {
    const u = String(url);
    const res = (obj) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(obj) });
    if (u.includes('store-data')) {
      if (u.includes('S-TEST1')) return res({ success: true, type: 'store', products: [{ code: 'P-TEST01', name: 'Wireless Earbuds', price: 49.99 }] });
      return res(product);
    }
    if (u.includes('store-orders')) return res({ success: true, orders: orders !== undefined ? orders : [{ oc: 'O-1', lc: 'P-TEST01', p: 'Wireless Earbuds', name: 'Ali', qty: 2, price: 49.99, ph: '212611111111', at: '2026-09-14T12:00:00.000Z' }] });
    if (u.includes('store-order')) {
      let qty = 1, name = '', phone = '';
      try { const b = JSON.parse(opts.body); qty = b.qty; name = b.name; phone = b.phone; } catch (e) {}
      orderBodies.push({ qty: qty, name: name, phone: phone });
      return res(Object.assign({ success: true, orderCode: 'O-9', wa: '212600000000', product: 'Wireless Earbuds', price: 49.99, qty: qty }, order || {}));
    }
    if (u.includes('store-manage')) {
      let a = null;
      try { a = JSON.parse(opts.body); } catch (e) {}
      manage.push(a);
      return res({ success: true });
    }
    if (u.includes('store-create')) return res({ success: true, code: 'P-TEST01', store: 'S-TEST1' });
    return res({ success: false });
  };
  f.manage = manage;
  f.orderBodies = orderBodies;
  return f;
}

async function main() {
  console.log('\nProfitLeak AI \u2014 WhatsApp Orders tests\n');
  console.log('\u2500\u2500 1. Seller journey \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const vc = new VirtualConsole();
  const pageErrors = [];
  vc.on('jsdomError', e => {
    const m = String((e && e.message) || e);
    if (!/^Not implemented:/i.test(m)) pageErrors.push(m);
  });

  /* free user: upsell */
  const domF = new JSDOM(STANDALONE, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://profitleak.example/', virtualConsole: vc,
    beforeParse(w) { w.fetch = mockStore(); } });
  await tick(300);
  const wF = domF.window, dF = wF.document;
  dF.querySelector('#welcome-start').click(); await tick(60);
  wF.location.hash = '#/orders'; await tick(90);
  test('free user: Orders page shows the Pro upsell', () => {
    assert.ok(dF.querySelector('#orders-body').textContent.includes('Pro feature'));
  });
  domF.window.close();

  /* licensed Pro seller (onboarded — straight to the Orders page) */
  const html = STANDALONE.replace('<head>', '<head><script>' + LICENSE_SEED + '</script>');
  const sellerFetch = mockStore();
  const dom2 = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://profitleak.example/', virtualConsole: vc,
    beforeParse(w) { w.fetch = sellerFetch; w.confirm = function () { return true; }; } });
  await tick(300);
  const w = dom2.window, d = w.document;
  w.location.hash = '#/orders'; await tick(150);
  test('Pro seller: Orders page renders with the number box', () => {
    assert.ok(d.getElementById('wa-number'));
    assert.ok(d.querySelector('[data-wa-create]'));
  });
  test('invalid number is rejected inline', () => {
    d.getElementById('wa-number').value = '123';
    d.getElementById('wa-save').click();
    assert.ok(!d.getElementById('wa-error').hidden);
  });
  d.getElementById('wa-number').value = '+212 600-000000';
  d.getElementById('wa-save').click(); await tick(60);
  const firstProduct = JSON.parse(w.localStorage.getItem('profitleak.products.v1') || '[]')[0];
  d.querySelector('[data-wa-create]').click(); await tick(200);
  test('creating an order link: saved locally + store link appears', () => {
    const wa = JSON.parse(w.localStorage.getItem('profitleak.wa.v1'));
    assert.ok(wa.links && wa.links[firstProduct.id] && wa.links[firstProduct.id].code === 'P-TEST01');
    assert.equal(wa.store, 'S-TEST1');
    assert.ok(d.getElementById('wa-store-copy'));
  });
  /* the feed refresh after creating pulls one order -> applies it */
  await tick(250);
  test('incoming order applies itself: unitsSold grows automatically', () => {
    const products = JSON.parse(w.localStorage.getItem('profitleak.products.v1'));
    const p = products.find(x => x.id === firstProduct.id);
    const before = firstProduct.unitsSold || 0;
    assert.equal(p.unitsSold, before + 2); /* the mocked order qty=2 */
  });
  test('feed shows the sale with buyer, phone, revenue and true profit', () => {
    const feed = d.getElementById('wa-feed').textContent;
    assert.ok(feed.includes('Ali'));
    assert.ok(feed.includes('+212611111111'));
    assert.ok(d.getElementById('wa-feed').querySelector('.wa-phone'));
    assert.ok(feed.includes('$99.98'));
    assert.ok(d.getElementById('wa-feed').querySelector('.table'));
  });
  d.querySelector('[data-wa-edit]').click(); await tick(80);
  test('settings icon opens the order-page editor', () => {
    assert.ok(d.getElementById('wa-e-name'));
    assert.ok(d.getElementById('wa-e-price'));
    assert.equal(d.getElementById('wa-e-price').value, '49.99');
  });
  d.getElementById('wa-e-name').value = 'Earbuds Pro v2';
  d.getElementById('wa-e-price').value = '59.99';
  d.getElementById('wa-e-save').click(); await tick(250);
  test('saving the editor updates the server listing and the product', () => {
    assert.ok(sellerFetch.manage.some(c => c && c.action === 'update' && c.code === 'P-TEST01' && c.name === 'Earbuds Pro v2' && c.price === 59.99));
    const products = JSON.parse(w.localStorage.getItem('profitleak.products.v1'));
    const p2 = products.find(x => x.id === firstProduct.id);
    assert.equal(p2.name, 'Earbuds Pro v2');
    assert.equal(p2.sellingPrice, 59.99);
    assert.ok(!d.querySelector('.wa-edit-row'));
  });
  d.querySelector('[data-wa-del]').click(); await tick(250);
  test('delete icon removes the link (server + local)', () => {
    assert.ok(sellerFetch.manage.some(c => c && c.action === 'delete' && c.code === 'P-TEST01'));
    const wa = JSON.parse(w.localStorage.getItem('profitleak.wa.v1'));
    assert.ok(!wa.links || !wa.links[firstProduct.id]);
    assert.ok(d.querySelector('[data-wa-create]'));
  });
  test('no unexpected page errors in the seller journey', () => {
    if (pageErrors.length) console.error('        page errors: ' + pageErrors.slice(0, 5).join(' | '));
    assert.equal(pageErrors.length, 0);
  });
  dom2.window.close();

  console.log('\n\u2500\u2500 2. Public journey (customer side) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  const opened = [];
  const pubFetch = mockStore({ success: true, type: 'product', name: 'Wireless Earbuds', price: 49.99, wa: '212600000000' });
  const domP = new JSDOM(STANDALONE, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://profitleak.example/', virtualConsole: vc,
    beforeParse(w) {
      w.fetch = pubFetch;
      w.open = (url) => { opened.push(String(url)); return null; };
      /* locked free trial: the public page must still work */
      w.localStorage.setItem('profitleak.trial.v1',
        JSON.stringify({ startedAt: Date.now() - 7200e3, lastActive: Date.now() - 7200e3 }));
      w.localStorage.setItem('profitleak.onboarded.v1', '1');
    } });
  await tick(300);
  const wP = domP.window, dP = wP.document;
  wP.location.hash = '#/order/P-TEST01'; await tick(200);
  test('public order page renders (trial lock never blocks customers)', () => {
    assert.ok(dP.querySelector('#view-public').hidden === false || !dP.querySelector('#view-public').hidden);
    assert.ok(dP.querySelector('#trial-overlay').hidden);
    assert.ok(dP.querySelector('#public-body').textContent.includes('Wireless Earbuds'));
    assert.ok(dP.querySelector('#public-body').textContent.includes('$49.99'));
  });
  dP.querySelector('#pub-order').click(); await tick(150);
  test('ordering without a phone number is blocked inline', () => {
    assert.equal(opened.length, 0);
    assert.ok(!dP.querySelector('#pub-err').hidden);
  });
  dP.querySelector('#pub-qty').value = '2';
  dP.querySelector('#pub-name').value = 'Ali';
  dP.querySelector('#pub-phone').value = '212611111111';
  dP.querySelector('#pub-order').click(); await tick(200);
  test('ordering: WhatsApp opens with a prefilled message + order code', () => {
    assert.equal(opened.length, 1);
    const url = decodeURIComponent(opened[0]);
    assert.ok(url.indexOf('wa.me/212600000000') !== -1);
    assert.ok(url.indexOf('O-9') !== -1);
    assert.ok(url.indexOf('Wireless Earbuds') !== -1);
    assert.ok(url.indexOf('$99.98') !== -1);
    assert.ok(url.indexOf('Ali') !== -1);
    assert.ok(url.indexOf('Buyer WhatsApp: +212611111111') !== -1);
    assert.equal(pubFetch.orderBodies.length, 1);
    assert.equal(pubFetch.orderBodies[0].phone, '212611111111');
  });
  test('success state with a manual WhatsApp link appears', () => {
    assert.ok(!dP.querySelector('#pub-done').hidden);
    assert.ok(dP.querySelector('#pub-wa-link').href.indexOf('wa.me/212600000000') !== -1);
  });
  wP.location.hash = '#/s/S-TEST1'; await tick(200);
  test('public store page lists the products', () => {
    const t = dP.querySelector('#public-body').textContent;
    assert.ok(t.includes('Wireless Earbuds'));
    assert.ok(dP.querySelector('.pub-item'));
  });
  test('no unexpected page errors in the public journey', () => {
    if (pageErrors.length) console.error('        page errors: ' + pageErrors.slice(0, 5).join(' | '));
    assert.equal(pageErrors.length, 0);
  });
  domP.window.close();

  console.log('\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  console.log('STORE TESTS: ' + passed + ' passed, ' + failed + ' failed');
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  if (failed) process.exitCode = 1;
}

main().catch(e => { console.error('STORE FATAL:', e && (e.stack || e)); process.exit(1); });
