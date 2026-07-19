import type { Metadata } from 'next';
import { CodeBlock as Code } from "@/components/CodeBlock";
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@iconify/react';

export const metadata: Metadata = {
  title: 'Examples',
  description: 'SDK usage examples for Fluppy — FluppyProvider, hooks, and browser SDK.',
};

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-[#0e0f0c] first:mt-0">{children}</h2>;
}
function Note({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300"><span className="shrink-0">ℹ</span><div>{children}</div></div>;
}
function Warn({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300"><Icon icon="ph:warning" width={18} height={18} className="shrink-0" /><div>{children}</div></div>;
}

export default function ExamplesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-[#0e0f0c]">Examples</h1>
        <p className="text-lg text-[#454745]">
          Complete code examples for integrating the Fluppy SDK into a React application.
          All examples use the internal monorepo workspace packages.
        </p>
      </div>

      <Note>
        These examples demonstrate the SDK API. Current packages are internal monorepo
        workspace packages — see{' '}
        <Link href="/docs/installation" className="underline">Installation</Link> for setup.
        Full migration of the existing Fluppy app to these hooks is a planned next phase.
      </Note>

      {/* Provider setup */}
      <H2 id="provider">1. Provider Setup</H2>
      <p className="text-sm text-[#454745]">
        Place <code className="text-[#0e0f0c]">FluppyProvider</code> near your application root.
        Memoize the config object with <code className="text-[#0e0f0c]">useMemo</code> to prevent
        unnecessary re-renders in child hooks.
      </p>
      <Code filename="app/layout.tsx">{`'use client';

import { useMemo } from 'react';
import { FluppyProvider } from '@flupy/react';
import type { FluppyReactConfig } from '@flupy/react';

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = useMemo((): FluppyReactConfig => ({
    stellarConfig: {
      contractId:        process.env.NEXT_PUBLIC_CONTRACT_ID!,
      rpcUrl:            process.env.NEXT_PUBLIC_RPC_URL!,
      networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
    },
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
    // merkleOptions is optional — defaults to /api/merkle-proof
  }), []);

  return (
    <html lang="en">
      <body>
        <FluppyProvider config={config}>
          {children}
        </FluppyProvider>
      </body>
    </html>
  );
}`}</Code>

      {/* Wallet connection */}
      <H2 id="wallet">2. Wallet Connection</H2>
      <p className="text-sm text-[#454745]">
        <code className="text-[#0e0f0c]">useFluppyWallet</code> wraps Freighter wallet state.
        All Freighter calls use dynamic import — safe in SSR environments.
      </p>
      <Code filename="WalletButton.tsx">{`'use client';

import { useFluppyWallet } from '@flupy/react';

export function WalletButton() {
  const { address, isConnected, isConnecting, error, connect, resetError } = useFluppyWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
      </div>
    );
  }

  return (
    <div>
      {error && <p onClick={resetError}>Error: {error.message} (click to dismiss)</p>}
      <button onClick={connect} disabled={isConnecting}>
        {isConnecting ? 'Connecting…' : 'Connect Freighter'}
      </button>
    </div>
  );
}`}</Code>

      {/* Credential lifecycle */}
      <H2 id="credential">3. Credential Lifecycle</H2>
      <Warn>
        The <code>secret</code> returned by <code>create()</code> and <code>unlock()</code> must
        never be logged to console, never stored in <code>useState</code>, and never sent to any
        server. Pass it directly to <code>pay()</code> in the same async function.
        Display the backup secret to the user <strong>exactly once</strong> after <code>create()</code>.
      </Warn>
      <Code filename="CredentialManager.tsx">{`'use client';

import { useFluppyCredential } from '@flupy/react';

export function CredentialManager({
  onSecretCreated,   // caller shows this backup secret to the user ONCE
  onUnlocked,        // caller passes secret directly to payment flow
}: {
  onSecretCreated: (backupSecret: string) => void;
  onUnlocked:      (secret: string)       => void;
}) {
  const { status, isLoading, error, create, unlock, remove, refresh } = useFluppyCredential();

  async function handleCreate(password: string) {
    // createCredential returns { secret } — show it to user ONCE as backup
    const { secret } = await create(password);
    onSecretCreated(secret); // your UI responsibility — never log it
  }

  async function handleUnlock(password: string) {
    // unlockCredential decrypts and returns the secret in memory
    const secret = await unlock(password);
    onUnlocked(secret); // pass directly to payment — do not store
  }

  if (status === 'unknown') return <p>Checking credential storage…</p>;

  if (status === 'not_found') {
    return (
      <div>
        <p>No credential found. Create one to start paying.</p>
        <button onClick={() => handleCreate(passwordFromYourUI)}>
          Create Credential
        </button>
      </div>
    );
  }

  return (
    <div>
      <p>Credential ready.</p>
      <button onClick={() => handleUnlock(passwordFromYourUI)}>Unlock to Pay</button>
      <button onClick={remove}>Delete Credential</button>
    </div>
  );
}`}</Code>

      {/* Payment flow */}
      <H2 id="payment">4. Payment Flow</H2>
      <Code filename="PaymentForm.tsx">{`'use client';

import { useFluppyPayment } from '@flupy/react';

export function PaymentForm({
  merchantAddress,  // your application supplies this — do not hardcode in SDK
  getSecretFromUI,  // function that returns unlocked secret from your credential flow
}: {
  merchantAddress: string;
  getSecretFromUI: () => Promise<string>;
}) {
  const {
    status, isLoading, error, txHash,
    progressPct, progressStage, currentStep,
    pay, abort, reset, resetError,
  } = useFluppyPayment();

  async function handlePay() {
    // Get the unlocked secret from your credential unlock flow
    const secret = await getSecretFromUI();

    // pay() accepts secret directly — it is NOT stored in React state internally
    await pay({
      secret,
      merchant: merchantAddress,
      amount:   10_000_000n, // 1 USDC in stroops
    });
  }

  return (
    <div>
      {/* Progress display */}
      {status === 'pending' && (
        <div>
          <p>Step: {currentStep}</p>
          <p>Progress: {progressPct ?? 0}% — {progressStage}</p>
          <button onClick={abort}>Cancel</button>
        </div>
      )}

      {/* Success */}
      {status === 'success' && txHash && (
        <div>
          <p>✓ Payment confirmed</p>
          
            href={\`https://stellar.expert/explorer/testnet/tx/\${txHash}\`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Stellar Expert ↗
          </a>
          <button onClick={reset}>Pay again</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div>
          <p>Error: {error.message}</p>
          <button onClick={resetError}>Dismiss</button>
        </div>
      )}

      {/* Pay button */}
      {status === 'idle' && (
        <button onClick={handlePay} disabled={isLoading}>
          Pay 1 USDC
        </button>
      )}
    </div>
  );
}`}</Code>

      {/* History */}
      <H2 id="history">5. Payment History</H2>
      <Note>
        <code>useFluppyHistory</code> stores only public metadata — txHash, amount, merchant address,
        timestamp, and status. No secrets, passwords, ZK proof inputs, or private keys are stored.
        The <code>amount</code> field is a <code>bigint</code> in the public API and serialized as a
        decimal string in localStorage.
      </Note>
      <Code filename="PaymentHistory.tsx">{`'use client';

import { useFluppyHistory } from '@flupy/react';
import type { FluppyPaymentRecord } from '@flupy/react';

export function PaymentHistory() {
  const { records, update, remove, clear } = useFluppyHistory();

  if (records.length === 0) {
    return <p>No payments recorded yet.</p>;
  }

  return (
    <div>
      <div>
        {records.map((record) => (
          <div key={record.txHash}>
            <span>{record.status}</span>
            <span>{(Number(record.amount) / 10_000_000).toFixed(2)} USDC</span>
            <span>{record.merchant.slice(0, 6)}…</span>
            <span>{new Date(record.timestamp).toLocaleDateString()}</span>
            {record.explorerUrl && (
              <a href={record.explorerUrl} target="_blank" rel="noopener noreferrer">
                View ↗
              </a>
            )}
            <button onClick={() => remove(record.txHash)}>×</button>
          </div>
        ))}
      </div>
      <button onClick={clear}>Clear all</button>
    </div>
  );
}

// Adding a record after payment:
function addPaymentToHistory(
  history: ReturnType<typeof useFluppyHistory>,
  result: { txHash: string },
  merchant: string,
  amount: bigint,
) {
  const record: FluppyPaymentRecord = {
    txHash:      result.txHash,
    amount,
    merchant,
    timestamp:   Date.now(),
    status:      'success',
    explorerUrl: \`https://stellar.expert/explorer/testnet/tx/\${result.txHash}\`,
  };
  history.add(record);
}`}</Code>

      {/* Combined example */}
      <H2 id="combined">6. Combined Payment Card</H2>
      <p className="text-sm text-[#454745]">
        A compact example combining all hooks. In a real application, supply{' '}
        <code className="text-[#0e0f0c]">merchantAddress</code> from your configuration and{' '}
        <code className="text-[#0e0f0c]">password</code> from a secure password input — never
        hardcode them.
      </p>
      <Code filename="PaymentCard.tsx">{`'use client';

import {
  useFluppyWallet,
  useFluppyCredential,
  useFluppyPayment,
  useFluppyHistory,
} from '@flupy/react';

export function PaymentCard({
  merchantAddress,        // from your app config — do not hardcode
  amountInStroops,        // e.g. 10_000_000n = 1 USDC
  passwordFromSecureInput, // from a password input field in your UI
}: {
  merchantAddress:         string;
  amountInStroops:         bigint;
  passwordFromSecureInput: string;
}) {
  const wallet  = useFluppyWallet();
  const cred    = useFluppyCredential();
  const payment = useFluppyPayment();
  const history = useFluppyHistory();

  async function handlePay() {
    // Connect wallet if needed
    if (!wallet.isConnected) {
      await wallet.connect();
    }

    // Decrypt credential — secret lives in memory only, never stored in state
    const secret = await cred.unlock(passwordFromSecureInput);

    // Execute payment — secret passed directly, not cached
    const result = await payment.pay({
      secret,
      merchant: merchantAddress,
      amount:   amountInStroops,
    });

    // Record metadata — NOT secret, NOT proof data
    history.add({
      txHash:      result.txHash,
      amount:      amountInStroops,
      merchant:    merchantAddress,
      timestamp:   Date.now(),
      status:      'success',
      explorerUrl: \`https://stellar.expert/explorer/testnet/tx/\${result.txHash}\`,
    });
  }

  if (payment.status === 'success') {
    return <p>✓ Payment confirmed: {payment.txHash?.slice(0, 12)}…</p>;
  }

  return (
    <div>
      {payment.status === 'pending' && (
        <div>
          <p>{payment.currentStep} — {payment.progressPct ?? 0}%</p>
          <p>{payment.progressStage}</p>
        </div>
      )}
      {payment.error && <p>Error: {payment.error.message}</p>}
      <button onClick={handlePay} disabled={payment.isLoading}>
        Pay {(Number(amountInStroops) / 10_000_000).toFixed(2)} USDC
      </button>
    </div>
  );
}`}</Code>

      {/* Browser SDK direct */}
      <H2 id="browser-direct">7. Browser SDK Without React</H2>
      <p className="text-sm text-[#454745]">
        <code className="text-[#0e0f0c]">@flupy/browser</code> works without React —
        useful for vanilla TypeScript integrations or non-React frameworks.
      </p>
      <Code filename="payment-vanilla.ts">{`import {
  unlockCredential,
  executeFluppyPayment,
  RootSyncError,
  type StellarConfig,
} from '@flupy/browser';

const stellarConfig: StellarConfig = {
  contractId:        process.env.NEXT_PUBLIC_CONTRACT_ID!,
  rpcUrl:            process.env.NEXT_PUBLIC_RPC_URL!,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
};

async function pay(
  password:        string, // from user input
  merchantAddress: string, // from your config
  amountInStroops: bigint,
) {
  // Decrypt credential — secret in memory only
  const secret = await unlockCredential(password);

  try {
    const result = await executeFluppyPayment({
      secret,
      merchant:          merchantAddress,
      amount:            amountInStroops,
      networkPassphrase: stellarConfig.networkPassphrase!,
      stellarConfig,
      onStep:          (step) => updateUI(step.name),
      onProofProgress: (stage, pct) => updateProgress(stage, pct),
    });

    return result.txHash;

  } catch (err) {
    if (err instanceof RootSyncError) {
      // On-chain root needs resync — admin action required
      console.error('Root mismatch. Expected on-chain:', err.contractRootHex);
    }
    throw err;
  }
}

function updateUI(step: string) { /* your UI update logic */ }
function updateProgress(stage: string, pct: number) { /* your progress logic */ }`}</Code>

    </div>
  );
}
