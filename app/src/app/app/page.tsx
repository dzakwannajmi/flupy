"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { isConnected } from "@stellar/freighter-api";
import Navbar from "../../components/Navbar";
import { useFluppy } from "../../hooks/useFluppy";
import { ProofProgressBar } from '../../components/ProofProgressBar';
import { TxHistoryPanel } from '../../components/TxHistoryPanel';
import { buildExplorerUrl } from "../../lib/history";
import { useFluppyCredential, useFluppyHistory, useFluppyPayment, useFluppyWallet, type FluppyPaymentRecord } from "@flupy/react";

// ─── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg: "#ffffff",
  fg: "#0e0f0c",
  muted: "#454745",
  primary: "#9fe870",
  dark: "#163300",
  card: "#ffffff",
  border: "rgba(14, 15, 12, 0.08)",
};

// ─── Tipe ────────────────────────────────────────────────────────────────────
type LogKind = "info" | "success" | "error";
type LogEntry = { id: number; icon: React.ReactNode; text: string; kind: LogKind };

// ─── SolidCard ───────────────────────────────────────────────────────────────
function SolidCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[2rem] border ${className}`}
      style={{ background: T.card, borderColor: T.border }}
    >
      {children}
    </div>
  );
}

// ─── TerminalLog ─────────────────────────────────────────────────────────────
function TerminalLog({
  logs,
  running,
  txHash,
}: {
  logs: LogEntry[];
  running: boolean;
  txHash?: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [logs]);

  const hasDone = logs.some(l => l.kind === "success");
  const hasError = logs.some(l => l.kind === "error");

  // Helper footer — hindari ternary Fragment bersarang
  function renderFooter(): React.ReactNode {
    if (running) {
      return (
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ opacity: [1, 0.25] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
            className="w-2 h-2 rounded-full"
            style={{ background: T.primary }}
          />
          <span className="text-xs font-mono" style={{ color: "rgba(14, 15, 12, 0.5)" }}>
            executing…
          </span>
        </div>
      );
    }

    if (hasDone && txHash) {
      return (
        <div className="flex items-center gap-3 w-full">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-mono" style={{ color: "rgba(14, 15, 12, 0.5)" }}>
            exit 0 · verified
          </span>

          <a
            href={buildExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs underline underline-offset-2 font-mono"
            style={{ color: T.primary } as React.CSSProperties}
          >
            Explorer →
          </a>
        </div >
      );
    }

    if (hasError) {
      return (
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs font-mono" style={{ color: "rgba(14, 15, 12, 0.5)" }}>
            exit 1 · check logs
          </span>
        </div>
      );
    }

    return (
      <span className="text-xs select-none font-mono" style={{ color: "rgba(14, 15, 12, 0.4)" }}>
        ready
      </span>
    );
  }

  return (
    <div
      className="h-full w-full rounded-[2rem] overflow-hidden flex flex-col relative z-20"
      style={{
        background: T.dark,
        border: `1px solid ${T.border}`,
        boxShadow: `inset 0 0 40px -20px ${T.primary}20`,
        minHeight: 450,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <span className="w-3 h-3 rounded-full bg-green-400/80" />
        <span
          className="ml-4 text-xs tracking-widest uppercase font-mono flex items-center gap-2 select-none"
          style={{ color: "rgba(14, 15, 12, 0.5)" }}
        >
          <Icon icon="ph:gear" width={12} height={12} className="animate-[spin_4s_linear_infinite]" />
          Soroban Shell
        </span>
      </div>

      {/* Log area */}
      <div className="flex-1 px-6 py-6 overflow-y-auto space-y-3 text-sm font-mono">
        {logs.length === 0 && !running && (
          <p className="text-xs select-none" style={{ color: "rgba(14, 15, 12, 0.4)" }}>
            Awaiting execution…
          </p>
        )}
        <AnimatePresence>
          {logs.map(log => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-start gap-3 leading-relaxed"
              style={{
                color:
                  log.kind === "success"
                    ? "#4ade80"
                    : log.kind === "error"
                      ? "#f87171"
                      : "rgba(14, 15, 12, 0.8)",
              }}
            >
              <span className="flex-shrink-0 text-base leading-none mt-[2px]">
                {log.icon}
              </span>
              <span>{log.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {running && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.65 }}
            className="inline-block w-2 h-[18px] align-middle"
            style={{ background: T.primary, borderRadius: 1 }}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div
        className="px-6 py-4"
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        {renderFooter()}
      </div>
    </div>
  );
}

// ─── Input style ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  color: "#0e0f0c",
  fontSize: 14,
  outline: "none",
  padding: "16px",
  width: "100%",
  transition: "border-color 0.2s",
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AppPage() {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("1");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);

  const idRef = useRef(0);

  // ── Fluppy Hook ────────────────────────────────────────────────────────────
  const {
    walletAddress,
    connectWallet,
    credentialStatus,
    checkCredentialStatus,
    setupCredential,
    loading,
    txHash,
    logs: hookLogs,
    proofProgress,
    setTxHash,
    executePayment,
  } = useFluppy();

  const { add: addToSdkHistory } = useFluppyHistory();

  const lastRecordedSdkTxRef = useRef<string | null>(null);

  // SDK wallet hook — additive, does not replace the existing app wallet flow.
  const sdkWallet = useFluppyWallet();

  // SDK payment hooks — experimental path only, primary payment flow remains unchanged.
  const sdkCredential = useFluppyCredential();
  const sdkPayment = useFluppyPayment();

  // ── Konversi hookLogs (string[]) → LogEntry[] ──────────────────────────────
  const hookLogEntries: LogEntry[] = hookLogs.map((text, i) => {
    const isSuccess = text.includes("✓") || text.includes("SUCCES") || text.includes("SUKSES");
    const isError = text.includes("❌") || text.includes("FAIL") || text.includes("FAILED");

    const icon = isSuccess
      ? <Icon icon="ph:check-circle" className="text-green-400" />
      : isError
        ? <Icon icon="ph:x-circle" className="text-red-400" />
        : text.includes("ZKP")
          ? <Icon icon="ph:lock" className="text-blue-400" />
          : text.includes("Merkle")
            ? <Icon icon="ph:calculator" className="text-yellow-400" />
            : text.includes("Stellar")
              ? <Icon icon="ph:paper-plane-tilt" className="text-[#163300]" />
              : text.includes("Finance")
                ? <Icon icon="ph:currency-dollar" className="text-emerald-400" />
                : <Icon icon="ph:gear" className="text-gray-400" />;

    const kind: LogKind = isSuccess ? "success" : isError ? "error" : "info";

    return { id: i + 1000, icon, text, kind };
  });

  const allLogs = [...localLogs, ...hookLogEntries];
  const done = hookLogs.some(l => l.includes("SUKSES"));

  // ── Cek credential saat wallet connect ────────────────────────────────────
  useEffect(() => {
    if (walletAddress) {
      checkCredentialStatus();
    }
  }, [walletAddress, checkCredentialStatus]);

  const recordSdkHistory = (
    confirmedTxHash: string,
    paymentAmount: string,
    merchantAddress: string,
  ) => {
    if (
      !confirmedTxHash ||
      confirmedTxHash === lastRecordedSdkTxRef.current
    ) {
      return;
    }

    const amountNum = parseFloat(paymentAmount);

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    const amountInStroops = BigInt(
      Math.floor(amountNum * 10_000_000),
    );

    const record: FluppyPaymentRecord = {
      txHash: confirmedTxHash,
      amount: amountInStroops,
      merchant: merchantAddress,
      timestamp: Date.now(),
      status: "success",
      explorerUrl: buildExplorerUrl(confirmedTxHash),
    };

    addToSdkHistory(record);
    lastRecordedSdkTxRef.current = confirmedTxHash;
  };



  // ── Tambah log lokal ──────────────────────────────────────────────────────
  const addLocalLog = useCallback((icon: React.ReactNode, text: string, kind: LogKind = "info") => {
    setLocalLogs(p => [...p, { id: ++idRef.current, icon, text, kind }]);
  }, []);

  // ── Connect wallet ────────────────────────────────────────────────────────
  const handleConnectWallet = async () => {
    try {
      const status = await isConnected();

      if (!status.isConnected) {
        alert("Please install the Freighter extension!");
        window.open("https://freighter.app", "_blank");
        return;
      }

      // Step 1: existing wallet flow.
      // The current payment system still relies on walletAddress from useFluppy().
      await connectWallet();

      // Step 2: additive SDK wallet sync.
      // This prepares the app for future SDK migration without changing payment behavior.
      try {
        await sdkWallet.refresh();
      } catch {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[SDK-1C-6B] sdkWallet.refresh() failed — old wallet flow remains intact.",
          );
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);

      addLocalLog(
        <Icon icon="ph:x-circle" className="text-red-400" />,
        `Wallet error: ${message}`,
        "error",
      );
    }
  };

  // ── Setup credential baru ─────────────────────────────────────────────────
  const handleSetupCredential = async () => {
    if (!newPassword || newPassword.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    try {
      const secret = await setupCredential(newPassword);
      setSetupSecret(secret);
      addLocalLog(
        <Icon icon="ph:key" className="text-[#163300]" />,
        "ZK credential created successfully!",
        "success",
      );
      addLocalLog(
        <Icon icon="ph:shield-check" className="text-yellow-400" />,
        "⚠️  Save your backup secret in a safe place!",
        "info",
      );
    } catch (e: any) {
      addLocalLog(
        <Icon icon="ph:x-circle" className="text-red-400" />,
        `Setup failed: ${e.message}`,
        "error",
      );
    }
  };

  // Restore wallet state when returning to /app from another route.
  // Freighter may still be connected while the old in-memory walletAddress was reset.
  useEffect(() => {
    if (walletAddress) return;

    let cancelled = false;

    const restoreWallet = async () => {
      try {
        await sdkWallet.refresh();

        if (cancelled) return;

        if (sdkWallet.isConnected || sdkWallet.address) {
          await connectWallet();
        }
      } catch {
        // Non-fatal: user can still connect manually.
      }
    };

    void restoreWallet();

    return () => {
      cancelled = true;
    };

    // Intentional: run when /app mounts or SDK wallet state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, sdkWallet.isConnected, sdkWallet.address]);

  // Sync SDK wallet state when the existing app walletAddress is already populated.
  // This is best-effort and does not replace the current wallet flow.
  useEffect(() => {
    if (!walletAddress) return;

    void sdkWallet.refresh().catch(() => {
      // Non-fatal: old wallet flow remains the source of truth.
    });

    // Intentional: only sync when old walletAddress becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  // DEV ONLY: warn if SDK wallet address differs from the existing app wallet address.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!walletAddress || !sdkWallet.address) return;

    if (walletAddress !== sdkWallet.address) {
      console.warn("[SDK-1C-6B DEV] Wallet address mismatch:", {
        old: walletAddress,
        sdk: sdkWallet.address,
      });
    }
  }, [walletAddress, sdkWallet.address]);

  // ── Execute payment ───────────────────────────────────────────────────────
  const handleRunPayment = async () => {
    if (!walletAddress) {
      alert("Please connect your Freighter wallet first!");
      return;
    }
    if (loading) return;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Invalid amount!");
      return;
    }
    if (!password) {
      alert("Enter your password to unlock the credential!");
      return;
    }

    setLocalLogs([]);
    setTxHash(null);

    const paymentAmount = amount;
    const paymentDestination = destination;

    const confirmedTxHash = await executePayment(
      paymentAmount,
      paymentDestination,
      password,
    );

    if (confirmedTxHash) {
      recordSdkHistory(
        confirmedTxHash,
        paymentAmount,
        paymentDestination,
      );
    }
  };

  // ── Experimental SDK payment path ─────────────────────────────────────────
  const handleRunSdkPayment = async () => {
    if (!walletAddress) {
      alert("Please connect your Freighter wallet first!");
      return;
    }

    if (loading || sdkPayment.isLoading) return;

    const amountNum = parseFloat(amount);

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      alert("Invalid amount!");
      return;
    }

    if (!destination) {
      alert("Please enter a destination address!");
      return;
    }

    if (!password) {
      alert("Enter your password to unlock the credential!");
      return;
    }

    if (credentialStatus !== "exists") {
      alert("Credential belum tersedia di perangkat ini.");
      return;
    }

    const paymentAmount = amount;
    const paymentDestination = destination;
    const amountInStroops = BigInt(
      Math.floor(amountNum * 10_000_000),
    );

    try {
      sdkPayment.resetError();

      addLocalLog(
        <Icon icon="ph:shield-check" className="text-[#163300]" />,
        "SDK Demo: Unlocking credential for experimental payment...",
        "info",
      );

      // The secret is kept only in this async function scope.
      // It is not stored in React state and must never be logged.
      const secret = await sdkCredential.unlock(password);

      addLocalLog(
        <Icon icon="ph:package" className="text-blue-400" />,
        "SDK Demo: Running useFluppyPayment experimental path...",
        "info",
      );

      const result = await sdkPayment.pay({
        secret,
        merchant: paymentDestination,
        amount: amountInStroops,
      });

      const confirmedTxHash = result.txHash;

      if (confirmedTxHash) {
        recordSdkHistory(
          confirmedTxHash,
          paymentAmount,
          paymentDestination,
        );

        addLocalLog(
          <Icon icon="ph:check-circle" className="text-green-400" />,
          `SDK Demo: Transaction confirmed (${confirmedTxHash.slice(0, 10)}...)`,
          "success",
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);

      addLocalLog(
        <Icon icon="ph:x-circle" className="text-red-400" />,
        `SDK Demo failed safely: ${message}`,
        "error",
      );
    }
  };

  const navItems = [{
    label: "Return to Home",
    bgColor: T.card,
    textColor: "#fff",
    links: [
      { label: "Back", href: "/", ariaLabel: "Home" },
      { label: "Developer Docs", href: "/docs", ariaLabel: "Open Fluppy developer documentation" },
    ],
  }];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative min-h-screen antialiased overflow-x-hidden"
      style={{ background: T.bg, color: T.fg }}
    >
      <div className="relative z-10 pt-4">
        <Navbar
          publicKey={walletAddress}
          onConnectWallet={handleConnectWallet}
          items={navItems}
          baseColor="rgba(18, 15, 23, 0.4)"
        />

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">

          {/* Judul */}
          <div className="mb-10">
            <h1
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: T.primary }}
            >
              Live DApp
            </h1>
            <h2 className="text-3xl font-bold text-[#0e0f0c] mt-2">Execute Payment.</h2>
          </div>

          {/* ── Banner: belum punya credential ─────────────────────────── */}
          {walletAddress && credentialStatus === "not_found" && !showSetup && (
            <div className="mb-6 p-6 rounded-2xl border border-yellow-400/30 bg-yellow-400/5">
              <p className="text-sm text-yellow-300 mb-3">
                ⚠️ You do not have a ZK Credential yet. Create one before making a payment.
              </p>
              <button
                onClick={() => setShowSetup(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-black"
                style={{ background: T.primary }}
              >
                <Icon icon="ph:user-plus" /> Create ZK Credential
              </button>
            </div>
          )}

          {/* ── Panel setup credential ─────────────────────────────────── */}
          {showSetup && credentialStatus === "not_found" && (
            <div className="mb-6 p-6 rounded-2xl border border-[#9fe870]/40 bg-[#9fe870]/10 space-y-4">
              <h3 className="text-sm font-bold text-[#0e0f0c]">Create New ZK Credential</h3>

              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
              />

              <button
                onClick={handleSetupCredential}
                className="w-full py-3 rounded-xl font-bold text-black text-sm"
                style={{ background: T.primary }}
              >
                Create & Encrypt Credential
              </button>

              {/* Secret backup — tampil SEKALI */}
              {setupSecret && (
                <div className="p-4 rounded-xl bg-black/40 border border-green-400/30">
                  <p className="text-xs text-green-300 mb-2 font-bold">
                    ✓ Backup Secret (save it now!):
                  </p>
                  <p className="text-xs font-mono text-[#0e0f0c] break-all">
                    {setupSecret}
                  </p>
                  <p className="text-xs text-yellow-300 mt-2">
                    ⚠️ This secret is shown only ONCE. Store it safely.
                  </p>
                  <button
                    onClick={() => { setShowSetup(false); setSetupSecret(null); }}
                    className="mt-3 text-xs px-4 py-2 rounded-lg text-black font-bold"
                    style={{ background: T.primary }}
                  >
                    I have saved it →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Main Grid ──────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-6">

            {/* KIRI: FORM */}
            <SolidCard className="p-8 h-full flex flex-col justify-between">
              <div className="space-y-6">

                {/* Password credential */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Password ZK Credential
                  </label>
                  <div className="relative">
                    <Icon icon="ph:lock" className="absolute left-5 top-[18px] text-[#454745] text-lg" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter credential password"
                      style={{ ...inputStyle, paddingLeft: 46, paddingRight: 46 }}
                      onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-5 top-[18px] text-[#454745] hover:text-[#0e0f0c] transition-colors"
                    >
                      {showPassword ? <Icon icon="ph:eye-slash" /> : <Icon icon="ph:eye" />}
                    </button>
                  </div>

                  {/* Status credential */}
                  <p
                    className="text-xs mt-2"
                    style={{
                      color:
                        credentialStatus === "exists"
                          ? "#4ade80"
                          : credentialStatus === "not_found"
                            ? "#f87171"
                            : T.muted,
                    }}
                  >
                    {credentialStatus === "exists" && "✓ Credential found on this device"}
                    {credentialStatus === "not_found" && "⚠ No credential found — create one first"}
                    {credentialStatus === "unknown" && "Connect wallet to check credential"}
                  </p>
                </div>

                {/* Destination */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Destination Address (Merchant)
                  </label>
                  <input
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    placeholder="G... Stellar address"
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
                    onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                    onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Amount (USDC)
                  </label>
                  <div className="relative">
                    <Icon icon="ph:currency-dollar" className="absolute left-5 top-[18px] text-[#454745] text-lg" />
                    <input
                      type="number"
                      step="0.1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: 42 }}
                      onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                      onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                    />
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <div className="mt-10">
                <button
                  onClick={handleRunPayment}
                  disabled={
                    loading ||
                    !password ||
                    !destination ||
                    !amount ||
                    credentialStatus !== "exists"
                  }
                  className="w-full py-4 rounded-xl font-bold text-black transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl flex justify-center items-center gap-2"
                  style={{ background: T.primary }}
                >
                  {loading ? (
                    <>
                      <Icon icon="ph:gear" className="animate-spin text-lg" />
                      Executing ZKP...
                    </>
                  ) : done ? (
                    <>
                      <Icon icon="ph:arrow-clockwise" className="text-lg" />
                      Pay Again
                    </>
                  ) : (
                    <>
                      <Icon icon="ph:shield-check" className="text-lg" />
                      Pay with ZK
                    </>
                  )}
                </button>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <button
                    onClick={handleRunSdkPayment}
                    disabled={
                      loading ||
                      sdkPayment.isLoading ||
                      !walletAddress ||
                      !password ||
                      !destination ||
                      !amount ||
                      credentialStatus !== "exists"
                    }
                    className="w-full py-3 rounded-xl font-bold text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-[#9fe870]/40 text-[#163300] hover:bg-[#9fe870]/20 flex justify-center items-center gap-2"
                    type="button"
                  >
                    {sdkPayment.isLoading ? (
                      <>
                        <Icon icon="ph:gear" className="animate-spin text-lg" />
                        Running SDK Payment...
                      </>
                    ) : (
                      <>
                        <Icon icon="ph:package" className="text-lg" />
                        Run SDK Payment (Experimental)
                      </>
                    )}
                  </button>

                  <p className="mt-2 text-[11px] leading-relaxed text-[#454745]">
                    Experimental SDK path using @flupy/react useFluppyPayment.
                    The primary Pay button above remains the stable flow.
                  </p>

                  {(sdkPayment.currentStep || sdkPayment.progressStage || sdkPayment.txHash || sdkPayment.error) && (
                    <div className="mt-3 space-y-1 rounded-lg bg-black/5 p-3 text-[11px] font-mono text-[#454745]">
                      {sdkPayment.currentStep && (
                        <div>step: {sdkPayment.currentStep}</div>
                      )}
                      {sdkPayment.progressStage && (
                        <div>
                          proof: {sdkPayment.progressStage}
                          {typeof sdkPayment.progressPct === "number" ? ` (${sdkPayment.progressPct}%)` : ""}
                        </div>
                      )}
                      {sdkPayment.txHash && (
                        <div className="break-all text-green-300">
                          tx: {sdkPayment.txHash}
                        </div>
                      )}
                      {sdkPayment.error && (
                        <div className="break-all text-red-300">
                          error: {sdkPayment.error.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Proof Progress */}
              {proofProgress && (
                <div className="mt-4">
                  <ProofProgressBar
                    stage={proofProgress.stage}
                    pct={proofProgress.pct}
                  />
                </div>
              )}
            </SolidCard>

            {/* KANAN: TERMINAL */}
            <TerminalLog logs={allLogs} running={loading} txHash={txHash} />
            {/* Transaction History */}
            <div className="mt-6">
              <TxHistoryPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}