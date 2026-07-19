const { buildPoseidon } = require("circomlibjs");
const fs = require("fs");

/**
 * Generates a valid input.json for local circuit sanity checks.
 *
 * NOTE: recipientHash and payerHash use dummy field values here because
 * the real computeRecipientHash() (SHA-256-based, in @flupy/core) requires
 * a live Stellar SDK Address — irrelevant for a pure circuit correctness
 * test. Both signals are pass-through public inputs (dummy-constrained,
 * not hashed inside the circuit), so any valid BN254 field element works
 * for this sanity check.
 */
async function generateValidInput() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log("Calculating mathematical parameters for ZK...");

  // Domain separation tags — MUST match POSEIDON_TAGS in
  // packages/flupy-core/src/constants.ts and FluppyPayment.circom
  const NULLIFIER_TAG = 1;
  const LEAF_TAG = 2;
  const NODE_TAG = 3;

  // Dummy witness data
  const secret = 123;
  const nonce = 456;
  const amount = 1000;
  const recipientHash = 101;
  const payerHash = 202;
  const chainId = 999;

  // Leaf = Poseidon(LEAF_TAG, secret) — MUST match circuit Constraint 2
  const leaf = poseidon([LEAF_TAG, secret]);

  // Merkle root (depth 20) with an all-zero path.
  // Node = Poseidon(NODE_TAG, left, right) — MUST match circuit
  // MerklePathVerifier. With pathIndices[i] = 0, left = current node,
  // right = pathElements[i] (see circuit Mux1 wiring).
  const levels = 20;
  let currentHash = leaf;
  const pathElements = [];
  const pathIndices = [];

  for (let i = 0; i < levels; i++) {
    pathElements.push(0);
    pathIndices.push(0);
    currentHash = poseidon([NODE_TAG, currentHash, 0]);
  }

  const merkleRootStr = F.toString(currentHash);

  const validInputs = {
    secret: secret.toString(),
    nonce: nonce.toString(),
    pathElements: pathElements.map(x => x.toString()),
    pathIndices: pathIndices,
    merkleRoot: merkleRootStr,
    recipientHash: recipientHash.toString(),
    payerHash: payerHash.toString(),
    amount: amount.toString(),
    chainId: chainId.toString(),
  };

  fs.writeFileSync("input.json", JSON.stringify(validInputs, null, 2));

  console.log("input.json generated successfully!");
  console.log("Merkle Root: ", merkleRootStr);
}

generateValidInput().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
