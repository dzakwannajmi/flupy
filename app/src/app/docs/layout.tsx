import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    template: "%s — Fluppy Docs",
    default: "Fluppy SDK Documentation",
  },
  description:
    "Developer documentation for the Fluppy ZK Payment Protocol SDK — @flupy/core, @flupy/browser, @flupy/react.",
};

const DOC_SECTIONS = [
  {
    title: "Getting Started",
    links: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "SDK Reference",
    links: [
      { href: "/docs/core", label: "@flupy/core" },
      { href: "/docs/browser", label: "@flupy/browser" },
      { href: "/docs/react", label: "@flupy/react" },
    ],
  },
  {
    title: "Guides",
    links: [
      { href: "/docs/examples", label: "Examples" },
      { href: "/docs/security", label: "Security Model" },
      { href: "/docs/fee-model", label: "Fee Model" },
      { href: "/docs/troubleshooting", label: "Troubleshooting" },
    ],
  },
] as const;

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-400 transition-colors hover:text-white">
              ← App
            </Link>
            <span className="text-gray-600">/</span>
            <Link href="/docs" className="flex items-center gap-2 font-semibold text-white">
              <span className="text-pink-400">🔐</span>
              <span>Fluppy Docs</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
              Testnet MVP
            </span>
            <a
              href="https://github.com/dzakwannajmi/fluppy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              GitHub →
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-64 shrink-0 overflow-y-auto border-r border-white/10 px-4 py-8 lg:block">
          <nav className="space-y-8">
            {DOC_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block rounded-md px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-medium text-gray-400">SDK Status</p>
            <div className="mt-2 space-y-1.5">
              {["@flupy/core", "@flupy/browser", "@flupy/react"].map((pkg) => (
                <div key={pkg} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{pkg}</span>
                  <span className="text-xs font-medium text-green-400">✓ Complete</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-10 lg:px-12">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
