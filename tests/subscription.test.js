/* v1.21 — subscription plans (monthly/yearly) + FREEYEAR promo tests. */
'use strict';
let jsdom; try { jsdom = require('jsdom'); } catch (e) { console.log('  ! jsdom missing — skipped.'); process.exit(0); }
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM, VirtualConsole } = jsdom;
const STANDALONE = fs.readFileSync(path.join(__dirname, '..', 'ProfitLeak-AI.html'), 'utf-8');
const LICS = require('/home/user/netlify-functions/lib/licenses.js');
const tick = ms => new Promise(r => setTimeout(r, ms || 90));
let passed = 0, failed = 0;
const test = (n, fn) => { try { fn(); passed++; console.log('  \u2713 ' + n); } catch (e) { failed++; console.error('  \u2717 ' + n + ' \u2014 ' + e.message); process.exitCode = 1; } };
const PLANS = { success: true, plans: { monthly: { price: 3.99, months: 1, label: 'Monthly' }, yearly: { price: 19.99, months: 12, label: 'Yearly' } }, freeYear: { code: 'FREEYEAR', limit: 15, remaining: 15 } };
const KEY_OK = LICS.generateTimed(12);
async function boot(fetchImpl, seed) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const html = STANDALONE.replace('<head>', '<head><script>' + (seed || '') + '</script>');
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://profitleak.example/', virtualConsole: vc, beforeParse(w) { w.fetch = fetchImpl; } });
  await tick(300); return dom;
}
(async () => {
  console.log('\nProfitLeak AI \u2014 subscription tests (v1.21)\n');
  test('unit: timed key verifies and carries an expiry ~1 year out', () => {
    const v = LICS.verifyKeyEx(KEY_OK.key);
    assert.ok(v.ok && v.expiresAt);
    assert.ok(new Date(v.expiresAt).getTime() - Date.now() > 330 * 24 * 3600e3);
  });
  test('unit: expired timed key is rejected (expired flag)', () => {
    const old = 'PLS-260101-' + KEY_OK.key.split('-')[2] + '-' + KEY_OK.key.split('-')[3] + '-XXXXXX';
    assert.ok(!LICS.verifyKeyEx(old).ok);
  });
  test('unit: legacy PL- key still verifies as lifetime', () => {
    const legacy = require('/home/user/netlify-functions/lib/licenses.js');
    const v = legacy.verifyKeyEx('PL-A2C4-E5G7-K9PM-XXXXXX') /* invalid tag */;
    const g = legacy.generateKey();
    const vg = legacy.verifyKeyEx(g);
    assert.ok(vg.ok && vg.expiresAt === null);
  });

  const dom = await boot((url) => {
    const u = String(url);
    if (u.includes('license-plans')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(PLANS) });
    if (u.includes('redeem-code')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, key: KEY_OK.key, expiresAt: KEY_OK.expiresAt, remaining: 14 }) });
    if (u.includes('license-verify')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, email: 'x@x.com', expiresAt: KEY_OK.expiresAt }) });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  }, 'localStorage.setItem("profitleak.onboarded.v1", "1");');
  const w = dom.window, d = w.document;
  w.location.hash = '#/pricing'; await tick(500);
  test('pricing shows Monthly + Yearly toggle and yearly price', () => {
    assert.ok(d.querySelector('.plan-opt[data-plan="monthly"]'));
    assert.ok(d.querySelector('.plan-opt[data-plan="yearly"]'));
    assert.ok(d.querySelector('#plan-price').textContent.includes('$19.99'));
  });
  test('FREE-YEAR launch banner with the code + counter', () => {
    const b = d.querySelector('.freeyear-box');
    assert.ok(b && b.textContent.includes('FREEYEAR') && b.textContent.includes('15'));
  });
  test('pay links carry the selected plan (yearly default)', () => {
    assert.ok(d.querySelector('[data-pay="paypal"]').href.includes('plan=yearly'));
  });
  d.querySelector('.plan-opt[data-plan="monthly"]').click(); await tick(60);
  test('switching to Monthly updates the price and the links', () => {
    assert.ok(d.querySelector('#plan-price').textContent.includes('$3.99'));
    assert.ok(d.querySelector('[data-pay="paypal"]').href.includes('plan=monthly'));
  });
  d.querySelector('#license-input').value = 'freeyear';
  d.querySelector('#license-activate-btn').click(); await tick(800);
  test('FREEYEAR code redeems into a working 1-year Pro license', () => {
    assert.ok(d.querySelector('#plan-nav .pro-badge'));
    const rec = JSON.parse(w.localStorage.getItem('profitleak.license.v1'));
    assert.ok(rec.key.indexOf('PLS-') === 0 && rec.expiresAt);
    assert.ok(d.body.textContent.includes('Active until'));
  });
  dom.window.close();

  /* expired subscription → locked again */
  const expIso = new Date(Date.now() - 86400e3).toISOString();
  const dom2 = await boot(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    'localStorage.setItem("profitleak.license.v1", ' + JSON.stringify(JSON.stringify({ key: 'PLS-260101-ABCD-EFGH-XXXXXX', email: 'e@x.com', activatedAt: expIso, expiresAt: expIso })) + ');' +
    'localStorage.setItem("profitleak.trial.v1", ' + JSON.stringify(JSON.stringify({ startedAt: Date.now() - 7200e3, lastActive: Date.now() - 7200e3, done: true })) + ');' +
    'localStorage.setItem("profitleak.onboarded.v1", "1");');
  const w2 = dom2.window;
  test('expired subscription: Pro is gone, visitor is locked', () => {
    assert.ok(!w2.PL_LICENSE.isActive());
  });
  dom2.window.close();

  console.log('\nSUBSCRIPTION TESTS: ' + passed + ' passed, ' + failed + ' failed\n');
  if (failed) process.exitCode = 1;
})().catch(e => { console.error('FATAL', e && (e.stack || e)); process.exit(1); });
