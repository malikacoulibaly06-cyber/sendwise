import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { api, money } from "../api";

export function SendPage() {
  const { amount, from, to, provider } = useSearch({ from: "/send" });
  const navigate = useNavigate();
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  const cmp = useQuery({ queryKey: ["compare", { amount, from, to }], queryFn: () => api.compare(amount, from, to) });
  const quote = cmp.data?.quotes.find((q) => q.providerId === provider);
  const dest = meta.data?.destinations.find((d) => d.currency === to);

  const [form, setForm] = useState({
    senderName: "",
    senderEmail: localStorageGet("sendwise-email"),
    recipientName: "",
  });

  const create = useMutation({
    mutationFn: () =>
      api.createTransfer({ ...form, recipientCountry: dest?.country ?? to, amount, from, to, providerId: provider }),
    onSuccess: (t) => {
      localStorageSet("sendwise-email", t.sender_email);
      navigate({ to: "/checkout/$id", params: { id: t.id } });
    },
  });

  const serviceFee = meta.data && cmp.data ? meta.data.serviceFeeUsd : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-[1.3fr_1fr]">
      <div>
        <Link to="/" search={{ amount, from, to }} className="text-[14px] text-stone hover:text-slate-ink">
          ← Back to comparison
        </Link>
        <h1 className="mt-4 font-serif text-[40px] leading-tight tracking-tight">Who are you sending to?</h1>
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
            label={`Recipient's full name ${dest ? `in ${dest.flag} ${dest.country}` : ""}`}
            value={form.recipientName}
            onChange={(v) => setForm({ ...form, recipientName: v })}
          />
          {create.isError && <p className="text-clay-dark text-[14px]">{(create.error as Error).message}</p>}
          <button className="btn w-full" disabled={!quote || create.isPending}>
            {create.isPending ? "Creating transfer…" : "Continue to payment"}
          </button>
        </form>
      </div>

      <aside className="card h-fit p-6">
        <div className="text-[13px] font-medium uppercase tracking-wider text-stone">Summary</div>
        {!quote ? (
          <p className="mt-4 text-stone">{cmp.isLoading ? "Loading quote…" : "Quote not found."}</p>
        ) : (
          <dl className="mt-4 space-y-3 text-[14px]">
            <Row k="Route" v={quote.providerName} />
            <Row k="You send" v={money(amount, from)} />
            <Row k="Provider fee (included)" v={money(quote.fee, from)} />
            <Row k="Exchange rate" v={`1 ${from} = ${quote.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}`} />
            <Row k="SendWise service fee" v={serviceFee != null ? `≈ $${serviceFee.toFixed(2)}` : "—"} />
            <div className="border-t border-line pt-3">
              <div className="text-stone">Recipient gets</div>
              <div className="font-serif text-[30px]">{money(quote.receiveAmount, to)}</div>
            </div>
            <div className="text-[12px] text-stone">Arrives: {quote.speed}</div>
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
      <dt className="text-stone">{k}</dt>
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
