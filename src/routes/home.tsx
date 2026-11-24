import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { api, money, type PayIn, type Payout, PAYIN_ICON, PAYOUT_ICON } from "../api";

const PAYINS: PayIn[] = ["bank", "debit", "credit", "cash"];
const PAYOUTS: Payout[] = ["bank", "cash", "mobile", "card"];

export function HomePage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });

  const [amount, setAmount] = useState(String(search.amount ?? 500));
  const [from, setFrom] = useState(search.from ?? "USD");
  const [to, setTo] = useState(search.to ?? "MX");
  const [payIn, setPayIn] = useState<PayIn>(search.payIn ?? "bank");
  const [submitted, setSubmitted] = useState({ amount: Number(amount), from, to, payIn });
  const [method, setMethod] = useState<Payout | "all">("all");

  // Pay-in choice re-quotes immediately; other inputs wait for "Compare".
  useEffect(() => setSubmitted((s) => ({ ...s, payIn })), [payIn]);
  useEffect(() => {
    navigate({ search: submitted, replace: true });
    setMethod("all");
  }, [submitted, navigate]);

  const cmp = useQuery({
    queryKey: ["compare", submitted],
    queryFn: () => api.compare(submitted.amount, submitted.from, submitted.to, submitted.payIn),
    enabled: submitted.amount >= 10,
  });

  const byRegion = useMemo(() => {
    const m = new Map<string, NonNullable<typeof meta.data>["countries"]>();
    for (const c of meta.data?.countries ?? []) m.set(c.region, [...(m.get(c.region) ?? []), c]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [meta.data]);

  const data = cmp.data;
  const cur = data?.country.currency ?? "";
  const allRoutes = data?.routes ?? [];
  const routes = method === "all" ? allRoutes : allRoutes.filter((r) => r.payout === method);
  const best = allRoutes[0];
  const bestBank = data?.banks[0];
  const counts = Object.fromEntries(PAYOUTS.map((p) => [p, allRoutes.filter((r) => r.payout === p).length]));
  const labels = meta.data?.payoutLabels;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-52 left-10 h-[420px] w-[420px] rounded-full bg-sky/25 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-36 pt-16 sm:px-6 md:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium tracking-wide text-sky">
            {meta.data?.countries.length ?? 195} countries · {meta.data?.providers ?? 11} providers · live rates
          </p>
          <h1 className="max-w-3xl font-display text-[40px] font-extrabold leading-[1.05] tracking-tight md:text-[60px]">
            Send more, <span className="bg-gradient-to-r from-sky to-[#a9dcff] bg-clip-text text-transparent">pay less.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/70">
            Compare every route home — bank deposit, cash pickup, mobile money and card — against the live mid-market rate
            and your own bank's wire fees.
          </p>
        </div>
      </section>

      <section className="relative mx-auto -mt-28 max-w-6xl px-4 pb-24 sm:px-6">
        {/* Form */}
        <form
          className="card p-5 shadow-xl shadow-ink/10"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted({ amount: Number(amount), from, to, payIn });
          }}
        >
          <div className="grid gap-4 md:grid-cols-[1fr_0.7fr_1.6fr_auto] md:items-end">
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
              <label className="label">Recipient's country</label>
              <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
                {byRegion.map(([region, list]) => (
                  <optgroup key={region} label={region}>
                    {list.map((c) => (
                      <option key={c.iso} value={c.iso} disabled={c.sanctioned}>
                        {c.flag} {c.name} ({c.currency}){c.sanctioned ? " — unavailable" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <button className="btn h-[46px]" type="submit">Compare</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="mr-1 text-[13px] font-medium text-muted">Pay with</span>
            {PAYINS.map((p) => (
              <button type="button" key={p} onClick={() => setPayIn(p)} className={`chip ${payIn === p ? "chip-on" : ""}`}>
                {PAYIN_ICON[p]} {meta.data?.payInLabels[p] ?? p}
              </button>
            ))}
          </div>
        </form>

        {cmp.isError && <p className="mt-6 text-warn">{(cmp.error as Error).message}</p>}
        {cmp.isLoading && <p className="mt-6 text-muted">Finding the cheapest route…</p>}

        {data?.blocked && (
          <div className="card mt-8 p-6 text-[15px]">
            Money transfers to {data.country.flag} {data.country.name} aren't available: the country is under comprehensive
            sanctions, so licensed providers don't serve it.
          </div>
        )}

        {data && !data.blocked && (
          <>
            {best ? (
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <Stat label="Cheapest route" value={best.providerName} sub={`${PAYOUT_ICON[best.payout]} ${labels?.[best.payout]}`} />
                <Stat label={`${data.country.flag} Recipient gets`} value={money(best.receiveAmount, cur)} sub={`Arrives: ${best.speed}`} />
                {bestBank && (
                  <Stat
                    accent
                    label="You save vs. sending from a bank"
                    value={money(Math.max(0, best.receiveAmount - bestBank.receiveAmount), cur)}
                    sub={`compared with ${bestBank.bank}, the cheapest major bank`}
                  />
                )}
              </div>
            ) : (
              <div className="card mt-8 p-6 text-[15px] text-muted">
                No provider offers this route when paying by {meta.data?.payInLabels[submitted.payIn].toLowerCase()}. Try another
                way to pay.
              </div>
            )}

            <div className="mt-3 text-[13px] text-muted">
              Mid-market rate: 1 {submitted.from} = {data.midRate.toLocaleString()} {cur} ·{" "}
              {data.live ? "live rate" : "offline fallback rate"} · updated {new Date(data.ratesAsOf).toLocaleTimeString()}
            </div>

            {allRoutes.length > 0 && (
              <>
                <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="font-display text-[24px] font-bold tracking-tight">
                    {allRoutes.length} routes to {data.country.name}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <button className={`chip ${method === "all" ? "chip-on" : ""}`} onClick={() => setMethod("all")}>
                      All methods
                    </button>
                    {PAYOUTS.map((p) => (
                      <button
                        key={p}
                        disabled={!counts[p]}
                        className={`chip disabled:opacity-40 ${method === p ? "chip-on" : ""}`}
                        onClick={() => setMethod(p)}
                      >
                        {PAYOUT_ICON[p]} {labels?.[p]} <span className="opacity-70">{counts[p]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card mt-4 overflow-hidden">
                  <div className="hidden grid-cols-[1.5fr_1.1fr_0.8fr_1fr_1.3fr_auto] gap-4 border-b border-line bg-mist px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-muted md:grid">
                    <div>Provider</div>
                    <div>Receive as</div>
                    <div>Fees</div>
                    <div>Their rate</div>
                    <div>Recipient gets</div>
                    <div />
                  </div>
                  {routes.map((q, i) => {
                    const isBest = q === best;
                    return (
                      <div
                        key={`${q.providerId}-${q.payout}`}
                        className={`grid gap-2 border-b border-line px-5 py-4 last:border-b-0 md:grid-cols-[1.5fr_1.1fr_0.8fr_1fr_1.3fr_auto] md:items-center md:gap-4 ${isBest ? "bg-mist/60" : ""}`}
                      >
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="text-[13px] font-medium text-muted">#{i + 1}</span>
                          {q.providerName}
                          {isBest && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">Cheapest</span>}
                        </div>
                        <div className="text-[14px]">
                          {PAYOUT_ICON[q.payout]} {labels?.[q.payout]}
                          <div className="text-[12px] text-muted">{q.speed}</div>
                        </div>
                        <div className="text-[14px]">{money(q.fee, submitted.from)}</div>
                        <div className="text-[14px]">{q.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                        <div>
                          <div className="font-display text-[19px] font-bold">{money(q.receiveAmount, cur)}</div>
                          <div className="text-[12px] text-muted">Total cost {money(q.totalCost, submitted.from)}</div>
                        </div>
                        <div>
                          <button
                            className={isBest ? "btn" : "btn-ghost"}
                            onClick={() =>
                              navigate({
                                to: "/send",
                                search: { ...submitted, provider: q.providerId, payout: q.payout },
                              })
                            }
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {data.banks.length > 0 && (
              <div className="mt-14">
                <h2 className="font-display text-[24px] font-bold tracking-tight">What would your bank charge?</h2>
                <p className="mt-1 max-w-3xl text-[14px] text-muted">
                  {data.sepa
                    ? "Euro → euro transfers inside the SEPA area are normally free and arrive within a day."
                    : `An international (SWIFT) wire from a major ${submitted.from} bank: the bank's outgoing fee, plus typical intermediary-bank and receiving-bank deductions, plus the bank's exchange-rate markup.`}
                </p>
                <div className="card mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[14px]">
                    <thead className="bg-mist text-left text-[12px] font-semibold uppercase tracking-wider text-muted">
                      <tr>
                        <th className="px-5 py-3">Bank</th>
                        <th className="px-5 py-3">Wire fee</th>
                        <th className="px-5 py-3">Other bank fees</th>
                        <th className="px-5 py-3">Their rate</th>
                        <th className="px-5 py-3">Recipient gets</th>
                        <th className="px-5 py-3">vs. cheapest route</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.banks.map((b) => (
                        <tr key={b.bank} className="border-t border-line">
                          <td className="px-5 py-3 font-semibold">🏛️ {b.bank}</td>
                          <td className="px-5 py-3">{money(b.outgoingFee, submitted.from)}</td>
                          <td className="px-5 py-3">{money(b.otherFees, submitted.from)}</td>
                          <td className="px-5 py-3">{b.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td className="px-5 py-3 font-display font-bold">{money(b.receiveAmount, cur)}</td>
                          <td className="px-5 py-3 font-medium text-warn">
                            {best ? `−${money(Math.max(0, best.receiveAmount - b.receiveAmount), cur)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[12px] text-muted">Bank fees are indicative estimates from typical published tariffs; check your bank.</p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "bg-gradient-to-br from-brand to-brand-dark text-white" : "card"}`}>
      <div className={`text-[13px] ${accent ? "text-white/75" : "text-muted"}`}>{label}</div>
      <div className="mt-1 font-display text-[26px] font-extrabold leading-tight tracking-tight">{value}</div>
      {sub && <div className={`mt-1 text-[12px] ${accent ? "text-white/75" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}
