'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import {
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
} from 'lucide-react';

import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { useTxHistory } from '../hooks/useTxHistory';
import type { TxRecord } from '../lib/history';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const DEFAULT_PAGE_SIZE = 10;

export function TxHistoryPanel() {
  const { records, loading } = useTxHistory();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  // Derived, not stored: if records shrink (or pageSize grows) after
  // `pageIndex` was set, this clamps to the new last page on the very next
  // render — no effect needed to "correct" state after the fact.
  const safePageIndex = Math.min(pageIndex, pageCount - 1);

  const paginatedRecords = records.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );

  const canPreviousPage = safePageIndex > 0;
  const canNextPage = safePageIndex < pageCount - 1;

  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <div className="animate-pulse text-xs text-[#454745]">
          Loading transaction history...
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <div className="text-xs text-[#454745]">
          No transaction history yet.
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/10">
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
          {paginatedRecords.map(record => (
            <TxHistoryRow key={record.id} record={record} />
          ))}
        </TableBody>
      </Table>

      {/* ── Pagination footer ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-t border-black/10 px-4 py-3">
        <div className="hidden text-xs text-[#454745] sm:block">
          {records.length} transaction{records.length === 1 ? '' : 's'}
        </div>

        <div className="flex w-full items-center justify-end gap-6 sm:w-fit">
          <div className="hidden items-center gap-2 sm:flex">
            <Label htmlFor="tx-rows-per-page" className="text-xs text-[#454745]">
              Rows per page
            </Label>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                if (value === null) return;
                setPageSize(Number(value));
                setPageIndex(0);
              }}
            >
              <SelectTrigger size="sm" className="w-16" id="tx-rows-per-page">
                <SelectValue placeholder={`${pageSize}`} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-fit items-center justify-center text-xs font-medium text-[#0e0f0c]">
            Page {safePageIndex + 1} of {pageCount}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-7 sm:flex"
              onClick={() => setPageIndex(0)}
              disabled={!canPreviousPage}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
              disabled={!canPreviousPage}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setPageIndex(Math.min(pageCount - 1, safePageIndex + 1))}
              disabled={!canNextPage}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-7 sm:flex"
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={!canNextPage}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
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
