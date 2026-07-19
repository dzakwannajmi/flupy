# 🦀 Flupy Smart Contract — Soroban

> ⚠️ **Testnet Notice**
>
> This contract is deployed on **Stellar Testnet** only.
>
> The current build uses a modular Groth16 verifier architecture with a demo-mode BN254 backend while native backend (bn254_native.rs) is compile-clean against Soroban Protocol 26 (soroban-sdk v26) BN254 host functions and ready for on-chain activation.
>
> Do **not** use this contract for real financial transactions until:
>
> - native on-chain BN254 verification is enabled,
> - external audit is complete,
> - admin controls are upgraded to multisig,
> - persistent Merkle storage is deployed,
> - mainnet readiness checklist is complete.
>
> See [`../SECURITY.md`](../SECURITY.md) for the current security model and limitations.

## 📋 Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Module Structure](#module-structure)
- [Contract Function Summary](#contract-function-summary)
- [execute_payment Input Model](#execute_payment-input-model)
- [Payment Execution Flow](#payment-execution-flow)
- [Atomic Settlement](#atomic-settlement)
- [Verifier Architecture](#verifier-architecture)
- [Merkle Root Validation](#merkle-root-validation)
- [Nullifier Replay Protection](#nullifier-replay-protection)
- [ChainId Binding](#chainid-binding)
- [Recipient Hash Binding](#recipient-hash-binding)
- [Events](#events)
- [Error Codes](#error-codes)
- [Security Design](#security-design)
- [Tests](#tests)
- [Build Commands](#build-commands)
- [Deployment Notes](#deployment-notes)
- [Live Evidence](#live-evidence)
- [Known Limitations](#known-limitations)
- [Mainnet Readiness Checklist](#mainnet-readiness-checklist)
- [License](#license)

---

<a id="overview"></a>

## Overview

This directory contains the Soroban smart contract for the Flupy Protocol.

The contract handles:

- authenticated payment execution,
- Merkle root validation,
- nullifier replay protection,
- chainId binding validation,
- recipient hash validation,
- amount bounds validation,
- atomic 95/5 USDC settlement,
- pause / unpause circuit breaker,
- modular Groth16 verifier backend dispatch.

The deployed Testnet contract works together with the browser frontend and SDK:

1. Browser obtains a Merkle proof.
2. Browser checks frontend/backend Merkle root against the on-chain contract root.
3. Browser generates a Groth16 proof with SnarkJS.
4. Browser verifies the proof locally.
5. User signs the transaction with Freighter.
6. Soroban contract validates public inputs and executes settlement.

---

<a id="current-status"></a>

## Current Status

**Phase 3D — Production Testnet E2E + Full SDK Integration**

Verified production Testnet flow:

```text
credential:decrypt              ✓
Merkle proof received           ✓
Frontend root matches contract  ✓
Groth16 proof generated         ✓
Local verification              ✓ VALID
Freighter signing               ✓
Transaction submitted           ✓
Transaction confirmed           ✓
Trace summary                   SUCCESS
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

<a id="module-structure"></a>

## Module Structure

```text
contracts/src/
├── verifier/
│   ├── mod.rs           # Public verifier API + backend dispatch
│   ├── types.rs         # Proof, PublicInputs, VerifyError, N_PUBLIC
│   ├── vk_constants.rs  # Verification key bytes and BN254 constants
│   ├── bn254_demo.rs    # Current Testnet verifier backend
│   └── bn254_native.rs  # Production Groth16 verifier (Protocol 26, compile-clean)
│
├── payment.rs           # Payment execution, public input checks, split logic
├── errors.rs            # FlupyError enum
├── lib.rs               # Contract entrypoint and exported contract API
└── test.rs              # Contract tests
```

Legacy files removed / replaced:

```text
verify.rs  → replaced by verifier/
```

---

<a id="contract-function-summary"></a>

## Contract Function Summary

| Function | Access | Description |
|---|---|---|
| `initialize(...)` | One-time only | Initializes contract config, admin, treasury, asset contract, and protocol state |
| `execute_payment(...)` | Public + signed user | Executes ZK-gated atomic payment settlement |
| `set_merkle_root(...)` | Admin only | Updates active Merkle root used for eligibility verification |
| `set_pause(...)` / pause control | Admin only | Enables or disables payment execution |
| read helpers | Public | Return contract state such as pause status or active Merkle root, depending on exposed functions |

> Function names should remain aligned with `lib.rs`.
> The frontend currently calls the payment entrypoint through `execute_payment`.

---

<a id="execute_payment-input-model"></a>

## `execute_payment` Input Model

The frontend submits a Groth16 proof encoded in Soroban wire format.

Conceptual signature:

```rust
execute_payment(
    from: Address,
    to: Address,
    amount: i128,
    pi_a: BytesN<64>,
    pi_b: BytesN<128>,
    pi_c: BytesN<64>,
    public_inputs: Vec<BytesN<32>>,
)
```

Proof encoding:

```text
pi_a = 64 bytes    # G1 affine point: x_be32 || y_be32
pi_b = 128 bytes   # G2 affine point: x_c1 || x_c0 || y_c1 || y_c0
pi_c = 64 bytes    # G1 affine point: x_be32 || y_be32
```

Public signal count:

```text
N_PUBLIC = 7
```

Public signal ordering:

```text
[0] nullifier
[1] verifiedRoot
[2] merkleRoot
[3] recipientHash
[4] payerHash
[5] amount
[6] chainId
```

This ordering must stay aligned across:

- Circom circuit,
- SnarkJS public signal output,
- browser SDK encoding,
- Soroban contract `payment.rs`,
- verifier module `types.rs`.

---

<a id="payment-execution-flow"></a>

## Payment Execution Flow

```text
User signs transaction with Freighter
        │
        ▼
1. from.require_auth()
        │
        ▼
2. Check contract is not paused
        │
        ▼
3. Decode and validate proof byte sizes
        │
        ▼
4. Validate public input count = 7
        │
        ▼
5. Validate chainId binding
        │
        ▼
6. Validate recipient hash
        │
        ▼
7. Validate amount bounds
        │
        ▼
8. Validate verifiedRoot == merkleRoot
        │
        ▼
9. Validate merkleRoot == active contract root
        │
        ▼
10. Check nullifier is not spent
        │
        ▼
11. Run verifier::verify_proof()
        │
        ▼
12. Mark nullifier as spent
        │
        ▼
13. Execute atomic USDC split:
    - 95% merchant
    - 5% protocol treasury
        │
        ▼
14. Emit payment event
```

---

<a id="atomic-settlement"></a>

## Atomic Settlement

Flupy performs an atomic 95/5 split through the Stellar Asset Contract.

```text
merchant_receive = amount * 95 / 100
protocol_fee     = amount - merchant_receive
```

Settlement properties:

- user signs the full payment amount,
- merchant receives 95%,
- protocol treasury receives 5%,
- split happens in a single contract execution,
- protocol fee is taken from within the payment amount,
- the current MVP does not sponsor user network fees.

---

<a id="verifier-architecture"></a>

## Verifier Architecture

The contract uses a modular verifier layout:

```text
verifier/
├── mod.rs
├── types.rs
├── vk_constants.rs
├── bn254_demo.rs
└── bn254_native.rs
```

### Current Backend: `bn254_demo`

The current Testnet backend performs structural validation and public input range checks but does not execute native on-chain BN254 pairing verification.

Browser-side verification is enforced before submission:

```text
snarkjs.groth16.verify() == true
```

### Future Backend: `bn254_native`

The native backend is **compile-clean and structurally complete** against the
confirmed Soroban Protocol 26 / soroban-sdk v26 BN254 API.

Confirmed host functions (Protocol 26 — CAP-0080):

```text
env.crypto().bn254().g1_msm(points, scalars) → Bn254G1Affine
env.crypto().bn254().g1_add(p0, p1)          → Bn254G1Affine
env.crypto().bn254().g1_mul(p0, scalar)      → Bn254G1Affine
env.crypto().bn254().pairing_check(v1, v2)   → bool
```

Activation path: `cargo build --target wasm32v1-none --features bn254_native`

Remaining step: validate a real Groth16 proof on-chain against the
native pairing check before replacing the demo backend in production.
Protocol 25 (X-Ray) introduced BN254 basics. Protocol 26 (Yardstick /
CAP-0080) added `g1_msm` and scalar arithmetic.

---

<a id="merkle-root-validation"></a>

## Merkle Root Validation

The contract stores an active Merkle root.

Before proof generation, the frontend compares:

1. root returned by `/api/merkle-proof`,
2. root returned by `/api/merkle-root`.

If the roots differ, proof generation is stopped before the expensive Groth16 proving step.

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

<a id="nullifier-replay-protection"></a>

## Nullifier Replay Protection

Each payment proof includes a nullifier.

The contract checks whether the nullifier has already been used.

Expected behavior:

```text
First valid nullifier       → accepted
Same nullifier reused       → rejected
Different valid nullifier   → accepted
```

Security goal:

- prevent replay attacks,
- prevent duplicate settlement,
- enforce one-time proof usage.

---

<a id="chainid-binding"></a>

## ChainId Binding

The circuit includes a chainId derived from the Stellar network passphrase.

The contract validates that the submitted public signal matches the expected network binding.

Security goal:

- prevent cross-network replay,
- separate Testnet and future Mainnet proofs,
- bind proof validity to the intended Stellar network.

---

<a id="recipient-hash-binding"></a>

## Recipient Hash Binding

The recipient address is hashed into a BN254-safe field element.

The frontend and contract use the same deterministic hashing rule:

```text
SHA-256(address XDR)
→ zero first byte
→ interpret as BN254-safe field element
```

Security goal:

- bind the proof to the intended merchant,
- prevent proof reuse with a different recipient,
- avoid BN254 field overflow / modulo wrap mismatch.

---

<a id="events"></a>

## Events

The contract emits events for observability and downstream indexing.

Expected event categories:

| Event | Purpose |
|---|---|
| `PaymentExecuted` | Emitted after successful payment settlement |
| `PauseUpdated` | Emitted when pause state changes |
| `MerkleRootUpdated` | Emitted when active root is updated |

Payment event data may include:

```text
nullifier
from
merchant
total_amount
merchant_receive
protocol_fee
ledger_timestamp
```

Exact schema should be kept aligned with `payment.rs` and `lib.rs`.

---

<a id="error-codes"></a>

## Error Codes

Current frontend mapping expects the contract error enum to align with the following logical errors:

| Code | Meaning |
|---|---|
| `#1` | NotInitialized |
| `#2` | AlreadyInitialized |
| `#3` | NotAdmin |
| `#4` | NullifierSpent |
| `#5` | InvalidProof |
| `#6` | RecipientMismatch |
| `#7` | InvalidAmount |
| `#8` | ContractPaused |
| `#9` | InvalidInputCount |
| `#10` | ArithmeticOverflow |
| `#11` | CircuitRootMismatch |
| `#12` | RootMismatch |
| `#13` | ChainIdMismatch |

If `errors.rs` changes, update:

- frontend `errorMapper.ts`,
- SDK error mapping,
- README documentation,
- tests.

---

<a id="security-design"></a>

## Security Design

### Implemented

- One-time initialization
- Admin authorization
- Emergency pause / circuit breaker
- Atomic 95/5 USDC settlement
- Nullifier replay protection
- Merkle root validation
- Root sync guard through frontend/backend API
- ChainId binding
- Recipient hash binding
- Amount bounds validation
- Browser-side local Groth16 verification
- Modular verifier backend architecture

### Current Limitation

Native on-chain BN254 pairing verification is not yet enabled in the active Testnet backend.

The current Testnet build relies on:

```text
browser-side snarkjs.groth16.verify()
+
contract-side public input, root, nullifier, recipient, chainId, and settlement checks
```

This is acceptable for the current Testnet MVP but not sufficient for mainnet readiness.

---

<a id="tests"></a>

## Tests

Run:

```bash
cargo test -- --nocapture
```

Expected:

```text
test result: ok. 22 passed; 0 failed; 0 ignored
```

Coverage includes:

- contract initialization
- constructor guard
- admin authorization
- Merkle root update
- wrong Merkle root rejection
- nullifier replay rejection
- payment marks nullifier as spent
- pause / unpause behavior
- fee cap validation
- atomic split precision
- successful payment flow
- distinct nullifiers succeeding independently

---

<a id="build-commands"></a>

## Build Commands

From `contracts/`:

```bash
cargo test -- --nocapture
cargo build --target wasm32v1-none --release
```

Feature check:

```bash
cargo check --features bn254_native
```

Expected behavior:

```text
Default build        → uses bn254_demo backend
bn254_native feature → compiles native backend (compile-clean, pending on-chain validation)
```

---

<a id="deployment-notes"></a>

## Deployment Notes

Current deployed Testnet contract:

```text
CD3GV6AD3DJKLH3DSLZG4I4KPJV5RUUIC4L7FZN626EHIT4ZBYIQ5PJH
```

Current root sync command pattern:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <SOURCE_ACCOUNT_ALIAS> \
  --network testnet \
  -- \
  set_merkle_root \
  --caller <ADMIN_ADDRESS> \
  --new_root <ROOT_HEX>
```

Example active root:

```text
01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972
```

---

<a id="live-evidence"></a>

## Live Evidence

| Item | Value |
|---|---|
| Contract ID | `CD3GV6AD3DJKLH3DSLZG4I4KPJV5RUUIC4L7FZN626EHIT4ZBYIQ5PJH` |
| Latest Confirmed Tx (SDK hook path) | `bcc57200a6590db53a7cea6fd6aa02911bdd6001f5a7892b77e6451066b38cbe` |
| Explorer | `https://stellar.expert/explorer/testnet/tx/13367140816011264` |
| Live App | `https://flupy.vercel.app/app` |

Runtime evidence:

```text
[Merkle] Proof received
[artifacts] Loaded: WASM=2243297 bytes | ZKEY=5913232 bytes
[prover] Proof generated: pi_a=64B pi_b=128B pi_c=64B
[stellar] Simulating transaction...
[stellar] Awaiting Freighter signature...
[stellar] Submitting transaction to the network...
[stellar] ✓ Transaction confirmed
```

---

<a id="known-limitations"></a>

## Known Limitations

The current contract is a production-candidate Testnet implementation, not a mainnet-ready protocol.

Not yet completed:

- native on-chain BN254 pairing verification,
- external security audit,
- multisig admin,
- persistent Merkle enrollment storage,
- production-grade rate limiting,
- public VK checksum,
- public trusted setup documentation,
- mainnet deployment.

---

<a id="mainnet-readiness-checklist"></a>

## Mainnet Readiness Checklist

### Cryptography

- [x] ChainId binding
- [x] Nullifier replay protection
- [x] Browser Groth16 proof generation
- [x] Browser local proof verification
- [x] Public signal ordering aligned across circuit, frontend, SDK, and contract
- [ ] Native on-chain BN254 pairing verification (bn254_native.rs compile-clean against Protocol 26; pending on-chain validation) (bn254_native.rs compile-clean; pending on-chain validation with real proof)
- [ ] Public VK checksum
- [ ] Trusted setup documentation finalized

### Contract

- [x] One-time initialization
- [x] Admin authorization
- [x] Pause mechanism
- [x] Merkle root validation
- [x] Atomic 95/5 settlement
- [x] Nullifier storage
- [x] Contract tests passing
- [ ] Multisig admin
- [ ] External audit

### Operations

- [x] Production Testnet E2E confirmed
- [x] Root sync verified
- [x] Artifact loading verified
- [ ] Monitoring dashboard
- [ ] Incident response runbook
- [ ] Public status page

---

<a id="license"></a>

## License

MIT