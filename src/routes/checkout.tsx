import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { api, money } from "../api";

// A fake Stripe-style checkout. Nothing is charged and card details never leave
// this request (the server only checks the format and does not store them).
export function CheckoutPage() {
  const { id } = useParams({ from: "/checkout/$id" });
  const navigate = useNavigate();
  const t = useQuery({ queryKey: ["transfer", id], queryFn: () => api.transfer(id) });
  const [card, setCard] = useState({ cardNumber: "", expiry: "", cvc: "", name: "" });

  const pay = useMutation({
    mutationFn: () => api.pay(id, card),
    onSuccess: () => navigate({ to: "/receipt/$id", params: { id } }),
  });

  if (t.isLoading) return <p className="p-16 text-center text-stone">Loading…</p>;
  if (t.isError || !t.data) return <p className="p-16 text-center text-clay-dark">Transfer not found.</p>;
  if (t.data.status === "paid") return <Navigate to="/receipt/$id" params={{ id }} />;
  const x = t.data;

  return (
    <div className="min-h-[80vh] bg-white">
      <div className="mx-auto grid max-w-5xl md:grid-cols-2">
        <div className="bg-oat px-8 py-14 md:min-h-[80vh]">
          <div className="text-[14px] text-stone">Pay SendWise</div>
          <div className="mt-2 font-serif text-[40px]">{money(x.total_charged, x.send_currency)}</div>
          <div className="mt-8 space-y-3 text-[14px]">
            <Line k={`Transfer to ${x.recipient_name} via ${x.provider_name}`} v={money(x.send_amount, x.send_currency)} />
            <Line k="SendWise service fee" v={money(x.service_fee, x.send_currency)} />
            <div className="border-t border-line pt-3">
              <Line k="Total due today" v={money(x.total_charged, x.send_currency)} bold />
            </div>
            <div className="pt-4 text-stone">
              {x.recipient_name} receives <b className="text-slate-ink">{money(x.receive_amount, x.receive_currency)}</b> in{" "}
              {x.recipient_country}.
            </div>
          </div>
        </div>

        <form
          className="px-8 py-14"
          onSubmit={(e) => {
            e.preventDefault();
            pay.mutate();
          }}
        >
          <div className="mb-6 rounded-lg border border-[#f5d9a8] bg-[#fdf6e7] px-4 py-3 text-[13px] text-[#8a5a00]">
            Test mode — use card <b>4242 4242 4242 4242</b>, any future date, any CVC. No real money moves.
          </div>
          <div className="text-[16px] font-medium">Pay with card</div>
          <div className="mt-4">
            <label className="label">Email</label>
            <input className="input bg-oat" value={x.sender_email} readOnly />
          </div>
          <div className="mt-4">
            <label className="label">Card information</label>
            <div className="overflow-hidden rounded-lg border border-line">
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
          {pay.isError && <p className="mt-4 text-[14px] text-clay-dark">{(pay.error as Error).message}</p>}
          <button className="mt-6 w-full rounded-lg bg-[#635bff] px-5 py-3 text-[15px] font-medium text-white transition hover:bg-[#4f46e5] disabled:opacity-50" disabled={pay.isPending}>
            {pay.isPending ? "Processing…" : `Pay ${money(x.total_charged, x.send_currency)}`}
          </button>
          <p className="mt-4 text-center text-[12px] text-stone">Simulated checkout · Powered by nothing real</p>
        </form>
      </div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? "font-medium" : ""}`}>
      <span className={bold ? "" : "text-stone"}>{k}</span>
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
