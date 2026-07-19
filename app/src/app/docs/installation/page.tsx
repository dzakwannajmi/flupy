/**
 * docs/installation/page.tsx — Installation guide for Fluppy SDK.
 *
 * Covers current monorepo setup. Packages are internal workspace packages —
 * NOT yet published to npm. Future npm installation is shown only as a preview.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: 'Installation',
  description:
    'Set up the Fluppy SDK monorepo locally: clone, install dependencies, configure environment, and build all packages.',
};

// ─── Reusable primitives ──────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 mt-12 scroll-mt-20 text-xl font-semibold text-[#0e0f0c] first:mt-0">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest text-[#454745]">{children}</h3>;
}

function Note({ type = 'info', children }: { type?: 'info' | 'warning' | 'future'; children: ReactNode }) {
  const styles = {
    info: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    warning: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300',
    future: 'border-purple-500/30 bg-purple-500/5 text-purple-300',
  };
  const icons = { info: 'ℹ', warning: '⚠', future: '🔮' };
  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-sm ${styles[type]}`}>
      <span className="shrink-0 text-base">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstallationPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-[#0e0f0c]">Installation</h1>
        <p className="text-lg text-[#454745]">
          Fluppy SDK is currently distributed as an internal pnpm monorepo workspace.
          This guide covers local development setup.
        </p>
      </div>

      <Note type="info">
        Fluppy packages (<code className="text-blue-200">@flupy/core</code>,{' '}
        <code className="text-blue-200">@flupy/browser</code>,{' '}
        <code className="text-blue-200">@flupy/react</code>) are{' '}
        <strong>internal workspace packages</strong> and are not yet published to npm.
        Public npm publication is planned after external security audit and multi-party
        trusted setup ceremony.
      </Note>

      {/* ── Prerequisites ── */}
      <SectionHeading id="prerequisites">1. Prerequisites</SectionHeading>

      <div className="overflow-hidden rounded-xl border border-black/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03]">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">Tool</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">Version</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">Purpose</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              ['Node.js', '≥ 18.0.0', 'JavaScript runtime for Next.js and SDK builds'],
              ['pnpm', '≥ 8.0.0', 'Monorepo package manager (workspace protocol)'],
              ['Rust + Cargo', 'stable', 'Soroban smart contract compilation to WASM'],
              ['Stellar CLI', '≥ 22.x', 'Contract deployment and invocation'],
              ['Freighter', 'Latest', 'Stellar wallet browser extension for signing'],
            ].map(([tool, ver, desc]) => (
              <tr key={tool} className="hover:bg-black/[0.03]">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#0e0f0c]">{tool}</td>
                <td className="px-4 py-2.5 text-xs text-[#454745]">{ver}</td>
                <td className="px-4 py-2.5 text-xs text-[#454745]">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CodeBlock>{`# Install pnpm (if not already installed)
npm install -g pnpm

# Add Rust WASM target for Soroban contract compilation
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
# See: https://developers.stellar.org/docs/tools/developer-tools/stellar-cli
cargo install --locked stellar-cli --features opt`}</CodeBlock>

      {/* ── Clone ── */}
      <SectionHeading id="clone">2. Clone Repository</SectionHeading>

      <CodeBlock>{`git clone https://github.com/dzakwannajmi/Fluppy.git
cd fluppy`}</CodeBlock>

      <p className="text-sm text-[#454745]">
        The repository uses a pnpm workspace monorepo. The root{' '}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs">pnpm-workspace.yaml</code>{' '}
        declares three workspace packages plus the Next.js app.
      </p>

      <CodeBlock filename="pnpm-workspace.yaml">{`packages:
  - 'app'
  - 'packages/*'`}</CodeBlock>

      {/* ── Install ── */}
      <SectionHeading id="install">3. Install Dependencies</SectionHeading>

      <CodeBlock>{`# From the repository root — installs all workspace dependencies
pnpm install`}</CodeBlock>

      <p className="text-sm text-[#454745]">
        This links all workspace packages via symlinks. You will see{' '}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs">node_modules/@flupy/core</code> inside{' '}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs">packages/fluppy-browser</code> and{' '}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs">app</code> as workspace symlinks.
      </p>

      {/* ── Configure ── */}
      <SectionHeading id="configure">4. Configure Environment</SectionHeading>

      <CodeBlock>{`cp app/.env.example app/.env.local`}</CodeBlock>

      <p className="mb-3 text-sm text-[#454745]">
        Edit <code className="rounded bg-black/5 px-1 py-0.5 text-xs">app/.env.local</code> with the following Testnet values:
      </p>

      <CodeBlock filename="app/.env.local">{`# Soroban contract — deployed on Stellar Testnet
NEXT_PUBLIC_CONTRACT_ID=CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS

# Soroban RPC endpoint
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443

# Horizon API (for transaction explorer links)
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

# Stellar network passphrase — MUST match the contract's expected chainId
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015`}</CodeBlock>

      <Note type="warning">
        <strong>ChainId binding:</strong> The{' '}
        <code>NEXT_PUBLIC_NETWORK_PASSPHRASE</code> value is hashed to produce the{' '}
        <code>chainId</code> public signal in every ZK proof. A mismatch between the
        frontend value and the contract's expected value will cause all payments to reject
        with <code>ChainIdMismatch</code>.
      </Note>

      {/* ── Build ── */}
      <SectionHeading id="build">5. Build SDK Packages</SectionHeading>

      <p className="mb-3 text-sm text-[#454745]">
        Build all SDK packages in dependency order. The Next.js app consumes them via workspace symlinks.
      </p>

      <CodeBlock>{`# Build @flupy/core (zero dependencies — always first)
pnpm build:core

# Build @flupy/browser (depends on @flupy/core)
pnpm build:browser

# Build @flupy/react (depends on @flupy/browser + @flupy/core)
pnpm build:react

# Typecheck React SDK
pnpm --filter @flupy/react typecheck

# Build the Next.js app
pnpm build:app`}</CodeBlock>

      <p className="text-sm text-[#454745]">
        All five commands should complete with no errors. Expected SDK bundle sizes after build:
      </p>

      <div className="overflow-hidden rounded-xl border border-black/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03]">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">Package</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">ESM</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">CJS</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">DTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              ['@flupy/core', '~10 KB', '~11 KB', '~9 KB'],
              ['@flupy/browser', '~31 KB', '~32 KB', '~11 KB'],
              ['@flupy/react', '~14 KB', '~14 KB', '~14 KB'],
            ].map(([pkg, esm, cjs, dts]) => (
              <tr key={pkg} className="hover:bg-black/[0.03]">
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#0e0f0c]">{pkg}</td>
                <td className="px-4 py-2.5 text-xs text-[#454745]">{esm}</td>
                <td className="px-4 py-2.5 text-xs text-[#454745]">{cjs}</td>
                <td className="px-4 py-2.5 text-xs text-[#454745]">{dts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Run App ── */}
      <SectionHeading id="run">6. Run the App Locally</SectionHeading>

      <CodeBlock>{`cd app
pnpm dev
# Open http://localhost:3000`}</CodeBlock>

      {/* ── Workspace Dependencies ── */}
      <SectionHeading id="workspace">7. Workspace Dependency Model</SectionHeading>

      <p className="mb-3 text-sm text-[#454745]">
        Packages reference each other via the pnpm workspace protocol:
      </p>

      <CodeBlock filename="packages/fluppy-browser/package.json">{`{
  "dependencies": {
    "@flupy/core": "workspace:*"
  }
}`}</CodeBlock>

      <CodeBlock filename="app/package.json">{`{
  "dependencies": {
    "@flupy/browser": "workspace:*",
    "@flupy/core": "workspace:*",
    "@flupy/react": "workspace:*"
  }
}`}</CodeBlock>

      <p className="text-sm text-[#454745]">
        The <code className="rounded bg-black/5 px-1 py-0.5 text-xs">workspace:*</code> protocol
        resolves to the local package path at install time. Running{' '}
        <code className="rounded bg-black/5 px-1 py-0.5 text-xs">pnpm install</code> from the root
        creates the necessary symlinks automatically.
      </p>

      {/* ── Future npm ── */}
      <SectionHeading id="future-npm">8. Future npm Installation</SectionHeading>

      <Note type="future">
        <strong>Not available today.</strong> The following shows how installation will work
        after packages are published to npm. Publication is planned after external security audit
        and multi-party trusted setup ceremony — both required before mainnet readiness.
      </Note>

      <SubHeading>Future npm install (preview only)</SubHeading>

      <CodeBlock>{`# Future package-manager command after package publication.
# DO NOT use this command today — packages are not yet published.

pnpm add @flupy/core @flupy/browser @flupy/react`}</CodeBlock>

      <CodeBlock filename="tsconfig.json (future)">{`{
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "moduleResolution": "bundler"
  }
}`}</CodeBlock>

    </div>
  );
}
