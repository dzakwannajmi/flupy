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

import {
  useState,
  useCallback,
  useEffect,
} from 'react';

import type { FluppyPaymentRecord } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UseFluppyHistoryReturn {
  /** All stored payment records, newest first. */
  readonly records: readonly FluppyPaymentRecord[];
  /**
   * Adds a new record (or replaces existing by txHash).
   * Persists to localStorage.
   */
  readonly add:     (record: FluppyPaymentRecord) => void;
  /**
   * Updates fields of an existing record by txHash.
   * Persists to localStorage.
   */
  readonly update:  (txHash: string, patch: Partial<Omit<FluppyPaymentRecord, 'txHash'>>) => void;
  /**
   * Removes a record by txHash.
   * Persists to localStorage.
   */
  readonly remove:  (txHash: string) => void;
  /** Clears all records from state and localStorage. */
  readonly clear:   () => void;
  /** Reloads records from localStorage. */
  readonly refresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_STORAGE_KEY = 'fluppy:payment-history:v1';
const MAX_HISTORY_LENGTH  = 50;

// ─── Serialization helpers ────────────────────────────────────────────────────
// bigint cannot be serialized by JSON.stringify directly.
// We store amount as string internally and restore on load.

interface PersistedRecord {
  txHash:       string;
  amount:       string;   // bigint serialized as decimal string
  merchant:     string;
  timestamp:    number;
  status:       'pending' | 'success' | 'failed';
  explorerUrl?: string;
}

function serializeRecord(record: FluppyPaymentRecord): PersistedRecord {
  return {
    txHash: record.txHash,
    amount: record.amount.toString(),
    merchant: record.merchant,
    timestamp: record.timestamp,
    status: record.status,
    ...(record.explorerUrl ? { explorerUrl: record.explorerUrl } : {}),
  };
}

function deserializeRecord(raw: PersistedRecord): FluppyPaymentRecord {
  return {
    txHash: raw.txHash,
    amount: BigInt(raw.amount),
    merchant: raw.merchant,
    timestamp: raw.timestamp,
    status: raw.status,
    ...(raw.explorerUrl ? { explorerUrl: raw.explorerUrl } : {}),
  };
}

function loadFromStorage(): FluppyPaymentRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [];

    return (parsed as PersistedRecord[]).map(deserializeRecord);
  } catch {
    // Parse failure — fail safe to empty rather than crashing
    return [];
  }
}

function saveToStorage(records: readonly FluppyPaymentRecord[]): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = records.map(serializeRecord);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Write failure (e.g. storage quota exceeded) — silently ignore
    // Records remain in state even if persistence fails
  }
}

function deduplicateByTxHash(
  records: readonly FluppyPaymentRecord[],
): FluppyPaymentRecord[] {
  const seen = new Set<string>();
  return records.filter(r => {
    if (seen.has(r.txHash)) return false;
    seen.add(r.txHash);
    return true;
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
export function useFluppyHistory(): UseFluppyHistoryReturn {
  const [records, setRecords] =
    useState<readonly FluppyPaymentRecord[]>([]);

  // ── Initial load from localStorage ─────────────────────────────────────────

  useEffect(() => {
    setRecords(loadFromStorage());
  }, []);

  // ── refresh ─────────────────────────────────────────────────────────────────

  const refresh = useCallback((): void => {
    setRecords(loadFromStorage());
  }, []);

  // ── add ─────────────────────────────────────────────────────────────────────

  const add = useCallback((record: FluppyPaymentRecord): void => {
    setRecords(prev => {
      // Prepend and deduplicate — existing record with same txHash is replaced
      const merged  = deduplicateByTxHash([record, ...prev]);
      const capped  = merged.slice(0, MAX_HISTORY_LENGTH);
      saveToStorage(capped);
      return capped;
    });
  }, []);

  // ── update ──────────────────────────────────────────────────────────────────

  const update = useCallback(
    (txHash: string, patch: Partial<Omit<FluppyPaymentRecord, 'txHash'>>): void => {
      setRecords(prev => {
        const next = prev.map(r =>
          r.txHash === txHash ? { ...r, ...patch } : r
        );
        saveToStorage(next);
        return next;
      });
    },
    [],
  );

  // ── remove ──────────────────────────────────────────────────────────────────

  const remove = useCallback((txHash: string): void => {
    setRecords(prev => {
      const next = prev.filter(r => r.txHash !== txHash);
      saveToStorage(next);
      return next;
    });
  }, []);

  // ── clear ───────────────────────────────────────────────────────────────────

  const clear = useCallback((): void => {
    setRecords([]);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch {
        // Silently ignore
      }
    }
  }, []);

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    records,
    add,
    update,
    remove,
    clear,
    refresh,
  };
}
