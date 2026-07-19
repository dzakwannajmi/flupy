# 💻 Flupy — Frontend Application (`/app`)

This directory contains the Next.js web interface for the Flupy Protocol.

The app handles browser-side ZK proof generation, Freighter wallet integration,
Merkle proof retrieval, contract root synchronization, Soroban transaction submission,
progress UX, error mapping, telemetry, and local transaction history.

> ⚠️ **Testnet Notice**
>
> This application currently connects to Stellar Testnet only.
> Flupy is a production-candidate Testnet implementation, not a mainnet financial product.
>
> The current on-chain verifier uses a demo-mode backend while browser-side
> `snarkjs.groth16.verify()` is enforced before every contract submission.
> See [`../SECURITY.md`](../SECURITY.md) for current limitations.

## 📋 Table of Contents

- [Current Status](#current-status)
- [Directory Structure](#directory-structure)
- [Payment Flow](#payment-flow)
- [Technical Stack](#technical-stack)
- [Environment Configuration](#environment-configuration)
- [Local Setup](#local-setup)
- [Key Source Files](#key-source-files)
- [Circuit Artifacts](#circuit-artifacts)
- [API Routes](#api-routes)
- [Merkle Root Synchronization](#merkle-root-synchronization)
- [Frontend Security Architecture](#frontend-security-architecture)
- [Verified Evidence](#verified-evidence)
- [Frontend Validation Checklist](#frontend-validation-checklist)
- [Current Frontend Limitations](#current-frontend-limitations)
- [Next Frontend Milestones](#next-frontend-milestones)
- [License](#license)

---

<a id="current-status"></a>

## 🚦 Current Status

**Phase 3D — Production Testnet E2E + Full SDK Integration**

The deployed Vercel frontend successfully:

- loads Groth16 circuit artifacts from production static assets,
- generates Groth16 proofs in the browser,
- verifies proofs locally before submission,
- checks Merkle root synchronization against the Soroban contract,
- signs transactions through Freighter,
- submits Soroban `execute_payment` calls,
- confirms transactions on Stellar Testnet,
- persists local transaction history in the browser.

Live app:

```text
https://flupy.vercel.app/app
```

Latest verified Stellar Testnet transaction:

```text
ca6227fd5c426cc2ab1dbd9c2ee2fb6a4fce16fb0b87412408d3a5cbe405b244
```

Explorer:

```text
https://stellar.expert/explorer/testnet/tx/ca6227fd5c426cc2ab1dbd9c2ee2fb6a4fce16fb0b87412408d3a5cbe405b244
```

---

<a id="directory-structure"></a>

## 📁 Directory Structure

```text
app/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing page
│   │   └── app/
│   │       └── page.tsx             # Main payment UI
│   │
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── ProofProgressBar.tsx     # Proof generation progress UX
│   │   └── TxHistoryPanel.tsx       # Local transaction history UI
│   │
│   ├── hooks/
│   │   └── useFlupy.ts             # Stable app payment orchestration hook
│   │
│   └── lib/
│       ├── errorMapper.ts           # Raw errors → user-friendly messages
│       ├── history.ts               # IndexedDB transaction history
│       ├── identity.ts              # Encrypted credential storage
│       ├── merkle.ts                # Browser Merkle client wrapper
│       ├── sentryCapture.ts         # Sentry payment error capture
│       ├── stellar.ts               # Soroban XDR + Freighter submit layer
│       ├── telemetry.ts             # Internal trace logging
│       └── zkp.ts                   # Legacy/direct ZK helpers if needed
│
├── public/
│   └── circuit/
│       └── v3/
│           ├── flupy_payment.wasm
│           ├── circuit_final.zkey.bin
│           └── verification_key.json
│
├── sentry.client.config.ts
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── next.config.ts
└── package.json
```

---

<a id="payment-flow"></a>

## 🔄 Payment Flow

```text
User connects Freighter wallet
        │
        ▼
User unlocks encrypted ZK credential
        │
        ▼
Frontend computes commitment only
        │
        ▼
POST /api/merkle-proof/enroll
        │
        ▼
GET /api/merkle-proof
        │
        ▼
GET /api/merkle-root
        │
        ▼
Root sync guard:
  Merkle proof root must match contract root
        │
        ▼
Browser SDK loads circuit artifacts:
  /circuit/v3/flupy_payment.wasm
  /circuit/v3/circuit_final.zkey.bin
  /circuit/v3/verification_key.json
        │
        ▼
snarkjs.groth16.fullProve()
        │
        ▼
snarkjs.groth16.verify()
        │
        ▼
stellar.ts encodes proof:
  pi_a = 64 bytes
  pi_b = 128 bytes
  pi_c = 64 bytes
  publicSignals = 7 × BytesN<32>
        │
        ▼
Freighter signs transaction
        │
        ▼
Soroban RPC simulation + submission
        │
        ▼
Contract execute_payment()
        │
        ▼
Transaction confirmed on Stellar Testnet
        │
        ▼
Local transaction history updated
```

---

<a id="technical-stack"></a>

## 🧩 Technical Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| ZK Proving | Circom + SnarkJS |
| Proof System | Groth16 |
| Curve | BN254 |
| ZK Hashing | Poseidon-based Merkle tree |
| Circuit Artifacts | WASM + ZKey + verification key |
| Browser SDK | `@flupy/browser` |
| React SDK | `@flupy/react` |
| Core SDK | `@flupy/core` |
| Identity Storage | IndexedDB + PBKDF2 + AES-GCM |
| Blockchain SDK | `@stellar/stellar-sdk` |
| Wallet | `@stellar/freighter-api` |
| UI Animation | `framer-motion` |
| Styling | Tailwind CSS |
| Notifications | `react-hot-toast` |
| Error Tracking | Sentry scaffold |
| Deployment | Vercel |
| Network | Stellar Testnet |

---

<a id="environment-configuration"></a>

## ⚙️ Environment Configuration

Create `app/.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ID=CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

NEXT_PUBLIC_TRACE=false
```

### Notes

- `NEXT_PUBLIC_CONTRACT_ID` points to the current Stellar Testnet Soroban contract.
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` is used for chainId binding.
- Sentry variables are optional in local development.
- `NEXT_PUBLIC_TRACE=true` enables internal trace logs in development.

---

<a id="local-setup"></a>

## 🛠️ Local Setup

### Prerequisites

- Node.js v18+
- pnpm or npm
- Freighter Wallet browser extension
- Freighter configured for Stellar Testnet

### Installation

```bash
cd app
npm install
```

or from the monorepo root:

```bash
pnpm install
```

### Development Server

```bash
cd app
npm run dev
```

Open:

```text
http://localhost:3000/app
```

### Production Build

```bash
cd app
npm run build
npm start
```

---

<a id="key-source-files"></a>

## 🔑 Key Source Files

### `src/hooks/useFlupy.ts`

Stable app-level orchestration hook.

Responsibilities:

- wallet connection state
- credential status checks
- credential setup
- payment execution
- proof progress state
- root sync validation
- local verification flow
- Freighter signing trigger
- transaction status handling
- Sentry capture
- internal telemetry
- history update
- user-facing logs

This hook intentionally remains the stable app path while `@flupy/react` adoption happens incrementally.

---

### `src/lib/merkle.ts`

Browser-side Merkle API client wrapper.

Responsibilities:

- commitment generation
- testnet/mock enrollment request
- Merkle proof request
- frontend logging for proof retrieval

Endpoints used:

```text
POST /api/merkle-proof/enroll
GET /api/merkle-proof
```

---

### `src/lib/stellar.ts`

Soroban transaction layer.

Responsibilities:

- proof byte validation
- ScVal encoding
- Freighter signing
- Soroban simulation
- transaction submission
- transaction polling
- contract root retrieval through `/api/merkle-root`

Contract function:

```text
execute_payment(from, to, amount, pi_a, pi_b, pi_c, public_inputs)
```

---

### `src/lib/errorMapper.ts`

Maps technical errors into user-friendly messages.

Examples:

| Error Pattern | User Message |
|---|---|
| `Error(Contract, #4)` | Payment proof was already used |
| `Error(Contract, #12)` | Enrollment state changed / root mismatch |
| `RootSyncError` | Contract Merkle root is out of sync |
| wrong password / corrupted credential | Wrong password or recreate credential |
| Freighter rejected | Transaction was cancelled |
| artifact 404 | Circuit artifact missing or deployment issue |

---

### `src/lib/history.ts`

Local transaction history layer.

Responsibilities:

- stores transaction metadata only
- persists across refresh
- stores status: `pending`, `success`, `failed`
- stores explorer URL
- avoids storing secrets, passwords, or raw proofs

Storage:

```text
IndexedDB
```

---

### `src/lib/telemetry.ts`

Lightweight internal tracing.

Example trace steps:

```text
credential:decrypt
merkle:request
merkle:received
proof:start
proof:generating
proof:done
wallet:sign_request
tx:submit
tx:confirmed
tx:failed
trace:summary
```

Tracing is local and does not persist sensitive data.

---

### `src/lib/sentryCapture.ts`

Sentry payment error capture helper.

Security rules:

- wallet addresses are masked
- secrets are not captured
- raw proofs are not captured
- circuit inputs are not captured
- amount and tx hash may be included as non-secret metadata

---

<a id="circuit-artifacts"></a>

## 📦 Circuit Artifacts

Production circuit artifacts are served from:

```text
/circuit/v3/flupy_payment.wasm
/circuit/v3/circuit_final.zkey.bin
/circuit/v3/verification_key.json
```

The proving key is served as:

```text
circuit_final.zkey.bin
```

instead of:

```text
circuit_final.zkey
```

for Vercel static deployment compatibility.

### Required Local Files

```text
app/public/circuit/v3/flupy_payment.wasm
app/public/circuit/v3/circuit_final.zkey.bin
app/public/circuit/v3/verification_key.json
```

### Local Artifact Check

```bash
curl -I http://localhost:3000/circuit/v3/flupy_payment.wasm
curl -I http://localhost:3000/circuit/v3/circuit_final.zkey.bin
curl -I http://localhost:3000/circuit/v3/verification_key.json
```

Expected:

```text
HTTP/1.1 200 OK
```

### Production Artifact Check

```bash
curl -I https://flupy.vercel.app/circuit/v3/flupy_payment.wasm
curl -I https://flupy.vercel.app/circuit/v3/circuit_final.zkey.bin
curl -I https://flupy.vercel.app/circuit/v3/verification_key.json
```

Expected:

```text
HTTP/2 200
```

Observed production artifact sizes:

```text
flupy_payment.wasm       = 2,243,297 bytes
circuit_final.zkey.bin    = 5,913,232 bytes
verification_key.json     = 4,028 bytes
```

---

<a id="api-routes"></a>

## 🌐 API Routes Used by Frontend

### `POST /api/merkle-proof/enroll`

Enrolls a commitment into the current Testnet Merkle tree.

This endpoint is used for mock/Testnet onboarding and does not receive raw secrets.

---

### `GET /api/merkle-proof`

Returns the full enrolled leaf set + root -- the same response for every
caller, regardless of which commitment they hold. The client locates its
own leaf and computes its Merkle path entirely locally, rather than
asking the server for a path to a specific commitment.

Response:

```json
{
  "leaves": ["..."],
  "root": "..."
}
```

This design avoids a timing side-channel: a per-commitment lookup would
let the server infer "this session is about to pay, right now" from
request timing, and correlate that with the payment transaction landing
seconds later.

---

### `GET /api/merkle-root`

Returns the active Merkle root stored in the Soroban contract.

This endpoint is used by the frontend root sync guard before proof generation.

---

<a id="merkle-root-synchronization"></a>

## 🔐 Merkle Root Synchronization

Before proof generation, the frontend compares:

1. Merkle proof root from `/api/merkle-proof`
2. Contract root from `/api/merkle-root`

If the values differ, proof generation is stopped.

This prevents:

- stale proof generation
- wasted proving time
- `RootMismatch` contract failures

Verified root sync evidence:

```text
Contract root:

01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972

Merkle proof root decimal:

825860214526777548768231888040603757085006455794519490744185581216954935666

Decimal root converted to hex:

01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972
```

Result:

```text
frontend/backend Merkle root == on-chain contract Merkle root
```

---

<a id="frontend-security-architecture"></a>

## 🔒 Frontend Security Architecture

### Cross-Origin Isolation

The app enables COOP/COEP headers for WASM and browser proof generation compatibility:

```ts
{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
{ key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
```

---

### Identity Privacy

- Raw credential never leaves the browser.
- Backend receives commitment only.
- Password is never stored.
- Password is never logged.
- Raw secret is never logged.
- Raw secret is not stored in React state.
- Credential is encrypted in IndexedDB using PBKDF2 + AES-GCM.

---

### Proof Privacy

- Proof generation happens locally in the browser.
- Local proof verification runs before transaction submission.
- Raw proof data is not logged by the React SDK.
- Only encoded proof bytes and public signals are sent to the contract.

---

### Transaction Safety

- User signs through Freighter.
- Frontend validates Freighter network.
- Contract checks nullifier, root, recipient hash, chainId, and amount constraints.
- Transaction history stores metadata only.
- Explorer links point to Stellar Testnet.

---

### Error Safety

The app maps technical errors to user-facing messages.

Examples:

- wrong password
- Freighter rejected
- contract paused
- nullifier already spent
- root mismatch
- invalid proof
- network mismatch
- artifact missing

Raw stack traces are retained only in developer console for debugging.

---

<a id="verified-evidence"></a>

## 📺 Verified Evidence

| Item | Value |
|---|---|
| Live App | `https://flupy.vercel.app/app` |
| Contract ID | `CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS` |
| Latest Transaction | `ca6227fd5c426cc2ab1dbd9c2ee2fb6a4fce16fb0b87412408d3a5cbe405b244` |
| Explorer | `https://stellar.expert/explorer/testnet/tx/ca6227fd5c426cc2ab1dbd9c2ee2fb6a4fce16fb0b87412408d3a5cbe405b244` |
| GitHub | `https://github.com/dzakwannajmi/Flupy` |

### Runtime Evidence

```text
[Merkle] Proof received
[artifacts] Loaded: WASM=2243297 bytes | ZKEY=5913232 bytes
[prover] Proof generated: pi_a=64B pi_b=128B pi_c=64B
[stellar] Simulating transaction...
[stellar] Awaiting Freighter signature...
[stellar] Submitting transaction to the network...
[stellar] ✓ Transaction confirmed
```

### Recent Transaction History

The frontend persists local transaction history with:

- amount
- recipient preview
- tx hash preview
- status
- timestamp
- explorer URL

No secrets, passwords, or raw proofs are stored in history.

---

<a id="frontend-validation-checklist"></a>

## ✅ Frontend Validation Checklist

### Local Build

```bash
cd app
npm run build
```

Expected:

```text
Compiled successfully
TypeScript passed
```

### Artifact Validation

```bash
curl -I https://flupy.vercel.app/circuit/v3/flupy_payment.wasm
curl -I https://flupy.vercel.app/circuit/v3/circuit_final.zkey.bin
curl -I https://flupy.vercel.app/circuit/v3/verification_key.json
```

Expected:

```text
HTTP/2 200
```

### Root Sync Validation

```bash
curl https://flupy.vercel.app/api/merkle-root
```

Expected:

```json
{
  "root": "01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972"
}
```

### Runtime Validation

Expected browser console flow:

```text
[Merkle] Requesting proof
[Merkle] Proof received
[artifacts] Loading circuit artifacts
[artifacts] Loaded
[prover] Proof generated
[stellar] Simulating transaction
[stellar] Awaiting Freighter signature
[stellar] Submitting transaction
[stellar] Transaction confirmed
```

---

<a id="current-frontend-limitations"></a>

## 🚧 Current Frontend Limitations

The frontend is production-candidate for Stellar Testnet, but not mainnet-ready.

Known limitations:

- proof generation currently runs on the browser main thread,
- artifact checksum validation is not yet implemented,
- offline artifact preload is not yet implemented,
- mobile performance testing is not yet complete,
- API rate limiting is not yet production-hardened,
- persistent Merkle storage is not yet deployed,
- incremental `@flupy/react` app integration is complete (SDK-1C-6A through 6D validated on Testnet),
- native on-chain BN254 pairing verification is still pending Soroban SDK support.

---

<a id="next-frontend-milestones"></a>

## 🗺️ Next Frontend Milestones

### 1. Runtime Hardening

- Move Groth16 proof generation into a Web Worker.
- Add proof generation timeout handling.
- Add cancellation-safe proof lifecycle.
- Add artifact checksum validation for WASM, ZKey, and verification key.
- Add offline artifact preload.

### 2. UX Hardening

- Improve proof progress estimation.
- Improve error recovery actions.
- Add better credential reset UX.
- Improve mobile layout and test on Android/iOS browsers.

### 3. SDK Integration (Complete — SDK-1C-6)

- ✅ `useFlupyHistory` — localStorage persistence (SDK-1C-6A)
- ✅ `useFlupyWallet` — Freighter bridge (SDK-1C-6B)
- ✅ `FlupyProvider` — context in /app subtree via providers.tsx (SDK-1C-6C)
- ✅ `useFlupyPayment` — experimental SDK path E2E confirmed on Testnet (SDK-1C-6D)

Both the primary payment path (`executeFlupyPayment`) and SDK hook path
(`useFlupyPayment`) are confirmed on Stellar Testnet with valid on-chain
95/5 atomic splits.

### 4. Observability

- Complete Sentry environment configuration.
- Add production-safe error grouping.
- Add transaction trace IDs to payment failure reports.
- Prepare future Datadog/OpenTelemetry integration.

---

<a id="license"></a>

## 📜 License

MIT