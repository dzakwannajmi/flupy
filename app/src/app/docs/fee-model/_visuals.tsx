
export function FlowSummary() {
  const rows: [string, string, "required" | "automatic" | "not applicable"][] = [
    ["User", "Signs transaction through Freighter wallet", "required"],
    ["User", "Pays Stellar/Soroban network fee via wallet", "required"],
    ["Soroban contract", "Splits payment: 95% → merchant, 5% → treasury", "automatic"],
    ["Developer / Merchant", "Does not pay network fee in current MVP", "not applicable"],
  ];
  const badgeStyle: Record<string, string> = {
    required: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    automatic: "bg-green-500/10 text-emerald-700 border-green-500/30",
    "not applicable": "bg-gray-500/10 text-[#454745] border-gray-500/30",
  };
  return (
    <div className="not-typeset rounded-xl border border-black/10 bg-white p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#454745]">Payment flow summary</p>
      <div className="space-y-2">
        {rows.map(([party, action, badge]) => (
          <div key={action} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-gray-600">·</span>
              <div>
                <span className="text-sm font-semibold text-[#0e0f0c]">{party}: </span>
                <span className="text-sm text-[#454745]">{action}</span>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle[badge]}`}>
              {badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SplitStats() {
  const stats = [
    { label: "User pays", pct: "100%", color: "border-black/15 bg-black/[0.03] text-[#0e0f0c]", sub: "full payment amount" },
    { label: "Merchant receives", pct: "95%", color: "border-green-500/30 bg-green-500/5 text-emerald-700", sub: "net settlement" },
    { label: "Treasury receives", pct: "5%", color: "border-[#9fe870]/30 bg-[#9fe870]/5 text-[#163300]", sub: "protocol fee" },
  ];
  return (
    <div className="not-typeset grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, pct, color, sub }) => (
        <div key={label} className={`rounded-xl border p-4 ${color}`}>
          <div className="text-3xl font-bold">{pct}</div>
          <div className="mt-1 text-sm font-medium">{label}</div>
          <div className="text-xs opacity-70">{sub}</div>
        </div>
      ))}
    </div>
  );
}

export function DescList({ rows }: { rows: [string, string][] }) {
  return (
    <div className="not-typeset space-y-2">
      {rows.map(([label, desc]) => (
        <div key={label} className="flex items-start gap-3 rounded-xl border border-black/10 bg-black/[0.03] p-3">
          <span className="mt-0.5 shrink-0 w-32 text-xs font-semibold text-[#454745]">{label}</span>
          <span className="text-xs text-[#454745]">{desc}</span>
        </div>
      ))}
    </div>
  );
}

export function FutureCards() {
  const items = [
    { title: "Merchant API Key Layer", desc: "A future phase will add an authenticated API key layer for merchant registration, rate limiting, and enrollment management. This is not a billing system — it is an access control and integration layer." },
    { title: "Optional Relayer Sponsorship", desc: "A future optional relayer model would allow enrolled merchants to sponsor user network fees through an API-key-authenticated backend. This is explicitly future — not part of the current MVP — and would require additional security review." },
    { title: "Fee Abstraction UX", desc: "Future UI helpers could abstract the network fee display for users without reducing transparency. Users would still authorize the full transaction including the network fee amount." },
  ];
  return (
    <div className="not-typeset space-y-3">
      {items.map(({ title, desc }) => (
        <div key={title} className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <p className="mb-1 text-sm font-semibold text-purple-700">{title} <span className="text-xs font-normal text-[#454745]">— future</span></p>
          <p className="text-xs text-[#454745]">{desc}</p>
        </div>
      ))}
    </div>
  );
}

export function DoDontGrid() {
  const items: { do: boolean; text: string }[] = [
    { do: true, text: "Show users the total amount they are authorizing (payment + network fee via Freighter)" },
    { do: true, text: "Make the 95/5 split clear in your UI — users should understand 5% goes to protocol treasury" },
    { do: true, text: "Treat the protocol fee as part of the amount, not a hidden extra charge" },
    { do: false, text: "Promise gasless or zero-fee payments — network fees are always present" },
    { do: false, text: "Claim developer or merchant sponsors the transaction fee in current MVP" },
    { do: false, text: "Market the protocol as having zero fees — the split and network fee are real costs" },
  ];
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-2">
      {items.map(({ do: isDo, text }) => (
        <div key={text} className={`flex items-start gap-2 rounded-xl border p-3 ${isDo ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
          <span className={`shrink-0 font-bold ${isDo ? "text-emerald-700" : "text-red-700"}`}>{isDo ? "✓" : "✗"}</span>
          <span className="text-xs text-[#454745]">{text}</span>
        </div>
      ))}
    </div>
  );
}
