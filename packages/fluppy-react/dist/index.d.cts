export { FluppyError, MerkleProof, PaymentProofOutput, parseFluppyError } from '@fluppy/core';
import { StellarConfig, MerkleClientOptions, FluppyPaymentStepName, ExecuteFluppyPaymentResult } from '@fluppy/browser';
export { ExecuteFluppyPaymentResult, FluppyPaymentStep, FluppyPaymentStepName, MerkleClientOptions, RootSyncError, StellarConfig } from '@fluppy/browser';
import React, { ReactNode } from 'react';

/**
 * types.ts — Shared types for @fluppy/react.
 */

interface FluppyReactConfig {
    readonly stellarConfig: StellarConfig;
    readonly merkleOptions?: MerkleClientOptions;
    readonly networkPassphrase: string;
}
interface FluppyReactProviderProps {
    readonly config: FluppyReactConfig;
    readonly children: ReactNode;
}
interface FluppyReactContextValue {
    readonly config: FluppyReactConfig;
}
type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type CredentialStatus = 'unknown' | 'exists' | 'not_found';
type PaymentStatus = 'idle' | 'pending' | 'success' | 'failed';
/**
 * A single payment event stored in useFluppyHistory.
 *
 * Note: amount is bigint in the public API.
 * Serialization to/from localStorage is handled internally by useFluppyHistory.
 */
interface FluppyPaymentRecord {
    readonly txHash: string;
    readonly amount: bigint;
    readonly merchant: string;
    readonly timestamp: number;
    readonly status: 'pending' | 'success' | 'failed';
    readonly explorerUrl?: string;
}

/**
 * provider.tsx — FluppyProvider React context provider.
 *
 * Wraps the app (or a subtree) with Fluppy configuration so all
 * child hooks can access stellarConfig, networkPassphrase, etc.
 * without prop drilling.
 *
 * Usage:
 *   <FluppyProvider config={{ stellarConfig, networkPassphrase }}>
 *     <App />
 *   </FluppyProvider>
 *
 * This module is safe to server-render — it holds no browser-only
 * state at the provider level. Browser-only logic is inside the hooks.
 */

/**
 * FluppyProvider
 *
 * Provides Fluppy configuration to all child hooks.
 * Place this near the root of your application.
 *
 * @param config   - Fluppy SDK configuration (stellarConfig, networkPassphrase)
 * @param children - React subtree that can consume Fluppy hooks
 */
declare function FluppyProvider({ config, children, }: FluppyReactProviderProps): React.ReactElement;

/**
 * useFluppyCredential.ts — React hook for ZK credential lifecycle management.
 *
 * Wraps @fluppy/browser identity functions:
 *   credentialExists(), createCredential(), unlockCredential(), deleteCredential()
 *
 * Design properties:
 *   - SSR-safe: no IndexedDB calls during render — only in effects and callbacks
 *   - No password or secret logging at any point
 *   - Caller is responsible for UI feedback (toast, error display)
 *     — this hook only manages state and delegates to @fluppy/browser
 *   - All async callbacks throw after setting error state
 *     so callers can handle UI feedback externally
 *   - Mounted guard prevents state updates after component unmounts
 */

interface UseFluppyCredentialReturn {
    /**
     * Lifecycle status of the credential.
     *   'unknown'   → initial state before first check completes
     *   'exists'    → encrypted credential found in IndexedDB
     *   'not_found' → no credential stored
     */
    readonly status: CredentialStatus;
    /** True while any async credential operation is in progress. */
    readonly isLoading: boolean;
    /** Last error thrown by an operation, or null if no error. */
    readonly error: Error | null;
    /**
     * True if credential exists, false if not.
     * Null while status is 'unknown' (initial load).
     */
    readonly exists: boolean | null;
    /**
     * Creates and stores a new credential encrypted with the given password.
     * Returns the raw secret ONCE — the caller must display it to the user as backup.
     * The secret is never logged inside this hook.
     *
     * @throws If password is too short or encryption fails
     */
    readonly create: (password: string) => Promise<{
        secret: string;
    }>;
    /**
     * Decrypts and returns the stored secret.
     * The secret is returned as a string but never logged by this hook.
     *
     * @throws If password is wrong or no credential exists
     */
    readonly unlock: (password: string) => Promise<string>;
    /**
     * Permanently deletes the stored credential from IndexedDB.
     * Ensure the user has saved their backup secret before calling.
     */
    readonly remove: () => Promise<void>;
    /**
     * Re-checks IndexedDB and updates status/exists state.
     * Call this after external credential changes.
     */
    readonly refresh: () => Promise<void>;
    /** Clears the current error without triggering any async operation. */
    readonly resetError: () => void;
}
/**
 * useFluppyCredential
 *
 * Manages the full lifecycle of a Fluppy ZK credential:
 *   check existence → create → unlock → delete
 *
 * @example
 *   const { status, exists, create, unlock, error } = useFluppyCredential();
 *
 *   if (status === 'not_found') {
 *     const { secret } = await create('my-password');
 *     displayBackupSecret(secret); // show ONCE to user
 *   }
 *
 *   const secret = await unlock('my-password');
 *   // pass secret to payment flow
 */
declare function useFluppyCredential(): UseFluppyCredentialReturn;

/**
 * useFluppyPayment.ts — React hook for the Fluppy ZK payment flow.
 *
 * Composes @fluppy/browser executeFluppyPayment() with React state management.
 *
 * Design properties:
 *   - Reads config from FluppyProvider via useFluppyContext() — no prop drilling
 *   - Caller passes an already-unlocked secret; this hook does NOT decrypt credentials
 *   - Secret is NEVER stored in React state — only passed through to executeFluppyPayment
 *   - SSR-safe: pay() throws a clear error if called outside a browser environment
 *   - Mounted guard: state updates are suppressed after component unmount
 *   - Active payment is aborted on unmount to prevent resource leaks
 *   - Caller is fully responsible for UI feedback (toast, error display, telemetry)
 *
 * Security:
 *   - Secret is not stored in state
 *   - Secret is not logged
 *   - Password is never received by this hook
 *   - Raw proof is not logged
 */

/** Input to pay() — caller provides an already-unlocked secret. */
interface UseFluppyPaymentInput {
    /**
     * Raw 64-char hex secret from useFluppyCredential.unlock().
     * NOT stored in React state. NOT logged.
     */
    readonly secret: string;
    /** Merchant Stellar address (G... format). */
    readonly merchant: string;
    /** Payment amount in stroops (1 USDC = 10_000_000). */
    readonly amount: bigint;
    /**
     * Optional AbortSignal from an external AbortController.
     * If not provided, the hook manages its own internal AbortController.
     */
    readonly signal?: AbortSignal;
}
/** Full return type of useFluppyPayment(). */
interface UseFluppyPaymentReturn {
    /** Current payment lifecycle status. */
    readonly status: PaymentStatus;
    /** True while proof generation or transaction submission is in progress. */
    readonly isLoading: boolean;
    /** Last error thrown during pay(), or null if no error. */
    readonly error: Error | null;
    /** Transaction hash after a successful payment, or null. */
    readonly txHash: string | null;
    /**
     * Current proof generation stage label (e.g. "Computing witness").
     * Null when not in proof generation phase.
     */
    readonly progressStage: string | null;
    /** Proof generation progress percentage (0–100). Null when not in progress. */
    readonly progressPct: number | null;
    /**
     * Current named step from the payment orchestrator
     * (e.g. 'merkle:request', 'proof:start', 'tx:submit').
     * Null when idle or complete.
     */
    readonly currentStep: FluppyPaymentStepName | null;
    /**
     * Initiates a ZK payment.
     * Returns the full payment result on success.
     * Throws on failure — caller is responsible for handling the error (toast, UI, etc.)
     */
    readonly pay: (input: UseFluppyPaymentInput) => Promise<ExecuteFluppyPaymentResult>;
    /**
     * Aborts any active payment and resets all state to idle.
     * Safe to call even when no payment is in progress.
     */
    readonly reset: () => void;
    /**
     * Clears the current error without changing status or other state.
     * Use this to dismiss an error message while keeping txHash/status visible.
     */
    readonly resetError: () => void;
    /**
     * Aborts the active payment (if any) and resets status to 'idle'.
     * Distinct from reset() in that it sets status to 'idle' rather than
     * resetting all state — preserving txHash from a prior successful payment.
     */
    readonly abort: () => void;
}
/**
 * useFluppyPayment
 *
 * Manages the full ZK payment lifecycle.
 * Reads Fluppy configuration from the nearest FluppyProvider.
 *
 * @example
 *   const cred = useFluppyCredential();
 *   const payment = useFluppyPayment();
 *
 *   async function handlePay(password: string) {
 *     const secret = await cred.unlock(password);
 *     const result = await payment.pay({
 *       secret,
 *       merchant: 'GDLST72T...',
 *       amount: 10_000_000n, // 1 USDC
 *     });
 *     console.log('tx:', result.txHash);
 *   }
 */
declare function useFluppyPayment(): UseFluppyPaymentReturn;

/**
 * useFluppyWallet.ts — React hook for Freighter wallet connection state.
 *
 * Wraps @stellar/freighter-api with React state management.
 *
 * Design properties:
 *   - SSR-safe: no Freighter API calls during render
 *   - connect() throws a clear error if called outside a browser
 *   - refresh() silently no-ops on SSR rather than throwing
 *   - Mounted guard prevents setState after unmount
 *   - Caller is responsible for all UI feedback (toast, error display)
 *
 * No secrets, passwords, or ZK proof logic are involved in this hook.
 */

interface UseFluppyWalletReturn {
    /** Current Stellar wallet address, or null if not connected. */
    readonly address: string | null;
    /** Lifecycle status of the wallet connection. */
    readonly connectionStatus: WalletConnectionStatus;
    /** Last error from connect() or refresh(), or null. */
    readonly error: Error | null;
    /** True when connectionStatus === 'connected'. */
    readonly isConnected: boolean;
    /** True when connectionStatus === 'connecting'. */
    readonly isConnecting: boolean;
    /**
     * Requests Freighter wallet access and returns the connected address.
     * @throws If called outside a browser, or if Freighter is not installed/rejects
     */
    readonly connect: () => Promise<string>;
    /**
     * Re-checks Freighter connection status and updates state.
     * SSR-safe — silently no-ops if window is undefined.
     */
    readonly refresh: () => Promise<void>;
    /** Clears the current error without triggering any async operation. */
    readonly resetError: () => void;
}
/**
 * useFluppyWallet
 *
 * Manages Freighter wallet connection state for Fluppy payment flows.
 *
 * @example
 *   const { address, isConnected, connect, error } = useFluppyWallet();
 *
 *   if (!isConnected) {
 *     await connect(); // caller shows Freighter popup
 *   }
 */
declare function useFluppyWallet(): UseFluppyWalletReturn;

/**
 * useFluppyHistory.ts — React hook for local ZK payment history.
 *
 * Persists payment records to localStorage using a generic key.
 * Exposes a simple CRUD interface — no payment execution logic.
 *
 * Design properties:
 *   - SSR-safe: no localStorage access during render
 *   - bigint serialized as string internally for JSON compatibility
 *   - Maximum 50 records to prevent unbounded localStorage growth
 *   - Parse failures fail safe to [] rather than crashing
 *   - Caller decides how to handle UI (display, toast, etc.)
 *
 * No secrets, passwords, wallet connection, or ZK proof logic here.
 */

interface UseFluppyHistoryReturn {
    /** All stored payment records, newest first. */
    readonly records: readonly FluppyPaymentRecord[];
    /**
     * Adds a new record (or replaces existing by txHash).
     * Persists to localStorage.
     */
    readonly add: (record: FluppyPaymentRecord) => void;
    /**
     * Updates fields of an existing record by txHash.
     * Persists to localStorage.
     */
    readonly update: (txHash: string, patch: Partial<Omit<FluppyPaymentRecord, 'txHash'>>) => void;
    /**
     * Removes a record by txHash.
     * Persists to localStorage.
     */
    readonly remove: (txHash: string) => void;
    /** Clears all records from state and localStorage. */
    readonly clear: () => void;
    /** Reloads records from localStorage. */
    readonly refresh: () => void;
}
/**
 * useFluppyHistory
 *
 * Manages a local, persisted list of Fluppy payment records.
 *
 * @example
 *   const history = useFluppyHistory();
 *
 *   // After successful payment:
 *   history.add({
 *     txHash:      result.txHash,
 *     amount:      10_000_000n,
 *     merchant:    merchantAddress,
 *     timestamp:   Date.now(),
 *     status:      'success',
 *     explorerUrl: `https://stellar.expert/explorer/testnet/tx/${result.txHash}`,
 *   });
 */
declare function useFluppyHistory(): UseFluppyHistoryReturn;

/**
 * @fluppy/react — Fluppy ZK Payment Protocol React SDK.
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

declare const FLUPPY_REACT_VERSION = "0.1.0";

export { type CredentialStatus, FLUPPY_REACT_VERSION, type FluppyPaymentRecord, FluppyProvider, type FluppyReactConfig, type FluppyReactContextValue, type FluppyReactProviderProps, type PaymentStatus, type UseFluppyCredentialReturn, type UseFluppyHistoryReturn, type UseFluppyPaymentInput, type UseFluppyPaymentReturn, type UseFluppyWalletReturn, type WalletConnectionStatus, useFluppyCredential, useFluppyHistory, useFluppyPayment, useFluppyWallet };
