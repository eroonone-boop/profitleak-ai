/* =============================================================
   ProfitLeak AI — calculation & recommendation engine
   Pure functions, no DOM. Works in the browser AND in Node.js
   so every calculation is covered by automated tests.

   Core idea: TRUE profit = revenue − ALL costs
   (purchase + advertising + shipping + fees + discounts + returns)
   ============================================================= */
(function (global) {
  'use strict';

  /* ---------- Business thresholds ----------
     Each is a share of the SELLING PRICE (per unit / per sale).
     These are transparent rules of thumb — surfaced in the UI —
     never invented "market data".                              */
  var THRESHOLDS = {
    LOW_PROFIT_MARGIN_PCT: 15,  // margin below this  → 🟡 LOW PROFIT
    AD_SHARE_PCT: 20,           // advertising above this share of price → flagged
    SHIPPING_SHARE_PCT: 15,     // shipping  above this share of price → flagged
    FEES_SHARE_PCT: 15,         // platform/payment fees above this → flagged
    DISCOUNT_SHARE_PCT: 10,     // discounts above this share of price → flagged
    RETURNS_SHARE_PCT: 10       // return costs above this share → flagged
  };

  /* ---------- Formatting helpers (also used inside recommendations) ---------- */
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function money(v) {
    var r = round2(v);
    return (r < 0 ? '\u2212' : '') + usd.format(Math.abs(r));
  }

  function pct(v) { return Math.round(v) + '%'; }             // whole number, e.g. 42%
  function pct1(v) { return (Math.round(v * 10) / 10) + '%'; } // 1 decimal, e.g. 2.6%

  /* =============================================================
     1) PROFIT CALCULATION — exact formulas from the spec
     ============================================================= */
  function computeMetrics(p) {
    var units = p.unitsSold;

    var revenue          = p.sellingPrice * units;
    var purchaseTotal    = p.purchaseCost * units;
    var adTotal          = p.adCostPerSale * units;
    var shippingTotal    = p.shippingCost * units;
    var feesTotal        = p.platformFees * units;
    var discountTotal    = p.discountPerSale * units;
    var returnsTotal     = p.returnCostPerSale * units;

    var totalCost = purchaseTotal + adTotal + shippingTotal +
                    feesTotal + discountTotal + returnsTotal;

    var trueProfit       = revenue - totalCost;
    var totalCostPerUnit = units > 0 ? totalCost / units : 0;
    var profitPerUnit    = p.sellingPrice - totalCostPerUnit;
    var profitMargin     = revenue > 0 ? (trueProfit / revenue) * 100 : 0;

    return {
      units: units,
      revenue: revenue,
      purchaseTotal: purchaseTotal,
      adTotal: adTotal,
      shippingTotal: shippingTotal,
      feesTotal: feesTotal,
      discountTotal: discountTotal,
      returnsTotal: returnsTotal,
      totalCost: totalCost,
      trueProfit: trueProfit,
      totalCostPerUnit: totalCostPerUnit,
      profitPerUnit: profitPerUnit,
      profitMargin: profitMargin
    };
  }

  /* =============================================================
     2) STATUS — 🔴 losing · 🟡 low profit · 🟢 profitable
     ============================================================= */
  function getStatus(m) {
    if (m.trueProfit < 0) return 'LOSING';
    if (m.profitMargin < THRESHOLDS.LOW_PROFIT_MARGIN_PCT) return 'LOW';
    return 'PROFITABLE';
  }

  /* ---------- Per-unit cost breakdown, with share of selling price ---------- */
  function costBreakdown(p) {
    var price = p.sellingPrice || 0;
    var defs = [
      ['purchase', 'Purchase cost',      p.purchaseCost],
      ['ad',       'Advertising',        p.adCostPerSale],
      ['shipping', 'Shipping',           p.shippingCost],
      ['fees',     'Platform & fees',    p.platformFees],
      ['discount', 'Discounts',          p.discountPerSale],
      ['returns',  'Returns & refunds',  p.returnCostPerSale]
    ];
    return defs.map(function (d) {
      return {
        key: d[0],
        label: d[1],
        perUnit: d[2],
        total: d[2] * p.unitsSold,
        shareOfPrice: price > 0 ? (d[2] / price) * 100 : 0
      };
    });
  }

  /* ---------- The single biggest cost (usually the main leak) ---------- */
  function biggestCost(p) {
    var ranked = costBreakdown(p)
      .filter(function (c) { return c.perUnit > 0; })
      .sort(function (a, b) { return b.perUnit - a.perUnit; });
    return ranked.length ? ranked[0] : null;
  }

  /* =============================================================
     3) LOSS DETECTION — find the leaks, with real numbers
     ============================================================= */
  function detectIssues(p, m) {
    var issues = [];
    var price = p.sellingPrice;
    function share(v) { return price > 0 ? (v / price) * 100 : 0; }

    if (m.trueProfit < 0) {
      issues.push({
        type: 'LOSING',
        severity: 'danger',
        title: 'Losing money on every sale',
        detail: 'You lose ' + money(-m.profitPerUnit) + ' per sale. Across ' + m.units +
                ' units, that is ' + money(m.trueProfit) + ' in total losses.'
      });
    } else if (m.profitMargin < THRESHOLDS.LOW_PROFIT_MARGIN_PCT) {
      issues.push({
        type: 'LOW_MARGIN',
        severity: 'warn',
        title: 'Very thin profit margin',
        detail: 'Your profit margin is ' + pct1(m.profitMargin) + ' — below the ' +
                THRESHOLDS.LOW_PROFIT_MARGIN_PCT + '% healthy level. One small cost increase could turn this product into a loss.'
      });
    }

    var checks = [
      { type: 'HIGH_AD',       label: 'Advertising',         perUnit: p.adCostPerSale,      th: THRESHOLDS.AD_SHARE_PCT,       title: 'High advertising costs' },
      { type: 'HIGH_SHIPPING', label: 'Shipping',            perUnit: p.shippingCost,       th: THRESHOLDS.SHIPPING_SHARE_PCT, title: 'High shipping costs' },
      { type: 'HIGH_FEES',     label: 'Platform and payment fees', perUnit: p.platformFees,  th: THRESHOLDS.FEES_SHARE_PCT,     title: 'Fees eat too much of your price' },
      { type: 'HIGH_DISCOUNT', label: 'Discounts',           perUnit: p.discountPerSale,    th: THRESHOLDS.DISCOUNT_SHARE_PCT, title: 'Discounts are destroying profitability' },
      { type: 'HIGH_RETURNS',  label: 'Returns and refunds', perUnit: p.returnCostPerSale,  th: THRESHOLDS.RETURNS_SHARE_PCT,  title: 'High return costs' }
    ];

    checks.forEach(function (c) {
      var s = share(c.perUnit);
      if (s > c.th) {
        issues.push({
          type: c.type,
          severity: m.trueProfit < 0 ? 'danger' : 'warn',
          title: c.title,
          detail: c.label + ' cost you ' + money(c.perUnit) + ' per sale — ' + pct(s) +
                  ' of your selling price (healthy ceiling: ' + c.th + '%).'
        });
      }
    });

    return issues;
  }

  /* =============================================================
     4) RECOMMENDATIONS — built from the seller's own numbers
     ============================================================= */
  function buildRecommendations(p, m, issues) {
    var recs = [];
    var has = function (t) { return issues.some(function (i) { return i.type === t; }); };
    var T = THRESHOLDS.LOW_PROFIT_MARGIN_PCT;

    // Price needed to reach a given margin at current costs: cost / (1 − margin)
    function priceForMargin(marginPct) { return m.totalCostPerUnit / (1 - marginPct / 100); }

    var big = biggestCost(p);

    if (m.trueProfit < 0) {
      var gap = -m.profitPerUnit; // positive number
      recs.push('You lose ' + money(gap) + ' on every sale. At ' + m.units +
                ' units sold, that is ' + money(m.trueProfit) + ' in total losses.');
      if (big) {
        recs.push('The biggest cost causing this loss is ' + big.label.toLowerCase() + ' at ' +
                  money(big.perUnit) + ' per sale — ' + pct(big.shareOfPrice) +
                  ' of your selling price, or ' + money(big.total) + ' across all ' + m.units + ' units sold.');
        if (big.perUnit >= gap - 1e-9) {
          recs.push('The fastest fix: cut ' + big.label.toLowerCase() + ' by ' + money(gap) +
                    ' per sale (to ' + money(big.perUnit - gap) + ') and you break even — or raise your price to ' +
                    money(p.sellingPrice + gap) + ' if that cost cannot be cut.');
        } else {
          recs.push('Even cutting ' + big.label.toLowerCase() + ' to $0.00 would still leave you losing ' +
                    money(gap - big.perUnit) + ' per sale — combine cost cuts with a price increase to ' +
                    money(p.sellingPrice + gap) + ' to break even.');
        }
      } else {
        recs.push('To break even you must either raise your price by ' + money(gap) +
                  ' per unit (to ' + money(p.sellingPrice + gap) + ') or cut your costs by ' +
                  money(gap) + ' per unit.');
      }
      recs.push('If you stop losing ' + money(gap) + ' per sale, at your current volume of ' +
                m.units + ' units you avoid approximately ' + money(Math.abs(m.trueProfit)) + ' in losses.');
    } else if (m.profitMargin < T) {
      var target = priceForMargin(T);
      var cutNeeded = m.totalCostPerUnit - p.sellingPrice * (1 - T / 100);
      recs.push('If you sell this product at the current price, your estimated profit is ' +
                money(m.profitPerUnit) + ' per sale — a ' + pct1(m.profitMargin) + ' margin. That\u2019s thin.');
      if (big) {
        recs.push('Your biggest cost is ' + big.label.toLowerCase() + ' at ' + money(big.perUnit) +
                  ' per sale (' + pct(big.shareOfPrice) + ' of your price). Cutting it by ' + money(cutNeeded) +
                  ' per sale would lift your margin to ' + T + '%.');
      }
      recs.push('To reach a ' + T + '% margin, either raise your price to about ' + money(target) +
                ' or cut costs by about ' + money(cutNeeded) + ' per unit.');
    } else {
      recs.push('If you sell this product at the current price, your estimated profit is ' +
                money(m.profitPerUnit) + ' per sale — a healthy ' + pct1(m.profitMargin) +
                ' margin after all costs. This product is genuinely profitable.');
      if (big) {
        recs.push('Your biggest cost is ' + big.label.toLowerCase() + ' at ' + money(big.perUnit) +
                  ' per sale (' + pct(big.shareOfPrice) + ' of your price). Negotiating it down by 10% would add about ' +
                  money(big.total * 0.1) + ' in profit across your ' + m.units + ' units.');
      }
    }

    if (has('HIGH_AD')) {
      recs.push('Your advertising cost represents ' + pct(p.adCostPerSale / p.sellingPrice * 100) +
                ' of the selling price. Consider reducing advertising cost, increasing the selling price, or reducing the purchase cost.');
      recs.push('Cutting ad spend by 20% (to ' + money(p.adCostPerSale * 0.8) + ' per sale) would add about ' +
                money(m.adTotal * 0.2) + ' in profit across your ' + m.units + ' units.');
    }

    if (has('HIGH_SHIPPING')) {
      recs.push('Shipping takes ' + pct(p.shippingCost / p.sellingPrice * 100) + ' of your price (' +
                money(p.shippingCost) + ' per sale). Try negotiating rates, lighter packaging, or building shipping into your price — every $1 you shave off per sale keeps ' +
                money(m.units) + ' across your volume.');
    }

    if (has('HIGH_FEES')) {
      recs.push('Platform and payment fees consume ' + pct(p.platformFees / p.sellingPrice * 100) +
                ' of your selling price — ' + money(m.feesTotal) + ' across all units. Compare marketplaces or payment providers: saving just 1% in fees keeps about ' +
                money(p.sellingPrice * 0.01 * m.units) + ' in your pocket.');
    }

    if (has('HIGH_DISCOUNT')) {
      recs.push('Discounts removed ' + money(m.discountTotal) + ' of revenue (' +
                pct(p.discountPerSale / p.sellingPrice * 100) + ' per sale). Offer discounts less often, or price your product so the discounted price still makes money.');
    }

    if (has('HIGH_RETURNS')) {
      recs.push('Returns and refunds cost you ' + money(m.returnsTotal) + ' in total (' +
                money(p.returnCostPerSale) + ' per sale). Better photos, sizing charts and accurate descriptions usually cut return rates.');
    }

    if (!issues.length) {
      recs.push('No leaks detected — this product is solid. Keep an eye on costs anyway: ad prices and shipping rates tend to creep up over time.');
    }

    return recs;
  }

  /* ---------- One-line recommendation (dashboard table) ---------- */
  function shortRecommendation(p, m) {
    var big = biggestCost(p);
    var st = getStatus(m);
    if (st === 'LOSING') {
      return 'Losing ' + money(-m.profitPerUnit) + '/sale' +
        (big ? '. Biggest cost: ' + big.label.toLowerCase() + ' — ' + pct(big.shareOfPrice) + ' of price' : '') + '.';
    }
    if (st === 'LOW') {
      return 'Thin ' + pct1(m.profitMargin) + ' margin' +
        (big ? '. Biggest cost: ' + big.label.toLowerCase() + ' — ' + pct(big.shareOfPrice) + ' of price' : '') + '.';
    }
    return 'Healthy ' + pct1(m.profitMargin) + ' margin after all costs.';
  }

  /* =============================================================
     5) PORTFOLIO SUMMARY — dashboard KPIs
     ============================================================= */
  function summarizePortfolio(products) {
    var s = { count: products.length, revenue: 0, totalCost: 0, trueProfit: 0,
              losing: 0, low: 0, profitable: 0, totalLosses: 0, margin: 0 };

    products.forEach(function (p) {
      var m = computeMetrics(p);
      s.revenue += m.revenue;
      s.totalCost += m.totalCost;
      s.trueProfit += m.trueProfit;
      var st = getStatus(m);
      if (st === 'LOSING') { s.losing++; s.totalLosses += Math.abs(m.trueProfit); }
      else if (st === 'LOW') { s.low++; }
      else { s.profitable++; }
    });

    s.margin = s.revenue > 0 ? (s.trueProfit / s.revenue) * 100 : 0;
    return s;
  }

  /* ---------- Exports ---------- */
  var api = {
    THRESHOLDS: THRESHOLDS,
    round2: round2,
    money: money,
    pct: pct,
    pct1: pct1,
    computeMetrics: computeMetrics,
    getStatus: getStatus,
    costBreakdown: costBreakdown,
    biggestCost: biggestCost,
    detectIssues: detectIssues,
    buildRecommendations: buildRecommendations,
    shortRecommendation: shortRecommendation,
    summarizePortfolio: summarizePortfolio
  };

  global.PL_CALC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis);
