# SendWise

**Live:** https://web-production-a78377cd.up.railway.app — deploys automatically from `main`.

Compare every route to send money abroad — 200 countries, 11 providers (Wise, Revolut, Remitly, Sendwave,
Taptap Send, WorldRemit, Xe, Ria, MoneyGram, Western Union, Xoom) across bank deposit, cash pickup, mobile money
and debit-card payouts — paid by bank account, debit card, credit card or cash at an agent. Also compares the
SWIFT wire cost from major banks in each sending currency (USD, EUR, GBP, CAD, AUD, CHF).

**Class demo:** exchange rates are live mid-market rates; provider and bank fees are estimates of typical published
pricing. Card payments use Stripe Checkout in test mode when `STRIPE_SECRET_KEY` is set, otherwise a simulated
checkout (test card `4242 4242 4242 4242`). No real money moves.

## Stripe setup (test mode)
1. Stripe Dashboard → Developers → API keys → copy the **test** secret key (`sk_test_…`).
2. Railway → sendwise → web → Variables → add `STRIPE_SECRET_KEY`.
3. Stripe → Workbench → Webhooks → add endpoint `https://web-production-a78377cd.up.railway.app/api/stripe/webhook`,
   events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Copy the signing secret (`whsec_…`) → Railway variable `STRIPE_WEBHOOK_SECRET`.

Stack: React + Tailwind + TanStack Router/Query (Vite) · Express API · Postgres (in-memory fallback when
`DATABASE_URL` is unset). Live FX from open.er-api.com.

```bash
npm install
npm run dev:server   # API on :3001
npm run dev          # front end on :5173 (proxies /api)
```

Production: `npm run build && npm start` (serves `dist/` + API on `$PORT`).
