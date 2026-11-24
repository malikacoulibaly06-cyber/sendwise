import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { HomePage } from "./routes/home";
import { SendPage } from "./routes/send";
import { CheckoutPage } from "./routes/checkout";
import { ReceiptPage } from "./routes/receipt";
import { HistoryPage } from "./routes/history";
import type { PayIn } from "./api";

export function Logo({ size = 30 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="" className="rounded-[9px]" />;
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-[19px] font-extrabold tracking-tight">
              Send<span className="text-sky">Wise</span>
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-[14px]">
            <Link to="/" className="text-white/70 hover:text-white [&.active]:text-white">Compare</Link>
            <Link to="/history" className="text-white/70 hover:text-white [&.active]:text-white">My transfers</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-start sm:gap-6 sm:px-6">
          <div className="flex items-center gap-2 font-display font-bold text-ink">
            <Logo size={22} /> SendWise
          </div>
          <p className="max-w-3xl leading-relaxed">
            Class demo. Exchange rates are live mid-market rates; provider and bank fees are estimates based on typical
            published pricing and can differ from a real quote. Payments run in test mode — no real money moves.
          </p>
        </div>
      </footer>
    </div>
  ),
});

export type CompareSearch = { amount?: number; from?: string; to?: string; payIn?: PayIn };

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (s: Record<string, unknown>): CompareSearch => ({
    amount: s.amount ? Number(s.amount) : undefined,
    from: s.from ? String(s.from) : undefined,
    to: s.to ? String(s.to) : undefined,
    payIn: s.payIn ? (String(s.payIn) as PayIn) : undefined,
  }),
  component: HomePage,
});

const sendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/send",
  validateSearch: (s: Record<string, unknown>) => ({
    amount: Number(s.amount ?? 0),
    from: String(s.from ?? "USD"),
    to: String(s.to ?? "MX"),
    payIn: String(s.payIn ?? "bank") as PayIn,
    provider: String(s.provider ?? ""),
    payout: String(s.payout ?? "bank"),
  }),
  component: SendPage,
});

const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/checkout/$id", component: CheckoutPage });
const receiptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/receipt/$id",
  validateSearch: (s: Record<string, unknown>) => ({ session_id: s.session_id ? String(s.session_id) : undefined }),
  component: ReceiptPage,
});
const historyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/history", component: HistoryPage });

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, sendRoute, checkoutRoute, receiptRoute, historyRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
