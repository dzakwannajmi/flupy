import { POSEIDON_TAGS, BN254_R, CIRCUIT_DEPTH, computeChainId, computePayerHash, computeRecipientHash, hexSecretToFieldElement, N_PUBLIC, encodeG1, encodeG2, decimalToBe32Hex } from '@fluppy/core';
export * from '@fluppy/core';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import { Networks, Keypair, rpc, xdr, nativeToScVal, Contract, TransactionBuilder, Account } from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';

// src/index.ts
var poseidonInstance = null;
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}
function resolveApiUrl(path, options) {
  const baseUrl = options?.baseUrl ?? "";
  return `${baseUrl}${path}`;
}
function validateSecret(secret) {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error("[Merkle] Invalid secret: must be 64-char hex string.");
  }
}
function secretToField(hexSecret) {
  return BigInt(`0x${hexSecret}`) % BN254_R;
}
function commitmentToHex(commitment) {
  return commitment.toString(16).padStart(64, "0").toLowerCase();
}
async function readApiError(response, fallback) {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return String(
        data.error ?? data.message ?? fallback
      );
    }
    return `${fallback}. HTTP ${response.status}`;
  } catch {
    return `${fallback}. HTTP ${response.status}`;
  }
}
async function computeCommitment(secret) {
  validateSecret(secret);
  const poseidon = await getPoseidon();
  const field = secretToField(secret);
  return poseidon.F.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      field
    ])
  );
}
async function enrollCommitment(secret, options) {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitmentToHex(commitment);
  const response = await fetch(
    resolveApiUrl("/api/merkle-proof/enroll", options),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        commitment: commitmentHex
      })
    }
  );
  if (!response.ok) {
    const error = await readApiError(
      response,
      "[Merkle] Enrollment failed"
    );
    throw new Error(error);
  }
  return await response.json();
}
var zeroHashCache = null;
async function getZeroHashes() {
  if (zeroHashCache) {
    return zeroHashCache;
  }
  const poseidon = await getPoseidon();
  const field = poseidon.F;
  const hashes = new Array(CIRCUIT_DEPTH + 1);
  hashes[0] = field.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      0n
    ])
  );
  for (let level = 1; level <= CIRCUIT_DEPTH; level++) {
    const previous = hashes[level - 1];
    if (previous === void 0) {
      throw new Error(`[Merkle] Missing zero hash for level ${level - 1}`);
    }
    hashes[level] = field.toObject(
      poseidon([
        POSEIDON_TAGS.NODE,
        previous,
        previous
      ])
    );
  }
  zeroHashCache = hashes;
  return zeroHashCache;
}
async function buildPathFromLeaves(leaves, leafIndex) {
  const poseidon = await getPoseidon();
  const field = poseidon.F;
  const zeroHashes = await getZeroHashes();
  const levels = Array.from(
    { length: CIRCUIT_DEPTH + 1 },
    () => /* @__PURE__ */ new Map()
  );
  const leafLevel = levels[0];
  if (!leafLevel) {
    throw new Error("[Merkle] Missing leaf level");
  }
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    if (leaf === void 0) {
      throw new Error(`[Merkle] Missing leaf at index ${i}`);
    }
    leafLevel.set(i, leaf);
  }
  for (let level = 0; level < CIRCUIT_DEPTH; level++) {
    const currentLevel = levels[level];
    const nextLevel = levels[level + 1];
    const zeroHash = zeroHashes[level];
    if (!currentLevel || !nextLevel || zeroHash === void 0) {
      throw new Error(`[Merkle] Invalid tree state at level ${level}`);
    }
    const parentIndices = /* @__PURE__ */ new Set();
    for (const nodeIndex of currentLevel.keys()) {
      parentIndices.add(Math.floor(nodeIndex / 2));
    }
    for (const parentIndex of parentIndices) {
      const leftIndex = parentIndex * 2;
      const rightIndex = leftIndex + 1;
      const leftHash = currentLevel.get(leftIndex) ?? zeroHash;
      const rightHash = currentLevel.get(rightIndex) ?? zeroHash;
      const parentHash = field.toObject(
        poseidon([
          POSEIDON_TAGS.NODE,
          leftHash,
          rightHash
        ])
      );
      nextLevel.set(parentIndex, parentHash);
    }
  }
  const rootLevel = levels[CIRCUIT_DEPTH];
  const defaultRoot = zeroHashes[CIRCUIT_DEPTH];
  if (!rootLevel || defaultRoot === void 0) {
    throw new Error("[Merkle] Missing root level");
  }
  const root = rootLevel.get(0) ?? defaultRoot;
  const pathElements = [];
  const pathIndices = [];
  let index = leafIndex;
  for (let level = 0; level < CIRCUIT_DEPTH; level++) {
    const levelNodes = levels[level];
    const zeroHash = zeroHashes[level];
    if (!levelNodes || zeroHash === void 0) {
      throw new Error(`[Merkle] Missing proof data at level ${level}`);
    }
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const siblingHash = levelNodes.get(siblingIndex) ?? zeroHash;
    pathElements.push(siblingHash);
    pathIndices.push(isRight ? 1 : 0);
    index = Math.floor(index / 2);
  }
  return { pathElements, pathIndices, root };
}
async function getMerkleProof(secret, options) {
  const commitment = await computeCommitment(secret);
  const commitmentDecimal = commitment.toString();
  const response = await fetch(
    resolveApiUrl("/api/merkle-proof", options),
    {
      method: "GET"
    }
  );
  if (!response.ok) {
    const error = await readApiError(
      response,
      "[Merkle] Leaf set request failed"
    );
    throw new Error(`[Merkle] ${error}`);
  }
  const data = await response.json();
  const leafIndex = data.leaves.indexOf(commitmentDecimal);
  if (leafIndex === -1) {
    throw new Error(
      "[Merkle] Commitment not found in enrolled leaf set. Has this credential been enrolled?"
    );
  }
  const leaves = data.leaves.map((leaf) => BigInt(leaf));
  const { pathElements, pathIndices, root } = await buildPathFromLeaves(
    leaves,
    leafIndex
  );
  const serverRoot = BigInt(data.root);
  if (root !== serverRoot) {
    throw new Error(
      "[Merkle] Locally computed root does not match server-reported root. This indicates a tree construction mismatch."
    );
  }
  return {
    pathElements,
    pathIndices,
    root
  };
}

// src/artifacts.ts
var CIRCUIT_VERSION = "v3";
var BASE_PATH = `/circuit/${CIRCUIT_VERSION}`;
var DEFAULT_PATHS = {
  wasmPath: `${BASE_PATH}/fluppy_payment.wasm`,
  zkeyPath: `${BASE_PATH}/circuit_final.zkey.bin`,
  verificationKeyPath: `${BASE_PATH}/verification_key.json`
};
var artifactCache = null;
var verificationKeyCache = null;
function resolvePaths(overrides) {
  return {
    wasmPath: overrides?.wasmPath ?? DEFAULT_PATHS.wasmPath,
    zkeyPath: overrides?.zkeyPath ?? DEFAULT_PATHS.zkeyPath,
    verificationKeyPath: overrides?.verificationKeyPath ?? DEFAULT_PATHS.verificationKeyPath
  };
}
function createFetchInit(options, method = "GET") {
  const init = {
    method,
    cache: options.cache ?? "no-store"
  };
  if (options.signal) {
    init.signal = options.signal;
  }
  return init;
}
async function fetchBinaryArtifact(path, options) {
  const response = await fetch(path, createFetchInit(options, "GET"));
  if (!response.ok) {
    throw new Error(
      `[artifacts] Failed to load artifact: ${path} (HTTP ${response.status})`
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
async function fetchJsonArtifact(path, options) {
  const response = await fetch(path, createFetchInit(options, "GET"));
  if (!response.ok) {
    throw new Error(
      `[artifacts] Failed to load JSON artifact: ${path} (HTTP ${response.status})`
    );
  }
  return await response.json();
}
async function checkArtifactExists(path, options) {
  const headResponse = await fetch(
    path,
    createFetchInit(options, "HEAD")
  ).catch(() => null);
  if (headResponse?.ok) {
    return;
  }
  const getResponse = await fetch(
    path,
    createFetchInit(options, "GET")
  );
  if (!getResponse.ok) {
    throw new Error(
      `[artifacts] Artifact not found: ${path} (HTTP ${getResponse.status}). Ensure app/public/circuit/${CIRCUIT_VERSION}/ contains the correct files.`
    );
  }
}
function getDefaultCircuitArtifactPaths() {
  return { ...DEFAULT_PATHS };
}
async function loadCircuitArtifacts(options = {}) {
  if (artifactCache?.version === CIRCUIT_VERSION) {
    return {
      wasm: artifactCache.wasm,
      zkey: artifactCache.zkey
    };
  }
  const paths = resolvePaths(options.paths);
  console.info("[artifacts] Loading circuit artifacts...");
  const [wasm, zkey] = await Promise.all([
    fetchBinaryArtifact(paths.wasmPath, options),
    fetchBinaryArtifact(paths.zkeyPath, options)
  ]);
  artifactCache = {
    wasm,
    zkey,
    version: CIRCUIT_VERSION,
    loadedAt: Date.now()
  };
  console.info(
    `[artifacts] Loaded: WASM=${wasm.byteLength} bytes | ZKEY=${zkey.byteLength} bytes`
  );
  return { wasm, zkey };
}
async function loadVerificationKey(options = {}) {
  if (verificationKeyCache !== null) {
    return verificationKeyCache;
  }
  const paths = resolvePaths(options.paths);
  verificationKeyCache = await fetchJsonArtifact(
    paths.verificationKeyPath,
    options
  );
  return verificationKeyCache;
}
async function validateCircuitArtifacts(options = {}) {
  const paths = resolvePaths(options.paths);
  await Promise.all([
    checkArtifactExists(paths.wasmPath, options),
    checkArtifactExists(paths.zkeyPath, options),
    checkArtifactExists(paths.verificationKeyPath, options)
  ]);
}
function clearCircuitArtifactCache() {
  artifactCache = null;
  verificationKeyCache = null;
  console.info("[artifacts] Cache cleared.");
}
var activeGenerationId = null;
function createGenerationId() {
  const bytes = crypto.getRandomValues(
    new Uint8Array(8)
  );
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function acquireGenerationLock() {
  if (activeGenerationId !== null) {
    throw new Error(
      "[prover] Another proof generation is already in progress"
    );
  }
  const generationId = createGenerationId();
  activeGenerationId = generationId;
  return generationId;
}
function releaseGenerationLock(generationId) {
  if (activeGenerationId === generationId) {
    activeGenerationId = null;
  }
}
function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException(
      "Proof generation was aborted",
      "AbortError"
    );
  }
}
function createProgressUpdater(callback) {
  return {
    update(stage, pct) {
      callback?.(stage, pct);
    },
    complete() {
      callback?.("Completed", 100);
    }
  };
}
function generateSecureNonce() {
  const bytes = crypto.getRandomValues(
    new Uint8Array(32)
  );
  const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const raw = BigInt(`0x${hex}`);
  return (raw % BN254_R).toString();
}
function validateProofInputs(secret, pathElements, pathIndices) {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      "[prover] Invalid secret format: must be 64-char hex string"
    );
  }
  if (pathElements.length !== CIRCUIT_DEPTH) {
    throw new Error(
      `[prover] pathElements length ${pathElements.length} !== CIRCUIT_DEPTH ${CIRCUIT_DEPTH}`
    );
  }
  if (pathIndices.length !== CIRCUIT_DEPTH) {
    throw new Error(
      `[prover] pathIndices length ${pathIndices.length} !== CIRCUIT_DEPTH ${CIRCUIT_DEPTH}`
    );
  }
}
function buildCircuitInputs(input) {
  const {
    secret,
    merkleProof,
    recipient,
    payerAddress,
    amount,
    networkPassphrase
  } = input;
  const {
    pathElements,
    pathIndices,
    root
  } = merkleProof;
  return {
    secret: hexSecretToFieldElement(secret),
    nonce: generateSecureNonce(),
    amount: amount.toString(),
    pathElements: pathElements.map((element) => element.toString()),
    pathIndices: [...pathIndices],
    merkleRoot: root.toString(),
    recipientHash: computeRecipientHash(recipient),
    payerHash: computePayerHash(payerAddress),
    chainId: computeChainId(networkPassphrase)
  };
}
function validateRootConsistency(publicSignals) {
  const verifiedRoot = BigInt(publicSignals[1] ?? "0");
  const providedRoot = BigInt(publicSignals[2] ?? "0");
  if (verifiedRoot !== providedRoot) {
    throw new Error(
      "[prover] Merkle root consistency check failed"
    );
  }
}
function encodeProofOutput(proof, publicSignals) {
  if (publicSignals.length !== N_PUBLIC) {
    throw new Error(
      `[prover] Public signal count mismatch: got ${publicSignals.length}, expected ${N_PUBLIC}`
    );
  }
  const pi_a = encodeG1(proof.pi_a);
  const pi_b = encodeG2(proof.pi_b);
  const pi_c = encodeG1(proof.pi_c);
  const encodedSignals = publicSignals.map(
    (signal) => decimalToBe32Hex(signal)
  );
  return {
    pi_a,
    pi_b,
    pi_c,
    publicSignals: encodedSignals
  };
}
function reconstructProofForVerification(proof) {
  return {
    pi_a: [
      BigInt(`0x${proof.pi_a.slice(0, 64)}`).toString(),
      BigInt(`0x${proof.pi_a.slice(64, 128)}`).toString(),
      "1"
    ],
    pi_b: [
      [
        BigInt(`0x${proof.pi_b.slice(0, 64)}`).toString(),
        BigInt(`0x${proof.pi_b.slice(64, 128)}`).toString()
      ],
      [
        BigInt(`0x${proof.pi_b.slice(128, 192)}`).toString(),
        BigInt(`0x${proof.pi_b.slice(192, 256)}`).toString()
      ],
      ["1", "0"]
    ],
    pi_c: [
      BigInt(`0x${proof.pi_c.slice(0, 64)}`).toString(),
      BigInt(`0x${proof.pi_c.slice(64, 128)}`).toString(),
      "1"
    ],
    protocol: "groth16",
    curve: "bn128"
  };
}
async function generateZkProof(input) {
  const {
    secret,
    merkleProof,
    signal,
    onProgress
  } = input;
  const {
    pathElements,
    pathIndices
  } = merkleProof;
  throwIfAborted(signal);
  const generationId = acquireGenerationLock();
  const progress = createProgressUpdater(onProgress);
  try {
    progress.update("Validating artifacts", 5);
    const artifactOptions = signal ? { signal } : {};
    await validateCircuitArtifacts(artifactOptions);
    throwIfAborted(signal);
    validateProofInputs(
      secret,
      pathElements,
      pathIndices
    );
    progress.update("Preparing inputs", 15);
    const circuitInputs = buildCircuitInputs(input);
    throwIfAborted(signal);
    progress.update("Loading artifacts", 25);
    const { wasm, zkey } = await loadCircuitArtifacts(artifactOptions);
    throwIfAborted(signal);
    progress.update("Computing witness", 45);
    const proveResult = await snarkjs.groth16.fullProve(
      circuitInputs,
      wasm,
      zkey
    );
    throwIfAborted(signal);
    progress.update("Encoding proof", 90);
    validateRootConsistency(
      proveResult.publicSignals
    );
    const output = encodeProofOutput(
      proveResult.proof,
      proveResult.publicSignals
    );
    progress.complete();
    console.info(
      `[prover] Proof generated: pi_a=${output.pi_a.length / 2}B pi_b=${output.pi_b.length / 2}B pi_c=${output.pi_c.length / 2}B`
    );
    return output;
  } finally {
    releaseGenerationLock(generationId);
  }
}
async function verifyProofLocally(proof) {
  try {
    const verificationKey = await loadVerificationKey();
    const reconstructed = reconstructProofForVerification(proof);
    const publicSignals = proof.publicSignals.map(
      (signal) => BigInt(`0x${signal}`).toString()
    );
    const isValid = await snarkjs.groth16.verify(
      verificationKey,
      publicSignals,
      reconstructed
    );
    console.info(
      `[prover] Local verification: ${isValid ? "\u2713 VALID" : "\u274C INVALID"}`
    );
    return isValid;
  } catch (err) {
    console.error(
      "[prover] Local verification error:",
      err
    );
    return false;
  }
}

// src/identity.ts
var DB_NAME = "fluppy-identity-v1";
var DB_VERSION = 1;
var STORE_NAME = "credentials";
var CRED_KEY = "zk-credential";
var PBKDF2_ITERATIONS = typeof process !== "undefined" && process.env?.["NODE_ENV"] === "development" ? 1e5 : 6e5;
function assertBrowserEnvironment() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error(
      "[identity] This module can only be used in a browser environment."
    );
  }
}
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}
function openDb() {
  assertBrowserEnvironment();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function dbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
function dbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}
function generateSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}
async function credentialExists() {
  const db = await openDb();
  const stored = await dbGet(db, CRED_KEY);
  return !!stored;
}
async function createCredential(password) {
  assertBrowserEnvironment();
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const secret = generateSecret();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, new Uint8Array(salt));
  const encoded = new TextEncoder().encode(secret);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
      tagLength: 128
    },
    key,
    encoded
  );
  const stored = {
    version: 1,
    kdf: "pbkdf2",
    iterations: PBKDF2_ITERATIONS,
    salt: toHex(salt),
    iv: toHex(iv),
    ciphertext: toHex(ciphertext)
  };
  const db = await openDb();
  await dbSet(db, CRED_KEY, stored);
  console.info("[identity] Credential created and stored in IndexedDB.");
  return { secret };
}
async function unlockCredential(password) {
  assertBrowserEnvironment();
  const db = await openDb();
  const raw = await dbGet(db, CRED_KEY);
  if (raw === void 0 || raw === null) {
    throw new Error("No credential found. Please create one first.");
  }
  const stored = raw;
  if (stored["version"] !== 1) {
    throw new Error(
      `Unknown credential version: ${stored["version"]}. Delete the existing credential and create a new one.`
    );
  }
  const salt = new Uint8Array(fromHex(stored["salt"]));
  const iv = new Uint8Array(fromHex(stored["iv"]));
  const ciphertext = new Uint8Array(
    fromHex(stored["ciphertext"])
  ).buffer;
  const iterations = stored["iterations"] ?? PBKDF2_ITERATIONS;
  const key = await deriveKey(password, salt, iterations);
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128
      },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error(
      "Wrong password or corrupted credential. If you forgot your password, delete the credential and create a new one."
    );
  }
}
async function deleteCredential() {
  const db = await openDb();
  await dbDelete(db, CRED_KEY);
}
var G1_BYTE_LENGTH = 64;
var G2_BYTE_LENGTH = 128;
var FIELD_BYTE_LENGTH = 32;
var DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org:443";
var DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;
var BASE_FEE = "100000";
var TX_TIMEOUT_SECONDS = 300;
var MAX_POLL_ATTEMPTS = 30;
var POLL_INTERVAL_MS = 2e3;
function resolveConfig(config) {
  return {
    rpcUrl: config?.rpcUrl ?? DEFAULT_RPC_URL,
    networkPassphrase: config?.networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE,
    contractId: config?.contractId ?? "",
    apiBaseUrl: config?.apiBaseUrl ?? ""
  };
}
function requireContractId(contractId) {
  if (!contractId) {
    throw new Error(
      "[stellar] Contract ID is required. Pass it via StellarConfig.contractId or set NEXT_PUBLIC_CONTRACT_ID."
    );
  }
  return contractId;
}
function hexToScBytes(hexStr, expectedBytes) {
  if (hexStr.length % 2 !== 0) {
    throw new Error(
      `[stellar] hexToScBytes: odd-length hex string (${hexStr.length} chars). Verify that encodeG1/encodeG2 in prover.ts produces well-formed hex.`
    );
  }
  const actualBytes = hexStr.length / 2;
  if (expectedBytes !== void 0 && actualBytes !== expectedBytes) {
    throw new Error(
      `[stellar] Byte length mismatch: expected ${expectedBytes} bytes, received ${actualBytes} bytes (${hexStr.length} hex chars).`
    );
  }
  return xdr.ScVal.scvBytes(Buffer.from(hexStr, "hex"));
}
function validateGroth16Proof(proof) {
  const errors = [];
  if (proof.pi_a.length !== G1_BYTE_LENGTH * 2) {
    errors.push(`pi_a: expected ${G1_BYTE_LENGTH * 2} hex chars, received ${proof.pi_a.length}`);
  }
  if (proof.pi_b.length !== G2_BYTE_LENGTH * 2) {
    errors.push(`pi_b: expected ${G2_BYTE_LENGTH * 2} hex chars, received ${proof.pi_b.length}`);
  }
  if (proof.pi_c.length !== G1_BYTE_LENGTH * 2) {
    errors.push(`pi_c: expected ${G1_BYTE_LENGTH * 2} hex chars, received ${proof.pi_c.length}`);
  }
  if (proof.publicSignals.length !== N_PUBLIC) {
    errors.push(
      `publicSignals: expected ${N_PUBLIC} elements, received ${proof.publicSignals.length}`
    );
  } else {
    proof.publicSignals.forEach((sig, i) => {
      if (sig.length !== FIELD_BYTE_LENGTH * 2) {
        errors.push(
          `publicSignals[${i}]: expected ${FIELD_BYTE_LENGTH * 2} hex chars, received ${sig.length}`
        );
      }
    });
  }
  if (errors.length > 0) {
    throw new Error(`[stellar] Proof validation failed:
  - ${errors.join("\n  - ")}`);
  }
}
async function resolveSender() {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    const { isConnected, requestAccess } = await import('@stellar/freighter-api');
    const connected = await isConnected();
    if (!connected.isConnected) {
      throw new Error(
        "[stellar] Freighter wallet not found. Install the Freighter extension from freighter.app"
      );
    }
    const { address, error } = await requestAccess();
    if (error) throw new Error(`[stellar] Freighter access denied: ${error}`);
    if (!address) throw new Error("[stellar] Freighter returned no address.");
    return { address, isBrowser: true };
  }
  const secret = process.env["SENDER_SECRET"];
  if (!secret) {
    throw new Error("[stellar] SENDER_SECRET is missing from .env (required in Node.js mode)");
  }
  return {
    address: Keypair.fromSecret(secret).publicKey(),
    isBrowser: false
  };
}
async function signAndSubmit(preparedTx, isBrowser, networkPassphrase, rpcServer, rpcUrl) {
  const tx = preparedTx;
  let signedTx;
  if (isBrowser) {
    const { signTransaction } = await import('@stellar/freighter-api');
    console.log("[stellar] Awaiting Freighter signature...");
    const signResult = await signTransaction(tx.toXDR(), { networkPassphrase });
    if (signResult.error) {
      throw new Error(`[stellar] Freighter rejected signing: ${signResult.error}`);
    }
    signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, networkPassphrase);
  } else {
    const secret = process.env["SENDER_SECRET"];
    if (!secret) throw new Error("[stellar] SENDER_SECRET required for Node.js signing");
    const sourceKeypair = Keypair.fromSecret(secret);
    tx.sign(sourceKeypair);
    signedTx = tx;
  }
  console.log("[stellar] Submitting transaction to the network...");
  const submission = await rpcServer.sendTransaction(signedTx);
  if (submission.status === "ERROR") {
    throw new Error(
      `[stellar] RPC submission failed: ${JSON.stringify(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        submission.errorResult ?? submission
      )}`
    );
  }
  return await pollTransaction(submission.hash, rpcServer, rpcUrl);
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
async function fetchTransactionStatusRaw(rpcUrl, hash) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `fluppy-${Date.now()}`,
      method: "getTransaction",
      params: {
        hash
      }
    })
  });
  if (!response.ok) {
    throw new Error(
      `[stellar] Raw getTransaction request failed: HTTP ${response.status}`
    );
  }
  const json = await response.json();
  if (!isRecord(json)) {
    throw new Error("[stellar] Invalid raw getTransaction response.");
  }
  if (json["error"]) {
    throw new Error(
      `[stellar] Raw getTransaction RPC error: ${JSON.stringify(json["error"])}`
    );
  }
  const result = json["result"];
  if (!isRecord(result)) {
    throw new Error("[stellar] Raw getTransaction response missing result.");
  }
  return result;
}
function readTransactionStatus(txStatus) {
  if (!isRecord(txStatus)) {
    throw new Error("[stellar] Invalid transaction status response.");
  }
  const status = txStatus["status"];
  if (typeof status !== "string") {
    throw new Error("[stellar] Transaction status response missing status.");
  }
  return status;
}
async function payWithZkGroth16(merchant, amount, proof, config, resolvedSender) {
  const resolved = resolveConfig(config);
  const contractId = requireContractId(resolved.contractId);
  const networkPassphrase = resolved.networkPassphrase;
  const rpcServer = new rpc.Server(resolved.rpcUrl);
  console.log("[stellar] payWithZkGroth16 \u2014 Contract:", contractId.slice(0, 8) + "...");
  validateGroth16Proof(proof);
  const { address: senderAddress, isBrowser } = resolvedSender ?? await resolveSender();
  const accountResponse = await rpcServer.getAccount(senderAddress);
  const piAScVal = hexToScBytes(proof.pi_a, G1_BYTE_LENGTH);
  const piBScVal = hexToScBytes(proof.pi_b, G2_BYTE_LENGTH);
  const piCScVal = hexToScBytes(proof.pi_c, G1_BYTE_LENGTH);
  const publicInputsScVal = xdr.ScVal.scvVec(
    proof.publicSignals.map((sig) => hexToScBytes(sig, FIELD_BYTE_LENGTH))
  );
  const contractArgs = [
    nativeToScVal(senderAddress, { type: "address" }),
    // 1. from
    nativeToScVal(merchant, { type: "address" }),
    // 2. to
    nativeToScVal(amount, { type: "i128" }),
    // 3. amount (stroops)
    piAScVal,
    // 4. pi_a
    piBScVal,
    // 5. pi_b
    piCScVal,
    // 6. pi_c
    publicInputsScVal
    // 7. public_inputs
  ];
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(
    new Account(senderAddress, accountResponse.sequenceNumber()),
    { fee: BASE_FEE, networkPassphrase }
  ).addOperation(contract.call("execute_payment", ...contractArgs)).setTimeout(TX_TIMEOUT_SECONDS).build();
  console.log("[stellar] Simulating transaction...");
  const preparedTx = await rpcServer.prepareTransaction(tx);
  return await signAndSubmit(
    preparedTx,
    isBrowser,
    networkPassphrase,
    rpcServer,
    resolved.rpcUrl
  );
}
async function getContractMerkleRoot(config) {
  const baseUrl = config?.apiBaseUrl ?? "";
  const response = await fetch(`${baseUrl}/api/merkle-root`, { method: "GET" });
  if (!response.ok) {
    throw new Error("[stellar] Failed to fetch contract Merkle root from /api/merkle-root");
  }
  const data = await response.json();
  if (!data["root"]) {
    throw new Error("[stellar] Invalid merkle root response: missing root field");
  }
  return String(data["root"]);
}
async function checkRootIsKnown(rootHex, config) {
  const baseUrl = config?.apiBaseUrl ?? "";
  const response = await fetch(
    `${baseUrl}/api/merkle-root?root=${encodeURIComponent(rootHex)}`,
    { method: "GET" }
  );
  if (!response.ok) {
    throw new Error("[stellar] Failed to check root against /api/merkle-root");
  }
  const data = await response.json();
  return Boolean(data["isKnown"]);
}
async function pollTransaction(hash, server, rpcUrl) {
  let status = "PENDING";
  let txStatus;
  let attempts = 0;
  console.log(`[stellar] Polling transaction: ${hash.slice(0, 10)}...`);
  while (status === "PENDING" || status === "NOT_FOUND") {
    if (attempts >= MAX_POLL_ATTEMPTS) {
      throw new Error(
        `[stellar] Transaction timed out after ${MAX_POLL_ATTEMPTS} attempts. Hash: ${hash}`
      );
    }
    txStatus = rpcUrl ? await fetchTransactionStatusRaw(rpcUrl, hash) : await server.getTransaction(hash);
    status = readTransactionStatus(txStatus);
    attempts++;
    if (status === "SUCCESS") {
      console.log(`[stellar] \u2713 Transaction confirmed (attempt ${attempts})`);
      return txStatus;
    }
    if (status === "FAILED") {
      const resultXdr = isRecord(txStatus) ? txStatus["resultXdr"] ?? txStatus["result_xdr"] : void 0;
      console.error("[stellar] Transaction rejected. Result XDR:", resultXdr);
      throw new Error(
        "Transaction rejected by the Soroban VM. Possible causes: invalid proof, nullifier already spent, or merkle root mismatch."
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return txStatus;
}

// src/payment.ts
var RootSyncError = class extends Error {
  frontendRootHex;
  contractRootHex;
  constructor(frontendRootHex, contractRootHex) {
    super("Contract Merkle root is out of sync with frontend tree.");
    this.name = "RootSyncError";
    this.frontendRootHex = frontendRootHex;
    this.contractRootHex = contractRootHex;
  }
};
function validateSecret2(secret) {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      "[payment] Invalid secret format: must be 64-char hex string."
    );
  }
}
function validateMerchant(merchant) {
  if (!merchant || !merchant.startsWith("G") || merchant.length !== 56) {
    throw new Error(
      `[payment] Invalid merchant address: ${merchant.slice(0, 10)}... Stellar addresses start with G and are 56 characters.`
    );
  }
}
function emitStep(onStep, name, startMs, details) {
  if (!onStep) {
    return;
  }
  const step = {
    name,
    elapsedMs: Date.now() - startMs,
    ...details ? { details } : {}
  };
  onStep(step);
}
function normalizeTxHash(txResult) {
  if (typeof txResult !== "object" || txResult === null) {
    return "";
  }
  const record = txResult;
  const candidate = record["txHash"] ?? record["hash"] ?? record["id"];
  return typeof candidate === "string" ? candidate : "";
}
function buildProofInput(input, merkleProof, payerAddress) {
  return {
    secret: input.secret,
    merkleProof,
    recipient: input.merchant,
    payerAddress,
    amount: input.amount,
    networkPassphrase: input.networkPassphrase,
    ...input.onProofProgress ? { onProgress: input.onProofProgress } : {},
    ...input.signal ? { signal: input.signal } : {}
  };
}
async function executeFluppyPayment(input) {
  const {
    secret,
    merchant,
    amount,
    stellarConfig,
    merkleOptions,
    onStep
  } = input;
  const startMs = Date.now();
  validateSecret2(secret);
  validateMerchant(merchant);
  const { address: senderAddress, isBrowser } = await resolveSender();
  if (amount <= 0n) {
    throw new Error(
      `[payment] Amount must be positive, received: ${amount}`
    );
  }
  emitStep(onStep, "enrollment:start", startMs);
  await enrollCommitment(secret, merkleOptions);
  emitStep(onStep, "enrollment:done", startMs);
  emitStep(onStep, "merkle:request", startMs);
  const merkleProof = await getMerkleProof(
    secret,
    merkleOptions
  );
  emitStep(onStep, "merkle:received", startMs, {
    root: merkleProof.root.toString().slice(0, 12)
  });
  emitStep(onStep, "root:sync_check", startMs);
  const frontendRootHex = merkleProof.root.toString(16).padStart(64, "0").toLowerCase();
  const isKnown = await checkRootIsKnown(frontendRootHex, stellarConfig);
  if (!isKnown) {
    throw new RootSyncError(
      frontendRootHex,
      "(not in the contract's recent root history)"
    );
  }
  emitStep(onStep, "proof:start", startMs);
  const proofInput = buildProofInput(input, merkleProof, senderAddress);
  const zkProof = await generateZkProof(proofInput);
  emitStep(onStep, "proof:done", startMs);
  if (typeof process !== "undefined" && process.env?.["NODE_ENV"] === "development") {
    emitStep(onStep, "proof:verify_local", startMs);
    const isValid = await verifyProofLocally(zkProof);
    if (!isValid) {
      throw new Error(
        "[payment] Local proof verification FAILED. Do not submit."
      );
    }
  }
  emitStep(onStep, "tx:submit", startMs);
  const txResult = await payWithZkGroth16(
    merchant,
    amount,
    zkProof,
    stellarConfig,
    { address: senderAddress, isBrowser }
  );
  const txHash = normalizeTxHash(txResult);
  emitStep(onStep, "tx:confirmed", startMs, {
    txHash
  });
  return {
    txHash,
    proof: zkProof,
    merkleRoot: merkleProof.root,
    txResult
  };
}

// src/index.ts
var FLUPPY_BROWSER_VERSION = "0.1.0";

export { FLUPPY_BROWSER_VERSION, RootSyncError, clearCircuitArtifactCache, computeCommitment, createCredential, credentialExists, deleteCredential, enrollCommitment, executeFluppyPayment, generateSecret, generateZkProof, getContractMerkleRoot, getDefaultCircuitArtifactPaths, getMerkleProof, loadCircuitArtifacts, loadVerificationKey, payWithZkGroth16, pollTransaction, resolveSender, unlockCredential, validateCircuitArtifacts, verifyProofLocally };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map