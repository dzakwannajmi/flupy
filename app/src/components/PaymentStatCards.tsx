"use client"

import { Icon } from "@iconify/react"

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useTxHistory } from "@/hooks/useTxHistory"
import { computePaymentStats } from "@/lib/paymentStats"

function formatUsdc(value: number): string {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`
}

function formatRelativeTime(timestamp: number): string {
  const diffMin = Math.floor((Date.now() - timestamp) / 60_000)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`

  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * PaymentStatCards
 *
 * Four-box summary row for the payment page, styled after the shadcn
 * dashboard-01 SectionCards block but backed by real local tx history
 * (see hooks/useTxHistory + lib/paymentStats) instead of placeholder
 * numbers — this only reflects payments made on this device via the
 * primary payment flow.
 */
export function PaymentStatCards() {
  const { records, loading } = useTxHistory()
  const stats = computePaymentStats(records)

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Volume</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "—" : formatUsdc(stats.totalVolume)}
          </CardTitle>
          <CardAction>
            <Icon icon="ph:coins" className="text-[#163300]" width={18} height={18} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.successCount} successful payment{stats.successCount === 1 ? "" : "s"}
          </div>
          <div className="text-muted-foreground">Confirmed on Stellar testnet</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Transactions</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading ? "—" : stats.totalCount}
          </CardTitle>
          <CardAction>
            <Icon icon="ph:hash" className="text-[#163300]" width={18} height={18} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.pendingCount} pending
          </div>
          <div className="text-muted-foreground">Includes attempts of every status</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Success Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading || stats.totalCount === 0 ? "—" : `${stats.successRate.toFixed(0)}%`}
          </CardTitle>
          <CardAction>
            <Icon
              icon={stats.failedCount > 0 ? "ph:warning-circle" : "ph:check-circle"}
              className={stats.failedCount > 0 ? "text-amber-500" : "text-[#163300]"}
              width={18}
              height={18}
            />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.failedCount} failed
          </div>
          <div className="text-muted-foreground">
            Out of {stats.totalCount} attempt{stats.totalCount === 1 ? "" : "s"}
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Last Payment</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {loading || !stats.lastPayment ? "—" : formatRelativeTime(stats.lastPayment.timestamp)}
          </CardTitle>
          <CardAction>
            <Icon icon="ph:clock-countdown" className="text-[#163300]" width={18} height={18} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {stats.lastPayment ? shortenAddress(stats.lastPayment.recipient) : "No payments yet"}
          </div>
          <div className="text-muted-foreground">Most recent recipient</div>
        </CardFooter>
      </Card>
    </div>
  )
}
