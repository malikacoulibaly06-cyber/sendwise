# SendWise

**Live:** https://web-production-a78377cd.up.railway.app — deploys automatically from `main`.

Compare money-transfer providers (Wise, Revolut, Remitly, Western Union, …) against the live mid-market
rate, pick the cheapest route, and "send" through a simulated Stripe-style checkout.

**Class demo:** provider fees are estimates of typical published pricing, and payments are simulated (test card
`4242 4242 4242 4242`). No real money moves.

Stack: React + Tailwind + TanStack Router/Query (Vite) · Express API · Postgres (in-memory fallback when
`DATABASE_URL` is unset). Live FX from open.er-api.com.

```bash
npm install
npm run dev:server   # API on :3001
npm run dev          # front end on :5173 (proxies /api)
```

Production: `npm run build && npm start` (serves `dist/` + API on `$PORT`).
