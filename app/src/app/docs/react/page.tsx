import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

export const metadata: Metadata = {
  title: '@flupy/react',
  description: 'API reference for @flupy/react — Fluppy React SDK hooks and provider.',
};

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-[#0e0f0c] first:mt-0">{children}</h2>;
}
function Code({ children, filename }: { children: string; filename?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10">
      {filename && <div className="border-b border-black/10 bg-black/[0.03] px-4 py-2"><span className="font-mono text-xs text-[#454745]">{filename}</span></div>}
      <pre className="overflow-x-auto bg-white p-4 text-sm text-[#454745]"><code>{children}</code></pre>
    </div>
  );
}
function Warn({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300"><Icon icon="ph:warning" width={18} height={18} className="shrink-0" /><div>{children}</div></div>;
}
function Note({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300"><span className="shrink-0">ℹ</span><div>{children}</div></div>;
}
function HookSection({ id, name, badge, children }: { id: string; name: string; badge?: string; children: ReactNode }) {
  return (
    <section>
      <h2 id={id} className="mb-3 mt-10 scroll-mt-20 flex items-center gap-2 text-xl font-semibold text-[#0e0f0c] first:mt-0">
        <code className="text-[#163300]">{name}</code>
        {badge && <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">{badge}</span>}
      </h2>
      {children}
    </section>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-black/10 bg-black/[0.03]">
          {headers.map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[#454745]">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-white/5">
          {rows.map(row => (
            <tr key={row[0]} className="hover:bg-black/[0.03]">
              {row.map((cell, i) => (
                <td key={i} className={`px-4 py-2.5 text-xs ${i === 0 ? 'font-mono font-semibold text-[#0e0f0c]' : i === 1 ? 'text-[#454745]' : 'text-[#454745]'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReactPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-[#9fe870]/30 bg-[#9fe870]/10 px-2.5 py-0.5 text-xs font-medium text-[#163300]">@flupy/react</span>
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">✓ Complete</span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-[#0e0f0c]">@flupy/react</h1>
        <p className="text-lg text-[#454745]">
          React SDK built on <code className="text-[#0e0f0c]">@flupy/browser</code>. Provides a context
          provider and four domain hooks for the full Fluppy payment lifecycle.
        </p>
      </div>

      <Note>
        <strong>Status:</strong> <code>@flupy/react</code> is complete as an SDK layer.
        Full migration of the existing Fluppy app to these hooks is a planned next phase.
        These hooks are ready to be consumed by any React 18+ application with{' '}
        <code>FluppyProvider</code> at the root.
      </Note>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['~14 KB', 'ESM bundle'], ['~14 KB', 'CJS bundle'], ['~14 KB', 'TypeScript declarations']].map(([size, label]) => (
          <div key={label} className="rounded-xl border border-black/10 bg-black/[0.03] p-3 text-center">
            <div className="text-lg font-bold text-[#0e0f0c]">{size}</div>
            <div className="text-xs text-[#454745]">{label}</div>
          </div>
        ))}
      </div>

      {/* Hooks overview */}
      <H2 id="hooks">Available Hooks</H2>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['FluppyProvider',      'Context provider — wraps a React subtree with Fluppy config'],
          ['useFluppyCredential', 'Credential lifecycle: create, unlock, delete, status'],
          ['useFluppyPayment',    'Full ZK payment flow with abort, progress, and step tracking'],
          ['useFluppyWallet',     'Freighter wallet connection state (SSR-safe, dynamic import)'],
          ['useFluppyHistory',    'localStorage-persisted payment records with bigint serialization'],
        ].map(([name, desc]) => (
          <div key={name as string} className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
            <code className="text-xs font-semibold text-[#163300]">{name}</code>
            <p className="mt-1 text-xs text-[#454745]">{desc}</p>
          </div>
        ))}
      </div>

      {/* Provider */}
      <HookSection id="provider" name="FluppyProvider">
        <p className="mb-4 text-sm text-[#454745]">
          Wrap your application (or a subtree) with <code className="text-[#0e0f0c]">FluppyProvider</code>.
          All Fluppy hooks must be descendants of this provider.
          Memoize the <code className="text-[#0e0f0c]">config</code> object to prevent unnecessary re-renders.
        </p>
        <Table
          headers={['Config field', 'Type', 'Description']}
          rows={[
            ['stellarConfig',    'StellarConfig',      'contractId, rpcUrl, networkPassphrase — Soroban connection config'],
            ['networkPassphrase','string',             'Stellar network passphrase — MUST match the contract\'s expected chainId'],
            ['merkleOptions?',   'MerkleClientOptions','Optional: apiBaseUrl override for the Merkle proof backend'],
          ]}
        />
        <Code filename="layout.tsx">{`import { FluppyProvider } from '@flupy/react';

const config = {
  stellarConfig: {
    contractId:        process.env.NEXT_PUBLIC_CONTRACT_ID!,
    rpcUrl:            process.env.NEXT_PUBLIC_RPC_URL!,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
  },
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
};

export default function Layout({ children }: { children: ReactNode }) {
  return <FluppyProvider config={config}>{children}</FluppyProvider>;
}`}</Code>
      </HookSection>

      {/* useFluppyCredential */}
      <HookSection id="credential" name="useFluppyCredential()">
        <p className="mb-4 text-sm text-[#454745]">
          Manages the full lifecycle of a locally encrypted ZK credential.
          Initial credential check runs in a browser-safe <code>useEffect</code> — SSR renders return{' '}
          <code>status: 'unknown'</code>.
        </p>
        <Warn>
          The <code>secret</code> returned by <code>create()</code> and <code>unlock()</code> must
          never be logged, never stored in <code>useState</code>, and never sent to any server.
          Pass it directly to <code>useFluppyPayment().pay()</code> in the same async function.
        </Warn>
        <Table
          headers={['Property', 'Type', 'Description']}
          rows={[
            ['status',      'CredentialStatus',         'unknown | exists | not_found'],
            ['exists',      'boolean | null',            'true/false when status is known; null while unknown'],
            ['isLoading',   'boolean',                   'True during any async credential operation'],
            ['error',       'Error | null',              'Last thrown error; null if none'],
            ['create(pw)',  '(string) → Promise<{secret}>','Creates and encrypts a new credential; returns secret ONCE'],
            ['unlock(pw)',  '(string) → Promise<string>', 'Decrypts and returns raw secret — never logged internally'],
            ['remove()',    '() → Promise<void>',         'Permanently deletes credential from IndexedDB'],
            ['refresh()',   '() → Promise<void>',         'Re-checks credential existence'],
            ['resetError()','() → void',                  'Clears current error without changing status'],
          ]}
        />
      </HookSection>

      {/* useFluppyPayment */}
      <HookSection id="payment" name="useFluppyPayment()">
        <p className="mb-4 text-sm text-[#454745]">
          Orchestrates the full ZK payment flow. Reads configuration from{' '}
          <code className="text-[#0e0f0c]">FluppyProvider</code>. The{' '}
          <code className="text-[#0e0f0c]">secret</code> is passed as a parameter to{' '}
          <code className="text-[#0e0f0c]">pay()</code> — it is never stored in React state.
        </p>
        <Table
          headers={['State', 'Type', 'Description']}
          rows={[
            ['status',        'PaymentStatus',         'idle | pending | success | failed'],
            ['isLoading',     'boolean',               'True during proof generation or transaction submission'],
            ['error',         'Error | null',          'Last thrown error; null if none'],
            ['txHash',        'string | null',         'Transaction hash on success; null otherwise'],
            ['progressStage', 'string | null',         'Current proof generation stage label (e.g. "Computing witness")'],
            ['progressPct',   'number | null',         '0–100 during proof generation'],
            ['currentStep',   'FluppyPaymentStepName | null', 'Named orchestrator step: merkle:request | proof:start | tx:submit | tx:confirmed | ...'],
          ]}
        />
        <Table
          headers={['Method', 'Returns', 'Description']}
          rows={[
            ['pay(input)',    'Promise<ExecuteFluppyPaymentResult>','Initiates payment; throws on failure — caller handles UI feedback'],
            ['abort()',       'void',                              'Cancels in-flight payment, resets status to idle'],
            ['reset()',       'void',                             'Full state reset: clears status, error, txHash, progress'],
            ['resetError()',  'void',                             'Clears error only — preserves txHash and status'],
          ]}
        />
        <Table
          headers={['pay() input', 'Type', 'Description']}
          rows={[
            ['secret',   'string',       '64-char hex from useFluppyCredential.unlock() — NOT stored in state'],
            ['merchant', 'string',       'Merchant Stellar address (G... format)'],
            ['amount',   'bigint',       'Payment amount in stroops (1 USDC = 10_000_000n)'],
            ['signal?',  'AbortSignal',  'Optional external abort signal composed with the hook\'s own controller'],
          ]}
        />
      </HookSection>

      {/* useFluppyWallet */}
      <HookSection id="wallet" name="useFluppyWallet()">
        <p className="mb-4 text-sm text-[#454745]">
          Manages Freighter wallet connection state. Uses dynamic import for the Freighter API
          to avoid bundling it in SSR contexts. <code className="text-[#0e0f0c]">refresh()</code> is a
          no-op on the server.
        </p>
        <Table
          headers={['Property', 'Type', 'Description']}
          rows={[
            ['address',          'string | null',          'Connected Stellar address; null if not connected'],
            ['connectionStatus', 'WalletConnectionStatus', 'disconnected | connecting | connected | error'],
            ['isConnected',      'boolean',                'Derived: true when status is connected'],
            ['isConnecting',     'boolean',                'Derived: true when status is connecting'],
            ['error',            'Error | null',           'Last error from connect(); null if none'],
            ['connect()',        '() → Promise<string>',   'Calls Freighter requestAccess(), returns address; throws on rejection'],
            ['refresh()',        '() → Promise<void>',     'Re-checks Freighter isConnected(); no-op on SSR'],
            ['resetError()',     '() → void',              'Clears error only'],
          ]}
        />
        <Note>
          The user <strong>signs the Soroban transaction directly via Freighter</strong> and pays
          the Stellar network fee from their own wallet. There is no production relayer and no gas
          sponsorship in the current Testnet MVP.
        </Note>
      </HookSection>

      {/* useFluppyHistory */}
      <HookSection id="history" name="useFluppyHistory()">
        <p className="mb-4 text-sm text-[#454745]">
          Persists payment record metadata to <code className="text-[#0e0f0c]">localStorage</code> using
          the key <code className="text-[#0e0f0c]">fluppy:payment-history:v1</code>.
          Records are loaded on mount inside a browser-safe <code>useEffect</code> — SSR renders
          return an empty array. Capped at 50 records.
        </p>
        <Note>
          <code>amount</code> is a <code>bigint</code> in the public API but serialized as a decimal
          string in localStorage (JSON cannot encode bigint natively). Deserialization is handled
          automatically — callers always receive <code>bigint</code>.
          No secrets, passwords, ZK proof internals, or private keys are stored.
        </Note>
        <Table
          headers={['Method', 'Signature', 'Description']}
          rows={[
            ['add(record)',          '(FluppyPaymentRecord) → void',     'Prepends record; deduplicates by txHash; persists'],
            ['update(txHash, patch)','(string, Partial) → void',          'Updates matching record fields; persists'],
            ['remove(txHash)',       '(string) → void',                  'Removes record by txHash; persists'],
            ['clear()',             '() → void',                         'Clears all records from state and localStorage'],
            ['refresh()',           '() → void',                         'Reloads records from localStorage'],
          ]}
        />
        <Table
          headers={['FluppyPaymentRecord field', 'Type', 'Description']}
          rows={[
            ['txHash',      'string',                           'Stellar transaction hash'],
            ['amount',      'bigint',                           'Payment amount in stroops'],
            ['merchant',    'string',                           'Merchant Stellar address'],
            ['timestamp',   'number',                           'Unix timestamp in milliseconds'],
            ['status',      "'pending' | 'success' | 'failed'", 'Payment outcome'],
            ['explorerUrl?','string',                           'Optional Stellar Expert explorer URL'],
          ]}
        />
      </HookSection>

      {/* Combined example */}
      <H2 id="example">Combined Example</H2>
      <Note>
        See <Link href="/docs/installation" className="underline">Installation</Link> for monorepo setup.
        Do not use public npm package installation yet — packages are not yet published.
      </Note>
      <Code filename="PaymentCard.tsx">{`'use client';

import {
  useFluppyCredential,
  useFluppyPayment,
  useFluppyHistory,
  useFluppyWallet,
} from '@flupy/react';

export function PaymentCard({ merchant }: { merchant: string }) {
  const wallet  = useFluppyWallet();
  const cred    = useFluppyCredential();
  const payment = useFluppyPayment();
  const history = useFluppyHistory();

  async function handlePay(password: string) {
    if (!wallet.isConnected) await wallet.connect();

    // unlock() returns secret in memory only — NOT stored in state
    const secret = await cred.unlock(password);

    const result = await payment.pay({
      secret,
      merchant,
      amount: 10_000_000n, // 1 USDC
    });

    // Store metadata — NOT secret, NOT proof internals
    history.add({
      txHash:      result.txHash,
      amount:      10_000_000n,
      merchant,
      timestamp:   Date.now(),
      status:      'success',
      explorerUrl: \`https://stellar.expert/explorer/testnet/tx/\${result.txHash}\`,
    });
  }

  return (
    <div>
      {payment.status === 'pending' && (
        <div>
          <div>{payment.currentStep}</div>
          <div>{payment.progressPct ?? 0}% — {payment.progressStage}</div>
        </div>
      )}
      {payment.status === 'success' && <p>✓ {payment.txHash}</p>}
      {payment.error && <p>Error: {payment.error.message}</p>}
      <button
        onClick={() => handlePay(passwordFromSecureInput)}
        disabled={payment.isLoading}
      >
        Pay 1 USDC
      </button>
    </div>
  );
}`}</Code>

    </div>
  );
}
