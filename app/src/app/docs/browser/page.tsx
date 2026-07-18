import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '@fluppy/browser',
  description: 'API reference for @fluppy/browser — Fluppy browser SDK.',
};

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-white first:mt-0">{children}</h2>;
}
function Code({ children, filename }: { children: string; filename?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {filename && <div className="border-b border-white/10 bg-white/5 px-4 py-2"><span className="font-mono text-xs text-gray-500">{filename}</span></div>}
      <pre className="overflow-x-auto bg-gray-900 p-4 text-sm text-gray-300"><code>{children}</code></pre>
    </div>
  );
}
function Note({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300"><span className="shrink-0">ℹ</span><div>{children}</div></div>;
}
function Warn({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300"><span className="shrink-0">🔐</span><div>{children}</div></div>;
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-white/10 bg-white/5">
          {headers.map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-white/5">
          {rows.map(row => (
            <tr key={row[0]} className="hover:bg-white/5">
              {row.map((cell, i) => (
                <td key={i} className={`px-4 py-2.5 text-xs ${i === 0 ? 'font-mono font-semibold text-white' : i === 1 ? 'text-gray-400' : 'text-gray-500'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BrowserPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400">@fluppy/browser</span>
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">✓ Complete</span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">@fluppy/browser</h1>
        <p className="text-lg text-gray-400">
          Browser runtime SDK built on <code className="text-white">@fluppy/core</code>. Provides identity management,
          Merkle proof client, ZK proof generation, and Stellar/Freighter payment submission.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['~31 KB', 'ESM bundle'], ['~32 KB', 'CJS bundle'], ['~11 KB', 'TypeScript declarations']].map(([size, label]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-lg font-bold text-white">{size}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Module map */}
      <H2 id="modules">Module Map</H2>
      <div className="space-y-2">
        {[
          ['merkle-client.ts', 'purple', 'Computes commitment locally, enrolls to backend, fetches Merkle proof path'],
          ['artifacts.ts',     'blue',   'Loads and caches WASM witness generator and ZKey proving key from CDN/public dir'],
          ['prover.ts',        'yellow', 'generateZkProof() via snarkjs.groth16.fullProve(), verifyProofLocally()'],
          ['identity.ts',      'red',    'AES-GCM credential (IndexedDB + PBKDF2): create, unlock, delete'],
          ['stellar.ts',       'green',  'Freighter signing, Soroban contract invocation, transaction polling'],
          ['payment.ts',       'pink',   'executeFluppyPayment() high-level orchestrator composing all modules'],
        ].map(([mod, color, desc]) => {
          const colors: Record<string, string> = {
            purple:'border-purple-500/20 text-purple-400', blue:'border-blue-500/20 text-blue-400',
            yellow:'border-yellow-500/20 text-yellow-400', red:'border-red-500/20 text-red-400',
            green:'border-green-500/20 text-green-400',   pink:'border-pink-500/20 text-pink-400',
          };
          return (
            <div key={mod as string} className={`flex items-start gap-3 rounded-xl border bg-white/5 p-3 ${colors[color as string]}`}>
              <code className="mt-0.5 shrink-0 text-xs font-semibold">{mod}</code>
              <span className="text-xs text-gray-400">{desc}</span>
            </div>
          );
        })}
      </div>

      {/* executeFluppyPayment */}
      <H2 id="orchestrator">executeFluppyPayment()</H2>
      <p className="text-sm text-gray-400">
        The top-level payment orchestrator. Composes all browser SDK modules into a single call.
        The caller is responsible for credential decryption (passing the unlocked{' '}
        <code className="text-white">secret</code>) and for UI feedback (toast, telemetry, history).
      </p>
      <Table
        headers={['Input field', 'Type', 'Description']}
        rows={[
          ['secret',           'string',                  '64-char hex secret from unlockCredential() — passed through, never stored'],
          ['merchant',         'string',                  'Merchant Stellar address (G... format)'],
          ['amount',           'bigint',                  'Payment amount in stroops (1 USDC = 10_000_000n)'],
          ['networkPassphrase','string',                  'Stellar network passphrase — used to compute chainId signal'],
          ['stellarConfig',    'StellarConfig',           'contractId, rpcUrl, networkPassphrase'],
          ['merkleOptions?',   'MerkleClientOptions',     'Optional: override Merkle API base URL'],
          ['signal?',          'AbortSignal',             'Optional: cancel in-flight payment'],
          ['onStep?',          '(step) => void',          'Optional: receives named steps (merkle:request, proof:done, tx:submit, ...)'],
          ['onProofProgress?', '(stage, pct) => void',    'Optional: receives proof generation progress (0–100)'],
        ]}
      />
      <Table
        headers={['Output field', 'Type', 'Description']}
        rows={[
          ['txHash',     'string',   'Stellar transaction hash of the confirmed payment'],
          ['proof',      'PaymentProofOutput', 'The Groth16 proof in Soroban wire format'],
          ['merkleRoot', 'bigint',   'The Merkle root used for this proof'],
          ['txResult',   'unknown',  'Raw Soroban RPC transaction status object'],
        ]}
      />

      <Note>
        <strong>RootSyncError</strong>: if the frontend Merkle tree root does not match the on-chain
        contract root, <code>executeFluppyPayment()</code> throws a{' '}
        <code>RootSyncError</code> with <code>frontendRootHex</code> and{' '}
        <code>contractRootHex</code> fields. The admin must call{' '}
        <code>set_merkle_root</code> on the contract to resync. See{' '}
        <Link href="/docs/troubleshooting" className="underline">Troubleshooting</Link>.
      </Note>

      {/* Identity */}
      <H2 id="identity">Identity Module</H2>
      <Warn>
        <strong>Security model:</strong> The raw secret is derived locally and stored only in
        encrypted form (AES-GCM, PBKDF2) in IndexedDB. It is never transmitted to any server.
        Only the <em>commitment</em> — <code>Poseidon(LEAF_TAG, secret)</code> — is sent to the
        backend Merkle API. The password is used only to derive the AES decryption key and
        is never stored or logged.
      </Warn>
      <Table
        headers={['Function', 'Returns', 'Description']}
        rows={[
          ['generateSecret()',         'string',                     'Generates a 32-byte CSPRNG secret as a 64-char hex string'],
          ['credentialExists()',       'Promise<boolean>',           'Returns true if an encrypted credential exists in IndexedDB'],
          ['createCredential(password)', 'Promise<{ secret: string }>', 'Encrypts and stores a new credential; returns the secret ONCE'],
          ['unlockCredential(password)', 'Promise<string>',          'Decrypts and returns the raw secret (never logged internally)'],
          ['deleteCredential()',       'Promise<void>',              'Permanently removes the credential from IndexedDB'],
        ]}
      />

      {/* Prover */}
      <H2 id="prover">Prover Module</H2>
      <p className="text-sm text-gray-400">
        Wraps <code className="text-white">snarkjs.groth16.fullProve()</code> with generation lock,
        progress callbacks, AbortSignal support, and Soroban wire format encoding.
        Local verification via <code className="text-white">snarkjs.groth16.verify()</code> is
        enforced in development before every transaction submission as a defense-in-depth measure.
      </p>
      <Table
        headers={['Function', 'Returns', 'Description']}
        rows={[
          ['generateZkProof(input)',    'Promise<PaymentProofOutput>', 'Full Groth16 proof generation — validates, builds circuit inputs, runs fullProve, encodes'],
          ['verifyProofLocally(proof)', 'Promise<boolean>',            'Verifies proof against the loaded verification key using snarkjs.groth16.verify()'],
        ]}
      />
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="mb-2 text-sm font-semibold text-white">Generation lock</p>
        <p className="text-xs text-gray-400">
          Only one proof can be generated at a time per browser session.
          Calling <code>generateZkProof()</code> while another is in progress throws immediately.
          Use AbortSignal to cancel an in-flight generation before starting a new one.
        </p>
      </div>

      {/* Merkle */}
      <H2 id="merkle">Merkle Client Module</H2>
      <Table
        headers={['Function', 'Returns', 'Description']}
        rows={[
          ['computeCommitment(secret)',     'Promise<bigint>',        'Computes Poseidon(LEAF_TAG=2, secret) locally — never sends raw secret'],
          ['enrollCommitment(secret)',      'Promise<EnrollResult>',  'POSTs commitment hash to /api/merkle-proof/enroll'],
          ['getMerkleProof(secret)',        'Promise<MerkleProof>',   'POSTs commitment hash, returns pathElements/pathIndices/root'],
        ]}
      />
      <Note>
        The backend Merkle API uses a sparse Merkle tree with pre-computed zero hashes.
        After the first build (cold cache ~0.7s), subsequent proof requests are served from
        an in-memory singleton cache in ~14ms.
      </Note>

      {/* Stellar */}
      <H2 id="stellar">Stellar & Freighter Module</H2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">payWithZkGroth16()</h3>
          <p className="text-xs text-gray-400">
            Builds and submits the <code>execute_payment()</code> Soroban transaction.
            The user <strong>signs via Freighter</strong> and pays the Stellar network fee
            from their own wallet. No relayer, no gas sponsorship.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">getContractMerkleRoot()</h3>
          <p className="text-xs text-gray-400">
            Fetches the current Merkle root from the backend API (<code>/api/merkle-root</code>).
            Used by the root sync guard inside <code>executeFluppyPayment()</code> to ensure
            the frontend tree matches the on-chain root before submitting.
          </p>
        </div>
      </div>

      {/* Usage */}
      <H2 id="usage">Usage Example</H2>
      <Note>
        See <Link href="/docs/installation" className="underline">Installation</Link> for monorepo
        setup. Do not use public npm package installation yet — packages are not yet published.
      </Note>
      <Code filename="payment-example.ts">{`import {
  executeFluppyPayment,
  unlockCredential,
  RootSyncError,
  type StellarConfig,
} from '@fluppy/browser';

const config: StellarConfig = {
  contractId:        process.env.NEXT_PUBLIC_CONTRACT_ID!,
  rpcUrl:            process.env.NEXT_PUBLIC_RPC_URL!,
  networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE!,
};

async function pay(password: string, merchant: string, amount: bigint) {
  // Step 1: Decrypt credential (browser only)
  const secret = await unlockCredential(password);

  // Step 2: Orchestrate full payment (secret passed through, not stored)
  try {
    const result = await executeFluppyPayment({
      secret,
      merchant,
      amount,
      networkPassphrase: config.networkPassphrase!,
      stellarConfig:     config,
      onStep:         (step) => console.log('[step]', step.name),
      onProofProgress:(stage, pct) => console.log('[proof]', stage, pct),
    });

    return result.txHash;

  } catch (err) {
    if (err instanceof RootSyncError) {
      // Admin action required: set_merkle_root on contract
      console.error('Root mismatch. Frontend:', err.frontendRootHex);
    }
    throw err;
  }
}`}</Code>

    </div>
  );
}
