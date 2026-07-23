/**
 * @fluppy/browser — Fluppy ZK Payment Protocol browser SDK.
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

export * from '@fluppy/core';

export {
  computeCommitment,
  enrollCommitment,
  getMerkleProof,
} from './merkle-client';

export type {
  BrowserMerkleProof,
  EnrollCommitmentResult,
  MerkleClientOptions,
} from './merkle-client';

export {
  clearCircuitArtifactCache,
  getDefaultCircuitArtifactPaths,
  loadCircuitArtifacts,
  loadVerificationKey,
  validateCircuitArtifacts,
} from './artifacts';

export type {
  CircuitArtifacts,
  CircuitArtifactPaths,
  LoadArtifactOptions,
} from './artifacts';

export {
  generateZkProof,
  verifyProofLocally,
} from './prover';

export type {
  GenerateZkProofInput,
  ProofProgressCallback,
} from './prover';


export {
  credentialExists,
  createCredential,
  deleteCredential,
  generateSecret,
  unlockCredential,
} from './identity';

export type {
  CreateCredentialResult,
} from './identity';


// Stellar/Freighter payment submission (SDK-1B-6)
export {
  getContractMerkleRoot,
  resolveSender,
  payWithZkGroth16,
  pollTransaction,
} from './stellar';

export type {
  PaymentResult,
  StellarConfig,
} from './stellar';


// Payment orchestrator (SDK-1B-7)
export {
  executeFluppyPayment,
  RootSyncError,
} from './payment';

export type {
  ExecuteFluppyPaymentInput,
  ExecuteFluppyPaymentResult,
  FluppyPaymentStep,
  FluppyPaymentStepName,
} from './payment';

export const FLUPPY_BROWSER_VERSION = '0.1.0';
