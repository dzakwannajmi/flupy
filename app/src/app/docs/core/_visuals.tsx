import type { ReactNode } from "react";

export function PageBadges() {

}

const MODULE_COLORS: Record<string, string> = {
  blue: "border-blue-500/20 text-blue-700",
  red: "border-red-500/20 text-red-700",
  purple: "border-purple-500/20 text-purple-700",
  gray: "border-black/15 text-[#454745]",
  yellow: "border-yellow-500/20 text-amber-700",
  pink: "border-[#9fe870]/20 text-[#163300]",
};

export function ModuleMap() {
  const modules: [string, string, string][] = [
    ["constants.ts", "blue", "BN254_R, CIRCUIT_DEPTH, N_PUBLIC, POSEIDON_TAGS, DEFAULT_MAX_AMOUNT, usdcToStroops()"],
    ["errors.ts", "red", "FluppyError class hierarchy and parseFluppyError() parser"],
    ["encoding.ts", "purple", "G1/G2 Soroban wire format encoding and field element conversion"],
    ["types.ts", "gray", "PaymentProofOutput, MerkleProof, ProofProgress, FluppyCoreConfig, PaymentResult"],
    ["recipient-hash.ts", "yellow", "computeRecipientHash() — BN254-safe Stellar address hash"],
    ["payer-hash.ts", "yellow", "computePayerHash() — BN254-safe Stellar address hash (payer binding)"],
    ["chain-id.ts", "pink", "computeChainId() — network passphrase → BN254-safe chain identifier"],
  ];
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

export function BindingCards() {
  return (
    <div className="not-typeset grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[#0e0f0c]">computeRecipientHash()</h3>
        <p className="text-xs text-[#454745]">
          XDR-encodes the merchant Stellar address, SHA-256 hashes the bytes, then zeroes the
          most-significant byte to guarantee the result fits within the BN254 scalar field.
          This value is used as the <code>recipientHash</code> public signal — binding the
          proof to a specific merchant address.
        </p>
      </div>
      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[#0e0f0c]">computeChainId()</h3>
        <p className="text-xs text-[#454745]">
          SHA-256 hashes the Stellar network passphrase (e.g. "Test SDF Network ; September 2015"),
          then zeroes the MSB. The result is included as the <code>chainId</code> public signal.
          A proof generated on one network will be rejected on a different network because the
          chainId values differ — preventing cross-network replay attacks.
        </p>
      </div>
    </div>
  );
}

export function EncodingTerminal() {
  return (
    <div className="not-typeset overflow-hidden rounded-xl border border-black/10 bg-white p-4 text-xs text-[#454745]">
      <div className="space-y-1 font-mono">
        <div><span className="text-gray-600">// G1 (pi_a, pi_c): 64 bytes = x_be32 ‖ y_be32</span></div>
        <div><span className="text-blue-700">encodeG1</span>([x, y, '1']) <span className="text-gray-600">→ 128-char hex string</span></div>
        <div className="mt-2"><span className="text-gray-600">// G2 (pi_b): 128 bytes = x_c1 ‖ x_c0 ‖ y_c1 ‖ y_c0</span></div>
        <div><span className="text-blue-700">encodeG2</span>([[x_c1,x_c0],[y_c1,y_c0],…]) <span className="text-gray-600">→ 256-char hex string</span></div>
        <div className="mt-2"><span className="text-gray-600">// Public signals: 7 × 32 bytes each</span></div>
        <div><span className="text-blue-700">decimalToBe32Hex</span>('123456…') <span className="text-gray-600">→ 64-char hex string</span></div>
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="not-typeset flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-blue-300">
      <span className="shrink-0">ℹ</span>
      <div>{children}</div>
    </div>
  );
}
