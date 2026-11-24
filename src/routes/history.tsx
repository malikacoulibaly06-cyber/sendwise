import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api, money } from "../api";
import { localStorageGet, localStorageSet } from "./send";

// No real auth in this demo: transfers are looked up by sender email.
export function HistoryPage() {
  const [input, setInput] = useState(localStorageGet("sendwise-email"));
  const [email, setEmail] = useState(input);
  const h = useQuery({ queryKey: ["history", email], queryFn: () => api.history(email), enabled: !!email });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-serif text-[40px] tracking-tight">My transfers</h1>
      <form
        className="mt-6 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setEmail(input.trim().toLowerCase());
          localStorageSet("sendwise-email", input.trim().toLowerCase());
        }}
      >
        <input className="input max-w-sm" type="email" placeholder="you@example.com" value={input} onChange={(e) => setInput(e.target.value)} required />
        <button className="btn">Look up</button>
      </form>

      {h.data && h.data.length === 0 && <p className="mt-8 text-stone">No transfers yet for {email}.</p>}
      {h.data && h.data.length > 0 && (
        <div className="card mt-8 divide-y divide-line">
          {h.data.map((t) => (
            <Link
              key={t.id}
              to={t.status === "paid" ? "/receipt/$id" : "/checkout/$id"}
              params={{ id: t.id }}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-oat"
            >
              <div>
                <div className="font-medium">
                  {t.recipient_name} · {t.recipient_country}
                </div>
                <div className="text-[13px] text-stone">
                  {new Date(t.created_at).toLocaleDateString()} · via {t.provider_name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-serif text-[18px]">{money(t.receive_amount, t.receive_currency)}</div>
                <div className={`text-[12px] ${t.status === "paid" ? "text-sage" : "text-clay-dark"}`}>
                  {t.status === "paid" ? "Paid" : "Awaiting payment"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
