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

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

import type { WalletConnectionStatus } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UseFluppyWalletReturn {
  /** Current Stellar wallet address, or null if not connected. */
  readonly address:          string | null;
  /** Lifecycle status of the wallet connection. */
  readonly connectionStatus: WalletConnectionStatus;
  /** Last error from connect() or refresh(), or null. */
  readonly error:            Error | null;
  /** True when connectionStatus === 'connected'. */
  readonly isConnected:      boolean;
  /** True when connectionStatus === 'connecting'. */
  readonly isConnecting:     boolean;
  /**
   * Requests Freighter wallet access and returns the connected address.
   * @throws If called outside a browser, or if Freighter is not installed/rejects
   */
  readonly connect:          () => Promise<string>;
  /**
   * Re-checks Freighter connection status and updates state.
   * SSR-safe — silently no-ops if window is undefined.
   */
  readonly refresh:          () => Promise<void>;
  /** Clears the current error without triggering any async operation. */
  readonly resetError:       () => void;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
export function useFluppyWallet(): UseFluppyWalletReturn {
  const [address, setAddress] =
    useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState<WalletConnectionStatus>('disconnected');

  const [error, setError] =
    useState<Error | null>(null);

  const mountedRef = useRef(true);

  // ── Mounted guard setup ─────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────────

  const isConnected  = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  // ── resetError ──────────────────────────────────────────────────────────────

  const resetError = useCallback((): void => {
    if (mountedRef.current) setError(null);
  }, []);

  // ── refresh ─────────────────────────────────────────────────────────────────

  /**
   * Checks whether Freighter is currently connected.
   * Uses dynamic import to avoid bundling Freighter in SSR contexts.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      const { isConnected: checkConnected } =
        await import('@stellar/freighter-api');

      const result = await checkConnected();

      if (!mountedRef.current) return;

      if (result.isConnected) {
        // Freighter is available but we don't fetch the address here —
        // address is only returned on explicit connect() to avoid
        // silent permission escalation.
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
        setAddress(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Treat refresh failures as disconnected — not an error state
      setConnectionStatus('disconnected');
      setAddress(null);
    }
  }, []);

  // ── Initial refresh ─────────────────────────────────────────────────────────

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── connect ─────────────────────────────────────────────────────────────────

  const connect = useCallback(async (): Promise<string> => {
    if (typeof window === 'undefined') {
      throw new Error(
        '[useFluppyWallet] Wallet connection can only run in a browser environment.'
      );
    }

    if (mountedRef.current) {
      setConnectionStatus('connecting');
      setError(null);
    }

    try {
      const { requestAccess } = await import('@stellar/freighter-api');

      const result = await requestAccess();

      if (result.error) {
        throw new Error(`[useFluppyWallet] Freighter access denied: ${result.error}`);
      }

      if (!result.address) {
        throw new Error('[useFluppyWallet] Freighter returned no address.');
      }

      if (mountedRef.current) {
        setAddress(result.address);
        setConnectionStatus('connected');
      }

      return result.address;

    } catch (err) {
      const normalized = toError(err);

      if (mountedRef.current) {
        setError(normalized);
        setConnectionStatus('error');
      }

      throw normalized;
    }
  }, []);

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    address,
    connectionStatus,
    error,
    isConnected,
    isConnecting,
    connect,
    refresh,
    resetError,
  };
}
