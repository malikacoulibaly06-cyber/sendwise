// Provider pricing models. All numbers are ESTIMATES of typical published
// pricing (flat fee + % fee + FX markup over the mid-market rate). Real quotes
// vary by corridor, amount, promo and payment method — always confirm on the
// provider's site. Update these as pricing changes.

import { ADVANCED, byIso, CARD_PAYOUT, type Country, HARD_TO_SERVE, MOBILE_MONEY, SANCTIONED } from "./countries.ts";

export type Payout = "bank" | "cash" | "mobile" | "card";
export type PayIn = "bank" | "debit" | "credit" | "cash";

export const PAYOUT_LABEL: Record<Payout, string> = {
  bank: "Bank deposit",
  cash: "Cash pickup",
  mobile: "Mobile money",
  card: "Debit card deposit",
};
export const PAYIN_LABEL: Record<PayIn, string> = {
  bank: "Bank account",
  debit: "Debit card",
  credit: "Credit card",
  cash: "Cash at an agent",
};

type Price = { fixedUsd: number; pct: number; markup: number; speed: string };
type Provider = {
  id: string;
  name: string;
  url: string;
  sendFrom: string[]; // send currencies supported
  payouts: Partial<Record<Payout, Price>>;
  payIns: Partial<Record<PayIn, { fixedUsd: number; pct: number }>>;
  covers: (c: Country, payout: Payout) => boolean;
};

// Currencies Wise can pay out to a local bank account.
const WISE_CUR = new Set(
  "AED ARS AUD BDT BGN BRL BWP CAD CHF CLP CNY COP CRC CZK DKK EGP EUR GBP GEL GHS HKD HUF IDR ILS INR JPY KES KRW LKR MAD MXN MYR NGN NOK NPR NZD PEN PHP PKR PLN RON SEK SGD THB TRY TZS UAH UGX USD UYU VND XOF ZAR ZMW".split(" "),
);
const SENDWAVE = new Set("KE UG TZ RW GH NG SN CI ML BF BJ TG GN CM ZM ET LR SL GM MG MX PH IN BD VN NP LK PK GT HN SV CO HT JM".split(" "));
const TAPTAP = new Set("KE UG TZ RW GH NG SN CI ML BF BJ TG GN CM GA CG CD ZM ET LR SL GM MG NE MA EG BD PK NP IN PH VN HT JM".split(" "));

const MAJORS = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF"];
const notAdvanced = (c: Country) => !ADVANCED.has(c.iso);

// Payout methods that only exist in some countries.
function methodAvailable(c: Country, p: Payout) {
  if (p === "mobile") return MOBILE_MONEY.has(c.iso);
  if (p === "card") return CARD_PAYOUT.has(c.iso);
  return true;
}

export const PROVIDERS: Provider[] = [
  {
    id: "wise", name: "Wise", url: "https://wise.com", sendFrom: MAJORS,
    payouts: { bank: { fixedUsd: 0.99, pct: 0.57, markup: 0, speed: "Minutes – 1 day" } },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 0, pct: 0.4 }, credit: { fixedUsd: 0, pct: 2.0 } },
    covers: (c) => WISE_CUR.has(c.currency) && !HARD_TO_SERVE.has(c.iso),
  },
  {
    id: "revolut", name: "Revolut", url: "https://revolut.com", sendFrom: MAJORS,
    payouts: { bank: { fixedUsd: 0, pct: 0.5, markup: 0.5, speed: "1–2 days" } },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 0, pct: 0 } },
    covers: (c) => !HARD_TO_SERVE.has(c.iso),
  },
  {
    id: "remitly", name: "Remitly", url: "https://remitly.com", sendFrom: MAJORS,
    payouts: {
      bank: { fixedUsd: 1.99, pct: 0, markup: 1.4, speed: "Minutes – 1 day" },
      cash: { fixedUsd: 2.99, pct: 0, markup: 1.7, speed: "Minutes" },
      mobile: { fixedUsd: 1.99, pct: 0, markup: 1.5, speed: "Minutes" },
      card: { fixedUsd: 2.99, pct: 0, markup: 1.6, speed: "Minutes" },
    },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 2.0, pct: 0 }, credit: { fixedUsd: 0, pct: 3.0 } },
    covers: (c, p) => !HARD_TO_SERVE.has(c.iso) && (p === "bank" || notAdvanced(c)),
  },
  {
    id: "sendwave", name: "Sendwave", url: "https://sendwave.com", sendFrom: ["USD", "EUR", "GBP", "CAD"],
    payouts: {
      mobile: { fixedUsd: 0, pct: 0, markup: 1.8, speed: "Minutes" },
      bank: { fixedUsd: 0, pct: 0, markup: 2.0, speed: "Minutes – 1 day" },
      cash: { fixedUsd: 0, pct: 0, markup: 2.2, speed: "Minutes" },
    },
    payIns: { debit: { fixedUsd: 0, pct: 0 } },
    covers: (c) => SENDWAVE.has(c.iso),
  },
  {
    id: "taptapsend", name: "Taptap Send", url: "https://taptapsend.com", sendFrom: ["USD", "EUR", "GBP", "CAD", "AUD", "CHF"],
    payouts: {
      mobile: { fixedUsd: 0, pct: 0, markup: 1.3, speed: "Minutes" },
      bank: { fixedUsd: 0, pct: 0, markup: 1.5, speed: "Minutes – 1 day" },
    },
    payIns: { debit: { fixedUsd: 0, pct: 0 } },
    covers: (c) => TAPTAP.has(c.iso),
  },
  {
    id: "worldremit", name: "WorldRemit", url: "https://worldremit.com", sendFrom: MAJORS,
    payouts: {
      bank: { fixedUsd: 2.99, pct: 0, markup: 1.6, speed: "Minutes – 1 day" },
      cash: { fixedUsd: 3.99, pct: 0, markup: 1.9, speed: "Minutes" },
      mobile: { fixedUsd: 1.99, pct: 0, markup: 1.7, speed: "Minutes" },
    },
    payIns: { debit: { fixedUsd: 0, pct: 0 }, credit: { fixedUsd: 0, pct: 2.0 }, bank: { fixedUsd: 0, pct: 0 } },
    covers: (c, p) => (!HARD_TO_SERVE.has(c.iso) || c.iso === "SO") && (p === "bank" || notAdvanced(c)),
  },
  {
    id: "xe", name: "Xe", url: "https://xe.com", sendFrom: MAJORS,
    payouts: { bank: { fixedUsd: 2.99, pct: 0, markup: 1.2, speed: "1–2 days" } },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 0, pct: 1.0 }, credit: { fixedUsd: 0, pct: 2.5 } },
    covers: (c) => !HARD_TO_SERVE.has(c.iso),
  },
  {
    id: "ria", name: "Ria", url: "https://riamoneytransfer.com", sendFrom: MAJORS,
    payouts: {
      bank: { fixedUsd: 2.99, pct: 0, markup: 2.0, speed: "Minutes – 2 days" },
      cash: { fixedUsd: 3.99, pct: 0, markup: 2.2, speed: "Minutes" },
      mobile: { fixedUsd: 2.99, pct: 0, markup: 2.0, speed: "Minutes" },
    },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 1.0, pct: 0 }, credit: { fixedUsd: 0, pct: 3.0 }, cash: { fixedUsd: 1.0, pct: 0 } },
    covers: () => true,
  },
  {
    id: "moneygram", name: "MoneyGram", url: "https://moneygram.com", sendFrom: MAJORS,
    payouts: {
      bank: { fixedUsd: 3.99, pct: 0, markup: 2.5, speed: "Minutes – 2 days" },
      cash: { fixedUsd: 4.99, pct: 0, markup: 3.0, speed: "Minutes" },
      mobile: { fixedUsd: 2.99, pct: 0, markup: 2.8, speed: "Minutes" },
    },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 1.5, pct: 0 }, credit: { fixedUsd: 0, pct: 3.0 }, cash: { fixedUsd: 2.0, pct: 0 } },
    covers: () => true,
  },
  {
    id: "westernunion", name: "Western Union", url: "https://westernunion.com", sendFrom: MAJORS,
    payouts: {
      bank: { fixedUsd: 1.99, pct: 0, markup: 2.5, speed: "Minutes – 2 days" },
      cash: { fixedUsd: 5.0, pct: 0, markup: 3.0, speed: "Minutes" },
      mobile: { fixedUsd: 3.99, pct: 0, markup: 2.8, speed: "Minutes" },
      card: { fixedUsd: 3.99, pct: 0, markup: 2.8, speed: "Minutes" },
    },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 2.0, pct: 0 }, credit: { fixedUsd: 0, pct: 3.0 }, cash: { fixedUsd: 2.0, pct: 0 } },
    covers: () => true,
  },
  {
    id: "xoom", name: "Xoom (PayPal)", url: "https://xoom.com", sendFrom: ["USD", "CAD", "GBP", "EUR"],
    payouts: {
      bank: { fixedUsd: 4.99, pct: 0, markup: 3.0, speed: "Minutes – 1 day" },
      cash: { fixedUsd: 4.99, pct: 0, markup: 3.2, speed: "Minutes" },
      mobile: { fixedUsd: 4.99, pct: 0, markup: 3.0, speed: "Minutes" },
      card: { fixedUsd: 4.99, pct: 0, markup: 3.0, speed: "Minutes" },
    },
    payIns: { bank: { fixedUsd: 0, pct: 0 }, debit: { fixedUsd: 2.99, pct: 0 }, credit: { fixedUsd: 0, pct: 3.0 } },
    covers: (c, p) => !HARD_TO_SERVE.has(c.iso) && (p === "bank" || notAdvanced(c)),
  },
];

// Major banks in each sending country, for the "what would my bank charge?"
// comparison. Outgoing SWIFT wire fee (online, in the send currency) + typical
// FX markup the bank applies. Indicative estimates — check your bank's tariff.
export const SEND_BANKS: Record<string, { name: string; fee: number; markup: number }[]> = {
  USD: [
    { name: "JPMorgan Chase", fee: 40, markup: 3.5 },
    { name: "Bank of America", fee: 45, markup: 3.5 },
    { name: "Wells Fargo", fee: 40, markup: 3.0 },
    { name: "Citibank", fee: 35, markup: 3.0 },
    { name: "U.S. Bank", fee: 50, markup: 3.5 },
  ],
  EUR: [
    { name: "BNP Paribas", fee: 25, markup: 2.5 },
    { name: "Deutsche Bank", fee: 20, markup: 2.0 },
    { name: "Santander", fee: 30, markup: 2.5 },
    { name: "Société Générale", fee: 25, markup: 2.5 },
    { name: "ING", fee: 12, markup: 1.5 },
  ],
  GBP: [
    { name: "HSBC UK", fee: 5, markup: 3.0 },
    { name: "Barclays", fee: 15, markup: 2.75 },
    { name: "Lloyds", fee: 9.5, markup: 3.0 },
    { name: "NatWest", fee: 15, markup: 2.75 },
  ],
  CAD: [
    { name: "RBC Royal Bank", fee: 15, markup: 3.0 },
    { name: "TD Canada Trust", fee: 30, markup: 2.75 },
    { name: "Scotiabank", fee: 25, markup: 3.0 },
    { name: "BMO", fee: 30, markup: 3.0 },
    { name: "CIBC", fee: 0, markup: 3.5 },
  ],
  AUD: [
    { name: "Commonwealth Bank", fee: 6, markup: 3.5 },
    { name: "Westpac", fee: 10, markup: 3.5 },
    { name: "NAB", fee: 0, markup: 4.0 },
    { name: "ANZ", fee: 9, markup: 3.5 },
  ],
  CHF: [
    { name: "UBS", fee: 10, markup: 2.0 },
    { name: "PostFinance", fee: 5, markup: 1.75 },
    { name: "Raiffeisen", fee: 10, markup: 2.0 },
    { name: "Zürcher Kantonalbank", fee: 10, markup: 2.0 },
  ],
};

// SWIFT wires usually lose money twice more after leaving your bank:
// a correspondent (intermediary) bank deduction and a receiving-bank fee.
const INTERMEDIARY_USD = 20;
const RECEIVING_FEE_USD: Record<string, number> = {
  Africa: 15, Asia: 10, Europe: 5, "Latin America & Caribbean": 15, "Middle East": 12, "North America": 15, Oceania: 15,
};

export const SEND_CURRENCIES = MAJORS;

// Fallback mid-market rates (units per 1 USD) if the live feed is unreachable.
const FALLBACK: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, CAD: 1.38, AUD: 1.52, CHF: 0.88, MXN: 18.5, INR: 85, PHP: 58, NGN: 1550,
  XOF: 605, XAF: 605, MAD: 9.9, KES: 129, GHS: 15.5, PEN: 3.75, COP: 4100, BRL: 5.6, DOP: 61, VND: 25500,
  PKR: 280, CNY: 7.2, BDT: 120, EGP: 49, GTQ: 7.7, HNL: 25, HTG: 131, JMD: 157, NPR: 136, LKR: 300,
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

export type Route = {
  providerId: string;
  providerName: string;
  url: string;
  payout: Payout;
  speed: string;
  fee: number; // in send currency (transfer fee + pay-in surcharge)
  rate: number;
  receiveAmount: number;
  totalCost: number; // fee + FX markup, in send currency
};

export type BankQuote = {
  bank: string;
  outgoingFee: number;
  otherFees: number; // intermediary + receiving bank, in send currency
  rate: number;
  receiveAmount: number;
  totalCost: number;
};

export async function compare(amount: number, from: string, iso: string, payIn: PayIn) {
  const country = byIso.get(iso);
  if (!country) throw new Error("Unknown destination country");
  if (SANCTIONED.has(iso))
    return { country, blocked: true as const, midRate: 0, live: false, ratesAsOf: "", routes: [] as Route[], banks: [] as BankQuote[] };

  const { rates, live, fetchedAt } = await getRates();
  const rFrom = rates[from];
  const rTo = rates[country.currency];
  if (!rFrom || !rTo) throw new Error(`No exchange rate available for ${from} → ${country.currency}`);
  const mid = rTo / rFrom;
  const toSend = (usd: number) => usd * rFrom; // USD amount → send currency
  const sameCurrency = from === country.currency;

  const routes: Route[] = [];
  for (const p of PROVIDERS) {
    if (!p.sendFrom.includes(from)) continue;
    const pin = p.payIns[payIn];
    if (!pin) continue;
    for (const [payout, price] of Object.entries(p.payouts) as [Payout, Price][]) {
      if (!methodAvailable(country, payout) || !p.covers(country, payout)) continue;
      const markup = sameCurrency ? 0 : price.markup;
      const fee = toSend(price.fixedUsd + pin.fixedUsd) + (amount * (price.pct + pin.pct)) / 100;
      const rate = mid * (1 - markup / 100);
      const receiveAmount = Math.max(0, (amount - fee) * rate);
      routes.push({
        providerId: p.id,
        providerName: p.name,
        url: p.url,
        payout,
        speed: price.speed,
        fee: r2(fee),
        rate: r6(rate),
        receiveAmount: r2(receiveAmount),
        totalCost: r2(amount - receiveAmount / mid),
      });
    }
  }
  routes.sort((a, b) => b.receiveAmount - a.receiveAmount);

  // SEPA: euro → euro-zone bank transfers are essentially free and same-day.
  const sepa = from === "EUR" && country.currency === "EUR";
  const banks: BankQuote[] = (SEND_BANKS[from] ?? []).map((b) => {
    const outgoingFee = sepa ? 0 : b.fee;
    const otherFees = sepa ? 0 : toSend(INTERMEDIARY_USD + (RECEIVING_FEE_USD[country.region] ?? 15));
    const rate = mid * (1 - (sameCurrency ? 0 : b.markup) / 100);
    const receiveAmount = Math.max(0, (amount - outgoingFee - otherFees) * rate);
    return {
      bank: b.name,
      outgoingFee: r2(outgoingFee),
      otherFees: r2(otherFees),
      rate: r6(rate),
      receiveAmount: r2(receiveAmount),
      totalCost: r2(amount - receiveAmount / mid),
    };
  });
  banks.sort((a, b) => b.receiveAmount - a.receiveAmount);

  return {
    country,
    blocked: false as const,
    sepa,
    midRate: r6(mid),
    live,
    ratesAsOf: new Date(fetchedAt).toISOString(),
    routes,
    banks,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
