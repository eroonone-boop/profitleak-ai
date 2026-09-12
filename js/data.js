/* =============================================================
   ProfitLeak AI — data layer
   - Sample products (so the app is useful the moment it opens)
   - Safe localStorage wrapper (falls back to memory when storage
     is blocked, e.g. inside sandboxed preview iframes)
   - Tiny CRUD helpers used by the UI
   No DOM usage here, so this file also loads cleanly in Node.js
   for automated tests.
   ============================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'profitleak.products.v1';
  var SEED_KEY = 'profitleak.seeded.v1';

  /* ---------- Sample products ----------
     Deliberately cover every status and every type of "leak":
     🟢 profitable · 🟡 low profit · 🔴 losing money
     (high ads / high shipping / fees / discounts / returns)      */
  var SAMPLE_PRODUCTS = [
    {
      id: 'sample-earbuds', name: 'Wireless Earbuds Pro',
      sellingPrice: 49.99, purchaseCost: 18.50, adCostPerSale: 6.00,
      shippingCost: 4.50, platformFees: 7.00, discountPerSale: 2.00,
      returnCostPerSale: 1.50, unitsSold: 320,
      createdAt: '2026-09-01T09:00:00.000Z'
    },
    {
      id: 'sample-yoga-mat', name: 'Eco Yoga Mat',
      sellingPrice: 39.00, purchaseCost: 13.00, adCostPerSale: 7.50,
      shippingCost: 6.50, platformFees: 6.00, discountPerSale: 4.00,
      returnCostPerSale: 1.00, unitsSold: 150,
      createdAt: '2026-09-01T09:05:00.000Z'
    },
    {
      id: 'sample-phone-case', name: 'Clear Phone Case',
      sellingPrice: 12.99, purchaseCost: 3.00, adCostPerSale: 5.50,
      shippingCost: 2.50, platformFees: 1.95, discountPerSale: 0.50,
      returnCostPerSale: 0.30, unitsSold: 500,
      createdAt: '2026-09-01T09:10:00.000Z'
    },
    {
      id: 'sample-candle', name: 'Lavender Candle Set',
      sellingPrice: 29.00, purchaseCost: 10.00, adCostPerSale: 4.00,
      shippingCost: 9.50, platformFees: 4.00, discountPerSale: 0.00,
      returnCostPerSale: 2.50, unitsSold: 210,
      createdAt: '2026-09-01T09:15:00.000Z'
    },
    {
      id: 'sample-speaker', name: 'Mini Bluetooth Speaker',
      sellingPrice: 39.99, purchaseCost: 15.00, adCostPerSale: 9.00,
      shippingCost: 5.00, platformFees: 5.25, discountPerSale: 2.00,
      returnCostPerSale: 1.25, unitsSold: 260,
      createdAt: '2026-09-01T09:20:00.000Z'
    },
    {
      id: 'sample-baking-mats', name: 'Silicone Baking Mat Set',
      sellingPrice: 24.99, purchaseCost: 7.50, adCostPerSale: 3.00,
      shippingCost: 3.50, platformFees: 3.60, discountPerSale: 0.00,
      returnCostPerSale: 0.75, unitsSold: 430,
      createdAt: '2026-09-01T09:25:00.000Z'
    }
  ];

  /* ---------- Detect whether browser storage is usable ----------
     In sandboxed iframes (e.g. embedded previews) even *touching*
     localStorage can throw a SecurityError — so wrap everything. */
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
  var memory = null; // fallback used when localStorage is blocked

  /* ---------- Sanitize products loaded from storage ---------- */
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) && n >= 0 ? n : fallback;
  }

  function sanitizeProduct(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var price = Number(raw.sellingPrice);
    var units = Number(raw.unitsSold);
    if (!isFinite(price) || price <= 0) return null;      // unusable entry
    if (!isFinite(units) || units < 1) units = 1;
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      name: String(raw.name || 'Unnamed product').slice(0, 120),
      sellingPrice: price,
      purchaseCost: num(raw.purchaseCost, 0),
      adCostPerSale: num(raw.adCostPerSale, 0),
      shippingCost: num(raw.shippingCost, 0),
      platformFees: num(raw.platformFees, 0),
      discountPerSale: num(raw.discountPerSale, 0),
      returnCostPerSale: num(raw.returnCostPerSale, 0),
      unitsSold: Math.round(units),
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
    };
  }

  function uid() {
    try {
      if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    } catch (e) { /* fall through */ }
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function samples() {
    return SAMPLE_PRODUCTS.map(function (p) {
      return Object.assign({}, p);
    });
  }

  /* ---------- Public store API ---------- */
  var Store = {

    /** True when products persist in localStorage; false in preview/memory mode. */
    isPersistent: function () { return persistent; },

    /** Load products; seeds sample data on very first visit. */
    load: function () {
      if (!persistent) {
        return memory ? memory.slice() : samples();
      }
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          var arr = JSON.parse(raw);
          if (!Array.isArray(arr)) return samples();
          return arr.map(sanitizeProduct).filter(Boolean);
        }
        // No saved products yet: seed samples on the very first visit only.
        if (!localStorage.getItem(SEED_KEY)) {
          var seeded = samples();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          localStorage.setItem(SEED_KEY, '1');
          return seeded;
        }
        return []; // user cleared their data on a previous visit
      } catch (e) {
        return samples();
      }
    },

    /** Persist the products array. */
    save: function (products) {
      memory = products.slice();
      if (!persistent) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      } catch (e) { /* storage full or blocked — keep going in memory */ }
    },

    samples: samples,
    uid: uid
  };

  global.PL_STORE = Store;

  /* Node.js export (used by the automated tests) */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Store: Store, SAMPLE_PRODUCTS: SAMPLE_PRODUCTS };
  }

})(typeof window !== 'undefined' ? window : globalThis);
