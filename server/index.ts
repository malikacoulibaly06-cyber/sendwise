import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, SANCTIONED } from "./countries.ts";
import { compare, getRates, PAYIN_LABEL, type PayIn, PAYOUT_LABEL, PROVIDERS, SEND_CURRENCIES } from "./providers.ts";
import { createTransfer, getTransfer, initDb, listTransfers, markPaid, usingPostgres } from "./db.ts";
import { confirmSession, createCheckoutSession, publicOrigin, stripeEnabled, stripeTestMode, webhook } from "./stripe.ts";

const SERVICE_FEE_USD = 1.49; // what SendWise charges for routing the transfer
const app = express();
app.set("trust proxy", true);
// Stripe webhook must see the raw body, so register it before express.json().
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), webhook);
app.use(express.json());

const isPayIn = (v: unknown): v is PayIn => typeof v === "string" && v in PAYIN_LABEL;

app.get("/api/health", (_req, res) => res.json({ ok: true, db: usingPostgres ? "postgres" : "memory" }));

app.get("/api/meta", (_req, res) =>
  res.json({
    sendCurrencies: SEND_CURRENCIES,
    countries: COUNTRIES.map((c) => ({ ...c, sanctioned: SANCTIONED.has(c.iso) })),
    providers: PROVIDERS.length,
    payoutLabels: PAYOUT_LABEL,
    payInLabels: PAYIN_LABEL,
    serviceFeeUsd: SERVICE_FEE_USD,
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

app.post("/api/transfers", async (req, res) => {
  const b = req.body ?? {};
  const required = ["senderName", "senderEmail", "recipientName", "amount", "from", "to", "providerId", "payout", "payIn"];
  for (const k of required) if (!b[k]) return res.status(400).json({ error: `Missing ${k}` });
  if (!/^\S+@\S+\.\S+$/.test(b.senderEmail)) return res.status(400).json({ error: "Invalid email" });
  if (!isPayIn(b.payIn)) return res.status(400).json({ error: "Unsupported payment method" });

  // Re-quote on the server so the client can't tamper with fees or rates.
  const amount = Number(b.amount);
  let result;
  try {
    result = await compare(amount, String(b.from), String(b.to), b.payIn);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  if (result.blocked) return res.status(400).json({ error: "Transfers to this country are not available (sanctions)." });
  const q = result.routes.find((x) => x.providerId === b.providerId && x.payout === b.payout);
  if (!q) return res.status(400).json({ error: "That route is not available" });

  const { rates } = await getRates();
  const serviceFee = Math.round(SERVICE_FEE_USD * rates[String(b.from)] * 100) / 100;

  const t = await createTransfer({
    sender_name: String(b.senderName).slice(0, 100),
    sender_email: String(b.senderEmail).toLowerCase().slice(0, 200),
    recipient_name: String(b.recipientName).slice(0, 100),
    recipient_country: result.country.name,
    send_amount: amount,
    send_currency: String(b.from),
    receive_currency: result.country.currency,
    provider_id: q.providerId,
    provider_name: q.providerName,
    payout_method: q.payout,
    pay_in_method: b.payIn,
    fee: q.fee,
    rate: q.rate,
    receive_amount: q.receiveAmount,
    service_fee: serviceFee,
    total_charged: Math.round((amount + serviceFee) * 100) / 100,
  });
  res.status(201).json(t);
});

app.get("/api/transfers/:id", async (req, res) => {
  const t = await getTransfer(req.params.id);
  t ? res.json(t) : res.status(404).json({ error: "Not found" });
});

// Simulated checkout: no real money moves. Card details are checked for shape
// only and are never stored or logged. Bank and cash pay-ins are confirmed
// with a single simulated step.
app.post("/api/transfers/:id/pay", async (req, res) => {
  const t0 = await getTransfer(req.params.id);
  if (!t0) return res.status(404).json({ error: "Not found" });
  if (t0.pay_in_method === "debit" || t0.pay_in_method === "credit") {
    if (stripeEnabled) return res.status(409).json({ error: "Card payments go through Stripe Checkout." });
    const { cardNumber, expiry, cvc } = req.body ?? {};
    const digits = String(cardNumber ?? "").replace(/\s/g, "");
    if (digits !== "4242424242424242")
      return res.status(402).json({ error: "Your card was declined. This is a demo — use the test card 4242 4242 4242 4242." });
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(expiry ?? ""));
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || new Date(2000 + Number(m[2]), Number(m[1])) < new Date())
      return res.status(400).json({ error: "Enter a valid future expiry date (MM/YY)." });
    if (!/^\d{3,4}$/.test(String(cvc ?? ""))) return res.status(400).json({ error: "Enter a valid CVC." });
  }
  const t = await markPaid(req.params.id);
  t ? res.json(t) : res.status(404).json({ error: "Not found" });
});

// Real Stripe Checkout (test mode) for card pay-ins, when keys are configured.
app.post("/api/transfers/:id/stripe-session", async (req, res) => {
  if (!stripeEnabled) return res.status(503).json({ error: "Stripe is not configured" });
  const t = await getTransfer(req.params.id);
  if (!t) return res.status(404).json({ error: "Not found" });
  if (t.status === "paid") return res.status(409).json({ error: "Already paid" });
  try {
    const session = await createCheckoutSession(t, publicOrigin(req));
    res.json({ url: session.url });
  } catch (e: any) {
    console.error("Stripe session error", e.message);
    res.status(502).json({ error: "Could not start Stripe checkout" });
  }
});

app.post("/api/transfers/:id/confirm", async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return res.status(400).json({ error: "Invalid session" });
  try {
    const t = await confirmSession(req.params.id, sessionId);
    t ? res.json(t) : res.status(404).json({ error: "Not found" });
  } catch (e: any) {
    res.status(400).json({ error: "Could not confirm payment" });
  }
});

app.get("/api/history", async (req, res) => {
  const email = String(req.query.email ?? "").toLowerCase();
  if (!email) return res.status(400).json({ error: "email required" });
  res.json(await listTransfers(email));
});

// Serve the built front end in production.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = Number(process.env.PORT ?? 3001);
initDb()
  .then(() => app.listen(port, () => console.log(`SendWise listening on :${port}`)))
  .catch((e) => {
    console.error("DB init failed", e);
    process.exit(1);
  });
