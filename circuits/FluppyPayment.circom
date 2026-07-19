pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// ─── Domain separation constants ─────────────────────────────────────────────
// These tags are prepended to every Poseidon call to prevent cross-context
// hash collisions. Values are arbitrary small BN254-safe integers.
// MUST match POSEIDON_TAGS in merkle.ts and zkp.ts exactly.
//
//   NULLIFIER_TAG = 1  → prevents forging nullifier from a merkle node
//   LEAF_TAG      = 2  → prevents forging leaf from a nullifier
//   NODE_TAG      = 3  → prevents forging node from a leaf or nullifier

// ─── Merkle Path Verifier ─────────────────────────────────────────────────────
template MerklePathVerifier(levels) {
    signal input  leaf;
    signal input  pathElements[levels];
    signal input  pathIndices[levels];
    signal output root;

    component hashers[levels];
    component muxL[levels];
    component muxR[levels];

    signal nodes[levels + 1];
    nodes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // NODE_TAG = 3 — domain-separated internal node hashing
        hashers[i] = Poseidon(3);
        hashers[i].inputs[0] <== 3;  // NODE_TAG

        muxL[i] = Mux1();
        muxL[i].c[0] <== nodes[i];
        muxL[i].c[1] <== pathElements[i];
        muxL[i].s    <== pathIndices[i];

        muxR[i] = Mux1();
        muxR[i].c[0] <== pathElements[i];
        muxR[i].c[1] <== nodes[i];
        muxR[i].s    <== pathIndices[i];

        hashers[i].inputs[1] <== muxL[i].out;
        hashers[i].inputs[2] <== muxR[i].out;

        nodes[i + 1] <== hashers[i].out;
    }

    root <== nodes[levels];
}

// ─── FluppyPayment ────────────────────────────────────────────────────────────
//
// Public signal ordering (MUST match payment.rs IDX_* constants):
//   output nullifier      → index 0
//   output verifiedRoot   → index 1
//   input  merkleRoot     → index 2
//   input  recipientHash  → index 3
//   input  payerHash      → index 4
//   input  amount         → index 5
//   input  chainId        → index 6
//
// Domain separation:
//   nullifier = Poseidon(1, secret, nonce)  — NULLIFIER_TAG = 1
//   leaf      = Poseidon(2, secret)         — LEAF_TAG      = 2
//   node      = Poseidon(3, left, right)    — NODE_TAG      = 3
//
// Design note — amount and payment policy:
//   `amount` is a PUBLIC pass-through signal, not a processed value. This
//   circuit performs NO range checks, NO business-rule validation on amount.
//   Per SOW constraint ("circuit MUST NOT include payment logic / business
//   rules"), any policy limit (min/max payment) is enforced by the contract
//   on the real i128 amount, not in-circuit. Amount is exact-match bound to
//   the proof via Groth16's public input mechanism (vk_x) — the contract
//   re-derives and compares it against the actual transfer amount.

template FluppyPayment(levels) {

    // ── Private inputs ────────────────────────────────────────────────────────
    signal input secret;
    signal input nonce;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // ── Public inputs ─────────────────────────────────────────────────────────
    signal input merkleRoot;
    signal input recipientHash;
    signal input payerHash;
    signal input amount;
    signal input chainId;

    // merkleRoot, recipientHash, payerHash, amount, and chainId do NOT need
    // internal processing to be bound to the proof — each is bound
    // automatically via Groth16's public input mechanism (vk_x). Dummy
    // quadratic constraints below exist ONLY to prevent the Circom
    // optimizer from removing an otherwise-unconsumed signal (same
    // technique Tornado uses for its recipient/fee/relayer public signals).
    //
    // The contract re-derives and compares recipientHash, payerHash, and
    // amount in payment.rs. The contract enforces:
    //   chainId === expected_chain_id(env)

    // ── Public outputs ────────────────────────────────────────────────────────
    signal output nullifier;
    signal output verifiedRoot;

    // ── Constraint 1: Nullifier with domain separation ────────────────────────
    // nullifier = Poseidon(NULLIFIER_TAG=1, secret, nonce)
    // Domain tag prevents nullifier from being forged using a Merkle node
    // that happens to hash to the same value via Poseidon(left, right).
    component posNullifier = Poseidon(3);
    posNullifier.inputs[0] <== 1;       // NULLIFIER_TAG
    posNullifier.inputs[1] <== secret;
    posNullifier.inputs[2] <== nonce;
    nullifier <== posNullifier.out;

    // ── Constraint 2: Membership leaf with domain separation ──────────────────
    // leaf = Poseidon(LEAF_TAG=2, secret)
    // Domain tag prevents leaf from being confused with a nullifier
    // even though both take `secret` as input.
    component posLeaf = Poseidon(2);
    posLeaf.inputs[0] <== 2;            // LEAF_TAG
    posLeaf.inputs[1] <== secret;

    // ── Constraint 3: Merkle membership proof ─────────────────────────────────
    component merkle = MerklePathVerifier(levels);
    merkle.leaf <== posLeaf.out;
    for (var i = 0; i < levels; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    verifiedRoot <== merkle.root;

    // Root equality — proof fails if path does not reconstruct merkleRoot
    verifiedRoot === merkleRoot;

    // ── Constraint 4: Dummy bindings for pass-through public signals ──────────
    // These signals carry no circuit-internal meaning; they exist purely to
    // be bound into the proof so the contract can verify exact-match
    // equality against the real transaction context.
    signal recipientHashSq;
    recipientHashSq <== recipientHash * recipientHash;

    signal payerHashSq;
    payerHashSq <== payerHash * payerHash;

    signal amountSq;
    amountSq <== amount * amount;

    // chainId requires no explicit consumer — see note above.
}

component main {
    public [merkleRoot, recipientHash, payerHash, amount, chainId]
} = FluppyPayment(20);
