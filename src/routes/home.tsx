import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { api, money } from "../api";

export function HomePage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });

  const [amount, setAmount] = useState(String(search.amount ?? 500));
  const [from, setFrom] = useState(search.from ?? "USD");
  const [to, setTo] = useState(search.to ?? "MXN");
  const [submitted, setSubmitted] = useState({ amount: Number(amount), from, to });

  useEffect(() => {
    navigate({ search: submitted, replace: true });
  }, [submitted, navigate]);

  const cmp = useQuery({
    queryKey: ["compare", submitted],
    queryFn: () => api.compare(submitted.amount, submitted.from, submitted.to),
    enabled: submitted.amount >= 10,
  });

  const quotes = cmp.data?.quotes ?? [];
  const best = quotes[0];
  const worst = quotes[quotes.length - 1];
  const dest = meta.data?.destinations.find((d) => d.currency === submitted.to);

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-12">
        <p className="mb-5 text-[13px] font-medium uppercase tracking-[0.14em] text-clay-dark">Send money abroad, for less</p>
        <h1 className="max-w-3xl font-serif text-[44px] leading-[1.08] tracking-tight md:text-[64px]">
          Find the cheapest route home.
        </h1>
        <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-stone">
          We compare {meta.data?.providers ?? 9} money-transfer services against the live mid-market rate, so more of
          your money reaches the people you love.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <form
          className="card grid gap-4 p-5 md:grid-cols-[1.2fr_1fr_1.4fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted({ amount: Number(amount), from, to });
          }}
        >
          <div>
            <label className="label">You send</label>
            <input className="input" type="number" min={10} max={50000} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">From</label>
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
              {(meta.data?.sendCurrencies ?? ["USD"]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">To</label>
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {(meta.data?.destinations ?? []).map((d) => (
                <option key={d.currency} value={d.currency}>
                  {d.flag} {d.country} ({d.currency})
                </option>
              ))}
            </select>
          </div>
          <button className="btn h-[46px]" type="submit">Compare</button>
        </form>

        {cmp.isError && <p className="mt-6 text-clay-dark">{(cmp.error as Error).message}</p>}
        {cmp.isLoading && <p className="mt-6 text-stone">Finding the cheapest route…</p>}

        {best && worst && (
          <>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Stat label="Best route" value={best.providerName} />
              <Stat
                label={`${dest?.flag ?? ""} Recipient gets`}
                value={money(best.receiveAmount, submitted.to)}
              />
              <Stat
                label="You save vs. most expensive"
                value={money(best.receiveAmount - worst.receiveAmount, submitted.to)}
                accent
              />
            </div>

            <div className="mt-3 text-[13px] text-stone">
              Mid-market rate: 1 {submitted.from} = {cmp.data!.midRate.toLocaleString()} {submitted.to} ·{" "}
              {cmp.data!.live ? "live rate" : "offline fallback rate"} · updated{" "}
              {new Date(cmp.data!.ratesAsOf).toLocaleTimeString()}
            </div>

            <div className="card mt-8 overflow-hidden">
              <div className="hidden grid-cols-[1.6fr_1fr_1fr_1.2fr_1fr_auto] gap-4 border-b border-line bg-oat px-5 py-3 text-[12px] font-medium uppercase tracking-wider text-stone md:grid">
                <div>Provider</div>
                <div>Fee</div>
                <div>Their rate</div>
                <div>Recipient gets</div>
                <div>Speed</div>
                <div />
              </div>
              {quotes.map((q, i) => (
                <div
                  key={q.providerId}
                  className={`grid gap-2 border-b border-line px-5 py-4 last:border-b-0 md:grid-cols-[1.6fr_1fr_1fr_1.2fr_1fr_auto] md:items-center md:gap-4 ${i === 0 ? "bg-[#fbf3ee]" : ""}`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {q.providerName}
                    {i === 0 && (
                      <span className="rounded-full bg-clay px-2 py-0.5 text-[11px] font-medium text-white">Cheapest</span>
                    )}
                  </div>
                  <div className="text-[14px]">{money(q.fee, submitted.from)}</div>
                  <div className="text-[14px]">{q.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                  <div>
                    <div className="font-serif text-[20px]">{money(q.receiveAmount, submitted.to)}</div>
                    <div className="text-[12px] text-stone">Total cost {money(q.totalCost, submitted.from)}</div>
                  </div>
                  <div className="text-[14px] text-stone">{q.speed}</div>
                  <div>
                    <button
                      className={i === 0 ? "btn" : "btn-ghost"}
                      onClick={() =>
                        navigate({
                          to: "/send",
                          search: { amount: submitted.amount, from: submitted.from, to: submitted.to, provider: q.providerId },
                        })
                      }
                    >
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "bg-slate-ink text-ivory" : "bg-oat"}`}>
      <div className={`text-[13px] ${accent ? "text-[#bfbdb4]" : "text-stone"}`}>{label}</div>
      <div className="mt-1 font-serif text-[28px] leading-tight">{value}</div>
    </div>
  );
}
