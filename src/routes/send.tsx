import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { api, money, PAYIN_ICON, PAYOUT_ICON } from "../api";

const RECIPIENT_HINT = {
  bank: "We'll ask the provider to deposit into the recipient's bank account.",
  cash: "Your recipient picks up cash at an agent location with photo ID and the reference number.",
  mobile: "Money lands in the recipient's mobile-money wallet (e.g. M-Pesa, Orange Money, GCash).",
  card: "Money is pushed straight to the recipient's debit card.",
} as const;

export function SendPage() {
  const { amount, from, to, payIn, provider, payout } = useSearch({ from: "/send" });
  const navigate = useNavigate();
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  const cmp = useQuery({
    queryKey: ["compare", { amount, from, to, payIn }],
    queryFn: () => api.compare(amount, from, to, payIn),
  });
  const route = cmp.data?.routes.find((r) => r.providerId === provider && r.payout === payout);
  const country = cmp.data?.country;

  const [form, setForm] = useState({
    senderName: "",
    senderEmail: localStorageGet("sendwise-email"),
    recipientName: "",
  });

  const create = useMutation({
    mutationFn: () => api.createTransfer({ ...form, amount, from, to, payIn, providerId: provider, payout }),
    onSuccess: (t) => {
      localStorageSet("sendwise-email", t.sender_email);
      navigate({ to: "/checkout/$id", params: { id: t.id } });
    },
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_1fr]">
      <div>
        <Link to="/" search={{ amount, from, to, payIn }} className="text-[14px] text-muted hover:text-brand">
          ← Back to comparison
        </Link>
        <h1 className="mt-4 font-display text-[36px] font-extrabold leading-tight tracking-tight">Who are you sending to?</h1>
        {route && <p className="mt-2 text-[15px] text-muted">{RECIPIENT_HINT[route.payout]}</p>}
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Your full name" value={form.senderName} onChange={(v) => setForm({ ...form, senderName: v })} />
          <Field
            label="Your email (used to look up your transfers)"
            type="email"
            value={form.senderEmail}
            onChange={(v) => setForm({ ...form, senderEmail: v })}
          />
          <Field
            label={`Recipient's full name ${country ? `in ${country.flag} ${country.name}` : ""}`}
            value={form.recipientName}
            onChange={(v) => setForm({ ...form, recipientName: v })}
          />
          {create.isError && <p className="text-[14px] text-warn">{(create.error as Error).message}</p>}
          <button className="btn w-full" disabled={!route || create.isPending}>
            {create.isPending ? "Creating transfer…" : "Continue to payment"}
          </button>
        </form>
      </div>

      <aside className="card h-fit p-6">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Summary</div>
        {!route ? (
          <p className="mt-4 text-muted">{cmp.isLoading ? "Loading quote…" : "This route is no longer available."}</p>
        ) : (
          <dl className="mt-4 space-y-3 text-[14px]">
            <Row k="Provider" v={route.providerName} />
            <Row k="Receive as" v={`${PAYOUT_ICON[route.payout]} ${meta.data?.payoutLabels[route.payout] ?? route.payout}`} />
            <Row k="Pay with" v={`${PAYIN_ICON[payIn]} ${meta.data?.payInLabels[payIn] ?? payIn}`} />
            <Row k="You send" v={money(amount, from)} />
            <Row k="Provider fees (included)" v={money(route.fee, from)} />
            <Row k="Exchange rate" v={`1 ${from} = ${route.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${country?.currency}`} />
            <Row k="SendWise service fee" v={meta.data ? `≈ $${meta.data.serviceFeeUsd.toFixed(2)}` : "—"} />
            <div className="border-t border-line pt-3">
              <div className="text-muted">Recipient gets</div>
              <div className="font-display text-[28px] font-extrabold text-brand">{money(route.receiveAmount, country!.currency)}</div>
            </div>
            <div className="text-[12px] text-muted">Arrives: {route.speed}</div>
          </dl>
        )}
      </aside>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <input className="input" required type={props.type ?? "text"} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}
export function localStorageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}
