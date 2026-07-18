/**
 * @flupy/react — Fluppy ZK Payment Protocol React SDK.
 *
 * Implemented:
 *   - FluppyProvider         (SDK-1C-1)
 *   - useFluppyCredential    (SDK-1C-2)
 *   - useFluppyPayment       (SDK-1C-3)
 *   - useFluppyWallet        (SDK-1C-4)
 *   - useFluppyHistory       (SDK-1C-4)
 *
 * Requires React 18+ as a peer dependency.
 * Does NOT import Next.js, Sentry, toast libraries, or app-specific code.
 */

export type {
  MerkleProof,
  PaymentProofOutput,
} from '@flupy/core';

export {
  FluppyError,
  parseFluppyError,
} from '@flupy/core';

export type {
  ExecuteFluppyPaymentResult,
  FluppyPaymentStep,
  FluppyPaymentStepName,
  StellarConfig,
  MerkleClientOptions,
} from '@flupy/browser';

export { RootSyncError } from '@flupy/browser';

// Provider
export { FluppyProvider } from './provider';
export type { FluppyReactConfig } from './provider';

// Types
export type {
  FluppyReactProviderProps,
  FluppyReactContextValue,
  WalletConnectionStatus,
  CredentialStatus,
  PaymentStatus,
  FluppyPaymentRecord,
} from './types';

// useFluppyCredential (SDK-1C-2)
export { useFluppyCredential } from './useFluppyCredential';
export type { UseFluppyCredentialReturn } from './useFluppyCredential';

// useFluppyPayment (SDK-1C-3)
export { useFluppyPayment } from './useFluppyPayment';
export type {
  UseFluppyPaymentReturn,
  UseFluppyPaymentInput,
} from './useFluppyPayment';

// useFluppyWallet (SDK-1C-4)
export { useFluppyWallet } from './useFluppyWallet';
export type { UseFluppyWalletReturn } from './useFluppyWallet';

// useFluppyHistory (SDK-1C-4)
export { useFluppyHistory } from './useFluppyHistory';
export type { UseFluppyHistoryReturn } from './useFluppyHistory';

export const FLUPPY_REACT_VERSION = '0.1.0';
