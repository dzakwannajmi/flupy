import type { ReactNode } from "react";

export function InstallNote({ type = "info", children }: { type?: "info" | "warning" | "future"; children: ReactNode }) {
  const styles: Record<string, string> = {
    info: "border-blue-500/30 bg-blue-500/5 text-blue-300",
    warning: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300",
    future: "border-purple-500/30 bg-purple-500/5 text-purple-300",
  };
  const icons: Record<string, string> = { info: "ℹ", warning: "⚠", future: "🔮" };
  return (
    <div className={`not-typeset flex gap-3 rounded-xl border p-4 text-sm ${styles[type]}`}>
      <span className="shrink-0 text-base">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}
