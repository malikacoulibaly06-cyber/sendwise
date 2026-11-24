import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { api, money, PAYIN_ICON, PAYOUT_ICON } from "../api";

export function ReceiptPage() {
  const { id } = useParams({ from: "/receipt/$id" });
  const { session_id } = useSearch({ from: "/receipt/$id" });
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  // Coming back from Stripe: confirm the session server-side first.
  const t = useQuery({
    queryKey: ["transfer", id, "receipt", session_id],
    queryFn: () => (session_id ? api.confirm(id, session_id) : api.transfer(id)),
  });
  if (t.isLoading) return <p className="p-16 text-center text-muted">Confirming payment…</p>;
  if (!t.data) return <p className="p-16 text-center text-warn">Transfer not found.</p>;
  const x = t.data;
  const paid = x.status === "paid";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-[22px] text-white ${paid ? "bg-success" : "bg-warn"}`}>
        {paid ? "✓" : "…"}
      </div>
      <h1 className="mt-6 font-display text-[40px] font-extrabold leading-tight tracking-tight">
        {paid ? "Your money is on its way." : "Payment pending."}
      </h1>
      <p className="mt-4 text-[17px] text-muted">
        {x.recipient_name} will receive <b className="text-ink">{money(x.receive_amount, x.receive_currency)}</b> in{" "}
        {x.recipient_country} via {x.provider_name}.
      </p>
      {!paid && (
        <Link to="/checkout/$id" params={{ id }} className="btn mt-6">
          Complete payment
        </Link>
      )}

      <div className="card mt-10 divide-y divide-line text-[14px]">
        {[
          ["Reference", x.id.slice(0, 8).toUpperCase()],
          ["Status", paid ? (meta.data?.stripe === "test" ? "Paid (Stripe test mode)" : "Paid (test)") : "Pending"],
          ["Receive as", `${PAYOUT_ICON[x.payout_method]} ${meta.data?.payoutLabels[x.payout_method] ?? x.payout_method}`],
          ["Paid with", `${PAYIN_ICON[x.pay_in_method]} ${meta.data?.payInLabels[x.pay_in_method] ?? x.pay_in_method}`],
          ["Sent", money(x.send_amount, x.send_currency)],
          ["Provider fees (included)", money(x.fee, x.send_currency)],
          ["Exchange rate", `1 ${x.send_currency} = ${x.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${x.receive_currency}`],
          ["SendWise service fee", money(x.service_fee, x.send_currency)],
          ["Total charged", money(x.total_charged, x.send_currency)],
          ["Date", new Date(x.paid_at ?? x.created_at).toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-3">
            <span className="text-muted">{k}</span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Link to="/" className="btn">Send another</Link>
        <Link to="/history" className="btn-ghost">My transfers</Link>
      </div>
    </div>
  );
}
