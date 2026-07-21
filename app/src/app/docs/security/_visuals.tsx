import { Icon } from "@iconify/react";

export function SecurityGrid() {
  const items = [
    { icon: "ph:lock-key-fill", title: "Browser-side proof generation", desc: "Groth16 ZK proof computed entirely in the browser. No raw identity data reaches any server." },
    { icon: "ph:check-circle-fill", title: "Local verification before submit", desc: "snarkjs.groth16.verify() runs locally before every transaction submission. Invalid proofs are rejected client-side." },
    { icon: "ph:tree-structure", title: "Poseidon Merkle membership", desc: "Membership is proven via a Poseidon-hashed Merkle path. Only the commitment hash reaches the backend." },
    { icon: "ph:prohibit", title: "Nullifier replay protection", desc: "The contract stores nullifiers after each payment. Duplicate nullifiers are rejected — same proof cannot be reused." },
    { icon: "ph:link", title: "Payer, recipient & amount binding", desc: "The proof is bound to the exact payer, merchant, and amount — a captured proof cannot be resubmitted with different values." },
    { icon: "ph:atom", title: "Atomic 95/5 split", desc: "The contract atomically splits every payment. No single party controls the split logic after deployment." },
  ];
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-2">
      {items.map(({ icon, title, desc }) => (
        <div key={title} className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
          <div className="mb-1 flex items-center gap-2">
            <Icon icon={icon} width={18} height={18} className="text-[#163300]" />
            <span className="text-sm font-semibold text-[#0e0f0c]">{title}</span>
          </div>
          <p className="text-xs text-[#454745]">{desc}</p>
        </div>
      ))}
    </div>
  );
}

export function VisibilityBadge({ status }: { status: "private" | "public" | "onchain" }) {
  const styles: Record<string, string> = {
    private: "bg-green-500/10 text-emerald-700 border-green-500/30",
    public: "bg-yellow-500/10 text-amber-700 border-yellow-500/30",
    onchain: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  };
  const label: Record<string, string> = { private: "private", public: "public", onchain: "on-chain" };
  return (
    <span className={`not-typeset inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {label[status]}
    </span>
  );
}

export function CredentialStack() {
  return (
    <div className="not-typeset rounded-xl border border-black/10 bg-white p-5">
      <div className="space-y-2 font-mono text-xs text-[#454745]">
        <div><span className="text-gray-600">{'// Browser credential storage stack'}</span></div>
        <div><span className="text-[#0e0f0c]">secret</span> <span className="text-gray-600">→ never stored in plaintext anywhere</span></div>
        <div><span className="text-[#0e0f0c]">password</span> + salt <span className="text-gray-600">→</span> <span className="text-amber-700">PBKDF2-SHA256</span> (100k iter dev / 600k prod) <span className="text-gray-600">→</span> <span className="text-blue-700">AES-256-GCM key</span></div>
        <div><span className="text-blue-700">AES-256-GCM</span>(secret, key, iv) <span className="text-gray-600">→</span> <span className="text-emerald-700">ciphertext in IndexedDB</span></div>
        <div className="mt-2"><span className="text-gray-600">{'// IndexedDB schema — nothing sensitive in plaintext'}</span></div>
        <div>DB: <span className="text-[#0e0f0c]">flupy-identity-v1</span> | store: <span className="text-[#0e0f0c]">credentials</span> | key: <span className="text-[#0e0f0c]">zk-credential</span></div>
        <div className="text-[#454745]">{'{'} version, kdf, iterations, salt(hex), iv(hex), ciphertext(hex) {'}'}</div>
      </div>
    </div>
  );
}

export function MerkleSecurityList() {
  const items = [
    { title: "Only the commitment reaches the backend at enrollment", desc: "The SDK computes Poseidon(LEAF_TAG=2, secret) locally and sends only that hash to /api/merkle-proof/enroll. The raw secret never leaves the browser." },
    { title: "Proof-fetch is identical for every requester", desc: "GET /api/merkle-proof returns the full enrolled leaf set + root — the same response regardless of which credential the caller holds. Earlier versions accepted a per-commitment lookup, which let the server infer \"this session is about to pay, right now\" from request timing and correlate it with the payment tx landing seconds later, without any wallet address ever being transmitted. The client now locates its own leaf and computes its Merkle path entirely locally." },
    { title: "Sparse Merkle tree with domain separation", desc: "The tree is built from pre-computed zero hashes, identically on server (enrollment/caching) and client (proof computation). Domain tags (LEAF=2, NODE=3) prevent cross-context hash collisions." },
    { title: "Durable commitment store", desc: "Enrolled commitments are persisted in Postgres (Neon), not held only in server memory — serverless cold starts no longer risk silently dropping enrollments." },
  ];
  return (
    <div className="not-typeset space-y-3">
      {items.map(({ title, desc }) => (
        <div key={title} className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
          <p className="mb-1 text-sm font-semibold text-[#0e0f0c]">{title}</p>
          <p className="text-xs text-[#454745]">{desc}</p>
        </div>
      ))}
    </div>
  );
}

export function ThreeCol({ items }: { items: [string, string][] }) {
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-3">
      {items.map(([title, desc]) => (
        <div key={title} className="rounded-xl border border-black/10 bg-black/[0.03] p-3">
          <p className="mb-1 text-xs font-semibold text-[#0e0f0c]">{title}</p>
          <p className="text-xs text-[#454745]">{desc}</p>
        </div>
      ))}
    </div>
  );
}

export function RoleCards() {
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <p className="mb-1 text-sm font-semibold text-[#0e0f0c]">Admin</p>
        <p className="text-xs text-[#454745]">Cold key. Full control: pause, fee, rotate the RootOperator. Can also update the root directly as a manual override.</p>
      </div>
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <p className="mb-1 text-sm font-semibold text-[#0e0f0c]">RootOperator</p>
        <p className="text-xs text-[#454745]">Hot key, held by the automated sync job. Can <em>only</em> update the root — it can never move funds, pause payments, or change fees. Revocable by Admin without a contract upgrade.</p>
      </div>
    </div>
  );
}

export function ChainIdBox() {
  return (
    <div className="not-typeset rounded-xl border border-black/10 bg-white p-4 font-mono text-xs text-[#454745]">
      <div>chainId = <span className="text-amber-700">SHA256</span>(<span className="text-blue-700">&quot;Test SDF Network ; September 2015&quot;</span>)[MSB=0]</div>
      <div className="mt-1 text-gray-600">{'// Testnet and Mainnet produce different values'}</div>
      <div className="mt-1">contract validates: <span className="text-emerald-700">proof.chainId === expected_chain_id(env)</span></div>
    </div>
  );
}

export function VerifierBoxes() {
  return (
    <div className="not-typeset space-y-3">
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="mb-2 text-sm font-semibold text-amber-700">Demo-mode verifier (current)</p>
        <p className="mb-2 text-xs text-[#454745]">
          The Soroban contract validates proof structure and public inputs but does not perform a full BN254 pairing check at the contract level. This demo-mode strategy was chosen to unblock frontend development while native BN254 host function exposure in the soroban-sdk stabilises.
        </p>
        <p className="text-xs text-[#454745]">
          <strong className="text-yellow-300">Defense-in-depth:</strong> Client-side <code>snarkjs.groth16.verify()</code> is enforced before every transaction submission. Invalid proofs are caught client-side and never submitted to the contract. All payer, recipient, and amount binding checks run on-chain regardless of verifier mode.
        </p>
      </div>
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="mb-2 text-sm font-semibold text-blue-700">Future: native BN254 pairing</p>
        <p className="text-xs text-[#454745]">
          When the soroban-sdk exposes stable BN254 host functions (bn254_g1_mul, bn254_g1_add, bn254_pairing_check), the verifier module can be upgraded by recompiling with <code>--features bn254_native</code>. The modular verifier architecture (types.rs, vk_constants.rs, bn254_demo.rs, bn254_native.rs) was designed for zero-impact migration. No changes to payment.rs or tests are required.
        </p>
      </div>
    </div>
  );
}
