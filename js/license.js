/* =============================================================
   ProfitLeak AI — Pro license activation (v1.8)
   Buyers receive a Gumroad license key right after purchase and
   paste it on the Pricing page. The key is verified ONCE against
   Gumroad's license API; the result is stored in the browser.
   After activation the app keeps working fully offline, exactly
   as before — no account, no server of ours, data stays local.
   ============================================================= */
(function (global) {
  'use strict';

  var LICENSE_STORAGE_KEY = 'profitleak.license.v1';

  /* ==== STORE CONNECTION ===========================================
     These two constants connect the app to your Gumroad product.
     They are filled in when the store goes live. Until then the
     license box stays hidden and the app keeps its free-preview
     upgrade flow, so nothing on the live site ever looks broken.
     ================================================================= */
  var GUMROAD_PRODUCT_ID = 'mNAS1ImGPnWRtqbqXGMn7g==';  // e.g. '32-nPAicqbLj8B_WswVlMw=='
  var GUMROAD_PRODUCT_URL = 'https://profitleakai.gumroad.com/l/profitleak-pro'; // e.g. yourname.gumroad.com/l/profitleak-pro

  /* ---------- storage (localStorage with memory fallback) ---------- */
  function storageAvailable() {
    try {
      if (typeof localStorage === 'undefined') return false;
      var k = '__profitleak_test__';
      localStorage.setItem(k, k);
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }
  var persistent = storageAvailable();
  var memoryLicense = null;

  function readLicense() {
    if (!persistent) return memoryLicense;
    try {
      var raw = localStorage.getItem(LICENSE_STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj.key !== 'string' || !obj.key) return null;
      return { key: obj.key, email: typeof obj.email === 'string' ? obj.email : '',
               activatedAt: typeof obj.activatedAt === 'string' ? obj.activatedAt : '' };
    } catch (e) {
      return null;
    }
  }

  function writeLicense(license) {
    memoryLicense = license;
    if (!persistent) return;
    try {
      if (license) localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
      else localStorage.removeItem(LICENSE_STORAGE_KEY);
    } catch (e) { /* storage blocked — keep going in memory */ }
  }

  var state = { license: readLicense() };

  /* ---------- key normalization ----------
     Gumroad keys look like 85DB562A-C11D4B06-A2335A6B-8C079166.
     Accept pastes with spaces, lowercase and stray characters. */
  function normalizeKey(k) {
    return String(k || '')
      .trim()
      .toUpperCase()
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[^A-Z0-9-]/g, '');
  }

  /* ---------- Gumroad license verify API ----------
     gumroad.com/api — one call at activation time only. */
  function verifyWithGumroad(key) {
    var body = new URLSearchParams();
    body.set('product_id', GUMROAD_PRODUCT_ID);
    body.set('license_key', key);
    body.set('increment_uses_count', 'false'); // activation may be repeated on new devices

    return fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }).then(function (res) {
      /* Gumroad answers 404 with {success:false} for unknown keys —
         that is a normal rejection, not a network problem. */
      return res.json().catch(function () { return null; }).then(function (data) {
        if (data && data.success !== true) {
          return { valid: false, reason: 'This license key was not recognized. Double-check the code from your purchase email.' };
        }
        if (!data) {
          return { valid: false, reason: 'Gumroad could not be reached (HTTP ' + res.status + '). Please try again in a moment.' };
        }
        var p = data.purchase || {};
        if (p.refunded) {
          return { valid: false, reason: 'This purchase was refunded \u2014 the license is no longer valid.' };
        }
        if (p.disputed) {
          return { valid: false, reason: 'This purchase is under payment dispute \u2014 the license cannot be activated.' };
        }
        return { valid: true, email: typeof p.email === 'string' ? p.email : '' };
      });
    });
  }

  function activate(rawKey) {
    if (!GUMROAD_PRODUCT_ID) {
      return Promise.resolve({
        ok: false,
        reason: 'License activation is not connected yet \u2014 it becomes available the moment the store goes live.'
      });
    }
    var key = normalizeKey(rawKey);
    if (key.length < 8) {
      return Promise.resolve({
        ok: false,
        reason: 'That code looks too short \u2014 copy the complete license key from your purchase email.'
      });
    }
    return verifyWithGumroad(key).then(function (r) {
      if (!r.valid) return { ok: false, reason: r.reason };
      state.license = { key: key, email: r.email, activatedAt: new Date().toISOString() };
      writeLicense(state.license);
      notify();
      return { ok: true, license: getLicense() };
    }).catch(function () {
      return { ok: false, reason: 'Activation needs an internet connection. Check your connection and try again.' };
    });
  }

  function deactivate() {
    state.license = null;
    writeLicense(null);
    notify();
  }

  function getLicense() {
    return state.license ? {
      key: state.license.key,
      email: state.license.email,
      activatedAt: state.license.activatedAt
    } : null;
  }
  function isActive() { return !!state.license; }
  function isConfigured() { return !!GUMROAD_PRODUCT_ID; }
  function buyUrl() { return GUMROAD_PRODUCT_URL; }

  /* ---------- notify the plan layer (data.js) ---------- */
  var listeners = [];
  function onChange(cb) { if (typeof cb === 'function') listeners.push(cb); }
  function notify() {
    listeners.forEach(function (cb) {
      try { cb(!!state.license); } catch (e) { /* never break activation */ }
    });
  }

  var api = {
    activate: activate,
    deactivate: deactivate,
    getLicense: getLicense,
    isActive: isActive,
    isConfigured: isConfigured,
    buyUrl: buyUrl,
    onChange: onChange,
    /* exposed for the automated tests */
    _normalizeKey: normalizeKey,
    _setStoreConnection: function (id, url) {
      GUMROAD_PRODUCT_ID = String(id || '');
      GUMROAD_PRODUCT_URL = String(url || '');
    },
    _reset: function () { deactivate(); }
  };

  global.PL_LICENSE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis);
