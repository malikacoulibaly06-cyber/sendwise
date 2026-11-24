// Fee models are ESTIMATES based on each provider's typical published pricing
// (fixed fee + percentage fee + FX markup over the mid-market rate).
// Real quotes vary by corridor, payment method and amount; users should confirm
// on the provider's site. Update these numbers as pricing changes.

export type Provider = {
  id: string;
  name: string;
  url: string;
  fixedFeeUsd: number; // flat fee, expressed in USD and converted to the send currency
  pctFee: number; // % of send amount
  fxMarkup: number; // % below mid-market rate
  speed: string;
  minSendUsd?: number;
};

export const PROVIDERS: Provider[] = [
  { id: "wise", name: "Wise", url: "https://wise.com", fixedFeeUsd: 0.99, pctFee: 0.57, fxMarkup: 0, speed: "Minutes to 1 day" },
  { id: "revolut", name: "Revolut", url: "https://revolut.com", fixedFeeUsd: 0, pctFee: 0.5, fxMarkup: 0.5, speed: "1–2 days" },
  { id: "remitly", name: "Remitly", url: "https://remitly.com", fixedFeeUsd: 1.99, pctFee: 0, fxMarkup: 1.4, speed: "Minutes (Express)" },
  { id: "worldremit", name: "WorldRemit", url: "https://worldremit.com", fixedFeeUsd: 2.99, pctFee: 0, fxMarkup: 1.6, speed: "Minutes" },
  { id: "xe", name: "Xe", url: "https://xe.com", fixedFeeUsd: 2.99, pctFee: 0, fxMarkup: 1.2, speed: "1–2 days" },
  { id: "moneygram", name: "MoneyGram", url: "https://moneygram.com", fixedFeeUsd: 4.99, pctFee: 0, fxMarkup: 2.5, speed: "Minutes (cash pickup)" },
  { id: "westernunion", name: "Western Union", url: "https://westernunion.com", fixedFeeUsd: 5.0, pctFee: 0, fxMarkup: 3.0, speed: "Minutes (cash pickup)" },
  { id: "xoom", name: "Xoom (PayPal)", url: "https://xoom.com", fixedFeeUsd: 4.99, pctFee: 0, fxMarkup: 3.2, speed: "Minutes" },
  { id: "bank", name: "Bank wire (typical US bank)", url: "", fixedFeeUsd: 45, pctFee: 0, fxMarkup: 3.5, speed: "2–5 days" },
];

export const SEND_CURRENCIES = ["USD", "EUR", "GBP", "CAD"] as const;

export const DESTINATIONS: { country: string; currency: string; flag: string }[] = [
  { country: "Mexico", currency: "MXN", flag: "🇲🇽" },
  { country: "India", currency: "INR", flag: "🇮🇳" },
  { country: "Philippines", currency: "PHP", flag: "🇵🇭" },
  { country: "Nigeria", currency: "NGN", flag: "🇳🇬" },
  { country: "Senegal / Côte d'Ivoire / Mali", currency: "XOF", flag: "🇸🇳" },
  { country: "Cameroon / Gabon", currency: "XAF", flag: "🇨🇲" },
  { country: "Morocco", currency: "MAD", flag: "🇲🇦" },
  { country: "Kenya", currency: "KES", flag: "🇰🇪" },
  { country: "Ghana", currency: "GHS", flag: "🇬🇭" },
  { country: "Peru", currency: "PEN", flag: "🇵🇪" },
  { country: "Colombia", currency: "COP", flag: "🇨🇴" },
  { country: "Brazil", currency: "BRL", flag: "🇧🇷" },
  { country: "Dominican Republic", currency: "DOP", flag: "🇩🇴" },
  { country: "Vietnam", currency: "VND", flag: "🇻🇳" },
  { country: "Pakistan", currency: "PKR", flag: "🇵🇰" },
  { country: "China", currency: "CNY", flag: "🇨🇳" },
  { country: "France / Eurozone", currency: "EUR", flag: "🇪🇺" },
  { country: "United Kingdom", currency: "GBP", flag: "🇬🇧" },
];

// Fallback mid-market rates (units per 1 USD) used if the live feed is unreachable.
const FALLBACK: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, CAD: 1.38, MXN: 18.5, INR: 85, PHP: 58, NGN: 1550,
  XOF: 605, XAF: 605, MAD: 9.9, KES: 129, GHS: 15.5, PEN: 3.75, COP: 4100, BRL: 5.6,
  DOP: 61, VND: 25500, PKR: 280, CNY: 7.2,
};

let cache: { rates: Record<string, number>; fetchedAt: number; live: boolean } | null = null;

export async function getRates() {
  if (cache && Date.now() - cache.fetchedAt < 60 * 60 * 1000) return cache;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) });
    const json = (await res.json()) as { result: string; rates: Record<string, number> };
    if (json.result !== "success") throw new Error("bad response");
    cache = { rates: json.rates, fetchedAt: Date.now(), live: true };
  } catch {
    cache = { rates: FALLBACK, fetchedAt: Date.now(), live: false };
  }
  return cache;
}

export type Quote = {
  providerId: string;
  providerName: string;
  url: string;
  speed: string;
  fee: number; // in send currency
  rate: number; // receive per 1 send, after markup
  receiveAmount: number;
  totalCost: number; // fee + FX markup cost, in send currency
};

export async function compare(amount: number, from: string, to: string) {
  const { rates, live, fetchedAt } = await getRates();
  const rFrom = rates[from];
  const rTo = rates[to];
  if (!rFrom || !rTo) throw new Error(`Unsupported currency pair ${from}->${to}`);
  const mid = rTo / rFrom;
  const usdPerFrom = 1 / rFrom;

  const quotes: Quote[] = PROVIDERS.map((p) => {
    const fee = p.fixedFeeUsd / usdPerFrom + (amount * p.pctFee) / 100;
    const rate = mid * (1 - p.fxMarkup / 100);
    const receiveAmount = Math.max(0, (amount - fee) * rate);
    const totalCost = amount - receiveAmount / mid;
    return {
      providerId: p.id,
      providerName: p.name,
      url: p.url,
      speed: p.speed,
      fee: round(fee, 2),
      rate: round(rate, 6),
      receiveAmount: round(receiveAmount, 2),
      totalCost: round(totalCost, 2),
    };
  }).sort((a, b) => b.receiveAmount - a.receiveAmount);

  return { midRate: round(mid, 6), live, ratesAsOf: new Date(fetchedAt).toISOString(), quotes };
}

function round(n: number, d: number) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
