import type { ReactNode } from "react";

export function ApiTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table>
      <thead>
        <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row[0]}>
            {row.map((cell, i) => <td key={i}>{i === 0 ? <code>{cell}</code> : cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GenerationLock() {
  return (
    <div className="not-typeset rounded-xl border border-black/10 bg-black/[0.03] p-4">
      <p className="mb-2 text-sm font-semibold text-[#0e0f0c]">Generation lock</p>
      <p className="text-xs text-[#454745]">
        Only one proof can be generated at a time per browser session.
        Calling <code>generateZkProof()</code> while another is in progress throws immediately.
        Use AbortSignal to cancel an in-flight generation before starting a new one.
      </p>
    </div>
  );
}
