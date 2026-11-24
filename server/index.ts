import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, SANCTIONED } from "./countries.ts";
import { compare, PAYIN_LABEL, type PayIn, PAYOUT_LABEL, PROVIDERS, SEND_CURRENCIES } from "./providers.ts";
import { outboundFor, promoMap } from "./affiliates.ts";
import { addWatch, clickStats, deleteWatch, grantPro, initDb, isPro, listWatches, recordClick, usingPostgres } from "./db.ts";
import { confirmProSession, createProCheckout, PRO_PRICE_USD, publicOrigin, stripeEnabled, stripeTestMode, webhook } from "./stripe.ts";

const app = express();
app.set("trust proxy", true);
// Stripe webhook must see the raw body, so register it before express.json().
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), webhook);
app.use(express.json());

const isPayIn = (v: unknown): v is PayIn => typeof v === "string" && v in PAYIN_LABEL;
const cleanEmail = (v: unknown) => {
  const e = String(v ?? "").trim().toLowerCase();
  return /^\S+@\S+\.\S+$/.test(e) && e.length <= 200 ? e : null;
};

app.get("/api/health", (_req, res) => res.json({ ok: true, db: usingPostgres ? "postgres" : "memory" }));

app.get("/api/meta", (_req, res) =>
  res.json({
    sendCurrencies: SEND_CURRENCIES,
    countries: COUNTRIES.map((c) => ({ ...c, sanctioned: SANCTIONED.has(c.iso) })),
    providers: PROVIDERS.length,
    payoutLabels: PAYOUT_LABEL,
    payInLabels: PAYIN_LABEL,
    partners: promoMap(),
    proPriceUsd: PRO_PRICE_USD,
    stripe: stripeEnabled ? (stripeTestMode ? "test" : "live") : "off",
  }),
);

app.get("/api/compare", async (req, res) => {
  const amount = Number(req.query.amount);
  const from = String(req.query.from ?? "USD").toUpperCase();
  const iso = String(req.query.to ?? "MX").toUpperCase();
  const payIn = req.query.payIn ?? "bank";
  if (!Number.isFinite(amount) || amount < 10 || amount > 50000)
    return res.status(400).json({ error: "Amount must be between 10 and 50,000" });
  if (!SEND_CURRENCIES.includes(from)) return res.status(400).json({ error: "Unsupported send currency" });
  if (!isPayIn(payIn)) return res.status(400).json({ error: "Unsupported payment method" });
  try {
    res.json(await compare(amount, from, iso, payIn));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Outbound click: record it (anonymously), then redirect to the provider via
// your affiliate link if you have one. Only known provider URLs are used, so
// this can't be abused as an open redirect.
app.get("/go/:provider", async (req, res) => {
  const out = outboundFor(req.params.provider);
  if (!out) return res.status(404).send("Unknown provider");
  const q = req.query;
  try {
    await recordClick({
      provider_id: out.providerId,
      payout: String(q.payout ?? "").slice(0, 10) || "unknown",
      pay_in: String(q.payIn ?? "").slice(0, 10) || "unknown",
      send_currency: String(q.from ?? "").slice(0, 3).toUpperCase() || "USD",
      amount: Math.min(Math.max(Number(q.amount) || 0, 0), 1_000_000),
      country_iso: String(q.to ?? "").slice(0, 2).toUpperCase() || "??",
      affiliate: out.affiliate,
    });
  } catch (e) {
    console.error("click log failed", e);
  }
  res.set("Referrer-Policy", "no-referrer-when-downgrade");
  res.redirect(302, out.url);
});

app.get("/api/stats", async (_req, res) => res.json(await clickStats()));

// ---- Rate Watch (the paid feature) ----

async function bestFor(amount: number, from: string, iso: string, payIn: PayIn) {
  const r = await compare(amount, from, iso, payIn);
  return { country: r.country, best: r.routes[0] ?? null };
}

app.get("/api/watch", async (req, res) => {
  const email = cleanEmail(req.query.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email" });
  const pro = await isPro(email);
  const watches = pro ? await listWatches(email) : [];
  const withNow = await Promise.all(
    watches.map(async (w) => {
      try {
        const { country, best } = await bestFor(w.amount, w.send_currency, w.country_iso, w.pay_in as PayIn);
        return { ...w, country, now: best };
      } catch {
        return { ...w, country: null, now: null };
      }
    }),
  );
  res.json({ email, pro, watches: withNow });
});

app.post("/api/watch/checkout", async (req, res) => {
  const email = cleanEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email" });
  if (await isPro(email)) return res.json({ alreadyPro: true });
  if (!stripeEnabled) return res.json({ simulated: true });
  try {
    const s = await createProCheckout(email, publicOrigin(req));
    res.json({ url: s.url });
  } catch (e: any) {
    console.error("Stripe session error", e.message);
    res.status(502).json({ error: "Could not start Stripe checkout" });
  }
});

// Simulated card payment — only available while Stripe isn't configured.
app.post("/api/watch/simulate-pay", async (req, res) => {
  if (stripeEnabled) return res.status(409).json({ error: "Payments go through Stripe Checkout." });
  const email = cleanEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email" });
  const digits = String(req.body?.cardNumber ?? "").replace(/\s/g, "");
  if (digits !== "4242424242424242")
    return res.status(402).json({ error: "Card declined. This is a demo — use the test card 4242 4242 4242 4242." });
  await grantPro(email, null);
  res.json({ ok: true });
});

app.post("/api/watch/confirm", async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return res.status(400).json({ error: "Invalid session" });
  try {
    const email = await confirmProSession(sessionId);
    email ? res.json({ email, pro: true }) : res.status(402).json({ error: "Payment not completed" });
  } catch {
    res.status(400).json({ error: "Could not confirm payment" });
  }
});

app.post("/api/watch", async (req, res) => {
  const b = req.body ?? {};
  const email = cleanEmail(b.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email" });
  if (!(await isPro(email))) return res.status(402).json({ error: "Unlock Rate Watch first" });
  const amount = Number(b.amount);
  const from = String(b.from ?? "").toUpperCase();
  const iso = String(b.to ?? "").toUpperCase();
  if (!Number.isFinite(amount) || amount < 10 || amount > 50000) return res.status(400).json({ error: "Invalid amount" });
  if (!SEND_CURRENCIES.includes(from) || !isPayIn(b.payIn)) return res.status(400).json({ error: "Invalid route" });
  try {
    const { best } = await bestFor(amount, from, iso, b.payIn);
    if (!best) return res.status(400).json({ error: "No route available to watch" });
    await addWatch({
      email,
      amount,
      send_currency: from,
      country_iso: iso,
      pay_in: b.payIn,
      baseline_receive: best.receiveAmount,
      baseline_provider: best.providerName,
    });
    res.status(201).json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/watch/:id", async (req, res) => {
  const email = cleanEmail(req.query.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email" });
  await deleteWatch(email, req.params.id);
  res.json({ ok: true });
});

// Serve the built front end in production.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
app.use(express.static(dist));
app.get(/^(?!\/api|\/go\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = Number(process.env.PORT ?? 3001);
initDb()
  .then(() => app.listen(port, () => console.log(`CheapSend listening on :${port}`)))
  .catch((e) => {
    console.error("DB init failed", e);
    process.exit(1);
  });
