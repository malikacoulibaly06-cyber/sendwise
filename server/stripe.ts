import Stripe from "stripe";
import type { Request, Response } from "express";
import { getTransfer, markPaid, type Transfer } from "./db.ts";

// Stripe is enabled only when STRIPE_SECRET_KEY is set (use a TEST key:
// sk_test_…). Keys are set as Railway variables / local .env — never in code.
const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key ? new Stripe(key) : null;
export const stripeEnabled = !!stripe;
export const stripeTestMode = !!key?.startsWith("sk_test_");

const cents = (n: number) => Math.round(n * 100);

export function publicOrigin(req: Request) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `${req.protocol}://${req.get("host")}`;
}

export async function createCheckoutSession(t: Transfer, origin: string) {
  if (!stripe) throw new Error("Stripe is not configured");
  const currency = t.send_currency.toLowerCase();
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: t.sender_email,
    client_reference_id: t.id,
    metadata: { transferId: t.id },
    payment_intent_data: { metadata: { transferId: t.id } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: cents(t.send_amount),
          product_data: {
            name: `Transfer to ${t.recipient_name} (${t.recipient_country})`,
            description: `Via ${t.provider_name} · recipient gets ${t.receive_amount.toLocaleString("en-US")} ${t.receive_currency}`,
          },
        },
      },
      {
        quantity: 1,
        price_data: { currency, unit_amount: cents(t.service_fee), product_data: { name: "SendWise service fee" } },
      },
    ],
    success_url: `${origin}/receipt/${t.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/${t.id}`,
  });
}

// Called by the receipt page after Stripe redirects back, so the transfer is
// marked paid even if the webhook hasn't been configured yet.
export async function confirmSession(transferId: string, sessionId: string) {
  if (!stripe) return getTransfer(transferId);
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  if (s.metadata?.transferId === transferId && s.payment_status === "paid") return markPaid(transferId);
  return getTransfer(transferId);
}

// POST /api/stripe/webhook — needs the RAW body to verify Stripe's signature.
export async function webhook(req: Request, res: Response) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).send("Stripe webhook not configured");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, req.headers["stripe-signature"] as string, secret);
  } catch (e: any) {
    return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === "paid" && s.metadata?.transferId) await markPaid(s.metadata.transferId);
  }
  res.json({ received: true });
}
