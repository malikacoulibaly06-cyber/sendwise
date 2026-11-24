import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

// Anonymous outbound-click stats — useful evidence when applying to
// affiliate programs ("we sent N people to you last week").
export function StatsPage() {
  const s = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  const country = (iso: string) => {
    const c = meta.data?.countries.find((x) => x.iso === iso);
    return c ? `${c.flag} ${c.name}` : iso;
  };
  const payout = (k: string) => meta.data?.payoutLabels[k as keyof NonNullable<typeof meta.data>["payoutLabels"]] ?? k;

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-[34px] font-extrabold tracking-tight">Click stats</h1>
      <p className="mt-2 text-[15px] text-muted">Anonymous clicks from CheapSend to providers. No personal data is stored.</p>
      {s.data && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Tile label="Total clicks" value={s.data.total} />
            <Tile label="Last 7 days" value={s.data.last7} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Table title="By provider" rows={s.data.byProvider} />
            <Table title="By destination" rows={s.data.byCountry.map((r) => ({ ...r, key: country(r.key) }))} />
            <Table title="By payout method" rows={s.data.byPayout.map((r) => ({ ...r, key: payout(r.key) }))} />
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 font-display text-[32px] font-extrabold">{value.toLocaleString()}</div>
    </div>
  );
}

function Table({ title, rows }: { title: string; rows: { key: string; n: number }[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-mist px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted">{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 text-[14px] text-muted">No clicks yet.</div>
      ) : (
        rows.map((r) => (
          <div key={r.key} className="flex justify-between border-b border-line px-4 py-2.5 text-[14px] last:border-b-0">
            <span>{r.key}</span>
            <span className="font-semibold">{r.n}</span>
          </div>
        ))
      )}
    </div>
  );
}
