import Stripe from "stripe";
import type { Request, Response } from "express";
import { grantPro } from "./db.ts";

// Stripe sells one thing: Rate Watch (one-time unlock). Enabled only when
// STRIPE_SECRET_KEY is a real API key (sk_… / rk_…). Use TEST keys.
const raw = process.env.STRIPE_SECRET_KEY?.trim();
const key = raw && /^(sk|rk)_(test|live)_/.test(raw) ? raw : undefined;
if (raw && !key) console.warn("STRIPE_SECRET_KEY is not an sk_/rk_ API key — Stripe disabled, using simulated checkout");
export const stripe = key ? new Stripe(key) : null;
export const stripeEnabled = !!stripe;
export const stripeTestMode = !!key && /^(sk|rk)_test_/.test(key);

export const PRO_PRICE_USD = 2.99;

export function publicOrigin(req: Request) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `${req.protocol}://${req.get("host")}`;
}

export async function createProCheckout(email: string, origin: string) {
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    metadata: { product: "rate_watch", email },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(PRO_PRICE_USD * 100),
          product_data: {
            name: "CheapSend Rate Watch",
            description: "Track up to 10 money-transfer routes and see when they get cheaper.",
          },
        },
      },
    ],
    success_url: `${origin}/watch?email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/watch?email=${encodeURIComponent(email)}`,
  });
}

// Called when Stripe redirects back, so access is granted even before the
// webhook is configured.
export async function confirmProSession(sessionId: string) {
  if (!stripe) return null;
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  const email = s.metadata?.email;
  if (s.metadata?.product === "rate_watch" && email && s.payment_status === "paid") {
    await grantPro(email, s.id);
    return email;
  }
  return null;
}

// POST /api/stripe/webhook — needs the RAW body to verify Stripe's signature.
export async function webhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return res.status(503).send("Stripe webhook not configured");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, req.headers["stripe-signature"] as string, secret);
  } catch (e: any) {
    return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === "paid" && s.metadata?.product === "rate_watch" && s.metadata.email)
      await grantPro(s.metadata.email, s.id);
  }
  res.json({ received: true });
}
