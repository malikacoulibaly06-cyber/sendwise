import { PROVIDERS } from "./providers.ts";

// Affiliate links and promo codes come from Railway variables so you can add
// each one as its program approves you — no code change needed:
//   AFFILIATE_URL_WISE=https://wise.prf.hn/click/camref:XXXX
//   PROMO_WISE=First transfer fee-free (only codes the program lets you publish)
// Without a variable, the button just goes to the provider's normal website.

const envKey = (id: string) => id.toUpperCase().replace(/[^A-Z0-9]/g, "_");

export type Outbound = { providerId: string; url: string; affiliate: boolean; promo: string | null };

export function outboundFor(providerId: string): Outbound | null {
  const p = PROVIDERS.find((x) => x.id === providerId);
  if (!p || !p.url) return null;
  const aff = process.env[`AFFILIATE_URL_${envKey(p.id)}`]?.trim();
  const affiliate = !!aff && /^https:\/\//.test(aff);
  const promo = process.env[`PROMO_${envKey(p.id)}`]?.trim() || null;
  return { providerId: p.id, url: affiliate ? aff! : p.url, affiliate, promo };
}

// Public info for the UI (never exposes the affiliate URL itself).
export function promoMap() {
  const out: Record<string, { promo: string | null; affiliate: boolean }> = {};
  for (const p of PROVIDERS) {
    const o = outboundFor(p.id);
    if (o) out[p.id] = { promo: o.promo, affiliate: o.affiliate };
  }
  return out;
}
