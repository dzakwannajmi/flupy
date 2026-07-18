/**
 * docs/quickstart/page.tsx — Developer quickstart for Fluppy React SDK.
 *
 * Demonstrates the full payment flow using @flupy/react hooks.
 *
 * Important: @flupy/react is a completed SDK layer.
 * Full app integration (replacing existing useFluppy.ts) is a separate next phase.
 * These code examples show how a future consumer would integrate the SDK.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Quickstart',
  description:
    'Get your first ZK payment running with Fluppy React SDK — FluppyProvider, useFluppyWallet, useFluppyCredential, useFluppyPayment, useFluppyHistory.',
};

// ─── Reusable primitives ──────────────────────────────────────────────────────

function SectionHeading({ id, step, children }: { id: string; step: number; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-3 mt-12 scroll-mt-20 flex items-center gap-3 text-xl font-semibold text-white first:mt-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-xs font-bold">
        {step}
      </span>
      {children}
    </h2>
  );
}

function CodeBlock({ children, filename }: { children: string; filename?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {filename && (
        <div className="border-b border-white/10 bg-white/5 px-4 py-2">
          <span className="text-xs font-mono text-gray-500">{filename}</span>
        </div>
      )}
      <pre className="overflow-x-auto bg-gray-900 p-4 text-sm text-gray-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
      <span className="shrink-0 text-base">🔐</span>
      <div>{children}</div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300">
      <span className="shrink-0 text-base">ℹ</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuickstartPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">Quickstart</h1>
        <p className="text-lg text-gray-400">
          This guide shows the full payment flow using <code className="text-white">@flupy/react</code> hooks —
          from wallet connection to a confirmed ZK payment on Stellar Testnet.
        </p>
      </div>

      <Note>
        <strong>SDK status:</strong>{' '}
        <code>@flupy/react</code> is complete as an SDK layer. These examples show
        how developers integrate the SDK. Full migration of the existing Fluppy app
        to these hooks is a separate next phase.
      </Note>

      {/* ── Flow overview ── */}
      <div className="rounded-xl border border-white/10 bg-gray-900 p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Payment Flow</p>
        <div className="space-y-2 text-sm">
          {[
            ['1', 'Wrap app with FluppyProvider',         'config: stellarConfig + networkPassphrase'],
            ['2', 'Connect Freighter wallet',             'useFluppyWallet → connect()'],
            ['3', 'Create or unlock ZK credential',       'useFluppyCredential → create() / unlock()'],
            ['4', 'Execute ZK payment',                   'useFluppyPayment → pay({ secret, merchant, amount })'],
            ['5', 'Store payment record locally',         'useFluppyHistory → add(record)'],
          ].map(([num, action, detail]) => (
            <div key={num} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-600/30 text-xs font-bold text-pink-400">
                {num}
              </span>
              <div>
                <span className="font-medium text-white">{action}</span>
                <span className="ml-2 text-gray-500">{detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 1: Provider ── */}
      <SectionHeading id="provider" step={1}>Wrap with FluppyProvider</SectionHeading>

      <p className="text-sm text-gray-400">
        Place <code className="text-white">FluppyProvider</code> near the root of your application.
        All Fluppy hooks must be inside this provider to access the shared SDK configuration.
      </p>

      <CodeBlock filename="app/layout.tsx">{`import { FluppyProvider } from '@flupy/react';
import type { FluppyReactConfig } from '@flupy/react';
import { useMemo } from 'react';

// Memoize config to prevent unnecessary re-renders
const fluppyConfig: FluppyReactConfig = {
  stellarConfig: {
    contractId:        process.env.NEXT_PUBLIC_CONTRACT_ID!,
    rpcUrl:            process.env.NEXT_PUBLIC_RPC_URL!,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  },
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  // merkleOptions is optional — defaults to /api/merkle-proof
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <FluppyProvider config={fluppyConfig}>
          {children}
        </FluppyProvider>
      </body>
    </html>
  );
}`}</CodeBlock>

      {/* ── Step 2: Wallet ── */}
      <SectionHeading id="wallet" step={2}>Connect Freighter Wallet</SectionHeading>

      <p className="text-sm text-gray-400">
        <code className="text-white">useFluppyWallet</code> manages Freighter connection state.
        <code className="mx-1 text-white">connect()</code> requests wallet access and returns the
        connected Stellar address. All calls are SSR-safe via dynamic import.
      </p>

      <CodeBlock filename="WalletButton.tsx">{`'use client';

import { useFluppyWallet } from '@flupy/react';

export function WalletButton() {
  const {
    address,
    isConnected,
    isConnecting,
    connectionStatus,
    error,
    connect,
  } = useFluppyWallet();

  if (isConnected && address) {
    return (
      <div>
        <span>Connected: {address.slice(0, 6)}...{address.slice(-4)}</span>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : 'Connect Freighter'}
    </button>
  );
}`}</CodeBlock>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Property</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {[
              ['address',          'string | null',             'Connected wallet address, or null'],
              ['isConnected',      'boolean',                   'True when status is connected'],
              ['isConnecting',     'boolean',                   'True during requestAccess()'],
              ['connectionStatus', 'WalletConnectionStatus',    'disconnected | connecting | connected | error'],
              ['connect()',        '() => Promise<string>',     'Requests Freighter access, returns address'],
              ['refresh()',        '() => Promise<void>',       'Re-checks Freighter without popup'],
            ].map(([prop, type, desc]) => (
              <tr key={prop} className="hover:bg-white/5">
                <td className="px-4 py-2.5 font-mono font-semibold text-white">{prop}</td>
                <td className="px-4 py-2.5 text-gray-400">{type}</td>
                <td className="px-4 py-2.5 text-gray-500">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Step 3: Credential ── */}
      <SectionHeading id="credential" step={3}>Create or Unlock Credential</SectionHeading>

      <p className="text-sm text-gray-400">
        <code className="text-white">useFluppyCredential</code> manages a ZK credential stored
        locally in IndexedDB, encrypted with AES-GCM + PBKDF2. The raw secret never leaves the
        browser and is never logged.
      </p>

      <CodeBlock filename="CredentialSetup.tsx">{`'use client';

import { useFluppyCredential } from '@flupy/react';

export function CredentialSetup() {
  const {
    status,
    exists,
    isLoading,
    error,
    create,
    unlock,
  } = useFluppyCredential();

  // Create a new credential
  async function handleCreate(password: string) {
    const { secret } = await create(password);

    // ⚠ Show the secret to the user EXACTLY ONCE as a backup phrase.
    // After this function returns, the secret cannot be recovered without the password.
    displayBackupPhrase(secret);  // your UI responsibility
  }

  // Unlock an existing credential
  async function handleUnlock(password: string): Promise<string> {
    // Returns the raw secret — pass it to useFluppyPayment.pay()
    // Do NOT log the secret. Do NOT store it in React state.
    return await unlock(password);
  }

  // Render based on status
  if (status === 'unknown') return <p>Checking credential...</p>;
  if (status === 'not_found') {
    return <button onClick={() => handleCreate('user-password')}>Create credential</button>;
  }
  return <p>Credential ready. Unlock to pay.</p>;
}`}</CodeBlock>

      <Warning>
        <strong>Security:</strong> The secret returned by{' '}
        <code>unlock(password)</code> must be passed directly to{' '}
        <code>pay(&#123; secret, ... &#125;)</code>. Never log it, never store it
        in <code>useState</code>, and never send it to a server.
        Only the <strong>commitment hash</strong> (<code>Poseidon(LEAF_TAG, secret)</code>)
        is transmitted to the backend API.
      </Warning>

      {/* ── Step 4: Payment ── */}
      <SectionHeading id="payment" step={4}>Execute ZK Payment</SectionHeading>

      <p className="text-sm text-gray-400">
        <code className="text-white">useFluppyPayment</code> orchestrates the full ZK payment flow:
        Merkle proof → Groth16 proof → Freighter signing → Soroban contract. It reads
        the SDK configuration from <code className="text-white">FluppyProvider</code>.
      </p>

      <CodeBlock filename="PaymentForm.tsx">{`'use client';

import { useFluppyCredential, useFluppyPayment, useFluppyHistory } from '@flupy/react';

export function PaymentForm({ merchantAddress }: { merchantAddress: string }) {
  const cred    = useFluppyCredential();
  const payment = useFluppyPayment();
  const history = useFluppyHistory();

  async function handlePay(password: string) {
    // Step 1: Unlock credential — get secret in memory only
    const secret = await cred.unlock(password);

    // Step 2: Execute ZK payment — secret is passed through, never stored
    const result = await payment.pay({
      secret,
      merchant: merchantAddress,
      amount:   10_000_000n,  // 1 USDC in stroops (1 USDC = 10_000_000)
    });

    // Step 3: Record in local history
    history.add({
      txHash:      result.txHash,
      amount:      10_000_000n,
      merchant:    merchantAddress,
      timestamp:   Date.now(),
      status:      'success',
      explorerUrl: \`https://stellar.expert/explorer/testnet/tx/\${result.txHash}\`,
    });
  }

  return (
    <div>
      {payment.status === 'pending' && (
        <div>
          <p>Step: {payment.currentStep}</p>
          <p>Progress: {payment.progressPct ?? 0}%</p>
          <p>Stage: {payment.progressStage}</p>
        </div>
      )}
      {payment.txHash && (
        <p>Confirmed: {payment.txHash}</p>
      )}
      {payment.error && (
        <p>Error: {payment.error.message}</p>
      )}
      <button
        onClick={() => handlePay('user-password')}
        disabled={payment.isLoading}
      >
        {payment.isLoading ? 'Processing...' : 'Pay 1 USDC'}
      </button>
    </div>
  );
}`}</CodeBlock>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">State</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {[
              ['status',        'PaymentStatus',            'idle | pending | success | failed'],
              ['progressPct',   'number | null',             '0–100 during proof generation'],
              ['progressStage', 'string | null',             'Current proof stage label'],
              ['currentStep',   'FluppyPaymentStepName',    'merkle:request | proof:start | tx:submit | ...'],
              ['txHash',        'string | null',             'Transaction hash on success'],
              ['error',         'Error | null',              'Structured error on failure'],
              ['pay(input)',    'Promise<Result>',           'Initiates payment; throws on failure'],
              ['abort()',       '() => void',                'Cancels in-flight payment, resets to idle'],
              ['reset()',       '() => void',                'Full state reset to idle'],
            ].map(([prop, type, desc]) => (
              <tr key={prop} className="hover:bg-white/5">
                <td className="px-4 py-2.5 font-mono font-semibold text-white">{prop}</td>
                <td className="px-4 py-2.5 text-gray-400">{type}</td>
                <td className="px-4 py-2.5 text-gray-500">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Step 5: History ── */}
      <SectionHeading id="history" step={5}>Display Payment History</SectionHeading>

      <p className="text-sm text-gray-400">
        <code className="text-white">useFluppyHistory</code> persists payment records to{' '}
        <code className="text-white">localStorage</code> under the key{' '}
        <code className="text-white">fluppy:payment-history:v1</code>. The{' '}
        <code className="text-white">amount</code> field is serialized as a decimal string
        internally — the public API always exposes <code className="text-white">bigint</code>.
        Records persist across page reloads and are capped at 50 entries.
      </p>

      <CodeBlock filename="PaymentHistory.tsx">{`'use client';

import { useFluppyHistory } from '@flupy/react';

export function PaymentHistory() {
  const { records, clear } = useFluppyHistory();

  if (records.length === 0) return <p>No payments yet.</p>;

  return (
    <div>
      <ul>
        {records.map((record) => (
          <li key={record.txHash}>
            <span>{record.status}</span>
            <span>
              {(Number(record.amount) / 10_000_000).toFixed(2)} USDC
            </span>
            <a
              href={record.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {record.txHash.slice(0, 8)}...
            </a>
          </li>
        ))}
      </ul>
      <button onClick={clear}>Clear history</button>
    </div>
  );
}`}</CodeBlock>

      <Note>
        <strong>Privacy:</strong> localStorage only stores public transaction metadata —
        txHash, amount, merchant address, timestamp, and status. No secrets, passwords,
        ZK proof inputs, or private keys are ever written to localStorage.
      </Note>

      {/* ── Security ── */}
      <SectionHeading id="security" step={6}>Security Reminders</SectionHeading>

      <div className="space-y-3">
        {[
          {
            title: 'Never log the secret',
            desc:  'The 64-char hex secret from unlock() must be passed directly to pay(). Logging it to console or sending it to an API breaks the privacy model.',
          },
          {
            title: 'Never store the secret in React state',
            desc:  'useState persists across renders. Pass the secret directly from unlock() to pay() in the same async function. Do not store it in a ref or global variable either.',
          },
          {
            title: 'User signs and pays network fee via Freighter',
            desc:  'There is no production relayer in the current MVP. The user approves and signs the Soroban transaction directly through the Freighter browser extension.',
          },
          {
            title: 'Protocol fee is taken from the payment amount',
            desc:  'The Soroban contract autonomously splits the payment: 95% to the merchant, 5% to the protocol treasury. This is not an additional charge — it comes from the amount you pass to pay().',
          },
          {
            title: 'This is a Testnet MVP',
            desc:  'No real funds are at risk on Testnet. Do not use mainnet USDC until a full security audit, multi-party trusted setup, and native BN254 pairing verification are complete.',
          },
        ].map(({ title, desc }) => (
          <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-1 text-sm font-semibold text-white">{title}</p>
            <p className="text-sm text-gray-400">{desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
