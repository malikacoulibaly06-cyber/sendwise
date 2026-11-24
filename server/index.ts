import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compare, DESTINATIONS, getRates, PROVIDERS, SEND_CURRENCIES } from "./providers.ts";
import { createTransfer, getTransfer, initDb, listTransfers, markPaid, usingPostgres } from "./db.ts";

const SERVICE_FEE_USD = 1.49; // what SendWise charges for routing the transfer
const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, db: usingPostgres ? "postgres" : "memory" }));

app.get("/api/meta", (_req, res) =>
  res.json({ sendCurrencies: SEND_CURRENCIES, destinations: DESTINATIONS, providers: PROVIDERS.length, serviceFeeUsd: SERVICE_FEE_USD }),
);

app.get("/api/compare", async (req, res) => {
  const amount = Number(req.query.amount);
  const from = String(req.query.from ?? "USD").toUpperCase();
  const to = String(req.query.to ?? "MXN").toUpperCase();
  if (!Number.isFinite(amount) || amount < 10 || amount > 50000)
    return res.status(400).json({ error: "Amount must be between 10 and 50,000" });
  if (!SEND_CURRENCIES.includes(from as any)) return res.status(400).json({ error: "Unsupported send currency" });
  try {
    res.json(await compare(amount, from, to));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/transfers", async (req, res) => {
  const b = req.body ?? {};
  const required = ["senderName", "senderEmail", "recipientName", "recipientCountry", "amount", "from", "to", "providerId"];
  for (const k of required) if (!b[k]) return res.status(400).json({ error: `Missing ${k}` });
  if (!/^\S+@\S+\.\S+$/.test(b.senderEmail)) return res.status(400).json({ error: "Invalid email" });

  // Re-quote on the server so the client can't tamper with fees or rates.
  const amount = Number(b.amount);
  let result;
  try {
    result = await compare(amount, String(b.from), String(b.to));
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  const q = result.quotes.find((x) => x.providerId === b.providerId);
  if (!q) return res.status(400).json({ error: "Unknown provider" });

  const { rates } = await getRates();
  const serviceFee = Math.round(SERVICE_FEE_USD * rates[String(b.from)] * 100) / 100;

  const t = await createTransfer({
    sender_name: String(b.senderName).slice(0, 100),
    sender_email: String(b.senderEmail).toLowerCase().slice(0, 200),
    recipient_name: String(b.recipientName).slice(0, 100),
    recipient_country: String(b.recipientCountry).slice(0, 100),
    send_amount: amount,
    send_currency: String(b.from),
    receive_currency: String(b.to),
    provider_id: q.providerId,
    provider_name: q.providerName,
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

// Simulated checkout: no real card processing. Card details are validated for
// shape only and never stored or logged.
app.post("/api/transfers/:id/pay", async (req, res) => {
  const { cardNumber, expiry, cvc } = req.body ?? {};
  const digits = String(cardNumber ?? "").replace(/\s/g, "");
  if (digits !== "4242424242424242")
    return res.status(402).json({ error: "Your card was declined. This is a demo — use the test card 4242 4242 4242 4242." });
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(expiry ?? ""));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || new Date(2000 + Number(m[2]), Number(m[1])) < new Date())
    return res.status(400).json({ error: "Enter a valid future expiry date (MM/YY)." });
  if (!/^\d{3,4}$/.test(String(cvc ?? ""))) return res.status(400).json({ error: "Enter a valid CVC." });
  const t = await markPaid(req.params.id);
  t ? res.json(t) : res.status(404).json({ error: "Not found" });
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
