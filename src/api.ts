export type Destination = { country: string; currency: string; flag: string };
export type Meta = { sendCurrencies: string[]; destinations: Destination[]; providers: number; serviceFeeUsd: number };
export type Quote = {
  providerId: string;
  providerName: string;
  url: string;
  speed: string;
  fee: number;
  rate: number;
  receiveAmount: number;
  totalCost: number;
};
export type Comparison = { midRate: number; live: boolean; ratesAsOf: string; quotes: Quote[] };
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

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  meta: () => req<Meta>("/api/meta"),
  compare: (amount: number, from: string, to: string) =>
    req<Comparison>(`/api/compare?amount=${amount}&from=${from}&to=${to}`),
  createTransfer: (body: Record<string, unknown>) =>
    req<Transfer>("/api/transfers", { method: "POST", body: JSON.stringify(body) }),
  transfer: (id: string) => req<Transfer>(`/api/transfers/${id}`),
  pay: (id: string, body: Record<string, string>) =>
    req<Transfer>(`/api/transfers/${id}/pay`, { method: "POST", body: JSON.stringify(body) }),
  history: (email: string) => req<Transfer[]>(`/api/history?email=${encodeURIComponent(email)}`),
};

export const money = (n: number, cur: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
