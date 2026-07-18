import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '@flupy/core',
  description: 'API reference for @flupy/core — Fluppy protocol primitives.',
};

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-white first:mt-0">{children}</h2>;
}
function H3({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest text-gray-500">{children}</h3>;
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
function ApiRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <tr className="hover:bg-white/5">
      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-white">{name}</td>
      <td className="px-4 py-2.5 text-xs text-gray-400">{type}</td>
      <td className="px-4 py-2.5 text-xs text-gray-500">{desc}</td>
    </tr>
  );
}
function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-white/10 bg-white/5">
          {['Export', 'Type', 'Description'].map(h => (
            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{h}</th>
          ))}
        </tr></thead>
        <tbody className="divide-y divide-white/5">{rows.map(([n, t, d]) => <ApiRow key={n} name={n} type={t} desc={d} />)}</tbody>
      </table>
    </div>
  );
}

export default function CorePage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">@flupy/core</span>
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">✓ Complete</span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">@flupy/core</h1>
        <p className="text-lg text-gray-400">
          Protocol-level primitives shared by <code className="text-white">@flupy/browser</code> and{' '}
          <code className="text-white">@flupy/react</code>. Pure TypeScript — no browser APIs, no React, no wallet dependency.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[['~10 KB', 'ESM bundle'], ['~11 KB', 'CJS bundle'], ['~9 KB', 'TypeScript declarations']].map(([size, label]) => (
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
          ['constants.ts', 'blue',   'BN254_R, CIRCUIT_DEPTH, N_PUBLIC, POSEIDON_TAGS, DEFAULT_MAX_AMOUNT, usdcToStroops()'],
          ['errors.ts',    'red',    'FluppyError class hierarchy and parseFluppyError() parser'],
          ['encoding.ts',  'purple', 'G1/G2 Soroban wire format encoding and field element conversion'],
          ['types.ts',     'gray',   'PaymentProofOutput, MerkleProof, ProofProgress, FluppyCoreConfig, PaymentResult'],
          ['recipient-hash.ts', 'yellow', 'computeRecipientHash() — BN254-safe Stellar address hash'],
          ['chain-id.ts',  'pink',   'computeChainId() — network passphrase → BN254-safe chain identifier'],
        ].map(([mod, color, desc]) => {
          const colors: Record<string, string> = {
            blue: 'border-blue-500/20 text-blue-400', red: 'border-red-500/20 text-red-400',
            purple: 'border-purple-500/20 text-purple-400', gray: 'border-white/20 text-gray-300',
            yellow: 'border-yellow-500/20 text-yellow-400', pink: 'border-pink-500/20 text-pink-400',
          };
          return (
            <div key={mod as string} className={`flex items-start gap-3 rounded-xl border bg-white/5 p-3 ${colors[color as string]}`}>
              <code className="mt-0.5 shrink-0 text-xs font-semibold">{mod}</code>
              <span className="text-xs text-gray-400">{desc}</span>
            </div>
          );
        })}
      </div>

      {/* Exports */}
      <H2 id="exports">Key Exports</H2>

      <H3>Error classes</H3>
      <Table rows={[
        ['FluppyError',           'class',    'Base error class with code, userMessage, and action fields'],
        ['FluppyProofError',      'class',    'Extends FluppyError — proof generation or verification failure'],
        ['FluppyNetworkError',    'class',    'Extends FluppyError — RPC or API network failure'],
        ['FluppyWalletError',     'class',    'Extends FluppyError — Freighter wallet rejection or not found'],
        ['FluppyRootMismatchError','class',   'Extends FluppyError — on-chain root differs from frontend root'],
        ['FluppyArtifactError',   'class',    'Extends FluppyError — WASM/ZKey load or integrity failure'],
        ['parseFluppyError(err)', 'function', 'Maps any thrown value to a structured FluppyError'],
      ]} />

      <H3>Types</H3>
      <Table rows={[
        ['PaymentProofOutput', 'interface', 'Soroban-encoded proof: pi_a (128 hex), pi_b (256 hex), pi_c (128 hex), publicSignals (7 × 64 hex)'],
        ['MerkleProof',        'interface', 'pathElements: bigint[], pathIndices: number[], root: bigint'],
        ['ProofProgress',      'interface', 'stage: string, pct: number — emitted during proof generation'],
        ['FluppyCoreConfig',   'interface', 'contractId, networkPassphrase, rpcUrl'],
        ['PaymentResult',      'interface', 'txHash, explorerUrl, status'],
      ]} />

      <H3>Constants</H3>
      <Table rows={[
        ['BN254_R',          'bigint',  'BN254 scalar field order — all circuit inputs must be < this value'],
        ['CIRCUIT_DEPTH',    'number',  '20 — Merkle tree depth supporting up to 2^20 enrolled commitments'],
        ['N_PUBLIC',         'number',  '7 — number of public signals (nullifier, verifiedRoot, merkleRoot, recipientHash, minAmount, maxAmount, chainId)'],
        ['POSEIDON_TAGS',    'object',  'NULLIFIER=1, LEAF=2, NODE=3 — domain separation constants, MUST match circuit'],
        ['DEFAULT_MAX_AMOUNT','bigint', 'Default upper bound for payment amount (1000 USDC in stroops)'],
        ['usdcToStroops()',  'function','Converts human-readable USDC string to stroops bigint'],
      ]} />

      <H3>Utilities</H3>
      <Table rows={[
        ['computeRecipientHash(address)', 'function', 'XDR-encodes a Stellar address, SHA-256 hashes it, zeroes MSB for BN254 safety'],
        ['computeChainId(passphrase)',    'function', 'SHA-256 hashes the network passphrase, zeroes MSB — binds proof to one network'],
        ['encodeG1(point)',              'function', 'Encodes BN254 G1 affine point to 64-byte big-endian hex for Soroban Bytes'],
        ['encodeG2(point)',              'function', 'Encodes BN254 G2 affine point to 128-byte big-endian hex for Soroban Bytes'],
        ['decimalToBe32Hex(decimal)',    'function', 'Converts a decimal string bigint to 32-byte big-endian hex (public signal encoding)'],
        ['hexSecretToFieldElement(hex)', 'function', 'Reduces a 256-bit hex secret to a BN254 scalar field element (mod BN254_R)'],
      ]} />

      {/* Encoding */}
      <H2 id="encoding">Proof Encoding</H2>
      <p className="text-sm text-gray-400">
        SnarkJS outputs Groth16 proof points as decimal strings. Soroban contracts expect fixed-size
        byte arrays (<code className="text-white">BytesN&lt;64&gt;</code>,{' '}
        <code className="text-white">BytesN&lt;128&gt;</code>,{' '}
        <code className="text-white">BytesN&lt;32&gt;</code>). The encoding helpers in{' '}
        <code className="text-white">@flupy/core</code> handle this conversion:
      </p>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900 p-4 text-xs text-gray-400">
        <div className="space-y-1 font-mono">
          <div><span className="text-gray-600">// G1 (pi_a, pi_c): 64 bytes = x_be32 ‖ y_be32</span></div>
          <div><span className="text-blue-400">encodeG1</span>([x, y, '1']) <span className="text-gray-600">→ 128-char hex string</span></div>
          <div className="mt-2"><span className="text-gray-600">// G2 (pi_b): 128 bytes = x_c1 ‖ x_c0 ‖ y_c1 ‖ y_c0</span></div>
          <div><span className="text-blue-400">encodeG2</span>([[x_c1,x_c0],[y_c1,y_c0],…]) <span className="text-gray-600">→ 256-char hex string</span></div>
          <div className="mt-2"><span className="text-gray-600">// Public signals: 7 × 32 bytes each</span></div>
          <div><span className="text-blue-400">decimalToBe32Hex</span>('123456…') <span className="text-gray-600">→ 64-char hex string</span></div>
        </div>
      </div>

      {/* Recipient hash / ChainId */}
      <H2 id="bindings">Recipient Hash & Chain ID</H2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">computeRecipientHash()</h3>
          <p className="text-xs text-gray-400">
            XDR-encodes the merchant Stellar address, SHA-256 hashes the bytes, then zeroes the
            most-significant byte to guarantee the result fits within the BN254 scalar field.
            This value is used as the <code>recipientHash</code> public signal — binding the
            proof to a specific merchant address.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">computeChainId()</h3>
          <p className="text-xs text-gray-400">
            SHA-256 hashes the Stellar network passphrase (e.g. "Test SDF Network ; September 2015"),
            then zeroes the MSB. The result is included as the <code>chainId</code> public signal.
            A proof generated on one network will be rejected on a different network because the
            chainId values differ — preventing cross-network replay attacks.
          </p>
        </div>
      </div>

      {/* Usage */}
      <H2 id="usage">Usage (Monorepo)</H2>
      <Note>
        Packages are internal workspace packages. See{' '}
        <Link href="/docs/installation" className="underline">Installation</Link> for setup.
        Do not use public npm package installation yet — packages are not yet published to npm.
      </Note>
      <Code filename="example.ts">{`import {
  computeRecipientHash,
  computeChainId,
  encodeG1,
  encodeG2,
  decimalToBe32Hex,
  usdcToStroops,
  parseFluppyError,
  type PaymentProofOutput,
  type MerkleProof,
} from '@flupy/core';

// Compute BN254-safe inputs
const recipientHash = computeRecipientHash('GDLST72T...');
const chainId       = computeChainId('Test SDF Network ; September 2015');

// Convert amount
const stroops = usdcToStroops('1.50'); // → 15_000_000n

// Error handling
try {
  // ... payment logic
} catch (err) {
  const parsed = parseFluppyError(err);
  console.error(parsed.code, parsed.userMessage); // safe to log
}`}</Code>

    </div>
  );
}
