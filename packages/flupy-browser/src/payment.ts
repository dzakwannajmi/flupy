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

import {
  type MerkleProof,
  type PaymentProofOutput,
} from '@flupy/core';

import {
  enrollCommitment,
  getMerkleProof as fetchMerkleProof,
  type MerkleClientOptions,
} from './merkle-client';

import {
  generateZkProof,
  verifyProofLocally,
  type GenerateZkProofInput,
  type ProofProgressCallback,
} from './prover';

import {
  getContractMerkleRoot,
  payWithZkGroth16,
  type StellarConfig,
} from './stellar';

export type FluppyPaymentStepName =
  | 'enrollment:start'
  | 'enrollment:done'
  | 'merkle:request'
  | 'merkle:received'
  | 'root:sync_check'
  | 'proof:start'
  | 'proof:done'
  | 'proof:verify_local'
  | 'tx:submit'
  | 'tx:confirmed';

export interface FluppyPaymentStep {
  readonly name: FluppyPaymentStepName;
  readonly elapsedMs?: number;
  readonly details?: Record<string, unknown>;
}

export interface ExecuteFluppyPaymentInput {
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

export interface ExecuteFluppyPaymentResult {
  readonly txHash: string;
  readonly proof: PaymentProofOutput;
  readonly merkleRoot: bigint;
  readonly txResult: unknown;
}

export class RootSyncError extends Error {
  readonly frontendRootHex: string;
  readonly contractRootHex: string;

  constructor(
    frontendRootHex: string,
    contractRootHex: string,
  ) {
    super('Contract Merkle root is out of sync with frontend tree.');
    this.name = 'RootSyncError';
    this.frontendRootHex = frontendRootHex;
    this.contractRootHex = contractRootHex;
  }
}

function validateSecret(secret: string): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      '[payment] Invalid secret format: must be 64-char hex string.',
    );
  }
}

function validateMerchant(merchant: string): void {
  if (!merchant || !merchant.startsWith('G') || merchant.length !== 56) {
    throw new Error(
      `[payment] Invalid merchant address: ${merchant.slice(0, 10)}... ` +
      'Stellar addresses start with G and are 56 characters.',
    );
  }
}

function emitStep(
  onStep: ((step: FluppyPaymentStep) => void) | undefined,
  name: FluppyPaymentStepName,
  startMs: number,
  details?: Record<string, unknown>,
): void {
  if (!onStep) {
    return;
  }

  const step: FluppyPaymentStep = {
    name,
    elapsedMs: Date.now() - startMs,
    ...(details ? { details } : {}),
  };

  onStep(step);
}

function normalizeTxHash(txResult: unknown): string {
  if (typeof txResult !== 'object' || txResult === null) {
    return '';
  }

  const record = txResult as Record<string, unknown>;

  const candidate =
    record['txHash'] ??
    record['hash'] ??
    record['id'];

  return typeof candidate === 'string' ? candidate : '';
}

function buildProofInput(
  input: ExecuteFluppyPaymentInput,
  merkleProof: MerkleProof,
): GenerateZkProofInput {
  return {
    secret: input.secret,
    merkleProof,
    recipient: input.merchant,
    amount: input.amount,
    networkPassphrase: input.networkPassphrase,
    ...(input.onProofProgress
      ? { onProgress: input.onProofProgress }
      : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  };
}

export async function executeFluppyPayment(
  input: ExecuteFluppyPaymentInput,
): Promise<ExecuteFluppyPaymentResult> {
  const {
    secret,
    merchant,
    amount,
    stellarConfig,
    merkleOptions,
    onStep,
  } = input;

  const startMs = Date.now();

  validateSecret(secret);
  validateMerchant(merchant);

  if (amount <= 0n) {
    throw new Error(
      `[payment] Amount must be positive, received: ${amount}`,
    );
  }

  emitStep(onStep, 'enrollment:start', startMs);

  await enrollCommitment(secret, merkleOptions);

  emitStep(onStep, 'enrollment:done', startMs);

  emitStep(onStep, 'merkle:request', startMs);

  const merkleProof = await fetchMerkleProof(
    secret,
    merkleOptions,
  );

  emitStep(onStep, 'merkle:received', startMs, {
    root: merkleProof.root.toString().slice(0, 12),
  });

  emitStep(onStep, 'root:sync_check', startMs);

  const contractRoot = await getContractMerkleRoot(
    stellarConfig,
  );

  const frontendRootHex = merkleProof.root
    .toString(16)
    .padStart(64, '0')
    .toLowerCase();

  const contractRootHex = contractRoot.toLowerCase();

  if (contractRootHex !== frontendRootHex) {
    throw new RootSyncError(
      frontendRootHex,
      contractRootHex,
    );
  }

  emitStep(onStep, 'proof:start', startMs);

  const proofInput = buildProofInput(input, merkleProof);
  const zkProof = await generateZkProof(proofInput);

  emitStep(onStep, 'proof:done', startMs);

  if (
    typeof process !== 'undefined' &&
    process.env?.['NODE_ENV'] === 'development'
  ) {
    emitStep(onStep, 'proof:verify_local', startMs);

    const isValid = await verifyProofLocally(zkProof);

    if (!isValid) {
      throw new Error(
        '[payment] Local proof verification FAILED. Do not submit.',
      );
    }
  }

  emitStep(onStep, 'tx:submit', startMs);

  const txResult = await payWithZkGroth16(
    merchant,
    amount,
    zkProof,
    stellarConfig,
  );

  const txHash = normalizeTxHash(txResult);

  emitStep(onStep, 'tx:confirmed', startMs, {
    txHash,
  });

  return {
    txHash,
    proof: zkProof,
    merkleRoot: merkleProof.root,
    txResult,
  };
}
