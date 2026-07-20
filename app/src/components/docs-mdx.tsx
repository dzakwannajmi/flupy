import type { ReactNode } from "react";
import { Icon } from "@iconify/react";

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="not-typeset flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300">
      <span className="shrink-0">ℹ</span>
      <div>{children}</div>
    </div>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="not-typeset flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
      <Icon icon="ph:warning" width={18} height={18} className="shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Caution({ children }: { children: ReactNode }) {
  return (
    <div className="not-typeset flex gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-300">
      <span className="shrink-0">⚠</span>
      <div>{children}</div>
    </div>
  );
}

export function Badge({
  children,
  color = "gray",
}: {
  children: ReactNode;
  color?: "purple" | "blue" | "green" | "yellow" | "gray";
}) {
  const styles: Record<string, string> = {
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-700",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-700",
    green: "border-green-500/30 bg-green-500/10 text-emerald-700",
    yellow: "border-yellow-500/30 bg-yellow-500/10 text-amber-700",
    gray: "border-black/15 bg-black/[0.03] text-[#454745]",
  };
  return (
    <span className={`not-typeset inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[color]}`}>
      {children}
    </span>
  );
}

export function BundleStats({ stats }: { stats: [string, string][] }) {
  return (
    <div className="not-typeset grid gap-3 sm:grid-cols-3">
      {stats.map(([size, label]) => (
        <div key={label} className="rounded-xl border border-black/10 bg-black/[0.03] p-3 text-center">
          <div className="text-lg font-bold text-[#0e0f0c]">{size}</div>
          <div className="text-xs text-[#454745]">{label}</div>
        </div>
      ))}
    </div>
  );
}

const MODULE_COLORS: Record<string, string> = {
  blue: "border-blue-500/20 text-blue-700",
  red: "border-red-500/20 text-red-700",
  purple: "border-purple-500/20 text-purple-700",
  gray: "border-black/15 text-[#454745]",
  yellow: "border-yellow-500/20 text-amber-700",
  green: "border-green-500/20 text-emerald-700",
  pink: "border-[#9fe870]/20 text-[#163300]",
};

export function ModuleMap({ modules }: { modules: [string, string, string][] }) {
  return (
    <div className="not-typeset space-y-2">
      {modules.map(([mod, color, desc]) => (
        <div key={mod} className={`flex items-start gap-3 rounded-xl border bg-black/[0.03] p-3 ${MODULE_COLORS[color]}`}>
          <code className="mt-0.5 shrink-0 text-xs font-semibold">{mod}</code>
          <span className="text-xs text-[#454745]">{desc}</span>
        </div>
      ))}
    </div>
  );
}

export function IssueCard({ error, cause, fix }: { error: string; cause: string; fix: ReactNode }) {
  return (
    <div className="not-typeset overflow-hidden rounded-xl border border-black/10">
      <div className="border-b border-black/10 bg-black/[0.03] px-4 py-2.5">
        <code className="text-xs font-semibold text-red-700">{error}</code>
      </div>
      <div className="divide-y divide-black/5 text-xs">
        <div className="flex gap-3 px-4 py-2.5">
          <span className="w-14 shrink-0 font-semibold text-[#454745]">Cause</span>
          <span className="text-[#454745]">{cause}</span>
        </div>
        <div className="flex gap-3 px-4 py-2.5">
          <span className="w-14 shrink-0 font-semibold text-[#454745]">Fix</span>
          <span className="text-[#454745]">{fix}</span>
        </div>
      </div>
    </div>
  );
}

export function CardGrid({
  cards,
  cols = 2,
}: {
  cards: { title: string; desc: ReactNode }[];
  cols?: 2 | 3;
}) {
  return (
    <div className={`not-typeset grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {cards.map(({ title, desc }) => (
        <div key={title} className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[#0e0f0c]">{title}</h3>
          <p className="text-xs text-[#454745]">{desc}</p>
        </div>
      ))}
    </div>
  );
}

export function StepFlow({ items }: { items: [string, string, string][] }) {
  return (
    <div className="not-typeset rounded-xl border border-black/10 bg-white p-5">
      <div className="space-y-2 text-sm">
        {items.map(([num, action, detail]) => (
          <div key={num} className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9fe870]/30 text-xs font-bold text-[#163300]">
              {num}
            </span>
            <div>
              <span className="font-medium text-[#0e0f0c]">{action}</span>
              <span className="ml-2 text-[#454745]">{detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepHeading({ id, step, children }: { id: string; step: number; children: ReactNode }) {
  return (
    <h2 id={id} className="not-typeset mb-3 mt-12 flex scroll-mt-20 items-center gap-3 text-xl font-semibold text-[#0e0f0c]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#9fe870] text-xs font-bold">
        {step}
      </span>
      {children}
    </h2>
  );
}

export function HookHeading({ id, name, badge }: { id: string; name: string; badge?: string }) {
  return (
    <h2 id={id} className="not-typeset mb-3 mt-10 flex scroll-mt-20 items-center gap-2 text-xl font-semibold text-[#0e0f0c]">
      <code className="text-[#163300]">{name}</code>
      {badge && <Badge color="green">{badge}</Badge>}
    </h2>
  );
}
