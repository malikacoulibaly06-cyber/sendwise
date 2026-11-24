# CheapSend

**Live:** https://web-production-a78377cd.up.railway.app — deploys automatically from `main`.

CheapSend compares every way to send money abroad — 200 countries, 11 providers (Wise, Revolut, Remitly, Sendwave,
Taptap Send, WorldRemit, Xe, Ria, MoneyGram, Western Union, Xoom), bank deposit / cash pickup / mobile money / card
payouts, paid by bank, debit, credit or cash — plus the SWIFT wire cost from major banks in USD, EUR, GBP, CAD, AUD
and CHF. It doesn't move money: users click through to the cheapest provider and send there.

## Business model
1. **Affiliate referrals** — "Go to …" buttons go through `/go/<provider>`, which logs an anonymous click and
   redirects to your affiliate link. Commissions are paid by each program/network (to your bank or PayPal), not Stripe.
2. **Rate Watch** — a one-time $2.99 unlock (Stripe Checkout) to track up to 10 routes.

Rankings are always by what the recipient gets, never by commission, and an affiliate disclosure is shown on every page.

## Adding affiliate links and promo codes (Railway → web → Variables)
| Variable | Example |
|---|---|
| `AFFILIATE_URL_WISE` | your Wise (Partnerize) tracking link |
| `AFFILIATE_URL_REMITLY` | your Remitly affiliate link |
| `AFFILIATE_URL_WESTERNUNION` | … |
| `PROMO_REMITLY` | `First transfer fee-free` (only codes the program allows you to publish) |

Provider IDs: `wise revolut remitly sendwave taptapsend worldremit xe ria moneygram westernunion xoom`.
Without a variable the button links to the provider's normal site. Click counts are at `/stats`.

## Stripe setup (test mode)
1. Stripe → Developers → API keys → copy the **secret** test key (`sk_test_…`) → Railway variable `STRIPE_SECRET_KEY`.
2. Stripe → Workbench → Webhooks → endpoint `https://web-production-a78377cd.up.railway.app/api/stripe/webhook`,
   events `checkout.session.completed`, `checkout.session.async_payment_succeeded` → copy the signing secret
   (`whsec_…`) → Railway variable `STRIPE_WEBHOOK_SECRET`.
Without a valid key, Rate Watch uses a simulated checkout (test card `4242 4242 4242 4242`).

## Stack / dev
React + Tailwind + TanStack Router/Query (Vite) · Express API · Postgres (in-memory fallback without `DATABASE_URL`).
Live FX from open.er-api.com. Provider and bank fees are estimates of typical published pricing.

```bash
npm install
npm run dev:server   # API on :3001
npm run dev          # front end on :5173 (proxies /api and /go)
```
