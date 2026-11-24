import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { HomePage } from "./routes/home";
import { SendPage } from "./routes/send";
import { CheckoutPage } from "./routes/checkout";
import { ReceiptPage } from "./routes/receipt";
import { HistoryPage } from "./routes/history";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <span className="inline-block h-5 w-5 rounded-full bg-clay" />
            SendWise
          </Link>
          <nav className="flex items-center gap-6 text-[14px]">
            <Link to="/" className="text-stone hover:text-slate-ink [&.active]:text-slate-ink">Compare</Link>
            <Link to="/history" className="text-stone hover:text-slate-ink [&.active]:text-slate-ink">My transfers</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 text-[13px] text-stone">
          SendWise is a class demo. Provider fees are estimates of typical published pricing; rates are live mid-market
          rates when available. Payments are simulated — no real money moves.
        </div>
      </footer>
    </div>
  ),
});

type CompareSearch = { amount?: number; from?: string; to?: string };

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (s: Record<string, unknown>): CompareSearch => ({
    amount: s.amount ? Number(s.amount) : undefined,
    from: s.from ? String(s.from) : undefined,
    to: s.to ? String(s.to) : undefined,
  }),
  component: HomePage,
});

const sendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/send",
  validateSearch: (s: Record<string, unknown>) => ({
    amount: Number(s.amount ?? 0),
    from: String(s.from ?? "USD"),
    to: String(s.to ?? "MXN"),
    provider: String(s.provider ?? ""),
  }),
  component: SendPage,
});

const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/checkout/$id", component: CheckoutPage });
const receiptRoute = createRoute({ getParentRoute: () => rootRoute, path: "/receipt/$id", component: ReceiptPage });
const historyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/history", component: HistoryPage });

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, sendRoute, checkoutRoute, receiptRoute, historyRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
