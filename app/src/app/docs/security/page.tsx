import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Security Model',
  description: 'Fluppy security model — ZK proofs, credential storage, nullifier protection, chainId binding.',
};

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mb-3 mt-10 scroll-mt-20 text-xl font-semibold text-white first:mt-0">{children}</h2>;
}
function Note({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300"><span className="shrink-0">ℹ</span><div>{children}</div></div>;
}
function Caution({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300"><span className="shrink-0">⚠</span><div>{children}</div></div>;
}
function Row({ label, value, status }: { label: string; value: string; status: 'private' | 'public' | 'onchain' }) {
  const badge: Record<typeof status, string> = {
    private: 'bg-green-500/10 text-green-400 border-green-500/30',
    public:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    onchain: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };
  const label2: Record<typeof status, string> = {
    private: 'private', public: 'public', onchain: 'on-chain',
  };
  return (
    <tr className="hover:bg-white/5">
      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-white">{label}</td>
      <td className="px-4 py-2.5 text-xs text-gray-400">{value}</td>
      <td className="px-4 py-2.5">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badge[status]}`}>
          {label2[status]}
        </span>
      </td>
    </tr>
  );
}

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3">
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
            Testnet MVP — No security audit yet
          </span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">Security Model</h1>
        <p className="text-lg text-gray-400">
          How Fluppy protects user identity and prevents payment replay — from browser credential
          storage through to on-chain nullifier protection.
        </p>
      </div>

      <Caution>
        Fluppy is a <strong>Testnet MVP</strong>. No external security audit has been completed.
        No real funds should be used until a full audit, multi-party trusted setup ceremony, and
        native BN254 on-chain verification are in place.
      </Caution>

      {/* Overview */}
      <H2 id="overview">Security Overview</H2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: '🔐', title: 'Browser-side proof generation',   desc: 'Groth16 ZK proof computed entirely in the browser. No raw identity data reaches any server.' },
          { icon: '✓',  title: 'Local verification before submit',desc: 'snarkjs.groth16.verify() runs locally before every transaction submission. Invalid proofs are rejected client-side.' },
          { icon: '🌳', title: 'Poseidon Merkle membership',       desc: 'Membership is proven via a Poseidon-hashed Merkle path. Only the commitment hash reaches the backend.' },
          { icon: '⛓',  title: 'Nullifier replay protection',      desc: 'The contract stores nullifiers after each payment. Duplicate nullifiers are rejected — same proof cannot be reused.' },
          { icon: '🔗', title: 'ChainId binding',                  desc: 'Every proof embeds a chain-specific chainId derived from the network passphrase. Testnet proofs are invalid on Mainnet.' },
          { icon: '⚛',  title: 'Atomic 95/5 split',                desc: 'The contract atomically splits every payment. No single party controls the split logic after deployment.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span>{icon}</span>
              <span className="text-sm font-semibold text-white">{title}</span>
            </div>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
        ))}
      </div>

      {/* Private vs public */}
      <H2 id="privacy">What Is Private vs Public</H2>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Visibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <Row label="raw secret"        value="64-char hex credential — browser memory only"               status="private" />
            <Row label="password"          value="PBKDF2 input — never stored or transmitted"                 status="private" />
            <Row label="ZK witness"        value="Merkle path + circuit inputs — local computation only"      status="private" />
            <Row label="commitment"        value="Poseidon(LEAF_TAG, secret) — sent to Merkle backend only"   status="private" />
            <Row label="nullifier"         value="Poseidon(NULLIFIER_TAG, secret, nonce) — stored on-chain"   status="onchain" />
            <Row label="merkleRoot"        value="Poseidon tree root — stored on-chain"                       status="onchain" />
            <Row label="recipientHash"     value="BN254-safe Stellar address hash — public signal"            status="onchain" />
            <Row label="chainId"           value="Network passphrase hash — public signal"                    status="onchain" />
            <Row label="txHash"            value="Stellar transaction hash — public ledger"                   status="public"  />
            <Row label="merchant address"  value="Stellar G-address of merchant — public"                     status="public"  />
            <Row label="payment amount"    value="Amount in stroops — visible in contract event"              status="public"  />
          </tbody>
        </table>
      </div>

      {/* Credential storage */}
      <H2 id="credential">Credential Storage</H2>
      <div className="rounded-xl border border-white/10 bg-gray-900 p-5">
        <div className="space-y-2 font-mono text-xs text-gray-400">
          <div><span className="text-gray-600">// Browser credential storage stack</span></div>
          <div><span className="text-white">secret</span> <span className="text-gray-600">→ never stored in plaintext anywhere</span></div>
          <div><span className="text-white">password</span> + salt <span className="text-gray-600">→</span> <span className="text-yellow-400">PBKDF2-SHA256</span> (100k iter dev / 600k prod) <span className="text-gray-600">→</span> <span className="text-blue-400">AES-256-GCM key</span></div>
          <div><span className="text-blue-400">AES-256-GCM</span>(secret, key, iv) <span className="text-gray-600">→</span> <span className="text-green-400">ciphertext in IndexedDB</span></div>
          <div className="mt-2"><span className="text-gray-600">// IndexedDB schema — nothing sensitive in plaintext</span></div>
          <div>DB: <span className="text-white">fluppy-identity-v1</span> | store: <span className="text-white">credentials</span> | key: <span className="text-white">zk-credential</span></div>
          <div className="text-gray-500">{'{'} version, kdf, iterations, salt(hex), iv(hex), ciphertext(hex) {'}'}</div>
        </div>
      </div>
      <Note>
        The iteration count is stored inside each credential blob. This allows safe migration of
        iteration parameters in future SDK versions without breaking existing credentials.
      </Note>

      {/* Merkle security */}
      <H2 id="merkle">Merkle Proof Security</H2>
      <div className="space-y-3">
        {[
          { title: 'Only the commitment reaches the backend', desc: 'The SDK computes Poseidon(LEAF_TAG=2, secret) locally and sends only that hash to /api/merkle-proof. The raw secret never leaves the browser.' },
          { title: 'Sparse Merkle tree with domain separation', desc: 'The server builds a sparse Poseidon Merkle tree using pre-computed zero hashes. Domain tags (LEAF=2, NODE=3) prevent cross-context hash collisions.' },
          { title: 'Root sync guard', desc: 'executeFluppyPayment() compares the frontend Merkle root against the on-chain contract root before generating a proof. A mismatch throws RootSyncError before any computation begins.' },
        ].map(({ title, desc }) => (
          <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-1 text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
        ))}
      </div>

      {/* Nullifier */}
      <H2 id="nullifier">Nullifier Replay Protection</H2>
      <p className="text-sm text-gray-400 mb-3">
        Each ZK payment proof includes a <strong>nullifier</strong>:{' '}
        <code className="text-white">Poseidon(NULLIFIER_TAG=1, secret, nonce)</code> — a
        random one-time value derived from the secret and a CSPRNG nonce.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['First payment',     'Nullifier stored in contract temporary storage (TTL ~30 days)'],
          ['Duplicate attempt', 'Contract rejects with NullifierSpent error (#4)'],
          ['New payment',       'New CSPRNG nonce → new nullifier → new valid proof'],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="mb-1 text-xs font-semibold text-white">{title}</p>
            <p className="text-xs text-gray-400">{desc}</p>
          </div>
        ))}
      </div>

      {/* ChainId */}
      <H2 id="chainid">ChainId Binding</H2>
      <p className="text-sm text-gray-400 mb-3">
        Every ZK proof includes a <code className="text-white">chainId</code> public signal
        derived from the Stellar network passphrase:
      </p>
      <div className="rounded-xl border border-white/10 bg-gray-900 p-4 font-mono text-xs text-gray-400">
        <div>chainId = <span className="text-yellow-400">SHA256</span>(<span className="text-blue-400">"Test SDF Network ; September 2015"</span>)[MSB=0]</div>
        <div className="mt-1 text-gray-600">// Testnet and Mainnet produce different values</div>
        <div className="mt-1">contract validates: <span className="text-green-400">proof.chainId === expected_chain_id(env)</span></div>
      </div>
      <Note>
        A proof generated on Testnet will always fail on Mainnet (and vice versa) because the
        chainId differs. This prevents cross-network proof replay attacks.
      </Note>

      {/* Verifier strategy */}
      <H2 id="verifier">On-Chain Verifier Strategy</H2>
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="mb-2 text-sm font-semibold text-yellow-400">Demo-mode verifier (current)</p>
        <p className="text-xs text-gray-400 mb-2">
          The Soroban contract validates proof structure and public inputs but does not perform a
          full BN254 pairing check at the contract level. This demo-mode strategy was chosen to
          unblock frontend development while native BN254 host function exposure in the soroban-sdk
          stabilises.
        </p>
        <p className="text-xs text-gray-400">
          <strong className="text-yellow-300">Defense-in-depth:</strong> Client-side{' '}
          <code>snarkjs.groth16.verify()</code> is enforced before every transaction submission.
          Invalid proofs are caught client-side and never submitted to the contract.
        </p>
      </div>
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="mb-2 text-sm font-semibold text-blue-400">Future: native BN254 pairing</p>
        <p className="text-xs text-gray-400">
          When the soroban-sdk exposes stable BN254 host functions (bn254_g1_mul, bn254_g1_add,
          bn254_pairing_check), the verifier module can be upgraded by recompiling with{' '}
          <code>--features bn254_native</code>. The modular verifier architecture (types.rs,
          vk_constants.rs, bn254_demo.rs, bn254_native.rs) was designed for zero-impact migration.
          No changes to payment.rs or tests are required.
        </p>
      </div>

      {/* Limitations */}
      <H2 id="limitations">Current Limitations</H2>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/10 bg-white/5">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Limitation</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Mitigation</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Planned Resolution</th>
          </tr></thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {[
              ['Single-contributor trusted setup', 'Testnet only — no real funds',         'Multi-party ceremony before mainnet'],
              ['Demo-mode on-chain verifier',       'Client-side snarkjs.verify() enforced','Native BN254 when SDK supports it'],
              ['No external security audit',        'Comprehensive internal test coverage', 'SCF Soroban Audit Bank after MVP'],
              ['No production relayer',             'User-signed Freighter (transparent)',  'Optional future relayer layer'],
              ['Testnet deployment only',           'No real value at risk',               'After audit + ceremony + native verifier'],
            ].map(([lim, mit, plan]) => (
              <tr key={lim} className="hover:bg-white/5">
                <td className="px-4 py-2.5 text-white font-medium">{lim}</td>
                <td className="px-4 py-2.5 text-gray-400">{mit}</td>
                <td className="px-4 py-2.5 text-gray-500">{plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

