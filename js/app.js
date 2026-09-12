/* =============================================================
   ProfitLeak AI — application controller
   Hash-based SPA:  #/  landing ·  #/dashboard  ·  #/add  ·
   #/edit/:id  ·  #/product/:id
   ============================================================= */
(function () {
  'use strict';

  var CALC = window.PL_CALC;
  var Store = window.PL_STORE;
  var Charts = window.PL_CHARTS;

  /* ---------------- tiny helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function fmtMoney(v) {
    var r = Math.round((Number(v) + Number.EPSILON) * 100) / 100;
    return (r < 0 ? '\u2212' : '') + usd.format(Math.abs(r));
  }
  function fmtPct(v, d) {
    var n = d === 0 ? Math.round(v) : Math.round(v * 10) / 10;
    return n + '%';
  }
  function toTop() { try { window.scrollTo(0, 0); } catch (e) { /* jsdom etc. */ } }

  var STATUS_META = {
    PROFITABLE: { label: '\uD83D\uDFE2 PROFITABLE', cls: 'badge-green' },
    LOW:        { label: '\uD83D\uDFE1 LOW PROFIT', cls: 'badge-amber' },
    LOSING:     { label: '\uD83D\uDD34 LOSING MONEY', cls: 'badge-red' }
  };
  var ISSUE_ICONS = {
    LOSING: '\uD83D\uDD3A',        // 🔻
    LOW_MARGIN: '\uD83D\uDCC9',    // 📉
    HIGH_AD: '\uD83D\uDCE3',       // 📣
    HIGH_SHIPPING: '\uD83D\uDE9A', // 🚚
    HIGH_FEES: '\uD83D\uDCA4',     // 💳
    HIGH_DISCOUNT: '\uD83C\uDFF7\uFE0F', // 🏷️
    HIGH_RETURNS: '\u21A9\uFE0F'   // ↩️
  };

  var ICONS = {
    eye: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
  };

  /* ---------------- state ---------------- */
  var state = {
    products: [],
    editingId: null,
    sort: { key: 'trueProfit', dir: 'asc' } // worst profit first by default
  };

  function persist() { Store.save(state.products); }

  /* =============================================================
     ROUTER
     ============================================================= */
  function parseRoute() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h === '/') return { page: 'landing' };
    var parts = h.split('/').filter(Boolean);
    if (parts[0] === 'dashboard') return { page: 'dashboard' };
    if (parts[0] === 'add') return { page: 'form', mode: 'add' };
    if (parts[0] === 'edit') return parts[1] ? { page: 'form', mode: 'edit', id: decodeURIComponent(parts[1]) } : { page: 'dashboard' };
    if (parts[0] === 'product') return parts[1] ? { page: 'analysis', id: decodeURIComponent(parts[1]) } : { page: 'dashboard' };
    return { page: 'landing' };
  }

  function render() {
    var route = parseRoute();
    var isLanding = route.page === 'landing';

    $('#view-landing').hidden = !isLanding;
    $('#view-app').hidden = isLanding;
    $('#storage-banner').hidden = isLanding || Store.isPersistent();

    $$('.page').forEach(function (s) { s.hidden = true; });
    $('[data-nav="dashboard"]').classList.toggle('active', route.page === 'dashboard');

    if (isLanding) {
      renderLandingExample();
    } else if (route.page === 'dashboard') {
      $('#page-dashboard').hidden = false;
      renderDashboard();
    } else if (route.page === 'form') {
      $('#page-form').hidden = false;
      renderForm(route);
    } else if (route.page === 'analysis') {
      if (!renderAnalysis(route.id)) { location.hash = '#/dashboard'; return; }
      $('#page-analysis').hidden = false;
    }
    toTop();
  }

  /* =============================================================
     LANDING — real example computed by the engine itself
     ============================================================= */
  function renderLandingExample() {
    var host = $('#hero-example');
    if (!host) return;
    var p = null;
    Store.samples().forEach(function (s) { if (s.id === 'sample-phone-case') p = s; });
    if (!p) return;

    var m = CALC.computeMetrics(p);
    var naive = p.sellingPrice - p.purchaseCost;
    var total = Math.max(m.totalCostPerUnit, p.sellingPrice);

    var segs = CALC.costBreakdown(p).filter(function (c) { return c.perUnit > 0; });
    var track = segs.map(function (c) {
      var w = Math.max(c.perUnit / total * 100, 0.75);
      return '<span class="mini-seg" style="width:' + w.toFixed(2) + '%;background:' +
             Charts.COLORS[c.key] + '" title="' + esc(c.label) + ': ' + fmtMoney(c.perUnit) + ' per sale"></span>';
    }).join('');
    var markerAt = (p.sellingPrice / total * 100).toFixed(2);

    host.innerHTML = '' +
      '<div class="he-badge">Real example — one of the sample products inside the app</div>' +
      '<div class="he-grid">' +
        '<div class="he-col">' +
          '<h3>What most sellers see</h3>' +
          '<div class="he-line"><span>Selling price</span><strong>' + fmtMoney(p.sellingPrice) + '</strong></div>' +
          '<div class="he-line"><span>Product cost</span><strong>\u2212' + fmtMoney(p.purchaseCost) + '</strong></div>' +
          '<div class="he-line he-total"><span>\u201CProfit\u201D</span><strong>' + fmtMoney(naive) + '</strong></div>' +
          '<p class="he-note">Looks like a winner, right?</p>' +
        '</div>' +
        '<div class="he-col he-truth">' +
          '<h3>The truth, after ALL costs</h3>' +
          '<div class="mini-bar-wrap">' +
            '<div class="mini-bar">' + track +
              '<span class="mini-marker" style="left:' + markerAt + '%"></span>' +
            '</div>' +
            '<div class="mini-caption">your price ' + fmtMoney(p.sellingPrice) + ' vs. true cost ' + fmtMoney(m.totalCostPerUnit) + ' per sale</div>' +
          '</div>' +
          '<div class="he-line he-total he-bad"><span>True profit per sale</span><strong>' + fmtMoney(m.profitPerUnit) + '</strong></div>' +
          '<p class="he-note">\u00D7 ' + m.units + ' units sold = <strong>' + fmtMoney(m.trueProfit) + ' in real losses</strong></p>' +
        '</div>' +
      '</div>' +
      '<a class="he-cta" href="#/dashboard">Open the dashboard and analyze your own products \u2192</a>';
  }

  /* =============================================================
     DASHBOARD
     ============================================================= */
  function kpi(label, value, sub, tone) {
    return '<div class="kpi' + (tone ? ' ' + tone : '') + '">' +
             '<div class="kpi-label">' + label + '</div>' +
             '<div class="kpi-value">' + value + '</div>' +
             '<div class="kpi-sub">' + sub + '</div>' +
           '</div>';
  }

  function renderDashboard() {
    var s = CALC.summarizePortfolio(state.products);
    var T = CALC.THRESHOLDS.LOW_PROFIT_MARGIN_PCT;

    /* ----- KPI cards ----- */
    $('#kpi-grid').innerHTML = [
      kpi('Total products', s.count, 'in your dashboard', ''),
      kpi('Total revenue', fmtMoney(s.revenue), 'selling price \u00D7 units sold', ''),
      kpi('Total costs', fmtMoney(s.totalCost), 'all costs, all products', ''),
      kpi('True profit',
          '<span class="' + (s.trueProfit < 0 ? 'text-neg' : 'text-pos') + '">' + fmtMoney(s.trueProfit) + '</span>',
          fmtPct(s.margin) + ' overall margin', s.trueProfit < 0 ? 'kpi-red' : 'kpi-green'),
      kpi('Losing money', s.losing,
          s.losing ? '\u2212' + usd.format(CALC.round2(s.totalLosses)) + ' in total losses' : 'none \u2014 nice work \uD83C\uDF89',
          'kpi-red'),
      kpi('Low profit', s.low,
          s.low ? 'margin under ' + T + '% \u2014 fragile' : 'none \u2014 nice work \uD83C\uDF89',
          'kpi-amber')
    ].join('');

    /* ----- Alert banners ----- */
    var alerts = '';
    if (s.losing > 0) {
      alerts += '<div class="alert alert-red"><span class="alert-icon" aria-hidden="true">\u26A0\uFE0F</span><div>' +
                '<strong>' + s.losing + (s.losing > 1 ? ' products are' : ' product is') + ' losing money.</strong> ' +
                'At current volumes that\u2019s <strong>\u2212' + usd.format(CALC.round2(s.totalLosses)) + '</strong> in true losses. ' +
                'They\u2019re listed first in your table below.</div></div>';
    }
    if (s.low > 0) {
      alerts += '<div class="alert alert-amber"><span class="alert-icon" aria-hidden="true">\u26A0\uFE0F</span><div>' +
                '<strong>' + s.low + (s.low > 1 ? ' products have' : ' product has') + ' a low profit margin</strong> (under ' + T + '%). ' +
                'A small cost increase could push ' + (s.low > 1 ? 'them' : 'it') + ' into a loss.</div></div>';
    }
    $('#alerts').innerHTML = alerts;

    /* ----- Charts ----- */
    var rows = state.products.map(function (p) {
      return { id: p.id, name: p.name, m: CALC.computeMetrics(p) };
    }).sort(function (a, b) { return a.m.trueProfit - b.m.trueProfit; });
    $('#chart-profit').innerHTML = Charts.profitBars(rows);

    var byKey = {};
    state.products.forEach(function (p) {
      CALC.costBreakdown(p).forEach(function (c) {
        if (!byKey[c.key]) byKey[c.key] = { key: c.key, label: c.label, total: 0 };
        byKey[c.key].total += c.total;
      });
    });
    $('#chart-costs').innerHTML = Charts.costDonut(Object.keys(byKey).map(function (k) { return byKey[k]; }));

    /* ----- Table ----- */
    $('#table-wrap').innerHTML = buildTable();
  }

  function sortedRows() {
    var rows = state.products.map(function (p) { return { p: p, m: CALC.computeMetrics(p) }; });
    var key = state.sort.key, dir = state.sort.dir;
    function val(r) {
      if (key === 'name') return r.p.name.toLowerCase();
      if (key === 'sellingPrice') return r.p.sellingPrice;
      if (key === 'unitsSold') return r.p.unitsSold;
      return r.m[key];
    }
    rows.sort(function (a, b) {
      var va = val(a), vb = val(b);
      var c = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === 'asc' ? c : -c;
    });
    return rows;
  }

  function buildTable() {
    if (!state.products.length) {
      return '<div class="empty-state">' +
               '<div class="empty-icon" aria-hidden="true">\uD83D\uDCE6</div>' +
               '<h3>No products yet</h3>' +
               '<p>Add your first product, or load the sample data to explore how ProfitLeak AI works.</p>' +
               '<div class="empty-actions">' +
                 '<a class="btn btn-primary" href="#/add">+ Add your first product</a>' +
                 '<button class="btn btn-ghost" type="button" data-action="load-samples">Load sample data</button>' +
               '</div>' +
             '</div>';
    }

    var cols = [
      ['name', 'Product'], ['sellingPrice', 'Selling price'], ['unitsSold', 'Units sold'],
      ['revenue', 'Revenue'], ['totalCost', 'Total cost'], ['trueProfit', 'True profit'],
      ['profitMargin', 'Profit margin'], [null, 'Status'], [null, 'Recommendation'], [null, '']
    ];

    var head = cols.map(function (c) {
      var isNumeric = c[0] && c[0] !== 'name';
      var classes = [];
      if (c[0]) classes.push('sortable');
      if (isNumeric) classes.push('num');
      var attrs = c[0] ? ' data-sort="' + c[0] + '"' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') :
                          (classes.length ? ' class="' + classes.join(' ') + '"' : '');
      var ind = (c[0] && state.sort.key === c[0])
        ? '<span class="sort-ind">' + (state.sort.dir === 'asc' ? '\u25B2' : '\u25BC') + '</span>' : '';
      return '<th scope="col"' + attrs + '>' + c[1] + ind + '</th>';
    }).join('');

    var body = sortedRows().map(rowHtml).join('');

    return '<table class="data-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function rowHtml(row) {
    var p = row.p, m = row.m;
    var meta = STATUS_META[CALC.getStatus(m)];
    var rec0 = CALC.shortRecommendation(p, m);
    var profitCls = m.trueProfit < 0 ? 'text-neg' : 'text-pos';

    return '<tr class="clickable" data-id="' + esc(p.id) + '" tabindex="0" role="button" ' +
             'aria-label="View analysis for ' + esc(p.name) + '">' +
      '<td data-label="Product"><span class="p-name">' + esc(p.name) + '</span></td>' +
      '<td data-label="Selling price" class="num">' + fmtMoney(p.sellingPrice) + '</td>' +
      '<td data-label="Units sold" class="num">' + m.units + '</td>' +
      '<td data-label="Revenue" class="num">' + fmtMoney(m.revenue) + '</td>' +
      '<td data-label="Total cost" class="num">\u2212' + fmtMoney(m.totalCost) + '</td>' +
      '<td data-label="True profit" class="num"><strong class="' + profitCls + '">' + fmtMoney(m.trueProfit) + '</strong></td>' +
      '<td data-label="Profit margin" class="num">' + fmtPct(m.profitMargin) + '</td>' +
      '<td data-label="Status"><span class="badge ' + meta.cls + '">' + meta.label + '</span></td>' +
      '<td data-label="Recommendation"><div class="cell-rec">' + esc(rec0) + '</div></td>' +
      '<td data-label="Actions" class="row-actions">' +
        '<button class="icon-btn" type="button" data-action="view" data-id="' + esc(p.id) + '" aria-label="View ' + esc(p.name) + '" title="View analysis">' + ICONS.eye + '</button>' +
        '<button class="icon-btn" type="button" data-action="edit" data-id="' + esc(p.id) + '" aria-label="Edit ' + esc(p.name) + '" title="Edit product">' + ICONS.pencil + '</button>' +
        '<button class="icon-btn icon-btn-danger" type="button" data-action="delete" data-id="' + esc(p.id) + '" aria-label="Delete ' + esc(p.name) + '" title="Delete product">' + ICONS.trash + '</button>' +
      '</td>' +
    '</tr>';
  }

  /* =============================================================
     ADD / EDIT PRODUCT FORM
     ============================================================= */
  var FORM_FIELDS = [
    ['f-name', 'name', 'text'],
    ['f-price', 'sellingPrice', 'number'],
    ['f-units', 'unitsSold', 'number'],
    ['f-purchase', 'purchaseCost', 'number'],
    ['f-ad', 'adCostPerSale', 'number'],
    ['f-ship', 'shippingCost', 'number'],
    ['f-fees', 'platformFees', 'number'],
    ['f-discount', 'discountPerSale', 'number'],
    ['f-returns', 'returnCostPerSale', 'number']
  ];

  function renderForm(route) {
    var form = $('#product-form');
    form.reset();

    if (route.mode === 'edit') {
      var p = null;
      state.products.forEach(function (x) { if (x.id === route.id) p = x; });
      if (!p) { location.hash = '#/dashboard'; return; }
      state.editingId = p.id;
      $('#form-title').textContent = 'Edit product';
      $('#form-subtitle').textContent = 'Update the numbers for \u201C' + p.name + '\u201D.';
      $('#form-submit').textContent = 'Update product';
      $('#f-name').value = p.name;
      $('#f-price').value = p.sellingPrice;
      $('#f-units').value = p.unitsSold;
      $('#f-purchase').value = p.purchaseCost;
      $('#f-ad').value = p.adCostPerSale;
      $('#f-ship').value = p.shippingCost;
      $('#f-fees').value = p.platformFees;
      $('#f-discount').value = p.discountPerSale;
      $('#f-returns').value = p.returnCostPerSale;
    } else {
      state.editingId = null;
      $('#form-title').textContent = 'Add product';
      $('#form-subtitle').textContent = 'Enter your product\u2019s numbers. Fields marked \u201Cper sale\u201D are the cost for one single order.';
      $('#form-submit').textContent = 'Save product';
    }
    clearAllErrors();
    updateLivePreview();
  }

  function readForm() {
    var d = {};
    FORM_FIELDS.forEach(function (f) {
      var el = document.getElementById(f[0]);
      d[f[1]] = f[2] === 'text' ? el.value.trim() : (el.value === '' ? '' : Number(el.value));
    });
    return d;
  }

  function validateForm(d) {
    var errors = {};
    var moneyKeys = ['sellingPrice', 'purchaseCost', 'adCostPerSale', 'shippingCost',
                     'platformFees', 'discountPerSale', 'returnCostPerSale'];

    if (!d.name) errors.name = 'Please enter a product name.';

    moneyKeys.forEach(function (key) {
      var v = d[key];
      if (v === '') v = key === 'sellingPrice' ? NaN : 0; // empty costs count as $0
      if (!isFinite(v)) {
        errors[key] = key === 'sellingPrice' ? 'Enter the price your customer pays (greater than $0).' : 'Enter a valid number.';
      } else if (v < 0) {
        errors[key] = 'This amount cannot be negative.';
      } else {
        d[key] = v;
      }
      if (key === 'sellingPrice' && isFinite(v) && v <= 0 && !errors[key]) {
        errors[key] = 'Enter the price your customer pays (greater than $0).';
      }
    });

    var u = d.unitsSold;
    if (u === '' || !isFinite(u)) errors.unitsSold = 'Enter how many units you sold.';
    else if (u < 1) errors.unitsSold = 'Units sold must be at least 1.';
    else if (!Number.isInteger(u)) errors.unitsSold = 'Units must be a whole number.';
    else d.unitsSold = u;

    return errors;
  }

  function showErrors(errors) {
    $$('.field', $('#product-form')).forEach(function (field) {
      var key = field.getAttribute('data-field');
      var msg = errors[key] || '';
      field.classList.toggle('has-error', !!msg);
      var p = field.querySelector('[data-error="' + key + '"]');
      if (p) p.textContent = msg;
    });
  }

  function clearAllErrors() {
    $$('.field.has-error', $('#product-form')).forEach(function (field) {
      field.classList.remove('has-error');
      var p = field.querySelector('.field-error');
      if (p) p.textContent = '';
    });
  }

  function updateLivePreview() {
    var d = readForm();
    var moneyOk = ['purchaseCost', 'adCostPerSale', 'shippingCost', 'platformFees',
                   'discountPerSale', 'returnCostPerSale'].every(function (k) {
      return d[k] === '' || (isFinite(d[k]) && d[k] >= 0);
    });
    var valid = moneyOk &&
                isFinite(d.sellingPrice) && d.sellingPrice > 0 &&
                isFinite(d.unitsSold) && d.unitsSold >= 1 && Number.isInteger(d.unitsSold);

    if (!valid) {
      $('#lp-rows').innerHTML =
        '<div class="lp-row"><span>Revenue</span><span>\u2014</span></div>' +
        '<div class="lp-row"><span>Total cost</span><span>\u2014</span></div>' +
        '<div class="lp-row"><span>True profit</span><span>\u2014</span></div>' +
        '<div class="lp-row"><span>Profit per unit</span><span>\u2014</span></div>' +
        '<div class="lp-row"><span>Profit margin</span><span>\u2014</span></div>';
      $('#lp-status').innerHTML = '<p class="lp-hint">Enter a selling price and units sold to see the numbers.</p>';
      return;
    }

    var p = {
      sellingPrice: d.sellingPrice, purchaseCost: d.purchaseCost || 0,
      adCostPerSale: d.adCostPerSale || 0, shippingCost: d.shippingCost || 0,
      platformFees: d.platformFees || 0, discountPerSale: d.discountPerSale || 0,
      returnCostPerSale: d.returnCostPerSale || 0, unitsSold: d.unitsSold
    };
    var m = CALC.computeMetrics(p);
    var meta = STATUS_META[CALC.getStatus(m)];
    var cls = m.trueProfit < 0 ? 'text-neg' : 'text-pos';

    $('#lp-rows').innerHTML =
      '<div class="lp-row"><span>Revenue</span><span>' + fmtMoney(m.revenue) + '</span></div>' +
      '<div class="lp-row"><span>Total cost</span><span>\u2212' + fmtMoney(m.totalCost) + '</span></div>' +
      '<div class="lp-row lp-strong"><span>True profit</span><span class="' + cls + '">' + fmtMoney(m.trueProfit) + '</span></div>' +
      '<div class="lp-row"><span>Profit per unit</span><span class="' + cls + '">' + fmtMoney(m.profitPerUnit) + '</span></div>' +
      '<div class="lp-row"><span>Profit margin</span><span>' + fmtPct(m.profitMargin) + '</span></div>';
    $('#lp-status').innerHTML = '<span class="badge ' + meta.cls + '">' + meta.label + '</span>';
  }

  function onFormSubmit(e) {
    e.preventDefault();
    var d = readForm();
    var errors = validateForm(d);
    showErrors(errors);

    if (Object.keys(errors).length) {
      var first = $('#product-form .has-error input');
      if (first) first.focus();
      return;
    }

    if (state.editingId) {
      state.products.forEach(function (p) {
        if (p.id === state.editingId) Object.assign(p, d);
      });
      persist();
      toast('\u201C' + esc(d.name) + '\u201D updated \u2713');
    } else {
      state.products.push(Object.assign({ id: Store.uid(), createdAt: new Date().toISOString() }, d));
      persist();
      toast('\u201C' + esc(d.name) + '\u201D added \u2713');
    }
    location.hash = '#/dashboard';
  }

  /* =============================================================
     PRODUCT ANALYSIS PAGE
     ============================================================= */
  function renderAnalysis(id) {
    var p = null;
    state.products.forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return false;

    var m = CALC.computeMetrics(p);
    var meta = STATUS_META[CALC.getStatus(m)];
    var issues = CALC.detectIssues(p, m);
    var recs = CALC.buildRecommendations(p, m, issues);

    /* --- header --- */
    $('#analysis-head').innerHTML =
      '<a class="back-link" href="#/dashboard">\u2190 All products</a>' +
      '<div class="an-head-main">' +
        '<div>' +
          '<h1>' + esc(p.name) + '</h1>' +
          '<p class="analysis-meta">' + m.units + ' units sold \u00B7 ' + fmtMoney(p.sellingPrice) + ' selling price</p>' +
        '</div>' +
        '<div class="an-head-actions">' +
          '<span class="badge ' + meta.cls + '">' + meta.label + '</span>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="edit" data-id="' + esc(p.id) + '">Edit</button>' +
          '<button class="btn btn-ghost btn-sm danger-text" type="button" data-action="delete" data-id="' + esc(p.id) + '">Delete</button>' +
        '</div>' +
      '</div>';

    /* --- headline stats --- */
    function stat(label, value, sub, cls) {
      return '<div class="stat-tile' + (cls ? ' ' + cls : '') + '">' +
               '<div class="stat-label">' + label + '</div>' +
               '<div class="stat-value">' + value + '</div>' +
               '<div class="stat-sub">' + sub + '</div>' +
             '</div>';
    }
    var profitCls = m.trueProfit < 0 ? 'text-neg' : 'text-pos';
    $('#analysis-stats').innerHTML =
      stat('True profit', '<span class="' + profitCls + '">' + fmtMoney(m.trueProfit) + '</span>',
           'revenue \u2212 all costs', m.trueProfit < 0 ? 'stat-red' : 'stat-green') +
      stat('Profit per unit', '<span class="' + profitCls + '">' + fmtMoney(m.profitPerUnit) + '</span>',
           'per single sale', m.trueProfit < 0 ? 'stat-red' : 'stat-green') +
      stat('Profit margin', fmtPct(m.profitMargin), 'true profit \u00F7 revenue') +
      stat('Break-even price', fmtMoney(m.totalCostPerUnit), 'price that covers all costs');

    /* --- the numbers table --- */
    function pctOfRev(v) { return m.revenue > 0 ? fmtPct(v / m.revenue * 100, 0) : '\u2014'; }
    var rowsHtml = CALC.costBreakdown(p).map(function (c) {
      return '<tr><td>' + c.label + '</td>' +
        '<td class="num" data-label="Total">\u2212' + fmtMoney(c.total) + '</td>' +
        '<td class="num" data-label="Per unit">\u2212' + fmtMoney(c.perUnit) + '</td>' +
        '<td class="num" data-label="% of revenue">' + pctOfRev(c.total) + '</td></tr>';
    }).join('');

    $('#analysis-numbers').innerHTML =
      '<table class="numbers-table">' +
        '<thead><tr><th scope="col">Item</th><th scope="col" class="num">Total</th>' +
        '<th scope="col" class="num">Per unit</th><th scope="col" class="num">% of revenue</th></tr></thead>' +
        '<tbody>' +
          '<tr class="rev-row"><td>Revenue</td><td class="num" data-label="Total">' + fmtMoney(m.revenue) + '</td>' +
            '<td class="num" data-label="Per unit">' + fmtMoney(p.sellingPrice) + '</td><td class="num" data-label="% of revenue">100%</td></tr>' +
          rowsHtml +
          '<tr class="total-row"><td>Total cost</td><td class="num" data-label="Total">\u2212' + fmtMoney(m.totalCost) + '</td>' +
            '<td class="num" data-label="Per unit">\u2212' + fmtMoney(m.totalCostPerUnit) + '</td><td class="num" data-label="% of revenue">' + pctOfRev(m.totalCost) + '</td></tr>' +
          '<tr class="profit-row"><td>True profit</td><td class="num" data-label="Total"><strong class="' + profitCls + '">' + fmtMoney(m.trueProfit) + '</strong></td>' +
            '<td class="num" data-label="Per unit"><strong class="' + profitCls + '">' + fmtMoney(m.profitPerUnit) + '</strong></td>' +
            '<td class="num" data-label="% of revenue"><strong>' + fmtPct(m.profitMargin) + '</strong></td></tr>' +
        '</tbody>' +
      '</table>';

    /* --- unit economics bar --- */
    $('#analysis-bar').innerHTML = Charts.unitBar(p, m);

    /* --- where are you losing money? --- */
    if (issues.length) {
      var rankBlock =
        '<div class="rank-block">' +
          '<p class="rank-block-title">Your costs, ranked — #1 is your biggest cost</p>' +
          Charts.costRanking(p) +
        '</div>';
      $('#analysis-issues').innerHTML = rankBlock + issues.map(function (i) {
        var cls = i.severity === 'danger' ? 'finding-danger' : 'finding-warn';
        return '<div class="finding ' + cls + '">' +
                 '<span class="finding-icon" aria-hidden="true">' + (ISSUE_ICONS[i.type] || '\u26A0\uFE0F') + '</span>' +
                 '<div><h3>' + esc(i.title) + '</h3><p>' + esc(i.detail) + '</p></div>' +
               '</div>';
      }).join('');
    } else {
      $('#analysis-issues').innerHTML =
        '<div class="finding finding-ok">' +
          '<span class="finding-icon" aria-hidden="true">\u2705</span>' +
          '<div><h3>No leaks detected</h3><p>All costs are within healthy limits. This product keeps a ' +
          fmtPct(m.profitMargin) + ' margin after every single cost.</p></div>' +
        '</div>';
    }

    /* --- what should you change? --- */
    $('#analysis-recs').innerHTML = recs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');

    return true;
  }

  /* =============================================================
     ACTIONS — delete / samples / clear all (with undo + confirm)
     ============================================================= */
  function requestDelete(id) {
    var p = null;
    state.products.forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return;

    confirmDialog({
      title: 'Delete \u201C' + p.name + '\u201D?',
      message: 'This removes the product from your dashboard. You can undo it right after deleting.',
      confirmText: 'Delete',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var snapshot = state.products.slice();
      state.products = state.products.filter(function (x) { return x.id !== id; });
      persist();

      var route = parseRoute();
      if (route.page === 'analysis' && route.id === id) {
        location.hash = '#/dashboard'; // triggers render via hashchange
      } else {
        render();
      }
      toast('\u201C' + esc(p.name) + '\u201D deleted', {
        actionLabel: 'Undo',
        onAction: function () {
          state.products = snapshot;
          persist();
          render();
          toast('Restored \u2713');
        }
      });
    });
  }

  function loadSamplesFlow() {
    var proceed = Promise.resolve(true);
    if (state.products.length) {
      proceed = confirmDialog({
        title: 'Replace current products?',
        message: 'This will replace your ' + state.products.length +
                 ' product(s) with the 6 built-in sample products.',
        confirmText: 'Replace with samples'
      });
    }
    proceed.then(function (ok) {
      if (!ok) return;
      state.products = Store.samples();
      persist();
      render();
      toast('Sample products loaded \u2713');
    });
  }

  function clearAllFlow() {
    confirmDialog({
      title: 'Clear all products?',
      message: 'This removes every product from your dashboard. You can undo it right after.',
      confirmText: 'Clear all',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var snapshot = state.products.slice();
      state.products = [];
      persist();
      render();
      toast('All products cleared', {
        actionLabel: 'Undo',
        onAction: function () {
          state.products = snapshot;
          persist();
          render();
          toast('Restored \u2713');
        }
      });
    });
  }

  /* =============================================================
     TOASTS + CONFIRM DIALOG
     ============================================================= */
  function toast(message, opts) {
    opts = opts || {};
    var host = $('#toast-container');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="toast-msg">' + message + '</span>' +
      (opts.actionLabel ? '<button type="button" class="toast-action">' + esc(opts.actionLabel) + '</button>' : '') +
      '<button type="button" class="toast-close" aria-label="Dismiss">\u00D7</button>';
    host.appendChild(el);

    var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    raf(function () { el.classList.add('show'); });

    var closed = false;
    function dismiss() {
      if (closed) return;
      closed = true;
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }
    var timer = setTimeout(dismiss, opts.timeout || 6000);

    el.querySelector('.toast-close').addEventListener('click', dismiss);
    var act = el.querySelector('.toast-action');
    if (act) {
      act.addEventListener('click', function () {
        clearTimeout(timer);
        dismiss();
        if (opts.onAction) opts.onAction();
      });
    }
  }

  var modalCleanup = null;

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var overlay = $('#modal-overlay');
      var confirmBtn = $('#modal-confirm');
      var cancelBtn = $('#modal-cancel');

      $('#modal-title').textContent = opts.title || 'Are you sure?';
      $('#modal-message').textContent = opts.message || '';
      confirmBtn.textContent = opts.confirmText || 'Confirm';
      confirmBtn.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      overlay.hidden = false;
      document.body.classList.add('modal-open');
      confirmBtn.focus();

      function close(val) {
        overlay.hidden = true;
        document.body.classList.remove('modal-open');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        document.removeEventListener('keydown', onKey);
        modalCleanup = null;
        resolve(val);
      }
      function onConfirm() { close(true); }
      function onCancel() { close(false); }
      function onOverlay(e) { if (e.target === overlay) close(false); }
      function onKey(e) { if (e.key === 'Escape') close(false); }

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
      document.addEventListener('keydown', onKey);
      modalCleanup = function () { close(false); };
    });
  }

  /* =============================================================
     GLOBAL EVENTS (delegation)
     ============================================================= */
  function onGlobalClick(e) {
    var actionEl = e.target.closest ? e.target.closest('[data-action]') : null;
    if (actionEl) {
      var act = actionEl.getAttribute('data-action');
      var id = actionEl.getAttribute('data-id');
      if (act === 'delete') { e.preventDefault(); e.stopPropagation(); requestDelete(id); }
      else if (act === 'edit') { e.preventDefault(); location.hash = '#/edit/' + encodeURIComponent(id); }
      else if (act === 'view') { e.preventDefault(); location.hash = '#/product/' + encodeURIComponent(id); }
      else if (act === 'load-samples') { loadSamplesFlow(); }
      else if (act === 'clear-all') { clearAllFlow(); }
      return;
    }

    var th = e.target.closest ? e.target.closest('th[data-sort]') : null;
    if (th) {
      var key = th.getAttribute('data-sort');
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = { key: key, dir: key === 'name' ? 'asc' : 'desc' };
      }
      renderDashboard();
      return;
    }

    var row = e.target.closest ? e.target.closest('tr.clickable') : null;
    if (row) location.hash = '#/product/' + encodeURIComponent(row.getAttribute('data-id'));
  }

  function onGlobalKeydown(e) {
    if (e.key === 'Escape' && modalCleanup) { modalCleanup(); return; }
    var row = e.target.closest && e.target.closest('tr.clickable');
    if (row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      location.hash = '#/product/' + encodeURIComponent(row.getAttribute('data-id'));
    }
  }

  /* =============================================================
     INIT
     ============================================================= */
  function init() {
    state.products = Store.load();

    $('#product-form').addEventListener('submit', onFormSubmit);
    $('#product-form').addEventListener('input', function (e) {
      var field = e.target.closest('.field');
      if (field && field.classList.contains('has-error')) {
        field.classList.remove('has-error');
        var p = field.querySelector('.field-error');
        if (p) p.textContent = '';
      }
      updateLivePreview();
    });

    document.addEventListener('click', onGlobalClick);
    document.addEventListener('keydown', onGlobalKeydown);
    window.addEventListener('hashchange', render);

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
