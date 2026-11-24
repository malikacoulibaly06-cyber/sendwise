import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { api, money } from "../api";

export function ReceiptPage() {
  const { id } = useParams({ from: "/receipt/$id" });
  const t = useQuery({ queryKey: ["transfer", id, "receipt"], queryFn: () => api.transfer(id) });
  if (t.isLoading) return <p className="p-16 text-center text-stone">Loading…</p>;
  if (!t.data) return <p className="p-16 text-center text-clay-dark">Transfer not found.</p>;
  const x = t.data;

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage text-[22px] text-white">✓</div>
      <h1 className="mt-6 font-serif text-[44px] leading-tight tracking-tight">
        {x.status === "paid" ? "Your money is on its way." : "Payment pending."}
      </h1>
      <p className="mt-4 text-[17px] text-stone">
        {x.recipient_name} will receive <b className="text-slate-ink">{money(x.receive_amount, x.receive_currency)}</b> in{" "}
        {x.recipient_country} via {x.provider_name}.
      </p>

      <div className="card mt-10 divide-y divide-line text-[14px]">
        {[
          ["Reference", x.id.slice(0, 8).toUpperCase()],
          ["Status", x.status === "paid" ? "Paid (simulated)" : "Pending"],
          ["Sent", money(x.send_amount, x.send_currency)],
          ["Provider fee (included)", money(x.fee, x.send_currency)],
          ["Exchange rate", `1 ${x.send_currency} = ${x.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${x.receive_currency}`],
          ["SendWise service fee", money(x.service_fee, x.send_currency)],
          ["Total charged", money(x.total_charged, x.send_currency)],
          ["Date", new Date(x.paid_at ?? x.created_at).toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between px-5 py-3">
            <span className="text-stone">{k}</span>
            <span className="font-medium">{v}</span>
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
