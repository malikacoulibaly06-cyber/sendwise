import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { api, money, type Transfer } from "../api";

// Card pay-ins: real Stripe Checkout (test mode) when the server has Stripe
// keys, otherwise a simulated Stripe-style form. Bank and cash pay-ins are
// simulated with a single confirmation step.
export function CheckoutPage() {
  const { id } = useParams({ from: "/checkout/$id" });
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  const t = useQuery({ queryKey: ["transfer", id], queryFn: () => api.transfer(id) });

  if (t.isLoading || meta.isLoading) return <p className="p-16 text-center text-muted">Loading…</p>;
  if (t.isError || !t.data) return <p className="p-16 text-center text-warn">Transfer not found.</p>;
  if (t.data.status === "paid") return <Navigate to="/receipt/$id" params={{ id }} search={{ session_id: undefined }} />;
  const x = t.data;
  const isCard = x.pay_in_method === "debit" || x.pay_in_method === "credit";

  return (
    <div className="min-h-[80vh] bg-white">
      <div className="mx-auto grid max-w-5xl md:grid-cols-2">
        <Summary x={x} />
        <div className="px-6 py-14 sm:px-8">
          {isCard && meta.data?.stripe !== "off" ? (
            <StripePay x={x} mode={meta.data!.stripe} />
          ) : isCard ? (
            <FakeCard x={x} />
          ) : (
            <SimpleConfirm x={x} />
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ x }: { x: Transfer }) {
  return (
    <div className="bg-mist px-6 py-14 sm:px-8 md:min-h-[80vh]">
      <div className="text-[14px] text-muted">Pay SendWise</div>
      <div className="mt-2 font-display text-[40px] font-extrabold tracking-tight">{money(x.total_charged, x.send_currency)}</div>
      <div className="mt-8 space-y-3 text-[14px]">
        <Line k={`Transfer to ${x.recipient_name} via ${x.provider_name}`} v={money(x.send_amount, x.send_currency)} />
        <Line k="SendWise service fee" v={money(x.service_fee, x.send_currency)} />
        <div className="border-t border-line pt-3">
          <Line k="Total due today" v={money(x.total_charged, x.send_currency)} bold />
        </div>
        <div className="pt-4 text-muted">
          {x.recipient_name} receives <b className="text-ink">{money(x.receive_amount, x.receive_currency)}</b> in {x.recipient_country}.
        </div>
      </div>
    </div>
  );
}

function StripePay({ x, mode }: { x: Transfer; mode: "test" | "live" | "off" }) {
  const go = useMutation({
    mutationFn: () => api.stripeSession(x.id),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  return (
    <>
      {mode === "test" && (
        <div className="mb-6 rounded-xl border border-[#f5d9a8] bg-[#fdf6e7] px-4 py-3 text-[13px] text-[#8a5a00]">
          Stripe test mode — pay with <b>4242 4242 4242 4242</b>, any future date, any CVC.
        </div>
      )}
      <div className="text-[18px] font-semibold">Pay by card with Stripe</div>
      <p className="mt-2 text-[14px] text-muted">You'll be taken to Stripe's secure checkout page and brought back here afterwards.</p>
      {go.isError && <p className="mt-4 text-[14px] text-warn">{(go.error as Error).message}</p>}
      <button
        className="mt-6 w-full rounded-xl bg-[#635bff] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50"
        disabled={go.isPending || go.isSuccess}
        onClick={() => go.mutate()}
      >
        {go.isPending || go.isSuccess ? "Opening Stripe…" : `Pay ${money(x.total_charged, x.send_currency)} with Stripe`}
      </button>
    </>
  );
}

function SimpleConfirm({ x }: { x: Transfer }) {
  const navigate = useNavigate();
  const pay = useMutation({
    mutationFn: () => api.pay(x.id, {}),
    onSuccess: () => navigate({ to: "/receipt/$id", params: { id: x.id }, search: { session_id: undefined } }),
  });
  const cash = x.pay_in_method === "cash";
  const ref = x.id.slice(0, 8).toUpperCase();
  return (
    <>
      <div className="mb-6 rounded-xl border border-[#f5d9a8] bg-[#fdf6e7] px-4 py-3 text-[13px] text-[#8a5a00]">
        Demo — this step is simulated. No real money moves.
      </div>
      {cash ? (
        <>
          <div className="text-[18px] font-semibold">Pay cash at a {x.provider_name} agent</div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14px] text-muted">
            <li>Visit any {x.provider_name} agent location (pharmacies, supermarkets, convenience stores).</li>
            <li>
              Give them reference <b className="font-mono text-ink">{ref}</b> and photo ID.
            </li>
            <li>Pay {money(x.total_charged, x.send_currency)} in cash.</li>
          </ol>
        </>
      ) : (
        <>
          <div className="text-[18px] font-semibold">Pay from your bank account</div>
          <p className="mt-2 text-[14px] text-muted">
            We'd debit {money(x.total_charged, x.send_currency)} from your linked bank account (ACH / open banking).
          </p>
        </>
      )}
      {pay.isError && <p className="mt-4 text-[14px] text-warn">{(pay.error as Error).message}</p>}
      <button className="btn mt-6 w-full" disabled={pay.isPending} onClick={() => pay.mutate()}>
        {pay.isPending ? "Confirming…" : cash ? "Simulate cash payment at agent" : `Pay ${money(x.total_charged, x.send_currency)} by bank`}
      </button>
    </>
  );
}

function FakeCard({ x }: { x: Transfer }) {
  const navigate = useNavigate();
  const [card, setCard] = useState({ cardNumber: "", expiry: "", cvc: "", name: "" });
  const pay = useMutation({
    mutationFn: () => api.pay(x.id, card),
    onSuccess: () => navigate({ to: "/receipt/$id", params: { id: x.id }, search: { session_id: undefined } }),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        pay.mutate();
      }}
    >
      <div className="mb-6 rounded-xl border border-[#f5d9a8] bg-[#fdf6e7] px-4 py-3 text-[13px] text-[#8a5a00]">
        Simulated checkout — use card <b>4242 4242 4242 4242</b>, any future date, any CVC. No real money moves.
      </div>
      <div className="text-[16px] font-semibold">Pay with card</div>
      <div className="mt-4">
        <label className="label">Email</label>
        <input className="input bg-mist" value={x.sender_email} readOnly />
      </div>
      <div className="mt-4">
        <label className="label">Card information</label>
        <div className="overflow-hidden rounded-xl border border-line">
          <input
            className="w-full border-b border-line px-3.5 py-2.5 text-[15px] outline-none"
            placeholder="1234 1234 1234 1234"
            inputMode="numeric"
            autoComplete="off"
            value={card.cardNumber}
            onChange={(e) => setCard({ ...card, cardNumber: formatCard(e.target.value) })}
            required
          />
          <div className="grid grid-cols-2">
            <input
              className="border-r border-line px-3.5 py-2.5 text-[15px] outline-none"
              placeholder="MM / YY"
              autoComplete="off"
              value={card.expiry}
              onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
              required
            />
            <input
              className="px-3.5 py-2.5 text-[15px] outline-none"
              placeholder="CVC"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={card.cvc}
              onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })}
              required
            />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <label className="label">Name on card</label>
        <input className="input" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} required />
      </div>
      {pay.isError && <p className="mt-4 text-[14px] text-warn">{(pay.error as Error).message}</p>}
      <button
        className="mt-6 w-full rounded-xl bg-[#635bff] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50"
        disabled={pay.isPending}
      >
        {pay.isPending ? "Processing…" : `Pay ${money(x.total_charged, x.send_currency)}`}
      </button>
    </form>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}
