# 💧 ProfitLeak AI

**You're making sales. But are you actually making money?**

ProfitLeak AI is a small SaaS MVP that helps online sellers discover where they're
losing money on individual products. You enter a product's financial numbers, and it
calculates the **TRUE profit after all costs** — purchase, advertising, shipping,
platform/payment fees, discounts and returns — then identifies hidden losses and
gives simple, number-based recommendations.

No signup. No backend. Your data is stored locally in your browser.

---

## ✨ Features (v1)

| Feature | What it does |
|---|---|
| 📊 **Dashboard** | Total products, revenue, costs, true profit, products losing money, low-profit products |
| ➕ **Add product** | 9 fields: price, purchase cost, ads/sale, shipping, fees, discount, returns, units sold |
| 🧮 **True profit engine** | Every cost is counted — never just "price minus product cost" |
| 🚨 **Loss detection** | Flags losing products, thin margins, high ad / shipping / fee / discount / return costs |
| 💡 **Recommendations** | Names the biggest cost causing each loss, with exact amounts, break-even prices and avoidable losses from *your* numbers |
| 🥇 **Cost ranking** | Every product's costs ranked biggest-first — the #1 leak is highlighted |
| 🩺 **Smart Profit Diagnosis** | Names your biggest profit leak with its exact **share of total costs**, a practical action, and a plain-English diagnosis sentence |
| 🎛️ **What-If Simulator** | Sliders for the price **and all six costs** — instantly see the profit impact ("improves by $X" / "reduces by $Y"), then apply with one click |
| 🎯 **Profit Goal** | Type a target profit per sale and see the exact price to charge or cost cut that reaches it |
| 📋 **Product table** | Sortable, with clear statuses: 🟢 PROFITABLE · 🟡 LOW PROFIT · 🔴 LOSING MONEY |
| 🔎 **Status filters** | All / Losing money / Low profit / Profitable, with live counts |
| 🔍 **Product analysis** | Full breakdown + "Where are you losing money?" + "What should you change?" |
| 📈 **Charts** | Profit-by-product bars and a "where your money goes" cost donut |
| 👋 **First-time onboarding** | Welcome screen with 3 simple steps, one-click **Try Demo Data** (clearly labeled), safe **Clear Demo Data**, plain-language metric help and a friendly empty state |
| 📄 **Profit Report** | One-click professional report: business summary, top 5 performers, biggest losses, profit leaks by category, smart recommendations — printable / save as PDF |
| 📤 **CSV import with preview** | Upload a CSV → preview each product's true profit & status, see clear per-row validation errors, then press “Import Products” — plus a downloadable template and CSV export |
| 💳 **FREE + PRO plans** | Free tier (3 products, basic diagnosis) + Pro tier (unlimited products, simulator, cost ranking, profit goals) with a pricing page — no payments connected yet |
| 📱 **Responsive** | Works on desktop, tablet and mobile |
| 💾 **Local data** | Stored in your browser (localStorage); sample products on first launch |

## 💳 Pricing (FREE + PRO)

ProfitLeak AI ships with a ready-to-monetize plan structure (v1.4). No authentication
and no payment provider are connected yet — by design.

| | FREE | PRO ($9/month at launch) |
|---|---|---|
| Products | Up to 3 | Unlimited |
| True profit calculator | ✅ | ✅ |
| Basic diagnosis (biggest leak + action) | ✅ | ✅ |
| Dashboard, table, filters, CSV | ✅ | ✅ |
| Advanced diagnosis + cost ranking | 🔒 | ✅ |
| What-If Simulator + Profit Goal | 🔒 | ✅ |
| Marketplace integrations | — | 🔜 coming soon |

- The plan is a local flag (`profitleak.plan.v1` in localStorage) — no accounts needed.
- **Upgrade to Pro** buttons open a "Pro is coming soon" dialog which also offers
  **free preview access**, so every feature stays usable until the paid launch.
- Users who exceed the free limit keep their data — adding is simply gated.
- New users get the welcome tour and start clean; **Try Demo Data** loads 3 products on Free (one 🟢, one 🟡, one 🔴) or all 6 on Pro, clearly labeled and removable in one click.

## 👋 Onboarding (first-run experience)

A brand-new user is greeted with a welcome screen — “Welcome to ProfitLeak AI · Find out
where your products are making money — and where they're losing it” — plus three simple
steps (**Add your products → Analyze your true profit → Discover what you should change**)
and two buttons: **Get Started** and **Try Demo Data**.

- **Try Demo Data** loads realistic sample products instantly (3 on Free, all 6 on Pro)
- Demo products carry a visible **Demo Data** badge in the table and on the analysis page
- **Clear Demo Data** removes only the demo products — your own products are never touched
  (with confirmation + Undo)
- The dashboard's key metrics have **? help buttons** with plain-language explanations
  (revenue, costs, true profit, losing products, low profit, biggest leak) — they work on
  touch and desktop
- An empty dashboard shows: “No products yet. Add your first product or try the demo.”
- The welcome appears only once (flag in localStorage); returning users go straight to their data

## 🚀 How to run it

You have three easy options — **no coding needed**:

1. **Double-click `ProfitLeak-AI.html`** — the whole app in one portable file. Nothing to install.
2. **Open `index.html`** in your browser (needs the `css/` and `js/` folders next to it — keep the folder structure).
3. **Host it** (e.g. GitHub Pages, Netlify, Vercel): upload the project folder; `index.html` is the entry point. No build step, no server code.

> First launch comes with 6 sample products so you can explore immediately.
> Use **Load sample data** / **Clear all** on the dashboard to reset anytime.

## 📨 Profit Report

The **Generate Report** button (dashboard) builds a professional report from your
actual product data and shows the generation date:

1. **Business summary** — products, revenue, costs, true profit, overall margin, profitable & losing counts
2. **Top performers** — the 5 most profitable products
3. **Biggest losses** — up to 5 products with the largest losses + each one's biggest cost
4. **Profit leaks** — all six cost categories aggregated across products, biggest first with % of total costs
5. **Smart recommendations** — generated only from your numbers (e.g. “Your largest cost category is purchase cost at $18,595.00 — 38% of all your costs”)

**Download Report** opens your browser's print dialog — choose **Save as PDF**.
The print layout is a clean A4 document (app chrome hidden, no broken rows).
No paid APIs, no authentication: everything is computed locally.

## 📄 CSV import format

The importer reads a header row plus your products, one per line:

```
Name, Selling Price, Purchase Cost, Ad Cost per Sale, Shipping Cost,
Platform Fees, Discount per Sale, Return Cost per Sale, Units Sold
```

- Required columns: **Name, Selling Price, Units Sold** (missing ones are listed for you)
- Missing cost columns / blank cells count as $0
- Lower-case and alternative headers (e.g. `price`, `units`) are accepted
- Every invalid row is skipped *and explained* (“Row 4 — Missing product name”)
- **CSV template** button on the dashboard downloads a ready-to-fill example
- Free plan: imports stop at 3 products (with a clear notice); Pro: unlimited

## 🧮 How the math works

For every product:

```
Revenue            = Selling Price × Units Sold
Purchase total     = Purchase Cost × Units
Advertising total  = Ad Cost per Sale × Units
Shipping total     = Shipping Cost × Units
Fees total         = Platform/Payment Fees × Units
Discount total     = Discount per Sale × Units
Returns total      = Return/Refund Cost per Sale × Units

Total Cost  = Purchase + Advertising + Shipping + Fees + Discount + Returns
True Profit = Revenue − Total Cost
Profit/Unit = Selling Price − Total Cost per Unit
Margin      = True Profit ÷ Revenue × 100
```

## 🚦 Statuses & thresholds

| Status | Rule |
|---|---|
| 🔴 LOSING MONEY | True profit < 0 |
| 🟡 LOW PROFIT | Margin below 15% |
| 🟢 PROFITABLE | Margin ≥ 15% |

A cost is flagged as a "leak" when its share of the selling price exceeds:
**ads 20% · shipping 15% · fees 15% · discounts 10% · returns 10%**.
These are transparent rules of thumb (visible in `js/calc.js`), not market data —
every recommendation quotes the actual numbers you entered.

## 💾 Where is my data?

In your browser's localStorage (key `profitleak.products.v1`). It never leaves your
device. Clearing your browser data removes it — there is no server, by design.
If storage is blocked (e.g. inside a sandboxed preview), the app shows a
"preview mode" notice and keeps data in memory for the session.

## 📁 Project structure

```
profitleak-ai/
├── index.html              ← the app (landing + dashboard + form + analysis)
├── ProfitLeak-AI.html      ← single-file build (auto-generated — just open it)
├── css/
│   └── styles.css          ← all styling, responsive design
├── js/
│   ├── data.js             ← storage (localStorage) + 6 sample products
│   ├── calc.js             ← calculation, loss detection & recommendation engine
│   ├── charts.js           ← lightweight SVG/CSS charts (no libraries)
│   └── app.js              ← UI: routing, dashboard, form, validation, toasts
├── tests/
│   ├── calc.test.js        ← engine tests (run: node tests/calc.test.js)
│   ├── csv.test.js         ← CSV export/import tests
│   ├── plan.test.js        ← FREE/PRO plan tests
│   ├── report.test.js      ← Profit Report tests
│   └── smoke.test.js       ← full click-through test in jsdom
├── scripts/
│   └── build_standalone.py ← regenerates ProfitLeak-AI.html
├── package.json
└── README.md
```

## 🧪 Tests

```bash
npm install            # once — installs jsdom for the smoke test
npm test               # engine + CSV + plan + report + full app click-through tests (273 total)
npm run test:calc      # engine tests only (zero dependencies)
npm run test:csv       # CSV export/import tests (zero dependencies)
npm run test:plan      # FREE/PRO plan tests (zero dependencies)
npm run test:report    # Profit Report tests (zero dependencies)
```

The engine tests verify every formula and recommendation against hand-calculated
values; the CSV tests verify round-trips, quoting and validation; the plan tests
verify the free limit and plan switching; the smoke test loads the real app
headlessly and walks the whole monetization journey: free user (3 products,
locked Pro features) → pricing → upgrade ("coming soon" + preview) → full Pro
experience → back to free with data intact.

## 🛠 Rebuild the single-file version

After editing anything in `css/` or `js/`:

```bash
python3 scripts/build_standalone.py
```

## ☁️ Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. Repository **Settings → Pages** → Source: *Deploy from a branch* → `main` / root.
3. Your app is live at `https://<username>.github.io/<repo>/`.

## 🔭 Roadmap (v2 ideas — intentionally not in v1)

- User accounts & multi-device sync
- Amazon / eBay / Shopify integrations
- CSV import/export
- Date ranges and profit-over-time charts
- Smarter AI-powered advice

## ⚠️ Disclaimer

ProfitLeak AI gives rule-of-thumb guidance calculated from the numbers you enter.
It is not financial, tax or accounting advice.
