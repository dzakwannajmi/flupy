import Link from "next/link";
import { Icon } from "@iconify/react";

const SDK_PACKAGES = [
  {
    name: "@flupy/core",
    status: "Stable",
    size: "10 KB ESM",
    desc: "Protocol primitives: constants, errors, encoding, recipient hash, chain ID, shared types.",
    href: "/docs/core",
    color: "blue",
  },
  {
    name: "@flupy/browser",
    status: "Stable",
    size: "31 KB ESM",
    desc: "Browser SDK: Merkle client, artifact loader, ZK prover, identity, Stellar/Freighter, payment orchestrator.",
    href: "/docs/browser",
    color: "purple",
  },
  {
    name: "@flupy/react",
    status: "Stable",
    size: "14 KB ESM",
    desc: "React SDK: FluppyProvider, useFluppyCredential, useFluppyPayment, useFluppyWallet, useFluppyHistory.",
    href: "/docs/react",
    color: "pink",
  },
] as const;

const QUICK_LINKS = [
  { href: "/docs/installation", label: "Installation", icon: "ph:download-simple", desc: "Monorepo setup and build commands" },
  { href: "/docs/quickstart", label: "Quickstart", icon: "ph:flag", desc: "5-minute first payment walkthrough" },
  { href: "/docs/react", label: "React Hooks", icon: "ph:atom", desc: "useFluppyPayment and other hooks" },
  { href: "/docs/security", label: "Security Model", icon: "ph:shield-check", desc: "ZK proofs, nullifiers, chainId" },
  { href: "/docs/fee-model", label: "Fee Model", icon: "ph:coins", desc: "User-signed, 95/5 atomic split" },
  { href: "/docs/examples", label: "Examples", icon: "ph:code", desc: "Full React integration examples" },
] as const;

const colorMap: Record<string, string> = {
  blue: "border-blue-600/30 bg-blue-50 text-blue-700",
  purple: "border-purple-600/30 bg-purple-50 text-purple-700",
  pink: "border-[#9fe870]/40 bg-[#9fe870]/10 text-[#163300]",
};

export function LiveBadge() {
  return (
    <span className="not-typeset inline-flex items-center gap-1.5 rounded-full border border-[#9fe870]/40 bg-[#9fe870]/15 px-2.5 py-0.5 text-xs font-medium text-[#163300]">
      <Icon icon="ph:check-circle-fill" width={14} height={14} />
      Live on Stellar Testnet
    </span>
  );
}

export function CtaButtons() {
  return (
    <div className="not-typeset flex flex-wrap gap-3">
      <Link
        href="/docs/quickstart"
        className="rounded-lg bg-[#9fe870] px-4 py-2 text-sm font-semibold text-[#163300] transition-colors hover:bg-[#8fd960]"
      >
        Quickstart →
      </Link>
      <Link
        href="/docs/installation"
        className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold text-[#454745] transition-colors hover:border-black/30 hover:text-[#0e0f0c]"
      >
        Installation
      </Link>
    </div>
  );
}

export function PackageCards() {
  return (
    <>
      <div className="not-typeset space-y-4">
        {SDK_PACKAGES.map((pkg) => (
          <Link
            key={pkg.name}
            href={pkg.href}
            className={`block rounded-xl border p-4 transition-colors hover:bg-black/[0.03] ${colorMap[pkg.color]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <code className="font-mono text-sm font-semibold">{pkg.name}</code>
                <span className="rounded-full border border-[#9fe870]/40 bg-[#9fe870]/15 px-2 py-0.5 text-xs font-medium text-[#163300]">
                  {pkg.status}
                </span>
              </div>
              <span className="text-xs text-[#454745]">{pkg.size}</span>
            </div>
            <p className="mt-2 text-sm text-[#454745]">{pkg.desc}</p>
          </Link>
        ))}
      </div>

      <div className="not-typeset mt-4 rounded-lg border border-black/10 bg-black/[0.03] p-4">
        <p className="text-sm text-[#454745]">
          <span className="font-medium text-[#0e0f0c]">Current usage:</span>{" "}
          Internal pnpm monorepo workspace. Packages are consumed via{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-xs">{'"workspace:*"'}</code>{" "}
          dependencies.
        </p>
        <p className="mt-2 text-sm text-[#454745]">
          <span className="font-medium text-[#454745]">Roadmap:</span>{" "}
          Public npm publication is planned for a future release.
        </p>
      </div>
    </>
  );
}

export function FlowDiagram() {
  return (
    <div className="not-typeset overflow-hidden rounded-xl border border-black/10 bg-white">
      <div className="border-b border-black/10 px-4 py-2">
        <span className="font-mono text-xs text-[#454745]">payment flow</span>
      </div>
      <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-[#454745]">
{`Browser (User)
  │
  ├─ @flupy/react      → useFluppyCredential: AES-GCM secret (IndexedDB)
  ├─ @flupy/browser    → computeCommitment → GET /api/merkle-proof
  ├─ @flupy/browser    → snarkjs.groth16.fullProve() → ZK proof (BN254)
  ├─ @flupy/browser    → verifyProofLocally() → ✓ VALID
  └─ @flupy/browser    → Freighter sign → Soroban RPC submit
                                    │
                           Soroban Contract
                              │
                              ├─ Nullifier replay protection
                              ├─ Merkle root history validation
                              ├─ Payer + recipient + amount binding
                              ├─ ChainId binding (cross-network guard)
                              └─ Atomic split: 95% merchant / 5% treasury
                                 via Stellar Asset Contract (USDC SAC)`}
      </pre>
    </div>
  );
}

export function QuickLinksGrid() {
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {QUICK_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-xl border border-black/10 bg-black/[0.03] p-4 transition-colors hover:border-black/15 hover:bg-black/5"
        >
          <Icon icon={link.icon} width={22} height={22} className="mb-2 text-[#163300]" />
          <div className="font-medium text-[#0e0f0c]">{link.label}</div>
          <div className="mt-1 text-xs text-[#454745]">{link.desc}</div>
        </Link>
      ))}
    </div>
  );
}

export function TrustStats() {
  const items = [
    { icon: "ph:package-fill", text: "3/3 packages building clean" },
    { icon: "ph:check-circle-fill", text: "Zero typecheck errors" },
    { icon: "ph:link-fill", text: "Payment confirmed on-chain" },
  ];
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-3">
      {items.map(({ icon, text }) => (
        <div key={text} className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
          <Icon icon={icon} width={20} height={20} className="mb-2 text-[#163300]" />
          <div className="text-sm font-medium text-[#0e0f0c]">{text}</div>
        </div>
      ))}
    </div>
  );
}

export function IncludedChecklist() {
  const items = [
    "Stellar Testnet deployment",
    "Browser-side Groth16 proof generation",
    "Poseidon Merkle membership proof",
    "Local proof verification before submission",
    "Freighter wallet signing (user-paid fee)",
    "Atomic 95/5 USDC split on-chain",
    "Nullifier-based replay protection",
    "Payer + amount + recipient binding",
    "Automated Merkle root sync",
    "Three-layer modular SDK (@flupy/*)",
  ];
  return (
    <div className="not-typeset rounded-xl border border-[#9fe870]/30 bg-[#9fe870]/10 p-4">
      <ul className="grid gap-1.5 text-sm text-[#454745] sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Icon icon="ph:check" width={16} height={16} className="mt-0.5 shrink-0 text-[#163300]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
