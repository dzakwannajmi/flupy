import type { TxRecord } from './history';

/**
 * paymentStats.ts
 *
 * Pure aggregation helpers over local TxRecord history (lib/history.ts).
 * No I/O, no React — safe to unit test directly. Consumed by
 * PaymentStatCards and PaymentVolumeChart.
 *
 * NOTE: this only reflects payments made through the primary payment flow
 * (the one that writes to IndexedDB via lib/history.ts). The experimental
 * SDK payment path stores its own records separately in localStorage
 * (@fluppy/react's useFluppyHistory) and is not included here.
 */

export interface PaymentStats {
  /** Sum of the `amount` field for status === 'success' records. */
  totalVolume: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
  /** 0-100, or 0 when there are no records. */
  successRate: number;
  /** Most recent record (records are already sorted newest-first), or null. */
  lastPayment: TxRecord | null;
}

function parseAmount(amount: string): number {
  const value = parseFloat(amount);
  return Number.isFinite(value) ? value : 0;
}

export function computePaymentStats(records: TxRecord[]): PaymentStats {
  const successCount = records.filter(r => r.status === 'success').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const failedCount = records.filter(r => r.status === 'failed').length;
  const totalCount = records.length;

  const totalVolume = records
    .filter(r => r.status === 'success')
    .reduce((sum, r) => sum + parseAmount(r.amount), 0);

  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

  const lastPayment = records.length > 0 ? records[0] : null;

  return {
    totalVolume,
    successCount,
    pendingCount,
    failedCount,
    totalCount,
    successRate,
    lastPayment,
  };
}

export interface DailyVolumePoint {
  /** YYYY-MM-DD, local time. */
  date: string;
  volume: number;
  count: number;
}

/**
 * Buckets successful payments by day for the last `days` days (inclusive of
 * today). Days with no payments are included as zero-value points so the
 * chart renders a continuous timeline instead of gaps.
 */
export function computeDailyVolume(
  records: TxRecord[],
  days: number,
): DailyVolumePoint[] {
  const points: DailyVolumePoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    points.push({ date: key, volume: 0, count: 0 });
  }

  const byDate = new Map(points.map(p => [p.date, p]));

  for (const record of records) {
    if (record.status !== 'success') {
      continue;
    }

    const key = toDateKey(new Date(record.timestamp));
    const point = byDate.get(key);

    if (point) {
      point.volume += parseAmount(record.amount);
      point.count += 1;
    }
  }

  return points;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
