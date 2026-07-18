import { MerkleProof, PaymentProofOutput } from '@flupy/core';
export * from '@flupy/core';
import { rpc } from '@stellar/stellar-sdk';

interface BrowserMerkleProof {
    readonly pathElements: bigint[];
    readonly pathIndices: number[];
    readonly root: bigint;
}
interface EnrollCommitmentResult {
    readonly enrolled: number;
    readonly alreadyEnrolled?: boolean;
}
interface MerkleClientOptions {
    readonly baseUrl?: string;
}
/**
 * Computes a Merkle commitment locally from a secret.
 *
 * The raw secret never leaves the browser.
 */
declare function computeCommitment(secret: string): Promise<bigint>;
/**
 * Enrolls a locally computed commitment into the Merkle backend.
 *
 * This is intended for local/testnet/mock enrollment flows.
 * Production should use authenticated admin enrollment.
 */
declare function enrollCommitment(secret: string, options?: MerkleClientOptions): Promise<EnrollCommitmentResult>;
/**
 * Fetches a Merkle membership proof from the backend.
 *
 * The backend receives only the commitment, never the raw secret.
 */
declare function getMerkleProof(secret: string, options?: MerkleClientOptions): Promise<BrowserMerkleProof>;

/**
 * artifacts.ts — Circuit artifact loader for Fluppy browser SDK.
 *
 * Responsibilities:
 * - Define default artifact paths
 * - Fetch and cache WASM and ZKey as Uint8Array
 * - Fetch and cache verification_key.json
 * - Validate artifact availability
 * - Expose cache reset for testing and development
 *
 * This module must not import React, Next.js, Sentry, or UI code.
 */
interface CircuitArtifactPaths {
    readonly wasmPath: string;
    readonly zkeyPath: string;
    readonly verificationKeyPath: string;
}
interface CircuitArtifacts {
    readonly wasm: Uint8Array;
    readonly zkey: Uint8Array;
}
interface LoadArtifactOptions {
    readonly paths?: Partial<CircuitArtifactPaths>;
    readonly cache?: RequestCache;
    readonly signal?: AbortSignal;
}
declare function getDefaultCircuitArtifactPaths(): CircuitArtifactPaths;
declare function loadCircuitArtifacts(options?: LoadArtifactOptions): Promise<CircuitArtifacts>;
declare function loadVerificationKey(options?: LoadArtifactOptions): Promise<unknown>;
declare function validateCircuitArtifacts(options?: LoadArtifactOptions): Promise<void>;
declare function clearCircuitArtifactCache(): void;

type ProofProgressCallback = (stage: string, pct: number) => void;
interface GenerateZkProofInput {
    readonly secret: string;
    readonly merkleProof: MerkleProof;
    readonly recipient: string;
    readonly amount: bigint;
    readonly networkPassphrase: string;
    readonly onProgress?: ProofProgressCallback;
    readonly signal?: AbortSignal;
}
declare function generateZkProof(input: GenerateZkProofInput): Promise<PaymentProofOutput>;
declare function verifyProofLocally(proof: PaymentProofOutput): Promise<boolean>;

/**
 * identity.ts — Browser credential management for the Fluppy browser SDK.
 *
 * Responsibilities:
 * - Generate a 256-bit cryptographically random ZK secret
 * - Encrypt and persist credential to IndexedDB using PBKDF2 + AES-GCM
 * - Decrypt and return the secret from IndexedDB
 * - Check credential existence
 * - Delete stored credential
 *
 * Security properties:
 * - Secret is never stored in plaintext
 * - Password is never logged or persisted
 * - AES-GCM key is non-extractable
 * - IndexedDB schema is versioned and migration-safe
 * - Iteration count is stored per credential for future migration safety
 *
 * Compatibility constraints:
 * - DB_NAME, DB_VERSION, STORE_NAME, and CRED_KEY must remain identical
 * - Credential schema fields and types must remain identical
 * - PBKDF2 and AES-GCM parameters must remain identical
 * - Secret format must remain a 64-character lowercase hex string
 *
 * This module uses native browser APIs only.
 * Do not import React, Next.js, Sentry, or UI code here.
 */
interface CreateCredentialResult {
    readonly secret: string;
}
declare function generateSecret(): string;
declare function credentialExists(): Promise<boolean>;
declare function createCredential(password: string): Promise<CreateCredentialResult>;
declare function unlockCredential(password: string): Promise<string>;
declare function deleteCredential(): Promise<void>;

/**
 * stellar.ts — Stellar/Soroban payment submission for the Fluppy browser SDK.
 *
 * Responsibilities:
 *   - Serialise Groth16 ZK proof to Soroban XDR format
 *   - Resolve sender address via Freighter wallet (browser) or Keypair (Node.js)
 *   - Build, simulate, sign, and submit execute_payment() transaction
 *   - Poll transaction status until finalised
 *   - Fetch the contract Merkle root from a configurable API endpoint
 *
 * Contract function: execute_payment()
 * Rust signature (DO NOT CHANGE argument order):
 *   pub fn execute_payment(
 *     env:           Env,
 *     from:          Address,       ← 1
 *     to:            Address,       ← 2
 *     amount:        i128,          ← 3
 *     pi_a:          Bytes,         ← 4  64 bytes  G1 point
 *     pi_b:          Bytes,         ← 5  128 bytes G2 point
 *     pi_c:          Bytes,         ← 6  64 bytes  G1 point
 *     public_inputs: Vec<BytesN<32>>, ← 7  N_PUBLIC × 32 bytes
 *   ) -> Result<(), FluppyError>
 *
 * Fee model:
 *   - User signs and pays via Freighter wallet
 *   - User pays Stellar/Soroban network fee
 *   - Protocol fee (5%) comes from payment amount via contract atomic split
 *   - No relayer or gas sponsorship in this module
 *
 * This module does NOT import React, Next.js, Sentry, or any UI code.
 */

/**
 * Configuration for Stellar/Soroban contract interaction.
 * All fields are optional — defaults are used when omitted.
 */
interface StellarConfig {
    /** Soroban RPC endpoint URL. */
    readonly rpcUrl?: string;
    /** Stellar network passphrase. */
    readonly networkPassphrase?: string;
    /** Deployed Fluppy contract ID. */
    readonly contractId?: string;
    /**
     * Base URL for internal API endpoints (e.g. the Merkle root route).
     * Defaults to '' (relative URLs) for Next.js app consumers.
     */
    readonly apiBaseUrl?: string;
}
/** Result returned by payWithZkGroth16. */
interface PaymentResult {
    /** Stellar transaction hash of the confirmed payment. */
    readonly txHash: string;
    /** Final Soroban transaction status (SUCCESS, FAILED, etc.) */
    readonly status: string;
    /** Raw transaction status response from the RPC server. */
    readonly rawStatus: unknown;
}
/**
 * Submits a ZK payment transaction to the Fluppy Soroban contract.
 *
 * Invokes: execute_payment(from, to, amount, pi_a, pi_b, pi_c, public_inputs)
 *
 * Fee model:
 *   - User signs via Freighter — user pays network fee
 *   - Protocol fee (5%) deducted from amount via contract atomic split
 *   - No gas sponsorship or relayer in this implementation
 *
 * @param merchant - Merchant Stellar address (G... format)
 * @param amount   - Payment amount in stroops (1 USDC = 10_000_000)
 * @param proof    - Soroban-encoded Groth16 proof from generateZkProof()
 * @param config   - Optional Stellar/Soroban configuration overrides
 */
declare function payWithZkGroth16(merchant: string, amount: bigint, proof: PaymentProofOutput, config?: StellarConfig): Promise<unknown>;
/**
 * Fetches the current Merkle root from the backend API.
 *
 * This calls the Next.js API route (or equivalent backend endpoint),
 * not the Soroban contract directly. The URL is configurable via
 * StellarConfig.apiBaseUrl for non-Next.js environments.
 *
 * @param config - Optional configuration (apiBaseUrl for custom deployments)
 */
declare function getContractMerkleRoot(config?: StellarConfig): Promise<string>;
/**
 * Polls the Soroban RPC server until the transaction is finalised.
 *
 * Statuses:
 *   PENDING / NOT_FOUND → still processing, retry
 *   SUCCESS             → transaction confirmed ✓
 *   FAILED              → rejected by the VM ✗
 *
 * @param hash      - Transaction hash from sendTransaction()
 * @param server    - Soroban RPC server instance
 */
declare function pollTransaction(hash: string, server: rpc.Server, rpcUrl?: string): Promise<unknown>;

/**
 * payment.ts — High-level ZK payment orchestrator for the Fluppy browser SDK.
 *
 * Composes the following SDK modules into a single payment flow:
 * 1. Enroll commitment to whitelist
 * 2. Fetch Merkle membership proof from backend
 * 3. Compare frontend Merkle root against contract root
 * 4. Generate Groth16 ZK proof in the browser
 * 5. Verify proof locally before submission
 * 6. Submit execute_payment() transaction via Freighter
 *
 * Design constraints:
 * - Accepts an already-unlocked secret
 * - Does not decrypt credentials
 * - Does not import React, Next.js, Sentry, toast, or UI code
 * - Does not write telemetry or history
 * - Does not log secrets
 *
 * Fee model:
 * - User signs and pays via Freighter wallet
 * - User pays Stellar/Soroban network fee
 * - Protocol fee comes from payment amount via contract atomic split
 * - No relayer or gas sponsorship
 */

type FluppyPaymentStepName = 'enrollment:start' | 'enrollment:done' | 'merkle:request' | 'merkle:received' | 'root:sync_check' | 'proof:start' | 'proof:done' | 'proof:verify_local' | 'tx:submit' | 'tx:confirmed';
interface FluppyPaymentStep {
    readonly name: FluppyPaymentStepName;
    readonly elapsedMs?: number;
    readonly details?: Record<string, unknown>;
}
interface ExecuteFluppyPaymentInput {
    readonly secret: string;
    readonly merchant: string;
    readonly amount: bigint;
    readonly networkPassphrase: string;
    readonly stellarConfig: StellarConfig;
    readonly merkleOptions?: MerkleClientOptions;
    readonly signal?: AbortSignal;
    readonly onStep?: (step: FluppyPaymentStep) => void;
    readonly onProofProgress?: ProofProgressCallback;
}
interface ExecuteFluppyPaymentResult {
    readonly txHash: string;
    readonly proof: PaymentProofOutput;
    readonly merkleRoot: bigint;
    readonly txResult: unknown;
}
declare class RootSyncError extends Error {
    readonly frontendRootHex: string;
    readonly contractRootHex: string;
    constructor(frontendRootHex: string, contractRootHex: string);
}
declare function executeFluppyPayment(input: ExecuteFluppyPaymentInput): Promise<ExecuteFluppyPaymentResult>;

/**
 * @flupy/browser — Fluppy ZK Payment Protocol browser SDK.
 *
 * This package provides browser-side implementations for:
 * - Merkle proof client operations
 * - ZK circuit artifact loading
 * - Groth16 proof generation and local verification
 * - Browser credential management
 * - Stellar/Freighter wallet integration
 *
 * This package must not import React, Next.js, Sentry, or UI code.
 */

declare const FLUPPY_BROWSER_VERSION = "0.1.0";

export { type BrowserMerkleProof, type CircuitArtifactPaths, type CircuitArtifacts, type CreateCredentialResult, type EnrollCommitmentResult, type ExecuteFluppyPaymentInput, type ExecuteFluppyPaymentResult, FLUPPY_BROWSER_VERSION, type FluppyPaymentStep, type FluppyPaymentStepName, type GenerateZkProofInput, type LoadArtifactOptions, type MerkleClientOptions, type PaymentResult, type ProofProgressCallback, RootSyncError, type StellarConfig, clearCircuitArtifactCache, computeCommitment, createCredential, credentialExists, deleteCredential, enrollCommitment, executeFluppyPayment, generateSecret, generateZkProof, getContractMerkleRoot, getDefaultCircuitArtifactPaths, getMerkleProof, loadCircuitArtifacts, loadVerificationKey, payWithZkGroth16, pollTransaction, unlockCredential, validateCircuitArtifacts, verifyProofLocally };
