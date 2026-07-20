'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  getTxHistory,
  type TxRecord,
} from '../lib/history';

const REFRESH_INTERVAL_MS = 4000;

export function TxHistoryPanel() {
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

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <div className="animate-pulse text-xs text-[#454745]">
          Loading transaction history...
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <div className="text-xs text-[#454745]">
          No transaction history yet.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-black/10">
      <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.03] px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#454745]">
          Recent Transactions
        </h3>
        <span className="text-[10px] text-[#454745]">
          Auto-refresh
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map(record => (
            <TxHistoryRow key={record.id} record={record} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TxHistoryRow({ record }: { record: TxRecord }) {
  const isPending = record.status === 'pending';
  const txHashDisplay =
    record.txHash === 'pending'
      ? 'Pending...'
      : `${record.txHash.slice(0, 8)}...${record.txHash.slice(-6)}`;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="truncate font-mono text-xs text-[#0e0f0c]">
            {txHashDisplay}
          </span>
          <span className="text-[10px] text-[#454745]">
            {formatTimestamp(record.timestamp)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-xs text-[#454745]">
          <span>{record.amount}</span>
          <Icon icon="ph:arrow-right" width={12} height={12} />
          <span>{shortenAddress(record.recipient)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <StatusBadge status={record.status} />
          {!isPending && record.explorerUrl !== '#' && (
            
            <a
              href={record.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#163300] transition-colors hover:text-[#9fe870]"
              aria-label="Open transaction in explorer"
            >
              <Icon icon="ph:arrow-square-out" width={14} height={14} />
            </a>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: TxRecord['status'] }) {
  const styles: Record<TxRecord['status'], string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300/60',
    success: 'bg-[#9fe870]/15 text-[#163300] border-[#9fe870]/40',
    failed: 'bg-red-100 text-red-700 border-red-300/60',
  };

  return (
    <span
      className={`rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
