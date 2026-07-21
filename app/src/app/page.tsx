"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView, Variants } from "framer-motion";

import { Icon } from "@iconify/react";
import { isConnected, requestAccess } from "@stellar/freighter-api";

// Import Komponen Custom
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Link from "next/link";

// ─── Design tokens (SOLID PINK THEME) ─────────────────────────────────────────
const T = {
  bg: "#ffffff",
  fg: "#0e0f0c",
  muted: "#454745",
  primary: "#9fe870",
  dark: "#163300",
  card: "#ffffff",
  border: "rgba(14, 15, 12, 0.08)",
  glass: "rgba(255, 255, 255, 0.6)",
};

// ─── Shared variants ──────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = (delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: delay } },
});

type LogKind = "info" | "success" | "error";
type LogEntry = { id: number; icon: React.ReactNode; text: string; kind: LogKind };

// ═════════════════════════════════════════════════════════════════════════════
//  UI UTILITY COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string; }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={stagger(delay)} className={className}>
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} className="mb-4">
      <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: T.primary }}>
        {children}
      </span>
    </motion.div>
  );
}

function HighlightText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={className} style={{ color: T.primary }}>
      {children}
    </span>
  );
}

function SolidCard({ children, className = "" }: { children: React.ReactNode; className?: string; }) {
  return (
    <div className={`rounded-[2rem] border ${className}`} style={{ background: T.card, borderColor: T.border }}>
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  HOW IT WORKS PLAIN SECTION (NEW)
// ═════════════════════════════════════════════════════════════════════════════
function HowItWorksPlain() {
  const steps = [
    {
      num: "01",
      title: "Prove you belong",
      desc: "Generate a cryptographic proof on your device that you're an approved member. Your identity never leaves your laptop.",
    },
    {
      num: "02",
      title: "Pay anyone",
      desc: "Send USDC to any merchant. The proof stays private while the payment stays transparent.",
    },
    {
      num: "03",
      title: "Settled in 5 seconds",
      desc: "Freighter signs the payment, and Stellar Testnet confirms an atomic 95/5 settlement in one transaction.",
    },
  ];

  return (
    <section className="relative py-20 px-6 z-10">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0e0f0c] mb-4">
            Privacy in <HighlightText>three steps.</HighlightText>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-base text-[#454745] max-w-xl mb-14">
            No crypto-jargon. Here&apos;s what actually happens when you send a payment with Flupy.
          </motion.p>

          <motion.div variants={stagger(0.08)} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((s) => (
              <motion.div
                key={s.num}
                variants={fadeUp}
                className="p-7 rounded-2xl border"
                style={{ background: T.card, borderColor: T.border }}
              >
                <div className="text-xs font-mono mb-5" style={{ color: T.primary }}>
                  {s.num}
                </div>
                <h3 className="text-xl font-bold text-[#0e0f0c] mb-2 tracking-tight">{s.title}</h3>
                <p className="text-sm text-[#454745] leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  ARCHITECTURE SECTION
// ═════════════════════════════════════════════════════════════════════════════
const ARCH_NODES = [
  { label: "Credential Unlock", sub: "Encrypted local credential unlock", glyph: "01" },
  { label: "Merkle Root Sync", sub: "Proof root checked against contract root", glyph: "02" },
  { label: "Groth16 Proof", sub: "Browser proof generation + local verification", glyph: "03" },
  { label: "Soroban Payment", sub: "Nullifier checks + atomic 95/5 settlement", glyph: "04" },
];

function Architecture() {
  return (
    <section id="architecture" className="relative py-24 px-6 z-10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionLabel>ARCHITECTURE</SectionLabel>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0e0f0c] mb-12">
            Four steps <HighlightText>One private payment</HighlightText>
          </motion.h2>

          <motion.div variants={stagger(0.1)} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {ARCH_NODES.map((n, i) => (
              <motion.div key={n.label} variants={fadeUp} className="relative">
                <SolidCard className="p-8 h-full flex flex-col hover:border-[#9fe870]/40 transition-colors">
                  <div className="text-sm font-mono mb-6" style={{ color: T.primary }}>{n.glyph}</div>
                  <h3 className="text-lg font-bold text-[#0e0f0c] mb-2">{n.label}</h3>
                  <p className="text-sm text-[#454745] leading-relaxed">{n.sub}</p>
                </SolidCard>

                {/* Arrow Connector on Desktop */}
                {i < ARCH_NODES.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-20 items-center justify-center w-6 h-6 rounded-full" style={{ background: T.bg, color: T.primary }}>
                    →
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  HERO SECTION
// ═════════════════════════════════════════════════════════════════════════════
function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-28 px-6">
      <div className="max-w-5xl mx-auto text-center flex flex-col items-center">

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }} className="text-5xl sm:text-7xl md:text-[7rem] font-bold tracking-tighter text-[#0e0f0c] leading-[1.05]">
          Private Payments,
          <br />
          <HighlightText>Finally.</HighlightText>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }} className="mt-9 text-lg md:text-xl text-[#454745] max-w-2xl mx-auto leading-relaxed">
          Pay privately on Stellar. Prove you&apos;re eligible without revealing who you are — your money moves instantly, your identity doesn&apos;t.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#payment-preview" className="flex items-center justify-center gap-2 px-8 py-4 rounded-full text-black font-bold text-sm transition-transform hover:scale-105" style={{ background: T.primary }}>
            Run Live Demo <Icon icon="ph:arrow-down" className="text-lg" />
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85, duration: 0.6 }} className="mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-xs font-bold uppercase tracking-widest text-[#454745]">
          <span>Groth16 Local Verify</span>
          <span className="hidden sm:inline">·</span>
          <span>Poseidon Merkle</span>
          <span className="hidden sm:inline">·</span>
          <span>Non-Custodial</span>
        </motion.div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  WHAT IS FLUPPY SECTION
// ═════════════════════════════════════════════════════════════════════════════
const FEATURES = [
  { title: "Dynamic Zero-Knowledge", desc: "Prove membership in an approved Merkle set without exposing raw credentials." },
  { title: "Browser Proof Verification", desc: "Groth16 proofs are generated and locally verified in the browser before Soroban submission." },
  { title: "Atomic Settlement", desc: "Funds split atomically — 95% to merchant, 5% to treasury — in a single Stellar Testnet transaction." },
  { title: "Non-Custodial", desc: "Treasury and asset IDs are anchored on-chain at init. We never touch your funds." },

];

function WhatIsFlupy() {
  return (
    <section id="features" className="relative py-20 px-6 z-10">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SolidCard className="overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/3 p-10 flex flex-col justify-between" style={{ background: "#0a080d" }}>
              <div>
                <div className="w-12 h-12 rounded-xl mb-6 flex items-center justify-center" style={{ background: T.primary }}>
                  <Icon icon="ph:sparkle-fill" className="text-black text-2xl" />
                </div>
                <h2 className="text-3xl font-bold text-[#0e0f0c] tracking-tight leading-tight">
                  Built for the<br /><HighlightText>privacy-first</HighlightText><br />economy
                </h2>
              </div>
            </div>

            {/* Kanan: List Fitur */}
            <div className="md:w-2/3 p-10 sm:p-14 flex flex-col justify-center gap-8">
              {FEATURES.map((f, i) => (
                <div key={f.title} className={`pb-8 ${i !== FEATURES.length - 1 ? 'border-b' : ''}`} style={{ borderColor: T.border }}>
                  <h3 className="text-xl font-bold text-[#0e0f0c] mb-2 uppercase tracking-wide flex items-center gap-2">
                    {f.title}
                  </h3>
                  <p className="text-sm text-[#454745] leading-relaxed max-w-lg">{f.desc}</p>
                </div>
              ))}
            </div>
          </SolidCard>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  DAPP PREVIEW SECTION
// ═════════════════════════════════════════════════════════════════════════════
function DAppPreview() {
  return (
    <section id="payment-preview" className="py-24 relative z-10">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <div className="mb-10 text-center" id="payment">
            <h2 className="text-4xl font-bold text-[#0e0f0c] mb-4">Experience the Protocol.</h2>
            <p className="text-sm text-[#454745] max-w-lg mx-auto">Try the Zero-Knowledge payment pipeline directly on testnet.</p>
          </div>

          <Link href="/app" className="block relative group cursor-pointer rounded-[2rem] overflow-hidden">

            {/* Always-visible instruction badge */}
            <div className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border text-[10px] font-bold uppercase tracking-wider text-[#0e0f0c]" style={{ background: T.glass, borderColor: T.border }}>
              Hover to launch
            </div>

            <div className="grid lg:grid-cols-2 gap-6 p-6 border rounded-[2rem] opacity-40 blur-[4px] group-hover:blur-md transition-all duration-500" style={{ background: T.card, borderColor: T.border }}>
              {/* Dummy Form */}
              <div className="space-y-6">
                <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10" />
                <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10" />
                <div className="h-16 w-full rounded-xl bg-white/5 border border-white/10" />
                <div className="h-14 w-full rounded-xl mt-10" style={{ background: T.primary }} />
              </div>
              <div className="h-full min-h-[300px] w-full rounded-[2rem] bg-black border border-white/10" />
            </div>

            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-3 text-2xl md:text-3xl font-bold text-[#0e0f0c] mb-8">
                #1 Private Payments Gateway On
                <div className="icon-mask w40 h-40 md:w-30 md:h-30 bg-white" style={{ maskImage: 'url(/logos/Stellar.svg)', WebkitMaskImage: 'url(/logos/Stellar.svg)' }} />
              </div>
              <button className="px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-2 hover:scale-105 transition-transform shadow-2xl">
                <Icon icon="ph:arrow-up-right" className="text-xl" /> Enter App
              </button>
            </div>

          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  FAQ SECTION 
// ═════════════════════════════════════════════════════════════════════════════
const FAQS = [
  { q: "What is Flupy?", a: "Flupy is a privacy-first payment gateway built on Stellar Soroban. You prove you are allowed to pay without revealing your identity, using a cryptographic proof generated right in your browser." },
  { q: "How does the 95/5 split work?", a: "Flupy never holds your funds. A single Stellar transaction sends 95% of your payment straight to the merchant and 5% to the protocol treasury at the same time — there is no in-between step where money sits with Flupy." },
  { q: "Do I need a specific wallet?", a: "Yes, Flupy currently works with the Freighter wallet extension. Install it and switch it to Stellar Testnet before trying the demo." },
  { q: "Is my proof actually checked on-chain?", a: "Your browser always verifies the proof locally before submitting it. On-chain, the contract checks the proof structure and every binding (payer, merchant, amount) today; full native pairing verification on-chain is planned — see the Security Model docs for the current status." },
];

function FAQItem({ q, a, isOpen, onClick }: { q: string, a: string, isOpen: boolean, onClick: () => void }) {
  return (
    <div className="border-b transition-colors" style={{ borderColor: isOpen ? T.primary : T.border }}>
      <button onClick={onClick} className="w-full flex justify-between items-center py-6 text-left focus:outline-none group">
        <span className={`text-lg font-bold transition-colors ${isOpen ? 'text-[#0e0f0c]' : 'text-[#0e0f0c] group-hover:text-[#0e0f0c]'}`}>{q}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="text-[#454745] group-hover:text-[#0e0f0c]">
          <Icon icon="ph:caret-down" width={22} height={22} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-6 text-sm text-[#454745] leading-relaxed pr-8">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative py-24 px-6 z-10">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
        <div className="md:w-1/3">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="text-4xl font-bold text-[#0e0f0c] tracking-tight">Questions?<br />Answers</h2>
        </div>
        <div className="md:w-2/3">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} isOpen={openIndex === i} onClick={() => setOpenIndex(openIndex === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main Page (Stateful)
// ═════════════════════════════════════════════════════════════════════════════
export default function Page() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // TOAST STATE (NEW)
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [secret, setSecret] = useState("2410010454");
  const [destination, setDestination] = useState("GDLST72TGNYOET54VCY7A63FKWHVUWPFAOOKJKCURI3VQXXLWWE7CLSF");
  const [amount, setAmount] = useState("1");

  const demoRef = useRef<HTMLElement>(null);
  const idRef = useRef(0);

  const addLog = useCallback((icon: React.ReactNode, text: string, kind: LogKind = "info") => {
    setLogs((p) => [...p, { id: ++idRef.current, icon, text, kind }]);
  }, []);

  const handleConnectWallet = async () => {
    try {
      const connectedStatus = await isConnected();
      if (connectedStatus.isConnected) {
        const access = await requestAccess();
        if (access.error) throw new Error(access.error);
        setPublicKey(access.address);
        addLog(<Icon icon="ph:key" className="text-[#9fe870]" />, `Freighter Connected: ${access.address.slice(0, 6)}...${access.address.slice(-4)}`, "success");
      } else {
        showToast("Please install Freighter extension!");
        window.open("https://freighter.app", "_blank");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(<Icon icon="ph:x-circle" className="text-red-400" />, `Wallet error: ${message}`, "error");
    }
  };

  const handleRunPayment = async () => {
    if (!publicKey) { showToast("Please connect your Freighter wallet first!"); return; }
    if (running) return;

    const amountStroops = Math.floor(parseFloat(amount) * 10_000_000);
    if (amountStroops <= 0 || isNaN(amountStroops)) { showToast("Invalid amount!"); return; }

    setRunning(true); setDone(false); setLogs([]); setTxHash(null);
    setTimeout(() => { demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);

    try {
      addLog(<Icon icon="ph:gear" className="text-gray-400" />, "Generating ZK Proof (Groth16 / BN254)...");
      const resProof = await fetch('/api/generate-proof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, destination, amount: amountStroops })
      });
      const dataProof = await resProof.json();
      if (!resProof.ok) throw new Error(dataProof.error);

      addLog(<Icon icon="ph:lock" className="text-blue-400" />, "Validating Merkle Membership (depth=20)...");
      addLog(<Icon icon="ph:calculator" className="text-yellow-400" />, `Computing Hash for Destination...`);
      addLog(<Icon icon="ph:package" className="text-orange-400" />, "Packaging proof for Soroban (XDR encoding)...");
      addLog(<Icon icon="ph:paper-plane-tilt" className="text-[#9fe870]" />, "Submitting transaction to Stellar Testnet...");

      const resTx = await fetch('/api/submit-tx', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: dataProof.proof, destination, amount: amountStroops })
      });
      const dataTx = await resTx.json();
      if (!resTx.ok) throw new Error(dataTx.error);

      addLog(<Icon icon="ph:link" className="text-indigo-400" />, "Executing Smart Contract: execute_payment()...");
      addLog(<Icon icon="ph:currency-dollar" className="text-emerald-400" />, "Atomic split → 95% merchant · 5% treasury...");
      addLog(<Icon icon="ph:check-circle" className="text-green-500" />, `SUCCESS — Tx: ${dataTx.hash.slice(0, 10)}...`, "success");

      setTxHash(dataTx.hash); setDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(<Icon icon="ph:x-circle" className="text-red-400" />, `Transaction failed: ${message}`, "error");
    } finally {
      setRunning(false);
    }
  };

  const navItems = [
    { label: "Protocol", bgColor: T.card, textColor: T.fg, links: [{ label: "How it Works", href: "#features", ariaLabel: "How it Works" }] },
    {
      label: "Developers",
      bgColor: T.card,
      textColor: T.fg,
      links: [
        { label: "Developer Docs", href: "/docs", ariaLabel: "Open Flupy developer documentation" },
      ],
    }
  ];

  return (
    <div className="relative min-h-screen antialiased overflow-x-hidden" style={{ background: T.bg, color: T.fg }}>


      <div className="relative z-10">
        <Navbar items={navItems} baseColor={T.bg} />

        {/* ── HERO SECTION ── */}
        <Hero />

        {/* ── PLAIN EXPLAINER (NEW) ── */}
        <HowItWorksPlain />

        {/* ── FLUPPY SECTION ── */}
        <WhatIsFlupy />

        {/* ── ARCHITECTURE SECTION ── */}
        <Architecture />

        {/* ── PREVIEW SECTION ── */}
        <DAppPreview />

        {/* ── FAQ SECTION ── */}
        <FAQSection />

        {/* ── FOOTER ── */}
        <Footer />
      </div>

      {/* ── TOAST UI (NEW) ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-full backdrop-blur-xl border text-sm font-medium text-[#0e0f0c] shadow-2xl"
            style={{ background: T.glass, borderColor: T.border }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}