import pg from "pg";
import { randomUUID } from "node:crypto";

export type Transfer = {
  id: string;
  sender_name: string;
  sender_email: string;
  recipient_name: string;
  recipient_country: string;
  send_amount: number;
  send_currency: string;
  receive_currency: string;
  provider_id: string;
  provider_name: string;
  fee: number;
  rate: number;
  receive_amount: number;
  service_fee: number;
  total_charged: number;
  status: "pending" | "paid";
  created_at: string;
  paid_at: string | null;
};

const url = process.env.DATABASE_URL;
const pool = url
  ? new pg.Pool({ connectionString: url, ssl: url.includes("railway.internal") || url.includes("localhost") ? false : { rejectUnauthorized: false } })
  : null;
const memory = new Map<string, Transfer>();

export const usingPostgres = !!pool;

export async function initDb() {
  if (!pool) {
    console.log("DATABASE_URL not set — using in-memory storage");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfers (
      id UUID PRIMARY KEY,
      sender_name TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_country TEXT NOT NULL,
      send_amount NUMERIC(14,2) NOT NULL,
      send_currency TEXT NOT NULL,
      receive_currency TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      fee NUMERIC(14,2) NOT NULL,
      rate NUMERIC(20,6) NOT NULL,
      receive_amount NUMERIC(20,2) NOT NULL,
      service_fee NUMERIC(14,2) NOT NULL,
      total_charged NUMERIC(14,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ
    )`);
  console.log("Postgres ready");
}

const NUMERIC = ["send_amount", "fee", "rate", "receive_amount", "service_fee", "total_charged"] as const;
function normalize(row: any): Transfer {
  for (const k of NUMERIC) row[k] = Number(row[k]);
  return row as Transfer;
}

export async function createTransfer(t: Omit<Transfer, "id" | "status" | "created_at" | "paid_at">) {
  const row: Transfer = { ...t, id: randomUUID(), status: "pending", created_at: new Date().toISOString(), paid_at: null };
  if (!pool) {
    memory.set(row.id, row);
    return row;
  }
  const cols = Object.keys(row);
  const { rows } = await pool.query(
    `INSERT INTO transfers (${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
    Object.values(row),
  );
  return normalize(rows[0]);
}

export async function getTransfer(id: string) {
  if (!pool) return memory.get(id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await pool.query("SELECT * FROM transfers WHERE id = $1", [id]);
  return rows[0] ? normalize(rows[0]) : null;
}

export async function markPaid(id: string) {
  if (!pool) {
    const t = memory.get(id);
    if (!t) return null;
    t.status = "paid";
    t.paid_at = new Date().toISOString();
    return t;
  }
  const { rows } = await pool.query(
    "UPDATE transfers SET status='paid', paid_at=now() WHERE id=$1 AND status='pending' RETURNING *",
    [id],
  );
  return rows[0] ? normalize(rows[0]) : getTransfer(id);
}

export async function listTransfers(email: string) {
  if (!pool)
    return [...memory.values()]
      .filter((t) => t.sender_email === email)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { rows } = await pool.query(
    "SELECT * FROM transfers WHERE sender_email = $1 ORDER BY created_at DESC LIMIT 50",
    [email],
  );
  return rows.map(normalize);
}
