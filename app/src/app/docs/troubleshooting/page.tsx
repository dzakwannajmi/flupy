import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Troubleshooting',
  description: 'Common issues and fixes for Fluppy SDK — build errors, credentials, Merkle sync, ZK proofs, Soroban transactions.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-white first:mt-0">
      {children}
    </h2>
  );
}

function Code({ children, filename }: { children: string; filename?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {filename && (
        <div className="border-b border-white/10 bg-white/5 px-4 py-2">
          <span className="font-mono text-xs text-gray-500">{filename}</span>
        </div>
      )}
      <pre className="overflow-x-auto bg-gray-900 p-4 text-sm text-gray-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300">
      <span className="shrink-0">ℹ</span>
      <div>{children}</div>
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300">
      <span className="shrink-0">⚠</span>
      <div>{children}</div>
    </div>
  );
}

function IssueCard({
  error,
  cause,
  fix,
}: {
  error: string;
  cause: string;
  fix: string | ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="border-b border-white/10 bg-white/5 px-4 py-2.5">
        <code className="text-xs font-semibold text-red-400">{error}</code>
      </div>
      <div className="divide-y divide-white/5 text-xs">
        <div className="flex gap-3 px-4 py-2.5">
          <span className="w-14 shrink-0 font-semibold text-gray-500">Cause</span>
          <span className="text-gray-400">{cause}</span>
        </div>
        <div className="flex gap-3 px-4 py-2.5">
          <span className="w-14 shrink-0 font-semibold text-gray-500">Fix</span>
          <span className="text-gray-400">{fix}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TroubleshootingPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <div className="mb-3">
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
            Testnet MVP — Internal Monorepo SDK
          </span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">Troubleshooting</h1>
        <p className="text-lg text-gray-400">
          Common errors and their fixes for the Fluppy SDK. Packages are internal workspace
          packages — see{' '}
          <Link href="/docs/installation" className="text-white underline">
            Installation
          </Link>{' '}
          for setup, and{' '}
          <Link href="/docs/core" className="text-white underline">
            API Reference
          </Link>{' '}
          for usage.
        </p>
      </div>

      {/* Jump links */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
          Jump to section
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            ['#build',       'Build & Workspace'],
            ['#env',         'Environment'],
            ['#wallet',      'Wallet / Freighter'],
            ['#credential',  'Credentials'],
            ['#merkle',      'Merkle / Root Sync'],
            ['#proof',       'ZK Proofs'],
            ['#soroban',     'Soroban Transactions'],
            ['#react',       'React SDK'],
            ['#commands',    'Quick Commands'],
            ['#issue',       'Filing an Issue'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href as string}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ── 1. Build & Workspace ── */}
      <H2 id="build">Build &amp; Workspace Issues</H2>
      <Note>
        Always run <code>pnpm install</code> from the <strong>repository root</strong>,
        then build packages in dependency order:{' '}
        <code>build:core → build:browser → build:react → build:app</code>.
      </Note>
      <div className="space-y-3">
        <IssueCard
          error="Cannot find module '@flupy/core'"
          cause="pnpm install was not run from the monorepo root, or workspace symlinks are missing."
          fix="Run `pnpm install` from the repository root, then `pnpm build:core`."
        />
        <IssueCard
          error="Cannot find module '@flupy/browser' / '@flupy/react'"
          cause="The package was not built — dist/ folder is empty or missing."
          fix="Run `pnpm build:browser` and/or `pnpm build:react` before starting the app."
        />
        <IssueCard
          error="Type error: Property 'X' does not exist on type (from @flupy/*)"
          cause="Stale dist/index.d.ts — package was updated in source but not rebuilt."
          fix="Rebuild the package: `pnpm build:core`, `pnpm build:browser`, or `pnpm build:react`."
        />
        <IssueCard
          error="pnpm build:react: command not found"
          cause="build:react script is missing from root package.json."
          fix={<>Add <code className="text-yellow-300">{`"build:react": "pnpm --filter @flupy/react build"`}</code> to the root package.json scripts section.</>}
        />
        <IssueCard
          error="TypeScript: rootDir or paths alias mismatch"
          cause="tsconfig.json in a package uses absolute paths that break when consumed from app/."
          fix="Do not import package source files directly across package boundaries. Import from the built dist only via workspace:* resolution."
        />
      </div>
      <Code>{`# Full clean build sequence from repository root
pnpm install
pnpm build:core
pnpm build:browser
pnpm build:react
pnpm --filter @flupy/react typecheck
pnpm build:app`}</Code>

      {/* ── 2. Environment ── */}
      <H2 id="env">Environment Issues</H2>
      <div className="space-y-3">
        <IssueCard
          error="[Stellar] NEXT_PUBLIC_CONTRACT_ID is required"
          cause=".env.local is missing or NEXT_PUBLIC_CONTRACT_ID is not set."
          fix="Run `cp app/.env.example app/.env.local` and fill in the Testnet values below."
        />
        <IssueCard
          error="[ZKP] NEXT_PUBLIC_NETWORK_PASSPHRASE missing"
          cause="NEXT_PUBLIC_NETWORK_PASSPHRASE is not set in .env.local."
          fix={<>Set <code className="text-yellow-300">NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015</code> in app/.env.local.</>}
        />
        <IssueCard
          error="ChainIdMismatch — proof valid locally but contract rejects"
          cause="NEXT_PUBLIC_NETWORK_PASSPHRASE does not match the value used when the contract was initialized."
          fix="Ensure NEXT_PUBLIC_NETWORK_PASSPHRASE is exactly `Test SDF Network ; September 2015` (including the semicolon and spaces)."
        />
        <IssueCard
          error="Environment variable updated but still using old value"
          cause="Next.js reads NEXT_PUBLIC_* variables at build/start time — changes require a server restart."
          fix="Stop the dev server, edit .env.local, then run `pnpm dev` again."
        />
      </div>
      <Code filename="app/.env.local (Testnet values)">{`NEXT_PUBLIC_CONTRACT_ID=CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015`}</Code>

      {/* ── 3. Wallet ── */}
      <H2 id="wallet">Wallet / Freighter Issues</H2>
      <div className="space-y-3">
        <IssueCard
          error="[useFluppyWallet] Freighter returned no address"
          cause="Freighter extension is not installed, or the wallet is locked."
          fix="Install Freighter from freighter.app, unlock it, and ensure it is set to Stellar Testnet."
        />
        <IssueCard
          error="[useFluppyWallet] Freighter access denied"
          cause="User clicked Reject in the Freighter access popup."
          fix="Call `connect()` again and have the user click Approve in the Freighter popup."
        />
        <IssueCard
          error="Transaction rejected / signing failed"
          cause="User rejected the transaction in Freighter, or Freighter is on the wrong network."
          fix="Switch Freighter to Stellar Testnet and retry. User must click Approve in the signing popup."
        />
        <IssueCard
          error="Insufficient balance for transaction fee"
          cause="Testnet wallet has no XLM to pay the Soroban network fee."
          fix={<>Fund the Testnet account at{' '}<a href="https://laboratory.stellar.org/account-creator" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Stellar Laboratory</a>{' '}or use the Friendbot API.</>}
        />
        <IssueCard
          error="No USDC trustline or insufficient USDC balance"
          cause="The user wallet does not have a USDC trustline or has insufficient Testnet USDC."
          fix="Add USDC trustline in Freighter for the Testnet USDC asset, then fund via Testnet faucet."
        />
      </div>

      {/* ── 4. Credentials ── */}
      <H2 id="credential">Credential Issues</H2>
      <Warn>
        If a credential is deleted or the IndexedDB is cleared, the secret cannot be recovered
        without the original backup phrase shown at creation. Always display the backup secret
        to the user exactly once after <code>create()</code>.
      </Warn>
      <div className="space-y-3">
        <IssueCard
          error="status: 'not_found' — no credential in IndexedDB"
          cause="No credential has been created yet, or the browser's IndexedDB was cleared."
          fix="Call `create(password)` to create a new credential. Show the returned secret to the user as a backup phrase."
        />
        <IssueCard
          error="Wrong password or corrupted credential"
          cause="The password provided to `unlock()` does not match the one used at `create()` time."
          fix="Use the correct password. If forgotten and no backup secret exists, delete the credential with `remove()` and create a new one."
        />
        <IssueCard
          error="Secret lost — user did not save backup"
          cause="The raw secret is only returned once from `create()`. It cannot be recovered after that without the password."
          fix="Delete the credential with `remove()` and create a new one. Enroll the new commitment in the Merkle tree."
        />
        <IssueCard
          error="Secret appearing in console or network tab"
          cause="Developer code accidentally logs the secret returned from unlock()."
          fix={<>Never call <code className="text-red-400">console.log(secret)</code>. Pass the secret directly from <code>unlock()</code> to <code>pay()</code> in the same async function.</>}
        />
      </div>

      {/* ── 5. Merkle / Root Sync ── */}
      <H2 id="merkle">Merkle / Root Sync Issues</H2>
      <div className="space-y-3">
        <IssueCard
          error="404 commitment_not_enrolled from /api/merkle-proof"
          cause="The commitment was never enrolled, or was enrolled to a different backend instance."
          fix="Call `enrollCommitment(secret)` before calling `getMerkleProof(secret)`."
        />
        <IssueCard
          error="RootSyncError: frontendRootHex !== contractRootHex"
          cause="The Merkle tree root stored in the Soroban contract does not match the backend tree root."
          fix="The contract admin must call `set_merkle_root` on the contract with the current backend root. Until then, no payments can proceed."
        />
        <IssueCard
          error="Stale Merkle root after new enrollments"
          cause="The backend sparse tree singleton cache was rebuilt after the contract root was last set."
          fix="Admin updates the contract Merkle root to match the current backend root. Restart the dev server to clear a stale in-memory cache."
        />
        <IssueCard
          error="Merkle proof path returns wrong depth or empty path"
          cause="Commitment enrolled to an old tree instance; backend was restarted without persisting the tree."
          fix="Re-enroll the commitment and request a fresh proof. In production, use a persistent Merkle tree backend."
        />
      </div>
      <Note>
        The root sync guard in <code>executeFluppyPayment()</code> always checks the backend root
        against the contract root <strong>before</strong> generating a ZK proof. A{' '}
        <code>RootSyncError</code> means no proof was generated and no transaction was submitted.
        Only the admin can resolve this by updating the on-chain Merkle root.
      </Note>

      {/* ── 6. ZK Proof ── */}
      <H2 id="proof">ZK Proof Generation Issues</H2>
      <div className="space-y-3">
        <IssueCard
          error="[artifacts] Failed to load WASM / ZKey artifact"
          cause="Circuit artifacts (circuit.wasm, circuit_final.zkey) are missing from the public/ directory or the path is wrong."
          fix={<>Ensure the artifact files are in <code className="text-yellow-300">app/public/circuit/</code> and that <code>NEXT_PUBLIC_CIRCUIT_WASM_PATH</code> / <code>NEXT_PUBLIC_CIRCUIT_ZKEY_PATH</code> are set correctly in .env.local.</>}
        />
        <IssueCard
          error="[prover] Proof generation already in progress"
          cause="generateZkProof() has a generation lock — only one proof runs at a time per session."
          fix="Wait for the current proof to complete, or call `abort()` to cancel it before starting a new one."
        />
        <IssueCard
          error="AbortError during proof generation"
          cause="The AbortSignal was triggered (user cancelled or component unmounted) during proof generation."
          fix="This is expected behavior. Reset the payment state with `reset()` and start fresh."
        />
        <IssueCard
          error="[prover] Local verification FAILED"
          cause="The generated proof is invalid — likely a circuit input mismatch (wrong secret, root, or recipient)."
          fix="Check that the secret, Merkle root, and merchant address all match the values used at enrollment. Rebuild circuit artifacts if recently changed."
        />
        <IssueCard
          error="Browser freezes or runs out of memory during proof"
          cause="Groth16 proof generation is CPU/memory intensive — some low-end browsers may struggle."
          fix="Retry in a desktop browser (Chrome or Firefox). Close other tabs to free memory. Safari may have WASM memory limitations on older versions."
        />
      </div>

      {/* ── 7. Soroban ── */}
      <H2 id="soroban">Soroban Transaction Issues</H2>
      <div className="space-y-3">
        <IssueCard
          error="Error code #4 — NullifierSpent"
          cause="This proof's nullifier has already been used in a previous payment."
          fix="Each payment requires a fresh proof with a new CSPRNG nonce. Call executeFluppyPayment() again — a new nullifier is generated automatically."
        />
        <IssueCard
          error="Error code: ChainIdMismatch"
          cause="The chainId public signal in the proof does not match the contract's expected network passphrase hash."
          fix="Ensure NEXT_PUBLIC_NETWORK_PASSPHRASE matches the value used when the contract was deployed. Testnet passphrase: `Test SDF Network ; September 2015`."
        />
        <IssueCard
          error="Error code: WrongMerkleRoot"
          cause="The merkleRoot public signal in the proof does not match the root stored in the contract."
          fix="The contract Merkle root must be updated by the admin to match the current backend tree. See Merkle / Root Sync section above."
        />
        <IssueCard
          error="Error code: RecipientMismatch"
          cause="The recipientHash public signal does not match the merchant address passed to the contract."
          fix="Ensure the merchant address passed to pay() is the same G-address used to compute the recipientHash in the circuit."
        />
        <IssueCard
          error="Error code: InvalidPaymentAmount"
          cause="The payment amount is outside the allowed range (minAmount–maxAmount public signals)."
          fix="Check the amount passed to pay(). Amount must be between MIN_AMOUNT and MAX_AMOUNT as defined in the circuit constants."
        />
        <IssueCard
          error="Error code #3 — ContractPaused"
          cause="The contract admin has paused the protocol via set_pause()."
          fix="Contact the contract admin to unpause. Check with stellar.expert/explorer that the contract is active."
        />
        <IssueCard
          error="Transaction simulation failed"
          cause="Simulation errors usually indicate a contract logic issue, authorization problem, or wrong account state."
          fix="Check the NEXT_PUBLIC_CONTRACT_ID. Ensure the Freighter-connected wallet is the transaction source. Check the console for the raw XDR simulation error."
        />
      </div>

      {/* ── 8. React SDK ── */}
      <H2 id="react">React SDK Issues</H2>
      <div className="space-y-3">
        <IssueCard
          error="[useFluppyContext] No FluppyProvider found in the component tree"
          cause="A Fluppy hook was called outside of a FluppyProvider subtree."
          fix={<>Wrap the component tree with <code className="text-yellow-300">{'<FluppyProvider config={...}>'}</code>. See <Link href="/docs/react#provider" className="text-blue-400 underline">Provider setup</Link>.</>}
        />
        <IssueCard
          error="FluppyProvider: stellarConfig or networkPassphrase missing"
          cause="The config object passed to FluppyProvider is missing required fields."
          fix="Ensure stellarConfig contains contractId, rpcUrl, and networkPassphrase. Also set networkPassphrase at the top-level config."
        />
        <IssueCard
          error="Secret accidentally stored in useState"
          cause="Developer stored the result of unlock() in a React state variable."
          fix={<>Pass the secret directly from <code>unlock()</code> to <code>pay()</code> within the same async handler. Never store it: <code className="text-red-400">const [secret, setSecret] = useState()</code> is incorrect.</>}
        />
        <IssueCard
          error="useFluppyHistory: localStorage parse error on mount"
          cause="The fluppy:payment-history:v1 localStorage key contains corrupted or incompatible data."
          fix={<>Open browser DevTools → Application → Local Storage → clear the key <code className="text-yellow-300">fluppy:payment-history:v1</code>. The hook will reset to an empty array.</>}
        />
        <IssueCard
          error="useFluppyWallet / useFluppyCredential called during SSR"
          cause="Browser-only hooks are being invoked at render time in a server component."
          fix={<>Add <code className="text-yellow-300">'use client'</code> to the component using these hooks. All Fluppy hooks are browser-only — they are SSR-safe but must run in a client component.</>}
        />
        <IssueCard
          error="useFluppyPayment: pay() called but status stays idle"
          cause="pay() was called outside a browser environment (e.g. in a test or SSR context)."
          fix="pay() throws '[useFluppyPayment] Payment can only run in a browser environment.' if called server-side. Ensure the component is client-side."
        />
      </div>

      {/* ── 9. Quick commands ── */}
      <H2 id="commands">Quick Command Checklist</H2>
      <p className="text-sm text-gray-400">
        Run these commands in order when diagnosing any issue:
      </p>
      <Code>{`cd ~/fluppy

# 1. Reinstall all workspace dependencies
pnpm install

# 2. Rebuild packages in dependency order
pnpm build:core
pnpm build:browser
pnpm build:react

# 3. Typecheck React SDK
pnpm --filter @flupy/react typecheck

# 4. Build the Next.js app
pnpm build:app

# 5. Check for overclaim content in docs
grep -R "mainnet.*live\\|production relayer.*exists\\|gasless payments.*implemented" \\
  app/src/app/docs || echo "CLEAN"

# 6. List all docs routes
find app/src/app/docs -name "page.tsx" | sort`}</Code>

      {/* ── 10. File an issue ── */}
      <H2 id="issue">Filing an Issue</H2>
      <p className="mb-4 text-sm text-gray-400">
        When reporting a bug or unexpected behaviour, please include the following information
        to help diagnose the issue quickly.
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Field</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">What to include</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {[
              ['Package version / commit',  'Run `git log --oneline -1` and paste the commit hash'],
              ['Browser & version',          'e.g. Chrome 124, Firefox 126, Safari 17'],
              ['Wallet network',             'Selected Stellar network — confirm in Freighter settings'],
              ['Error message',             'Full error text from browser console or terminal'],
              ['Stack trace',               'Copy the full stack trace from DevTools console'],
              ['txHash (if available)',      'The Stellar transaction hash if the tx was submitted'],
              ['RootSyncError',             'If thrown: include frontendRootHex and contractRootHex'],
              ['Build command output',      'Paste output of `pnpm build:core && pnpm build:browser && pnpm build:react && pnpm build:app`'],
              ['Environment',               'Confirm NEXT_PUBLIC_CONTRACT_ID and NEXT_PUBLIC_NETWORK_PASSPHRASE are set (redact values if needed)'],
            ].map(([field, desc]) => (
              <tr key={field} className="hover:bg-white/5">
                <td className="px-4 py-2.5 font-semibold text-white">{field}</td>
                <td className="px-4 py-2.5 text-gray-400">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Note>
        Fluppy is a <strong>Testnet MVP</strong>. Please do not file security vulnerability
        reports publicly. Instead, contact the maintainer directly with a private disclosure.
        Include the contract ID, transaction hash (if any), and a minimal reproduction.
      </Note>

    </div>
  );
}
