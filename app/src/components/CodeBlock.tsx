"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";

export function CodeBlock({
  children,
  filename,
}: {
  children: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — fail silently,
      // the code is still visible and selectable manually.
    }
  }

  return (
    <div className="not-typeset overflow-hidden rounded-xl border border-black/10">
      {filename && (
        <div className="flex items-center justify-between border-b border-black/10 bg-black/[0.03] px-4 py-2">
          <span className="text-xs font-mono text-[#454745]">{filename}</span>
        </div>
      )}
      <div className="group relative">
        <pre
          className="overflow-x-auto bg-white p-4 text-sm text-[#454745]"
          style={{ tabSize: 4 }}
        >
          <code>{children}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium text-[#454745] opacity-0 transition-opacity hover:text-[#0e0f0c] group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Icon icon="ph:check" width={14} height={14} className="text-[#163300]" />
              Copied!
            </>
          ) : (
            <>
              <Icon icon="ph:copy" width={14} height={14} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
