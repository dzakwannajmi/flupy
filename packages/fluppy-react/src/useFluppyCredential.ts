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

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import {
  credentialExists,
  createCredential,
  unlockCredential,
  deleteCredential,
} from '@fluppy/browser';

import type { CredentialStatus } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UseFluppyCredentialReturn {
  /**
   * Lifecycle status of the credential.
   *   'unknown'   → initial state before first check completes
   *   'exists'    → encrypted credential found in IndexedDB
   *   'not_found' → no credential stored
   */
  readonly status:     CredentialStatus;
  /** True while any async credential operation is in progress. */
  readonly isLoading:  boolean;
  /** Last error thrown by an operation, or null if no error. */
  readonly error:      Error | null;
  /**
   * True if credential exists, false if not.
   * Null while status is 'unknown' (initial load).
   */
  readonly exists:     boolean | null;

  /**
   * Creates and stores a new credential encrypted with the given password.
   * Returns the raw secret ONCE — the caller must display it to the user as backup.
   * The secret is never logged inside this hook.
   *
   * @throws If password is too short or encryption fails
   */
  readonly create:     (password: string) => Promise<{ secret: string }>;

  /**
   * Decrypts and returns the stored secret.
   * The secret is returned as a string but never logged by this hook.
   *
   * @throws If password is wrong or no credential exists
   */
  readonly unlock:     (password: string) => Promise<string>;

  /**
   * Permanently deletes the stored credential from IndexedDB.
   * Ensure the user has saved their backup secret before calling.
   */
  readonly remove:     () => Promise<void>;

  /**
   * Re-checks IndexedDB and updates status/exists state.
   * Call this after external credential changes.
   */
  readonly refresh:    () => Promise<void>;

  /** Clears the current error without triggering any async operation. */
  readonly resetError: () => void;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
export function useFluppyCredential(): UseFluppyCredentialReturn {
  const [status, setStatus] =
    useState<CredentialStatus>('unknown');

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState<Error | null>(null);

  // exists is derived from status for external convenience
  const exists: boolean | null =
    status === 'unknown' ? null : status === 'exists';

  // Mounted guard — prevents state updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Internal state helpers ───────────────────────────────────────────────────

  const safeSetStatus = useCallback((s: CredentialStatus) => {
    if (mountedRef.current) setStatus(s);
  }, []);

  const safeSetLoading = useCallback((v: boolean) => {
    if (mountedRef.current) setIsLoading(v);
  }, []);

  const safeSetError = useCallback((e: Error | null) => {
    if (mountedRef.current) setError(e);
  }, []);

  // ── refresh ──────────────────────────────────────────────────────────────────

  /**
   * Checks IndexedDB for the existence of a stored credential.
   * SSR-safe: returns early if window is not defined.
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined') {
      // SSR environment — IndexedDB not available, stay 'unknown'
      return;
    }

    try {
      const found = await credentialExists();
      safeSetStatus(found ? 'exists' : 'not_found');
    } catch (err) {
      safeSetStatus('not_found');
      safeSetError(toError(err));
    }
  }, [safeSetStatus, safeSetError]);

  // ── Initial check on mount ───────────────────────────────────────────────────

  useEffect(() => {
    void refresh();
    // Only run once on mount — `refresh` is stable (useCallback with no deps change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── create ───────────────────────────────────────────────────────────────────

  const create = useCallback(
    async (password: string): Promise<{ secret: string }> => {
      safeSetLoading(true);
      safeSetError(null);

      try {
        // createCredential returns { secret } — we pass it through without logging
        const result = await createCredential(password);
        safeSetStatus('exists');
        return result;
      } catch (err) {
        const normalized = toError(err);
        safeSetError(normalized);
        throw normalized; // re-throw so caller can show UI feedback
      } finally {
        safeSetLoading(false);
      }
    },
    [safeSetLoading, safeSetError, safeSetStatus],
  );

  // ── unlock ───────────────────────────────────────────────────────────────────

  const unlock = useCallback(
    async (password: string): Promise<string> => {
      safeSetLoading(true);
      safeSetError(null);

      try {
        // unlockCredential returns the raw secret — we return it without logging
        const secret = await unlockCredential(password);
        return secret;
      } catch (err) {
        const normalized = toError(err);
        safeSetError(normalized);
        throw normalized;
      } finally {
        safeSetLoading(false);
      }
    },
    [safeSetLoading, safeSetError],
  );

  // ── remove ───────────────────────────────────────────────────────────────────

  const remove = useCallback(async (): Promise<void> => {
    safeSetLoading(true);
    safeSetError(null);

    try {
      await deleteCredential();
      safeSetStatus('not_found');
    } catch (err) {
      const normalized = toError(err);
      safeSetError(normalized);
      throw normalized;
    } finally {
      safeSetLoading(false);
    }
  }, [safeSetLoading, safeSetError, safeSetStatus]);

  // ── resetError ───────────────────────────────────────────────────────────────

  const resetError = useCallback((): void => {
    safeSetError(null);
  }, [safeSetError]);

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    status,
    isLoading,
    error,
    exists,
    create,
    unlock,
    remove,
    refresh,
    resetError,
  };
}
