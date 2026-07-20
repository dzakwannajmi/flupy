"use client";

import React from "react";
import { Icon } from "@iconify/react";

const T = {
  muted: "#454745",
  primary: "#9fe870",
  border: "rgba(14, 15, 12, 0.08)",
};

export default function Footer() {
  return (
    <footer className="relative pt-16 pb-12 px-6 z-10" style={{ borderTop: `1px solid ${T.border}` }}>
      <div className="max-w-6xl mx-auto">

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">

          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-[4px] flex items-center justify-center" style={{ background: T.primary }}>
              <span className="text-black text-[10px] font-black">✦</span>
            </div>
            <span className="font-bold tracking-widest text-[#0e0f0c]">FLUPPY</span>
          </div>

          <div className="flex items-center gap-8 text-sm font-medium">
            <a href="https://github.com/dzakwannajmi/Fluppy" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[#163300]" style={{ color: T.muted }}>
              <Icon icon="ph:github-logo" className="text-lg" /> GitHub
            </a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-xs font-mono uppercase tracking-widest" style={{ borderTop: `1px solid ${T.border}`, color: "rgba(14, 15, 12, 0.5)" }}>
          <span>© 2026 Flupy</span>
        </div>

      </div>
    </footer>
  );
}