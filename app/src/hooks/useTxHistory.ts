'use client';

import { useEffect, useRef, useState } from 'react';

import { getTxHistory, type TxRecord } from '../lib/history';

const REFRESH_INTERVAL_MS = 4000;

export interface UseTxHistoryReturn {
  records: TxRecord[];
  loading: boolean;
}

/**
 * useTxHistory
 *
 * Polls the local IndexedDB transaction history (see lib/history.ts) on an
 * interval and exposes it as React state. This is the single source of
 * truth for anything on the payment page that reads local tx history —
 * TxHistoryPanel, PaymentStatCards, and PaymentVolumeChart all consume this
 * hook instead of each polling IndexedDB independently.
 */
export function useTxHistory(): UseTxHistoryReturn {
  const mountedRef = useRef(true);

  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mountedRef.current = true;

    async function loadHistory(): Promise<void> {
      try {
        const history = await getTxHistory();

        if (!mountedRef.current) {
          return;
        }

        setRecords(history);
      } catch {
        // Silently ignore -- history is a convenience feature, not
        // critical path. A failed load simply leaves the last known
        // records in place until the next poll succeeds.
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    const interval = window.setInterval(() => {
      void loadHistory();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, []);

  return { records, loading };
}
