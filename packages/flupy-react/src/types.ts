/**
 * types.ts — Shared types for @flupy/react.
 */

import type { ReactNode } from 'react';
import type {
  StellarConfig,
  MerkleClientOptions,
} from '@flupy/browser';

// ─── Provider config ──────────────────────────────────────────────────────────

export interface FluppyReactConfig {
  readonly stellarConfig: StellarConfig;
  readonly merkleOptions?: MerkleClientOptions;
  readonly networkPassphrase: string;
}

export interface FluppyReactProviderProps {
  readonly config: FluppyReactConfig;
  readonly children: ReactNode;
}

export interface FluppyReactContextValue {
  readonly config: FluppyReactConfig;
}

// ─── Wallet status ────────────────────────────────────────────────────────────

export type WalletConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

// ─── Credential status ────────────────────────────────────────────────────────

export type CredentialStatus =
  | 'unknown'
  | 'exists'
  | 'not_found';

// ─── Payment status ───────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failed';

// ─── Payment record ───────────────────────────────────────────────────────────

/**
 * A single payment event stored in useFluppyHistory.
 *
 * Note: amount is bigint in the public API.
 * Serialization to/from localStorage is handled internally by useFluppyHistory.
 */
export interface FluppyPaymentRecord {
  readonly txHash: string;
  readonly amount: bigint;
  readonly merchant: string;
  readonly timestamp: number;
  readonly status: 'pending' | 'success' | 'failed';
  readonly explorerUrl?: string;
}
