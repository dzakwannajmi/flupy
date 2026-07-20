"use client";

import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Icon } from "@iconify/react";
import { isConnected } from "@stellar/freighter-api";
import Navbar from "../../components/Navbar";
import { useFluppy } from "../../hooks/useFluppy";
import { ProofProgressBar } from '../../components/ProofProgressBar';
import { TxHistoryPanel } from '../../components/TxHistoryPanel';
import { PaymentStatCards } from '../../components/PaymentStatCards';
import { PaymentVolumeChart } from '../../components/PaymentVolumeChart';
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

  // ── Estimasi biaya (invoice) ────────────────────────────────────────────
  // Fee protokol 5% dihitung dari amount USDC yang diketik user. Network fee
  // di bawah ini ESTIMASI TETAP (bukan hasil simulasi RPC real-time) --
  // jangan dianggap angka final on-chain.
  const PROTOCOL_FEE_RATE = 0.05;
  const ESTIMATED_NETWORK_FEE_XLM = 0.0142081;
  const estimatedAmount = parseFloat(amount) || 0;
  const protocolFee = estimatedAmount * PROTOCOL_FEE_RATE;
  const merchantReceives = estimatedAmount - protocolFee;
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);

  // ── Fluppy Hook ────────────────────────────────────────────────────────────
  const {
    walletAddress,
    connectWallet,
    credentialStatus,
    checkCredentialStatus,
    setupCredential,
    loading,
    logs: hookLogs,
    proofProgress,
    setTxHash,
    executePayment,
    disconnectWallet,
  } = useFluppy();

  const { add: addToSdkHistory } = useFluppyHistory();

  const lastRecordedSdkTxRef = useRef<string | null>(null);
  // True right after an explicit user-initiated disconnect, so the wallet-restore effect below does not immediately reconnect it.
  const skipAutoRestoreRef = useRef(false);

  // SDK wallet hook — additive, does not replace the existing app wallet flow.
  const sdkWallet = useFluppyWallet();

  // SDK payment hooks — experimental path only, primary payment flow remains unchanged.
  const sdkCredential = useFluppyCredential();
  const sdkPayment = useFluppyPayment();

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



  // ── Connect wallet ────────────────────────────────────────────────────────
  const handleConnectWallet = async () => {
    if (walletAddress) {
      skipAutoRestoreRef.current = true;
      disconnectWallet();
      return;
    }
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

      toast.error(`Wallet error: ${message}`);
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
      toast.success("ZK credential created successfully!");
      toast("⚠️ Save your backup secret in a safe place!", { icon: "🔑" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Setup failed: ${message}`);
    }
  };

  // Restore wallet state when returning to /app from another route.
  // Freighter may still be connected while the old in-memory walletAddress was reset.
  useEffect(() => {
    if (walletAddress) return;
    if (skipAutoRestoreRef.current) return;

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

      toast.loading("Unlocking credential for experimental payment...", {
        id: "sdk-payment",
      });

      // The secret is kept only in this async function scope.
      // It is not stored in React state and must never be logged.
      const secret = await sdkCredential.unlock(password);

      toast.loading("Running useFluppyPayment experimental path...", {
        id: "sdk-payment",
      });

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

        toast.success(
          `SDK Demo: Transaction confirmed (${confirmedTxHash.slice(0, 10)}...)`,
          { id: "sdk-payment" },
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);

      toast.error(`SDK Demo failed safely: ${message}`, { id: "sdk-payment" });
    }
  };

  const navItems = [{
    label: "Return to Home",
    bgColor: T.card,
    textColor: T.fg,
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
          items={navItems}
          baseColor={T.bg}
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

          {/* ── Ringkasan payment (4 box + chart) ─────────────────────────── */}
          <div className="@container/main mb-8 space-y-6">
            <PaymentStatCards />
            <PaymentVolumeChart />
          </div>

          {/* ── Main Grid ──────────────────────────────────────────────── */}
          <div className="grid items-start lg:grid-cols-2 gap-6">

            {/* KIRI: FORM */}
            <SolidCard className="p-8 flex flex-col">
              <div className="space-y-6">

                {/* Connect Wallet */}
                <div>
                  <label
                    className="text-xs font-bold uppercase tracking-widest mb-3 block"
                    style={{ color: T.muted }}
                  >
                    Wallet
                  </label>
                  <button
                    type="button"
                    onClick={handleConnectWallet}
                    className="w-full inline-flex justify-center items-center gap-2 px-5 py-4 rounded-xl text-sm font-bold text-black transition-transform hover:scale-[1.01] active:scale-95 shadow-xl"
                    style={{ background: T.primary }}
                  >
                    {walletAddress ? (
                      <>
                        <Icon icon="ph:sign-out" className="text-lg" />
                        Disconnect Wallet
                      </>
                    ) : (
                      <>
                        <Icon icon="ph:wallet" className="text-lg" />
                        Connect Wallet
                      </>
                    )}
                  </button>
                  {walletAddress && (
                    <p className="text-xs mt-2 font-mono" style={{ color: T.muted }}>
                      Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </p>
                  )}
                </div>

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

                {/* Estimasi biaya (invoice) */}
                {estimatedAmount > 0 && (
                  <div
                    className="rounded-xl border p-4 text-sm space-y-2"
                    style={{ borderColor: T.border, background: "rgba(14, 15, 12, 0.02)" }}
                  >
                    <div className="flex justify-between" style={{ color: T.muted }}>
                      <span>Amount</span>
                      <span style={{ color: T.fg }}>{estimatedAmount.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between" style={{ color: T.muted }}>
                      <span>Protocol fee (5%)</span>
                      <span style={{ color: T.fg }}>- {protocolFee.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between font-semibold" style={{ color: T.fg }}>
                      <span>Merchant receives</span>
                      <span>{merchantReceives.toFixed(2)} USDC</span>
                    </div>
                    <div
                      className="flex justify-between pt-2"
                      style={{ borderTop: `1px solid ${T.border}`, color: T.muted }}
                    >
                      <span>Est. network fee</span>
                      <span style={{ color: T.fg }}>{ESTIMATED_NETWORK_FEE_XLM} XLM</span>
                    </div>
                    <div className="flex justify-between font-semibold" style={{ color: T.fg }}>
                      <span>Total</span>
                      <span>{estimatedAmount.toFixed(2)} USDC + {ESTIMATED_NETWORK_FEE_XLM} XLM</span>
                    </div>
                  </div>
                )}
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

            {/* KANAN: RIWAYAT TRANSAKSI */}
            <TxHistoryPanel />
          </div>
        </div>
      </div>
    </div>
  );
}