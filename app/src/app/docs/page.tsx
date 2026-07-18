import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Fluppy is a privacy-preserving ZK payment protocol on Stellar Soroban with a three-layer modular SDK.",
};

const SDK_PACKAGES = [
  {
    name: "@fluppy/core",
    status: "Complete",
    size: "10 KB ESM",
    desc: "Protocol primitives: constants, errors, encoding, recipient hash, chain ID, shared types.",
    href: "/docs/core",
    color: "blue",
  },
  {
    name: "@fluppy/browser",
    status: "Complete",
    size: "31 KB ESM",
    desc: "Browser SDK: Merkle client, artifact loader, ZK prover, identity, Stellar/Freighter, payment orchestrator.",
    href: "/docs/browser",
    color: "purple",
  },
  {
    name: "@fluppy/react",
    status: "Complete",
    size: "14 KB ESM",
    desc: "React SDK: FluppyProvider, useFluppyCredential, useFluppyPayment, useFluppyWallet, useFluppyHistory.",
    href: "/docs/react",
    color: "pink",
  },
] as const;

const QUICK_LINKS = [
  { href: "/docs/installation", label: "Installation", icon: "📦", desc: "Monorepo setup and build commands" },
  { href: "/docs/quickstart", label: "Quickstart", icon: "⚡", desc: "5-minute first payment walkthrough" },
  { href: "/docs/react", label: "React Hooks", icon: "⚛️", desc: "useFluppyPayment and other hooks" },
  { href: "/docs/security", label: "Security Model", icon: "🔐", desc: "ZK proofs, nullifiers, chainId" },
  { href: "/docs/fee-model", label: "Fee Model", icon: "💰", desc: "User-signed, 95/5 atomic split" },
  { href: "/docs/examples", label: "Examples", icon: "🧪", desc: "Full React integration examples" },
] as const;

const VALIDATION_ROWS = [
  { label: "pnpm build:core", result: "✓ Pass" },
  { label: "pnpm build:browser", result: "✓ Pass" },
  { label: "pnpm build:react", result: "✓ Pass" },
  { label: "pnpm --filter @fluppy/react typecheck", result: "✓ Pass (0 errors)" },
  { label: "pnpm build:app", result: "✓ Pass" },
  { label: "Payment E2E (Stellar Testnet)", result: "✓ Confirmed" },
] as const;

const colorMap: Record<string, string> = {
  blue: "border-blue-500/30 bg-blue-500/5 text-blue-400",
  purple: "border-purple-500/30 bg-purple-500/5 text-purple-400",
  pink: "border-pink-500/30 bg-pink-500/5 text-pink-400",
};

export default function DocsPage() {
  return (
    <div className="space-y-14">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
            Testnet MVP — Internal Monorepo SDK
          </span>
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
          Fluppy SDK Documentation
        </h1>

        <p className="text-lg leading-relaxed text-gray-400">
          Fluppy is an open-source, privacy-preserving payment protocol on{" "}
          <span className="text-white">Stellar Soroban</span>. It combines{" "}
          <span className="text-white">Groth16 ZK membership proofs</span> with{" "}
          <span className="text-white">atomic 95/5 USDC settlement</span> — built as
          a three-layer modular SDK.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/docs/quickstart"
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-500"
          >
            Quickstart →
          </Link>
          <Link
            href="/docs/installation"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-white/40 hover:text-white"
          >
            Installation
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold text-white">SDK Architecture</h2>
        <p className="mb-5 text-sm text-gray-500">
          Three composable packages — each layer depends on the one below it.
        </p>

        <div className="space-y-4">
          {SDK_PACKAGES.map((pkg) => (
            <Link
              key={pkg.name}
              href={pkg.href}
              className={`block rounded-xl border p-4 transition-colors hover:bg-white/5 ${colorMap[pkg.color]}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="font-mono text-sm font-semibold">{pkg.name}</code>
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                    {pkg.status}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{pkg.size}</span>
              </div>
              <p className="mt-2 text-sm text-gray-400">{pkg.desc}</p>
            </Link>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-gray-400">
            <span className="font-medium text-gray-200">Current usage:</span>{" "}
            Internal pnpm monorepo workspace. Packages are consumed via{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-xs">
              {"\"workspace:*\""}
            </code>{" "}
            dependencies.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            <span className="font-medium text-gray-400">Future:</span>{" "}
            npm publication is planned after further release-readiness work. These packages
            are not yet available as public npm packages.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">How It Works</h2>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900">
          <div className="border-b border-white/10 px-4 py-2">
            <span className="font-mono text-xs text-gray-500">payment flow</span>
          </div>
          <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-gray-300">
{`Browser (User)
  │
  ├─ @fluppy/react      → useFluppyCredential: AES-GCM secret (IndexedDB)
  ├─ @fluppy/browser    → computeCommitment → POST /api/merkle-proof
  ├─ @fluppy/browser    → snarkjs.groth16.fullProve() → ZK proof (BN254)
  ├─ @fluppy/browser    → verifyProofLocally() → ✓ VALID
  └─ @fluppy/browser    → Freighter sign → Soroban RPC submit
                                    │
                           Soroban Contract
                              │
                              ├─ Nullifier replay protection
                              ├─ Merkle root validation
                              ├─ ChainId binding (cross-network guard)
                              └─ Atomic split: 95% merchant / 5% treasury
                                 via Stellar Asset Contract (USDC SAC)`}
          </pre>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Explore the Docs</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <div className="mb-2 text-2xl">{link.icon}</div>
              <div className="font-medium text-white">{link.label}</div>
              <div className="mt-1 text-xs text-gray-500">{link.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold text-white">Validation Evidence</h2>
        <p className="mb-4 text-sm text-gray-500">
          All SDK packages build and typecheck clean. Payment E2E confirmed on Stellar Testnet.
        </p>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Command / Test
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {VALIDATION_ROWS.map((row) => (
                <tr key={row.label} className="hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <code className="text-xs text-gray-300">{row.label}</code>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-green-400">
                    {row.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-400">Latest Testnet Tx:</span>{" "}
            <a
              href="https://stellar.expert/explorer/testnet/tx/cd0905471d7397174d51f8b2b6347ff6e7634ed875146cfadef459ab7d26cfec"
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-pink-400 hover:text-pink-300"
            >
              cd0905471d7397174d51f8b2b6347ff6e7634ed875146cfadef459ab7d26cfec
            </a>
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Current MVP Scope</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-green-400">
              ✓ Included in this MVP
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-400">
              {[
                "Stellar Testnet deployment",
                "Browser-side Groth16 proof generation",
                "Poseidon Merkle membership proof",
                "Local proof verification before submission",
                "Freighter wallet signing (user-paid fee)",
                "Atomic 95/5 USDC split on-chain",
                "Nullifier-based replay protection",
                "ChainId binding (cross-network guard)",
                "Three-layer modular SDK (@fluppy/*)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-green-400">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-yellow-400">
              ⏳ Future / Not in MVP
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-400">
              {[
                "Mainnet deployment",
                "Production relayer or gas sponsorship",
                "API key billing system",
                "Public npm package publication",
                "Native on-chain BN254 pairing check (pending SDK)",
                "Multi-party trusted setup ceremony",
                "External security audit",
                "React SDK app integration (next phase)",
                "Merchant production dashboard",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-yellow-400">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
