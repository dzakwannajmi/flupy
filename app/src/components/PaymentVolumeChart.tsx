"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { useTxHistory } from "@/hooks/useTxHistory"
import { computeDailyVolume } from "@/lib/paymentStats"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

const chartConfig = {
  volume: {
    label: "Volume (USDC)",
    color: "var(--primary)",
  },
} satisfies ChartConfig

const RANGE_DAYS: Record<string, number> = {
  "90d": 90,
  "30d": 30,
  "7d": 7,
}

/**
 * PaymentVolumeChart
 *
 * Area chart of confirmed payment volume per day, styled after the shadcn
 * dashboard-01 ChartAreaInteractive block but backed by real local tx
 * history (see hooks/useTxHistory + lib/paymentStats) instead of
 * placeholder data.
 */
export function PaymentVolumeChart() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")
  const { records } = useTxHistory()

  // Derived, not stored: default to a shorter range on mobile without
  // mutating state from an effect (avoids cascading renders) — the user
  // can still override it manually via the selector below.
  const effectiveTimeRange = isMobile && timeRange === "30d" ? "7d" : timeRange

  const days = RANGE_DAYS[effectiveTimeRange] ?? 30
  const data = React.useMemo(() => computeDailyVolume(records, days), [records, days])
  const hasData = data.some(point => point.count > 0)

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Payment Volume</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Confirmed payment volume on testnet
          </span>
          <span className="@[540px]/card:hidden">Payment volume</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={effectiveTimeRange ? [effectiveTimeRange] : []}
            onValueChange={(value) => {
              setTimeRange(value[0] ?? "30d")
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={(value) => {
              if (value !== null) {
                setTimeRange(value)
              }
            }}
          >
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 30 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-volume)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-volume)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="volume"
                type="natural"
                fill="url(#fillVolume)"
                stroke="var(--color-volume)"
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[250px] w-full items-center justify-center text-sm text-muted-foreground">
            No confirmed payments in this period yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
