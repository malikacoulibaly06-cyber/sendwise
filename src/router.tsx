import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import { HomePage } from "./routes/home";
import { WatchPage } from "./routes/watch";
import { StatsPage } from "./routes/stats";
import { DISCLOSURE, type PayIn } from "./api";

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
              Cheap<span className="text-sky">Send</span>
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-[14px]">
            <Link to="/" className="text-white/70 hover:text-white [&.active]:text-white">Compare</Link>
            <Link to="/watch" search={{}} className="text-white/70 hover:text-white [&.active]:text-white">Rate Watch</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-start sm:gap-6 sm:px-6">
          <div className="flex items-center gap-2 font-display font-bold text-ink">
            <Logo size={22} /> CheapSend
          </div>
          <div className="max-w-3xl space-y-2 leading-relaxed">
            <p>
              <b className="text-ink">How we make money.</b> {DISCLOSURE}
            </p>
            <p>
              CheapSend doesn't move money — you send it directly with the provider you choose. Exchange rates are live
              mid-market rates; provider and bank fees are estimates and can differ from a real quote.{" "}
              <Link to="/stats" className="underline hover:text-brand">Click stats</Link>
            </p>
          </div>
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

export type WatchSearch = {
  email?: string;
  session_id?: string;
  amount?: number;
  from?: string;
  to?: string;
  payIn?: PayIn;
};

const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watch",
  validateSearch: (s: Record<string, unknown>): WatchSearch => ({
    email: s.email ? String(s.email) : undefined,
    session_id: s.session_id ? String(s.session_id) : undefined,
    amount: s.amount ? Number(s.amount) : undefined,
    from: s.from ? String(s.from) : undefined,
    to: s.to ? String(s.to) : undefined,
    payIn: s.payIn ? (String(s.payIn) as PayIn) : undefined,
  }),
  component: WatchPage,
});

const statsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/stats", component: StatsPage });

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, watchRoute, statsRoute]) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
