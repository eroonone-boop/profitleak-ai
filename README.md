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
| 💡 **Recommendations** | Written from *your* numbers: break-even price, cost cuts, avoidable losses |
| 📋 **Product table** | Sortable, with clear statuses: 🟢 PROFITABLE · 🟡 LOW PROFIT · 🔴 LOSING MONEY |
| 🔍 **Product analysis** | Full breakdown + "Where are you losing money?" + "What should you change?" |
| 📈 **Charts** | Profit-by-product bars and a "where your money goes" cost donut |
| 📱 **Responsive** | Works on desktop, tablet and mobile |
| 💾 **Local data** | Stored in your browser (localStorage) + 6 sample products pre-loaded |

## 🚀 How to run it

You have three easy options — **no coding needed**:

1. **Double-click `ProfitLeak-AI.html`** — the whole app in one portable file. Nothing to install.
2. **Open `index.html`** in your browser (needs the `css/` and `js/` folders next to it — keep the folder structure).
3. **Host it** (e.g. GitHub Pages, Netlify, Vercel): upload the project folder; `index.html` is the entry point. No build step, no server code.

> First launch comes with 6 sample products so you can explore immediately.
> Use **Load sample data** / **Clear all** on the dashboard to reset anytime.

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
│   └── smoke.test.js       ← full click-through test in jsdom
├── scripts/
│   └── build_standalone.py ← regenerates ProfitLeak-AI.html
├── package.json
└── README.md
```

## 🧪 Tests

```bash
npm install            # once — installs jsdom for the smoke test
npm test               # engine tests + full app click-through
npm run test:calc      # engine tests only (zero dependencies)
```

The engine tests verify every formula and recommendation against hand-calculated
values; the smoke test loads the real app headlessly and walks the whole journey:
landing → dashboard → analysis → add → validate → save → delete → live preview.

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
