import pg from "pg";
import { randomUUID } from "node:crypto";

// Storage for the referral model:
//  - clicks:          anonymous outbound clicks to providers (no personal data)
//  - watch_accounts:  emails that bought Rate Watch
//  - watches:         saved corridors per email
// The old `transfers` table (from the simulated-transfer version) is left
// untouched in Postgres; it's simply no longer used.

export type Click = {
  provider_id: string;
  payout: string;
  pay_in: string;
  send_currency: string;
  amount: number;
  country_iso: string;
  affiliate: boolean;
  created_at?: string;
};
export type Watch = {
  id: string;
  email: string;
  amount: number;
  send_currency: string;
  country_iso: string;
  pay_in: string;
  baseline_receive: number;
  baseline_provider: string;
  created_at: string;
};

const url = process.env.DATABASE_URL;
const pool = url
  ? new pg.Pool({ connectionString: url, ssl: url.includes("railway.internal") || url.includes("localhost") ? false : { rejectUnauthorized: false } })
  : null;
export const usingPostgres = !!pool;

const mem = { clicks: [] as Click[], accounts: new Map<string, string>(), watches: [] as Watch[] };

export async function initDb() {
  if (!pool) {
    console.log("DATABASE_URL not set — using in-memory storage");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clicks (
      id BIGSERIAL PRIMARY KEY,
      provider_id TEXT NOT NULL,
      payout TEXT NOT NULL,
      pay_in TEXT NOT NULL,
      send_currency TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      country_iso TEXT NOT NULL,
      affiliate BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS watch_accounts (
      email TEXT PRIMARY KEY,
      paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      stripe_session TEXT
    );
    CREATE TABLE IF NOT EXISTS watches (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      send_currency TEXT NOT NULL,
      country_iso TEXT NOT NULL,
      pay_in TEXT NOT NULL,
      baseline_receive NUMERIC(20,2) NOT NULL,
      baseline_provider TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS watches_email_idx ON watches(email);`);
  console.log("Postgres ready");
}

export async function recordClick(c: Click) {
  if (!pool) return void mem.clicks.push({ ...c, created_at: new Date().toISOString() });
  await pool.query(
    "INSERT INTO clicks (provider_id,payout,pay_in,send_currency,amount,country_iso,affiliate) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [c.provider_id, c.payout, c.pay_in, c.send_currency, c.amount, c.country_iso, c.affiliate],
  );
}

export async function clickStats() {
  if (!pool) {
    const by = (k: keyof Click) => {
      const m = new Map<string, number>();
      for (const c of mem.clicks) m.set(String(c[k]), (m.get(String(c[k])) ?? 0) + 1);
      return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n).slice(0, 15);
    };
    return { total: mem.clicks.length, last7: mem.clicks.length, byProvider: by("provider_id"), byCountry: by("country_iso"), byPayout: by("payout") };
  }
  const q = async (col: string) =>
    (await pool.query(`SELECT ${col} AS key, count(*)::int AS n FROM clicks GROUP BY 1 ORDER BY 2 DESC LIMIT 15`)).rows;
  const { rows } = await pool.query(
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS last7 FROM clicks",
  );
  return { ...rows[0], byProvider: await q("provider_id"), byCountry: await q("country_iso"), byPayout: await q("payout") };
}

export async function isPro(email: string) {
  if (!pool) return mem.accounts.has(email);
  const { rows } = await pool.query("SELECT 1 FROM watch_accounts WHERE email=$1", [email]);
  return rows.length > 0;
}

export async function grantPro(email: string, stripeSession: string | null) {
  if (!pool) return void mem.accounts.set(email, stripeSession ?? "simulated");
  await pool.query(
    "INSERT INTO watch_accounts (email, stripe_session) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING",
    [email, stripeSession],
  );
}

const MAX_WATCHES = 10;

export async function addWatch(w: Omit<Watch, "id" | "created_at">) {
  const row: Watch = { ...w, id: randomUUID(), created_at: new Date().toISOString() };
  const existing = await listWatches(w.email);
  if (existing.length >= MAX_WATCHES) throw new Error(`You can watch up to ${MAX_WATCHES} routes`);
  if (!pool) return void mem.watches.push(row);
  await pool.query(
    `INSERT INTO watches (id,email,amount,send_currency,country_iso,pay_in,baseline_receive,baseline_provider)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [row.id, row.email, row.amount, row.send_currency, row.country_iso, row.pay_in, row.baseline_receive, row.baseline_provider],
  );
}

export async function listWatches(email: string): Promise<Watch[]> {
  if (!pool) return mem.watches.filter((w) => w.email === email);
  const { rows } = await pool.query("SELECT * FROM watches WHERE email=$1 ORDER BY created_at DESC", [email]);
  return rows.map((r) => ({ ...r, amount: Number(r.amount), baseline_receive: Number(r.baseline_receive) }));
}

export async function deleteWatch(email: string, id: string) {
  if (!pool) return void (mem.watches = mem.watches.filter((w) => !(w.id === id && w.email === email)));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await pool.query("DELETE FROM watches WHERE id=$1 AND email=$2", [id, email]);
}
