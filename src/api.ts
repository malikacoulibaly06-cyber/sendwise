export const DISCLOSURE =
  "CheapSend is free to use. Some “Go to” links are affiliate links: if you sign up with a provider through them, we may earn a commission at no extra cost to you. Routes are always ranked by what your recipient gets — never by commission.";

export type Payout = "bank" | "cash" | "mobile" | "card";
export type PayIn = "bank" | "debit" | "credit" | "cash";
export type Country = { iso: string; name: string; currency: string; region: string; flag: string; sanctioned: boolean };
export type Meta = {
  sendCurrencies: string[];
  countries: Country[];
  providers: number;
  payoutLabels: Record<Payout, string>;
  payInLabels: Record<PayIn, string>;
  partners: Record<string, { promo: string | null; affiliate: boolean }>;
  proPriceUsd: number;
  stripe: "off" | "test" | "live";
};
export type Route = {
  providerId: string;
  providerName: string;
  url: string;
  payout: Payout;
  speed: string;
  fee: number;
  rate: number;
  receiveAmount: number;
  totalCost: number;
};
export type BankQuote = {
  bank: string;
  outgoingFee: number;
  otherFees: number;
  rate: number;
  receiveAmount: number;
  totalCost: number;
};
export type Comparison = {
  country: Country;
  blocked: boolean;
  sepa?: boolean;
  midRate: number;
  live: boolean;
  ratesAsOf: string;
  routes: Route[];
  banks: BankQuote[];
};
export type Watch = {
  id: string;
  email: string;
  amount: number;
  send_currency: string;
  country_iso: string;
  pay_in: PayIn;
  baseline_receive: number;
  baseline_provider: string;
  created_at: string;
  country: Country | null;
  now: Route | null;
};
export type Stats = {
  total: number;
  last7: number;
  byProvider: { key: string; n: number }[];
  byCountry: { key: string; n: number }[];
  byPayout: { key: string; n: number }[];
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
  compare: (amount: number, from: string, to: string, payIn: PayIn) =>
    req<Comparison>(`/api/compare?amount=${amount}&from=${from}&to=${to}&payIn=${payIn}`),
  stats: () => req<Stats>("/api/stats"),
  watch: (email: string) => req<{ email: string; pro: boolean; watches: Watch[] }>(`/api/watch?email=${encodeURIComponent(email)}`),
  addWatch: (body: Record<string, unknown>) => req<{ ok: true }>("/api/watch", { method: "POST", body: JSON.stringify(body) }),
  deleteWatch: (id: string, email: string) =>
    req<{ ok: true }>(`/api/watch/${id}?email=${encodeURIComponent(email)}`, { method: "DELETE" }),
  proCheckout: (email: string) =>
    req<{ url?: string; simulated?: boolean; alreadyPro?: boolean }>("/api/watch/checkout", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  simulatePay: (email: string, cardNumber: string) =>
    req<{ ok: true }>("/api/watch/simulate-pay", { method: "POST", body: JSON.stringify({ email, cardNumber }) }),
  confirmPro: (sessionId: string) =>
    req<{ email: string; pro: true }>("/api/watch/confirm", { method: "POST", body: JSON.stringify({ sessionId }) }),
};

export function goUrl(providerId: string, p: { amount: number; from: string; to: string; payIn: string; payout: string }) {
  const q = new URLSearchParams({ amount: String(p.amount), from: p.from, to: p.to, payIn: p.payIn, payout: p.payout });
  return `/go/${providerId}?${q}`;
}

export function getStoredEmail() {
  try {
    return localStorage.getItem("cheapsend-email") ?? "";
  } catch {
    return "";
  }
}
export function storeEmail(e: string) {
  try {
    localStorage.setItem("cheapsend-email", e);
  } catch {}
}

export const money = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`;
  }
};

export const PAYOUT_ICON: Record<Payout, string> = { bank: "🏦", cash: "💵", mobile: "📱", card: "💳" };
export const PAYIN_ICON: Record<PayIn, string> = { bank: "🏦", debit: "💳", credit: "💳", cash: "💵" };
