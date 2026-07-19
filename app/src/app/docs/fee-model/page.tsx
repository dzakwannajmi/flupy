import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Fee Model',
  description: 'Fluppy fee model — user-signed Freighter transaction, 95/5 atomic split, no production relayer.',
};

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-[#0e0f0c] first:mt-0">{children}</h2>;
}
function Note({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300"><span className="shrink-0">ℹ</span><div>{children}</div></div>;
}
function Caution({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300"><span className="shrink-0">⚠</span><div>{children}</div></div>;
}

export default function FeeModelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-[#0e0f0c]">Fee Model</h1>
        <p className="text-lg text-[#454745]">
          Who pays what in a Fluppy payment — from the user wallet fee to the on-chain 95/5 split.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#454745]">Payment flow summary</p>
        <div className="space-y-2">
          {[
            ['User',                 'Signs transaction through Freighter wallet',      'required'],
            ['User',                 'Pays Stellar/Soroban network fee via wallet',     'required'],
            ['Soroban contract',     'Splits payment: 95% → merchant, 5% → treasury',  'automatic'],
            ['Developer / Merchant', 'Does not pay network fee in current MVP',         'not applicable'],
          ].map(([party, action, badge]) => {
            const badgeStyle: Record<string, string> = {
              'required':        'bg-blue-500/10 text-blue-700 border-blue-500/30',
              'automatic':       'bg-green-500/10 text-emerald-700 border-green-500/30',
              'not applicable':  'bg-gray-500/10 text-[#454745] border-gray-500/30',
            };
            return (
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
            );
          })}
        </div>
      </div>

      {/* 95/5 split */}
      <H2 id="split">The 95/5 Atomic Split</H2>
      <p className="text-sm text-[#454745] mb-4">
        When a user submits a ZK payment, the Soroban contract atomically bifurcates the amount
        in a single ledger operation. This is not configurable after deployment.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'User pays',         pct: '100%', color: 'border-black/15 bg-black/[0.03] text-[#0e0f0c]', sub: 'full payment amount' },
          { label: 'Merchant receives', pct:  '95%', color: 'border-green-500/30 bg-green-500/5 text-emerald-700', sub: 'net settlement' },
          { label: 'Treasury receives', pct:   '5%', color: 'border-[#9fe870]/30 bg-[#9fe870]/5 text-[#163300]', sub: 'protocol fee' },
        ].map(({ label, pct, color, sub }) => (
          <div key={label} className={`rounded-xl border p-4 ${color}`}>
            <div className="text-3xl font-bold">{pct}</div>
            <div className="mt-1 text-sm font-medium">{label}</div>
            <div className="text-xs opacity-70">{sub}</div>
          </div>
        ))}
      </div>
      <Note>
        The protocol fee is taken <strong>from within the payment amount</strong>, not as an
        additional charge on top of it. If a user pays 10 USDC, the merchant receives 9.5 USDC
        and the treasury receives 0.5 USDC — the user is not charged 10.5 USDC.
      </Note>

      {/* Example calculation */}
      <H2 id="example">Example Calculation</H2>
      <div className="overflow-hidden rounded-xl border border-black/10">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-black/10 bg-black/[0.03]">
            {['Payment amount', 'Merchant receives', 'Treasury receives', 'Network fee'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {[
              ['1 USDC',   '0.95 USDC',  '0.05 USDC',  'Paid by user via Freighter (varies ~0.001 XLM)'],
              ['5 USDC',   '4.75 USDC',  '0.25 USDC',  'Paid by user via Freighter'],
              ['10 USDC',  '9.50 USDC',  '0.50 USDC',  'Paid by user via Freighter'],
              ['100 USDC', '95.00 USDC', '5.00 USDC',  'Paid by user via Freighter'],
            ].map(row => (
              <tr key={row[0]} className="hover:bg-black/[0.03]">
                {row.map((cell, i) => (
                  <td key={i} className={`px-4 py-2.5 ${i === 0 ? 'font-semibold text-[#0e0f0c]' : i === 3 ? 'text-[#454745]' : 'text-[#454745]'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Network fee */}
      <H2 id="network-fee">Stellar Network Fee</H2>
      <p className="text-sm text-[#454745] mb-3">
        Soroban transactions require a base reserve and a fee paid in XLM. In the current MVP:
      </p>
      <div className="space-y-2">
        {[
          ['Source of fee',    'User\'s Freighter-connected wallet — not Fluppy, not the developer'],
          ['Fee currency',     'XLM (Stellar\'s native token) — separate from the USDC payment amount'],
          ['Fee visibility',   'Freighter shows the fee to the user before they sign — transparent'],
          ['Fee sponsorship',  'No production relayer or gas sponsorship in current Testnet MVP'],
          ['Typical cost',     'Varies with ledger congestion — usually very small (~0.001–0.01 XLM)'],
        ].map(([label, desc]) => (
          <div key={label} className="flex items-start gap-3 rounded-xl border border-black/10 bg-black/[0.03] p-3">
            <span className="mt-0.5 shrink-0 text-xs font-semibold text-[#454745] w-32">{label}</span>
            <span className="text-xs text-[#454745]">{desc}</span>
          </div>
        ))}
      </div>

      {/* What Fluppy does not do */}
      <H2 id="not-included">What Fluppy Does NOT Currently Do</H2>
      <div className="overflow-hidden rounded-xl border border-yellow-500/20">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-yellow-500/20 bg-yellow-500/5">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-yellow-600">Feature</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-yellow-600">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-yellow-500/10 text-xs">
            {[
              ['Production transaction relayer',    'Not implemented — future phase only'],
              ['Gas / network fee sponsorship',     'Not implemented — user pays directly'],
              ['API key billing system',            'Not implemented — future merchant integration layer'],
              ['Mainnet transaction fees',          'No mainnet deployment yet'],
              ['Merchant subscription or plans',   'Not implemented — future phase'],
              ['Developer fee accounting',         'Not implemented — protocol fee goes to treasury only'],
            ].map(([feat, status]) => (
              <tr key={feat} className="hover:bg-yellow-500/5">
                <td className="px-4 py-2.5 font-medium text-yellow-300">{feat}</td>
                <td className="px-4 py-2.5 text-[#454745]">{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Future phases */}
      <H2 id="future">Future Fee-Related Phases</H2>
      <div className="space-y-3">
        {[
          { title: 'Merchant API Key Layer', desc: 'A future phase will add an authenticated API key layer for merchant registration, rate limiting, and enrollment management. This is not a billing system — it is an access control and integration layer.' },
          { title: 'Optional Relayer Sponsorship', desc: 'A future optional relayer model would allow enrolled merchants to sponsor user network fees through an API-key-authenticated backend. This is explicitly future — not part of the current MVP — and would require additional security review.' },
          { title: 'Fee Abstraction UX', desc: 'Future UI helpers could abstract the network fee display for users without reducing transparency. Users would still authorize the full transaction including the network fee amount.' },
        ].map(({ title, desc }) => (
          <div key={title} className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <p className="mb-1 text-sm font-semibold text-purple-700">{title} <span className="text-xs font-normal text-[#454745]">— future</span></p>
            <p className="text-xs text-[#454745]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Developer guidance */}
      <H2 id="guidance">Developer Guidance</H2>
      <Caution>
        Do not advertise Fluppy as a gasless payment system in the current MVP.
        Users pay the Stellar network fee directly through Freighter. This is by design —
        it keeps the protocol non-custodial and trust-minimized.
      </Caution>
      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        {[
          { do: true,  text: 'Show users the total amount they are authorizing (payment + network fee via Freighter)' },
          { do: true,  text: 'Make the 95/5 split clear in your UI — users should understand 5% goes to protocol treasury' },
          { do: true,  text: 'Treat the protocol fee as part of the amount, not a hidden extra charge' },
          { do: false, text: 'Promise gasless or zero-fee payments — network fees are always present' },
          { do: false, text: 'Claim developer or merchant sponsors the transaction fee in current MVP' },
          { do: false, text: 'Market the protocol as having zero fees — the split and network fee are real costs' },
        ].map(({ do: isDo, text }) => (
          <div key={text} className={`flex items-start gap-2 rounded-xl border p-3 ${isDo ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <span className={`shrink-0 font-bold ${isDo ? 'text-emerald-700' : 'text-red-700'}`}>{isDo ? '✓' : '✗'}</span>
            <span className="text-xs text-[#454745]">{text}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
