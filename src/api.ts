export type Payout = "bank" | "cash" | "mobile" | "card";
export type PayIn = "bank" | "debit" | "credit" | "cash";
export type Country = { iso: string; name: string; currency: string; region: string; flag: string; sanctioned: boolean };
export type Meta = {
  sendCurrencies: string[];
  countries: Country[];
  providers: number;
  payoutLabels: Record<Payout, string>;
  payInLabels: Record<PayIn, string>;
  serviceFeeUsd: number;
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
  payout_method: Payout;
  pay_in_method: PayIn;
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
  compare: (amount: number, from: string, to: string, payIn: PayIn) =>
    req<Comparison>(`/api/compare?amount=${amount}&from=${from}&to=${to}&payIn=${payIn}`),
  createTransfer: (body: Record<string, unknown>) =>
    req<Transfer>("/api/transfers", { method: "POST", body: JSON.stringify(body) }),
  transfer: (id: string) => req<Transfer>(`/api/transfers/${id}`),
  pay: (id: string, body: Record<string, string>) =>
    req<Transfer>(`/api/transfers/${id}/pay`, { method: "POST", body: JSON.stringify(body) }),
  stripeSession: (id: string) => req<{ url: string }>(`/api/transfers/${id}/stripe-session`, { method: "POST" }),
  confirm: (id: string, sessionId: string) =>
    req<Transfer>(`/api/transfers/${id}/confirm`, { method: "POST", body: JSON.stringify({ sessionId }) }),
  history: (email: string) => req<Transfer[]>(`/api/history?email=${encodeURIComponent(email)}`),
};

export const money = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`;
  }
};

export const PAYOUT_ICON: Record<Payout, string> = { bank: "🏦", cash: "💵", mobile: "📱", card: "💳" };
export const PAYIN_ICON: Record<PayIn, string> = { bank: "🏦", debit: "💳", credit: "💳", cash: "💵" };
