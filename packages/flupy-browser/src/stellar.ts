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

import {
  rpc,
  Networks,
  Contract,
  TransactionBuilder,
  Account,
  xdr,
  Keypair,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { N_PUBLIC } from '@flupy/core';
import type { PaymentProofOutput } from '@flupy/core';

// ─── Constants ────────────────────────────────────────────────────────────────

/** G1 affine point: x_be32 ‖ y_be32 = 64 bytes (pi_a and pi_c). */
const G1_BYTE_LENGTH = 64;

/**
 * G2 affine point: x_c1_be32 ‖ x_c0_be32 ‖ y_c1_be32 ‖ y_c0_be32 = 128 bytes (pi_b).
 * SnarkJS Fq2 ordering (imaginary before real) is preserved by encodeG2() in prover.ts.
 * Consistent with EIP-197 and Soroban bn254_pairing_check.
 */
const G2_BYTE_LENGTH = 128;

/** BN254 scalar field element: 32 bytes big-endian (one public signal). */
const FIELD_BYTE_LENGTH = 32;

/** Default Soroban Testnet RPC endpoint. */
const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org:443';

/** Default network passphrase for Testnet. */
const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;

/** Transaction base fee in stroops. */
const BASE_FEE = '100000';

/** Transaction timeout in seconds — must exceed proof generation time. */
const TX_TIMEOUT_SECONDS = 300;

/** Maximum polling attempts before timeout (~60 seconds at 2s interval). */
const MAX_POLL_ATTEMPTS = 30;

/** Polling interval between status checks in milliseconds. */
const POLL_INTERVAL_MS = 2000;

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Configuration for Stellar/Soroban contract interaction.
 * All fields are optional — defaults are used when omitted.
 */
export interface StellarConfig {
  /** Soroban RPC endpoint URL. */
  readonly rpcUrl?:            string;
  /** Stellar network passphrase. */
  readonly networkPassphrase?: string;
  /** Deployed Fluppy contract ID. */
  readonly contractId?:        string;
  /**
   * Base URL for internal API endpoints (e.g. the Merkle root route).
   * Defaults to '' (relative URLs) for Next.js app consumers.
   */
  readonly apiBaseUrl?:        string;
}

/** Result returned by payWithZkGroth16. */
export interface PaymentResult {
  /** Stellar transaction hash of the confirmed payment. */
  readonly txHash:  string;
  /** Final Soroban transaction status (SUCCESS, FAILED, etc.) */
  readonly status:  string;
  /** Raw transaction status response from the RPC server. */
  readonly rawStatus: unknown;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveConfig(config?: StellarConfig): Required<StellarConfig> {
  return {
    rpcUrl:            config?.rpcUrl            ?? DEFAULT_RPC_URL,
    networkPassphrase: config?.networkPassphrase  ?? DEFAULT_NETWORK_PASSPHRASE,
    contractId:        config?.contractId         ?? '',
    apiBaseUrl:        config?.apiBaseUrl          ?? '',
  };
}

/**
 * Validates that a required contractId is present.
 * Throws with a clear message rather than an opaque RPC error.
 */
function requireContractId(contractId: string): string {
  if (!contractId) {
    throw new Error(
      '[stellar] Contract ID is required. ' +
      'Pass it via StellarConfig.contractId or set NEXT_PUBLIC_CONTRACT_ID.'
    );
  }
  return contractId;
}

/**
 * Converts a hex string to a Soroban scvBytes ScVal.
 * Validates byte length when expectedBytes is provided.
 */
function hexToScBytes(hexStr: string, expectedBytes?: number): xdr.ScVal {
  if (hexStr.length % 2 !== 0) {
    throw new Error(
      `[stellar] hexToScBytes: odd-length hex string (${hexStr.length} chars). ` +
      `Verify that encodeG1/encodeG2 in prover.ts produces well-formed hex.`
    );
  }

  const actualBytes = hexStr.length / 2;

  if (expectedBytes !== undefined && actualBytes !== expectedBytes) {
    throw new Error(
      `[stellar] Byte length mismatch: ` +
      `expected ${expectedBytes} bytes, received ${actualBytes} bytes ` +
      `(${hexStr.length} hex chars).`
    );
  }

  return xdr.ScVal.scvBytes(Buffer.from(hexStr, 'hex'));
}

/**
 * Validates the full Groth16 proof structure before serialisation.
 * Fails fast with a descriptive message rather than an opaque Soroban VM error.
 */
function validateGroth16Proof(proof: PaymentProofOutput): void {
  const errors: string[] = [];

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
    throw new Error(`[stellar] Proof validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Resolves the transaction sender address.
 *
 * Browser: via Freighter wallet extension (dynamic import to avoid SSR issues)
 * Node.js: via SENDER_SECRET environment variable (for test scripts)
 */
export async function resolveSender(): Promise<{ address: string; isBrowser: boolean }> {
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    const { isConnected, requestAccess } = await import('@stellar/freighter-api');

    const connected = await isConnected();
    if (!connected.isConnected) {
      throw new Error(
        '[stellar] Freighter wallet not found. ' +
        'Install the Freighter extension from freighter.app'
      );
    }

    const { address, error } = await requestAccess();
    if (error) throw new Error(`[stellar] Freighter access denied: ${error}`);
    if (!address) throw new Error('[stellar] Freighter returned no address.');

    return { address, isBrowser: true };
  }

  // Node.js mode — for automated testing / scripting only
  const secret = process.env['SENDER_SECRET'];
  if (!secret) {
    throw new Error('[stellar] SENDER_SECRET is missing from .env (required in Node.js mode)');
  }
  return {
    address:   Keypair.fromSecret(secret).publicKey(),
    isBrowser: false,
  };
}

/**
 * Signs the prepared transaction via Freighter (browser) or Keypair (Node.js),
 * then submits it to the Soroban RPC server.
 *
 * The `preparedTx` parameter type is `unknown` here because the Stellar SDK
 * returns different types depending on the call path, and the intersection
 * type is not easily expressible without `any`. We narrow it at usage points.
 */
async function signAndSubmit(
  preparedTx:        unknown,
  isBrowser:         boolean,
  networkPassphrase: string,
  rpcServer:         rpc.Server,
  rpcUrl:            string,
): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = preparedTx as any;
  let signedTx: unknown;

  if (isBrowser) {
    const { signTransaction } = await import('@stellar/freighter-api');
    console.log('[stellar] Awaiting Freighter signature...');

    const signResult = await signTransaction(tx.toXDR(), { networkPassphrase });

    if (signResult.error) {
      throw new Error(`[stellar] Freighter rejected signing: ${signResult.error}`);
    }

    signedTx = TransactionBuilder.fromXDR(signResult.signedTxXdr, networkPassphrase);
  } else {
    const secret = process.env['SENDER_SECRET'];
    if (!secret) throw new Error('[stellar] SENDER_SECRET required for Node.js signing');
    const sourceKeypair = Keypair.fromSecret(secret);
    tx.sign(sourceKeypair);
    signedTx = tx;
  }

  console.log('[stellar] Submitting transaction to the network...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submission = await rpcServer.sendTransaction(signedTx as any);

  if (submission.status === 'ERROR') {
    throw new Error(
      `[stellar] RPC submission failed: ` +
      `${JSON.stringify(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (submission as any).errorResult ?? submission
      )}`
    );
  }

  return await pollTransaction(submission.hash, rpcServer, rpcUrl);
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fetchTransactionStatusRaw(
  rpcUrl: string,
  hash: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `fluppy-${Date.now()}`,
      method: 'getTransaction',
      params: {
        hash,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `[stellar] Raw getTransaction request failed: HTTP ${response.status}`,
    );
  }

  const json: unknown = await response.json();

  if (!isRecord(json)) {
    throw new Error('[stellar] Invalid raw getTransaction response.');
  }

  if (json['error']) {
    throw new Error(
      `[stellar] Raw getTransaction RPC error: ${JSON.stringify(json['error'])}`,
    );
  }

  const result = json['result'];

  if (!isRecord(result)) {
    throw new Error('[stellar] Raw getTransaction response missing result.');
  }

  return result;
}

function readTransactionStatus(
  txStatus: unknown,
): string {
  if (!isRecord(txStatus)) {
    throw new Error('[stellar] Invalid transaction status response.');
  }

  const status = txStatus['status'];

  if (typeof status !== 'string') {
    throw new Error('[stellar] Transaction status response missing status.');
  }

  return status;
}

// ─── Public API ───────────────────────────────────────────────────────────────

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
export async function payWithZkGroth16(
  merchant: string,
  amount:   bigint,
  proof:    PaymentProofOutput,
  config?:  StellarConfig,
  resolvedSender?: { address: string; isBrowser: boolean },
): Promise<unknown> {
  const resolved         = resolveConfig(config);
  const contractId       = requireContractId(resolved.contractId);
  const networkPassphrase = resolved.networkPassphrase;
  const rpcServer        = new rpc.Server(resolved.rpcUrl);

  console.log('[stellar] payWithZkGroth16 — Contract:', contractId.slice(0, 8) + '...');

  // ── Pre-flight validation ──────────────────────────────────────────────────
  validateGroth16Proof(proof);

  const { address: senderAddress, isBrowser } = resolvedSender ?? await resolveSender();
  const accountResponse = await rpcServer.getAccount(senderAddress);

  // ── Proof serialisation to ScVal ──────────────────────────────────────────
  //
  // Argument ordering matches the Rust contract exactly — DO NOT reorder.
  // pi_b uses EIP-197 Fq2 ordering (imaginary before real), preserved by encodeG2().

  const piAScVal = hexToScBytes(proof.pi_a, G1_BYTE_LENGTH);
  const piBScVal = hexToScBytes(proof.pi_b, G2_BYTE_LENGTH);
  const piCScVal = hexToScBytes(proof.pi_c, G1_BYTE_LENGTH);

  const publicInputsScVal = xdr.ScVal.scvVec(
    proof.publicSignals.map(sig => hexToScBytes(sig, FIELD_BYTE_LENGTH))
  );

  // ── Build transaction ──────────────────────────────────────────────────────
  const contractArgs = [
    nativeToScVal(senderAddress, { type: 'address' }), // 1. from
    nativeToScVal(merchant, { type: 'address' }),       // 2. to
    nativeToScVal(amount, { type: 'i128' }),            // 3. amount (stroops)
    piAScVal,                                           // 4. pi_a
    piBScVal,                                           // 5. pi_b
    piCScVal,                                           // 6. pi_c
    publicInputsScVal,                                  // 7. public_inputs
  ];

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(
    new Account(senderAddress, accountResponse.sequenceNumber()),
    { fee: BASE_FEE, networkPassphrase },
  )
    .addOperation(contract.call('execute_payment', ...contractArgs))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  // ── Simulate & submit ──────────────────────────────────────────────────────
  console.log('[stellar] Simulating transaction...');
  const preparedTx = await rpcServer.prepareTransaction(tx);

  return await signAndSubmit(
    preparedTx,
    isBrowser,
    networkPassphrase,
    rpcServer,
    resolved.rpcUrl,
  );
}

/**
 * Fetches the current Merkle root from the backend API.
 *
 * This calls the Next.js API route (or equivalent backend endpoint),
 * not the Soroban contract directly. The URL is configurable via
 * StellarConfig.apiBaseUrl for non-Next.js environments.
 *
 * @param config - Optional configuration (apiBaseUrl for custom deployments)
 */
export async function getContractMerkleRoot(config?: StellarConfig): Promise<string> {
  const baseUrl = config?.apiBaseUrl ?? '';
  const response = await fetch(`${baseUrl}/api/merkle-root`, { method: 'GET' });

  if (!response.ok) {
    throw new Error('[stellar] Failed to fetch contract Merkle root from /api/merkle-root');
  }

  const data = await response.json() as Record<string, unknown>;

  if (!data['root']) {
    throw new Error('[stellar] Invalid merkle root response: missing root field');
  }

  return String(data['root']);
}

/**
 * Checks whether `rootHex` is any of the contract's last 30 anchored
 * Merkle roots (root history ring buffer), not just the single latest
 * one. This is the correct check for payment eligibility -- a proof
 * generated a few minutes ago against a root that's since been
 * superseded by the automated sync job is still valid on-chain.
 *
 * getContractMerkleRoot() (above) still exists for callers that
 * specifically want "the current latest root" (e.g. the sync job's own
 * idempotency check), but executeFluppyPayment() uses this instead.
 */
export async function checkRootIsKnown(
  rootHex: string,
  config?: StellarConfig,
): Promise<boolean> {
  const baseUrl = config?.apiBaseUrl ?? '';
  const response = await fetch(
    `${baseUrl}/api/merkle-root?root=${encodeURIComponent(rootHex)}`,
    { method: 'GET' },
  );

  if (!response.ok) {
    throw new Error('[stellar] Failed to check root against /api/merkle-root');
  }

  const data = await response.json() as Record<string, unknown>;

  return Boolean(data['isKnown']);
}

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
export async function pollTransaction(
  hash: string,
  server: rpc.Server,
  rpcUrl?: string,
): Promise<unknown> {
  let status = 'PENDING';
  let txStatus: unknown;
  let attempts = 0;

  console.log(`[stellar] Polling transaction: ${hash.slice(0, 10)}...`);

  while (status === 'PENDING' || status === 'NOT_FOUND') {
    if (attempts >= MAX_POLL_ATTEMPTS) {
      throw new Error(
        `[stellar] Transaction timed out after ${MAX_POLL_ATTEMPTS} attempts. ` +
        `Hash: ${hash}`,
      );
    }

    txStatus = rpcUrl
      ? await fetchTransactionStatusRaw(rpcUrl, hash)
      : await server.getTransaction(hash);

    status = readTransactionStatus(txStatus);
    attempts++;

    if (status === 'SUCCESS') {
      console.log(`[stellar] ✓ Transaction confirmed (attempt ${attempts})`);
      return txStatus;
    }

    if (status === 'FAILED') {
      const resultXdr = isRecord(txStatus)
        ? txStatus['resultXdr'] ?? txStatus['result_xdr']
        : undefined;

      console.error('[stellar] Transaction rejected. Result XDR:', resultXdr);

      throw new Error(
        'Transaction rejected by the Soroban VM. ' +
        'Possible causes: invalid proof, nullifier already spent, ' +
        'or merkle root mismatch.',
      );
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return txStatus;
}
