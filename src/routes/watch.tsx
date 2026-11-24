import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { api, getStoredEmail, goUrl, money, storeEmail, type Watch } from "../api";

// Rate Watch — the one paid feature. One-time unlock via Stripe Checkout
// (test mode), or a simulated card form while Stripe isn't configured.
export function WatchPage() {
  const search = useSearch({ from: "/watch" });
  const navigate = useNavigate({ from: "/watch" });
  const qc = useQueryClient();
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  const [input, setInput] = useState(search.email ?? getStoredEmail());
  const [email, setEmail] = useState(search.email ?? getStoredEmail());
  const pending = search.amount && search.from && search.to && search.payIn ? search : null;

  // Back from Stripe: confirm the session, then clean the URL.
  const confirm = useQuery({
    queryKey: ["confirm", search.session_id],
    queryFn: () => api.confirmPro(search.session_id!),
    enabled: !!search.session_id,
    retry: false,
  });
  useEffect(() => {
    if (confirm.data) {
      setEmail(confirm.data.email);
      storeEmail(confirm.data.email);
      qc.invalidateQueries({ queryKey: ["watch"] });
      navigate({ search: { email: confirm.data.email }, replace: true });
    }
  }, [confirm.data, navigate, qc]);

  const w = useQuery({ queryKey: ["watch", email], queryFn: () => api.watch(email), enabled: !!email });

  const add = useMutation({
    mutationFn: () => api.addWatch({ email, ...pending }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watch"] });
      navigate({ search: { email }, replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteWatch(id, email),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watch"] }),
  });

  const price = meta.data ? `$${meta.data.proPriceUsd.toFixed(2)}` : "$2.99";
  const pendingCountry = meta.data?.countries.find((c) => c.iso === pending?.to);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">Rate Watch</p>
      <h1 className="mt-2 font-display text-[38px] font-extrabold leading-tight tracking-tight">
        Know when it's cheaper to send.
      </h1>
      <p className="mt-3 max-w-2xl text-[16px] text-muted">
        Save up to 10 routes and see at a glance whether your recipient would get more today than when you saved it — and
        which provider is cheapest right now. One-time {price}.
      </p>

      {search.session_id && confirm.isLoading && <p className="mt-6 text-muted">Confirming your payment…</p>}
      {confirm.isError && <p className="mt-6 text-warn">{(confirm.error as Error).message}</p>}

      <form
        className="mt-8 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.trim().toLowerCase();
          setEmail(v);
          storeEmail(v);
        }}
      >
        <input className="input max-w-sm" type="email" placeholder="you@example.com" value={input} onChange={(e) => setInput(e.target.value)} required />
        <button className="btn">Continue</button>
      </form>
      {w.isError && <p className="mt-4 text-warn">{(w.error as Error).message}</p>}

      {w.data && !w.data.pro && <Unlock email={email} price={price} stripeMode={meta.data?.stripe ?? "off"} onDone={() => w.refetch()} />}

      {w.data?.pro && (
        <>
          {pending && (
            <div className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="text-[15px]">
                Add <b>{money(pending.amount!, pending.from!)}</b> → {pendingCountry?.flag} <b>{pendingCountry?.name}</b>{" "}
                <span className="text-muted">(paying by {meta.data?.payInLabels[pending.payIn!].toLowerCase()})</span>
              </div>
              <button className="btn" disabled={add.isPending} onClick={() => add.mutate()}>
                {add.isPending ? "Adding…" : "🔔 Watch this route"}
              </button>
              {add.isError && <p className="w-full text-[14px] text-warn">{(add.error as Error).message}</p>}
            </div>
          )}

          <div className="mt-8 flex items-end justify-between">
            <h2 className="font-display text-[22px] font-bold">Your routes</h2>
            <span className="text-[13px] text-muted">{w.data.watches.length}/10</span>
          </div>
          {w.data.watches.length === 0 ? (
            <div className="card mt-3 p-6 text-muted">
              No routes yet. <Link to="/" className="text-brand underline">Compare a route</Link> and tap “Watch this route”.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {w.data.watches.map((x) => (
                <WatchRow key={x.id} x={x} onRemove={() => remove.mutate(x.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WatchRow({ x, onRemove }: { x: Watch; onRemove: () => void }) {
  const cur = x.country?.currency ?? "";
  const diff = x.now ? x.now.receiveAmount - x.baseline_receive : 0;
  const up = diff > 0.005;
  const down = diff < -0.005;
  return (
    <div className="card grid gap-3 p-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
      <div>
        <div className="font-semibold">
          {money(x.amount, x.send_currency)} → {x.country?.flag} {x.country?.name ?? x.country_iso}
        </div>
        <div className="text-[12px] text-muted">
          Saved {new Date(x.created_at).toLocaleDateString()}: {money(x.baseline_receive, cur)} via {x.baseline_provider}
        </div>
      </div>
      <div>
        <div className="text-[12px] text-muted">Best today</div>
        <div className="font-display text-[18px] font-bold">{x.now ? money(x.now.receiveAmount, cur) : "—"}</div>
        <div className="text-[12px] text-muted">{x.now?.providerName}</div>
      </div>
      <div className={`text-[14px] font-semibold ${up ? "text-success" : down ? "text-warn" : "text-muted"}`}>
        {up ? `▲ ${money(diff, cur)} more` : down ? `▼ ${money(-diff, cur)} less` : "No change"}
      </div>
      <div className="flex gap-2">
        {x.now && (
          <a
            className="btn whitespace-nowrap"
            href={goUrl(x.now.providerId, { amount: x.amount, from: x.send_currency, to: x.country_iso, payIn: x.pay_in, payout: x.now.payout })}
            target="_blank"
            rel="sponsored noopener"
          >
            Send now →
          </a>
        )}
        <button className="btn-ghost" onClick={onRemove} aria-label="Remove">✕</button>
      </div>
    </div>
  );
}

function Unlock({ email, price, stripeMode, onDone }: { email: string; price: string; stripeMode: string; onDone: () => void }) {
  const [card, setCard] = useState("");
  const start = useMutation({
    mutationFn: () => api.proCheckout(email),
    onSuccess: (r) => {
      if (r.url) window.location.assign(r.url);
      else if (r.alreadyPro) onDone();
    },
  });
  const fake = useMutation({ mutationFn: () => api.simulatePay(email, card), onSuccess: onDone });
  const simulated = start.data?.simulated;

  return (
    <div className="card mt-8 p-6">
      <div className="font-display text-[20px] font-bold">Unlock Rate Watch — {price}</div>
      <ul className="mt-3 space-y-1 text-[14px] text-muted">
        <li>✓ Track up to 10 routes</li>
        <li>✓ See today's cheapest provider for each</li>
        <li>✓ One-time payment, no subscription</li>
      </ul>
      {stripeMode === "test" && (
        <p className="mt-4 rounded-xl border border-[#f5d9a8] bg-[#fdf6e7] px-4 py-3 text-[13px] text-[#8a5a00]">
          Stripe test mode — pay with <b>4242 4242 4242 4242</b>, any future date, any CVC.
        </p>
      )}
      {!simulated ? (
        <button
          className="mt-5 rounded-xl bg-[#635bff] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#4f46e5] disabled:opacity-50"
          disabled={start.isPending || !!start.data?.url}
          onClick={() => start.mutate()}
        >
          {start.isPending || start.data?.url ? "Opening checkout…" : `Pay ${price}${stripeMode === "off" ? "" : " with Stripe"}`}
        </button>
      ) : (
        <form
          className="mt-5 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            fake.mutate();
          }}
        >
          <p className="w-full text-[13px] text-muted">
            Simulated checkout (Stripe isn't connected yet) — use test card 4242 4242 4242 4242.
          </p>
          <input
            className="input max-w-xs"
            placeholder="1234 1234 1234 1234"
            inputMode="numeric"
            autoComplete="off"
            value={card}
            onChange={(e) => setCard(e.target.value.replace(/[^\d ]/g, "").slice(0, 19))}
            required
          />
          <button className="btn" disabled={fake.isPending}>{fake.isPending ? "Processing…" : `Pay ${price}`}</button>
        </form>
      )}
      {(start.isError || fake.isError) && (
        <p className="mt-3 text-[14px] text-warn">{((start.error || fake.error) as Error).message}</p>
      )}
    </div>
  );
}
