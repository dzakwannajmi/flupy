# 🔐 Security Policy — Fluppy

## Overview

Fluppy is a privacy-preserving payment protocol on Stellar Soroban that combines
Zero-Knowledge Membership Proofs with atomic USDC settlement.

This document describes Fluppy's current security model, implemented protections,
known limitations, threat model, testing status, and responsible disclosure policy.

> ⚠️ **Testnet Status Notice**
>
> Fluppy is currently a production-candidate **Stellar Testnet** implementation.
> It has successfully completed end-to-end payment validation on the deployed Vercel frontend
> and Stellar Testnet, but it is **not yet mainnet-ready**.
>
> Do **not** use this protocol for real financial transactions until:
>
> - native on-chain BN254 verification is enabled,
> - external security audit is complete,
> - admin controls are upgraded to multisig,
> - persistent Merkle storage is deployed,
> - production API hardening is complete,
> - this notice is removed.

## 📋 Table of Contents

- [Current Security Status](#current-security-status)
- [Implemented Security Controls](#implemented-security-controls)
- [Current Verification Strategy](#current-verification-strategy)
- [Known Limitations](#known-limitations)
- [Threat Model](#threat-model)
- [ZK Security Properties](#zk-security-properties)
- [Known Silent Failure Risks](#known-silent-failure-risks)
- [Test Coverage](#test-coverage)
- [Production Testnet Evidence](#production-testnet-evidence)
- [Mainnet Readiness Checklist](#mainnet-readiness-checklist)
- [Responsible Disclosure](#responsible-disclosure)
- [Changelog](#changelog)

---

<a id="current-security-status"></a>

## 1. Current Security Status

| Area | Status |
|------|--------|
| Stellar Testnet deployment | ✅ Active |
| Browser Groth16 proof generation | ✅ Implemented |
| Browser-side local proof verification | ✅ Enforced before contract submission |
| ChainId binding | ✅ Implemented |
| Nullifier replay protection | ✅ Implemented |
| Merkle root validation | ✅ Implemented |
| Merkle root sync guard | ✅ Implemented |
| Atomic 95/5 USDC split | ✅ Implemented |
| Freighter user signing | ✅ Implemented |
| Local transaction history | ✅ Implemented |
| Native on-chain BN254 pairing verification | ⚠️ bn254_native.rs compile-clean against soroban-sdk v26; pending on-chain validation with real proof |
| External audit | ⏳ Not yet completed |
| Multisig admin | ⏳ Planned |
| Persistent Merkle database | ⏳ Planned |
| Mainnet deployment | ⏳ Out of scope for current MVP |

---

<a id="implemented-security-controls"></a>

## 2. Implemented Security Controls

### 2.1 One-Time Initialization Lock

The contract uses a one-time initialization pattern to prevent reconfiguration after deployment.

Once initialized, core configuration values such as admin, treasury, asset contract, and protocol
settings cannot be overwritten through a second initialization call.

**Security goal:**

- Prevent malicious reconfiguration.
- Prevent treasury redirection after deployment.
- Preserve immutable deployment assumptions.

---

### 2.2 Caller Authentication

Payment execution requires the sender address to authorize the transaction.

The user signs through Freighter, and the contract requires sender authentication before settlement
logic is executed.

**Security goal:**

- Prevent third parties from submitting payments on behalf of users.
- Ensure payment intent is explicitly authorized by the wallet owner.

---

### 2.3 Emergency Pause / Circuit Breaker

The contract supports an admin-controlled pause mechanism.

When paused, payment execution is blocked without requiring contract redeployment.

**Security goal:**

- Allow emergency response during incident handling.
- Stop payment execution if a critical issue is discovered.
- Preserve contract state while preventing new settlements.

---

### 2.4 Atomic 95/5 USDC Split

Payment settlement is executed atomically through the Soroban contract.

The protocol splits the incoming payment amount as:

- 95% to the merchant
- 5% to the protocol treasury

The split is not performed manually off-chain.

**Security goal:**

- Prevent manual reconciliation risk.
- Ensure deterministic settlement.
- Avoid partial settlement failure.

---

### 2.5 Nullifier Replay Protection

Each valid payment proof includes a nullifier.

The contract stores spent nullifiers and rejects duplicate usage.

**Security goal:**

- Prevent replaying the same proof.
- Prevent duplicate settlement using the same nullifier.
- Preserve one-time proof usage.

**Expected behavior:**

- First valid nullifier: accepted.
- Reused nullifier: rejected with a nullifier-spent error.

---

### 2.6 Merkle Root Validation

The contract stores the active Merkle root.

Payment public inputs include the Merkle root used by the proof. The contract checks that the proof
root matches the active root stored on-chain.

**Security goal:**

- Prevent stale whitelist proofs.
- Prevent proof generation against an outdated tree.
- Ensure proof membership is tied to the active contract root.

---

### 2.7 Frontend / Backend Root Sync Guard

Before proof generation, the frontend compares:

- the Merkle proof root returned by `/api/merkle-proof`
- the active contract root returned by `/api/merkle-root`

If the roots differ, the payment flow stops before Groth16 proof generation.

**Security goal:**

- Avoid wasting time on proofs that would fail on-chain.
- Prevent `RootMismatch` failures.
- Ensure browser-generated proofs target the active contract state.

Verified root sync evidence:

```text
Contract root:

01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972

Merkle proof root decimal:

825860214526777548768231888040603757085006455794519490744185581216954935666

Decimal root converted to hex:

01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972
````

---

### 2.8 ChainId Binding

The ZK circuit includes a chainId derived from the Stellar network passphrase.

This binds proofs to a specific network environment.

**Security goal:**

* Prevent cross-network replay.
* Prevent using a proof generated for one network on another network.
* Keep Testnet and future Mainnet proofs separated.

---

### 2.9 Recipient Hash Binding

The recipient address is hashed into a BN254-safe field element and included in the public inputs.

The contract recomputes the expected recipient hash and compares it against the submitted public
signal.

**Security goal:**

* Prevent redirecting a valid proof to a different merchant.
* Bind proof validity to the intended recipient address.
* Preserve deterministic recipient verification.

---

### 2.10 Amount Bounds

The circuit and contract use amount-related public inputs to enforce payment constraints.

The contract validates payment amount rules before settlement.

**Security goal:**

* Prevent invalid amount settlement.
* Prevent out-of-range payment values.
* Ensure payment logic remains deterministic.

---

### 2.11 Browser-Side Local Groth16 Verification

The browser generates Groth16 proofs using SnarkJS and verifies the proof locally before submitting
the transaction to Soroban.

**Security goal:**

* Reject invalid proofs before wallet signing.
* Avoid submitting malformed proofs to the contract.
* Preserve cryptographic correctness at the browser-contract boundary during the Testnet phase.

Observed production Testnet evidence:

```text
[artifacts] Loaded: WASM=2243297 bytes | ZKEY=5913232 bytes
[prover] Proof generated: pi_a=64B pi_b=128B pi_c=64B
Local verification: VALID
Transaction confirmed on Stellar Testnet
```

---

### 2.12 Encrypted Browser Credential Storage

Fluppy stores browser credentials using encrypted client-side storage.

Current credential model:

* IndexedDB for browser storage
* PBKDF2 for password-based key derivation
* AES-GCM for encryption
* password is not stored
* raw secret is not logged
* raw secret is not stored in React state

**Security goal:**

* Prevent raw credential exposure.
* Keep proof generation local to the browser.
* Avoid sending raw secrets to the backend.

---

### 2.13 SDK Boundary Safety

Fluppy uses a three-layer SDK architecture:

* `@fluppy/core`
* `@fluppy/browser`
* `@fluppy/react`

Security-sensitive SDK boundaries:

* `@fluppy/browser` does not import React, Next.js, Sentry, toast libraries, or UI code.
* `@fluppy/react` does not store raw secrets or passwords in React state.
* Payment history stores transaction metadata only.
* Raw proofs are not logged by the React SDK.

**Security goal:**

* Keep cryptographic and UI concerns separated.
* Reduce accidental secret exposure.
* Improve auditability.

---

### 2.14 Circuit Artifact Loading

Production circuit artifacts are served from:

```text
/circuit/v3/fluppy_payment.wasm
/circuit/v3/circuit_final.zkey.bin
/circuit/v3/verification_key.json
```

The proving key is served as:

```text
circuit_final.zkey.bin
```

for Vercel static asset compatibility.

Verified production artifact status:

```text
fluppy_payment.wasm       HTTP/2 200
circuit_final.zkey.bin    HTTP/2 200
verification_key.json     HTTP/2 200
```

**Security goal:**

* Ensure the browser loads the intended proving artifacts.
* Avoid stale or missing artifact failures.
* Support future checksum validation.

---

<a id="current-verification-strategy"></a>

## 3. Current Verification Strategy

### 3.1 Browser Verification

Current Testnet flow:

1. Browser fetches Merkle proof.
2. Browser checks root sync against contract root.
3. Browser loads circuit artifacts.
4. Browser generates Groth16 proof.
5. Browser verifies proof locally with `snarkjs.groth16.verify()`.
6. User signs transaction with Freighter.
7. Contract validates public inputs, Merkle root, nullifier, chainId, recipient hash, and payment logic.

### 3.2 On-Chain Verifier Limitation

The current Testnet contract uses a modular verifier architecture.

The active verifier backend is a demo-mode verifier strategy because native BN254 host functions are
not yet exposed as a stable public Rust API through the Soroban SDK.

Required future host functions include:

```text
bn254_g1_mul
bn254_g1_add
bn254_pairing_check
```

**Important limitation:**

The current Testnet build does not claim full production on-chain Groth16 pairing verification.

**Mitigation in current MVP:**

Browser-side Groth16 local verification is strictly enforced before every contract submission.

**Future production path:**

When stable BN254 host functions are available in Soroban SDK, Fluppy will migrate to native
on-chain BN254 verification through the existing modular verifier backend.

---

<a id="known-limitations"></a>

## 4. Known Limitations

### 4.1 Native On-Chain BN254 Verification Pending

Severity: **High for Mainnet readiness**

The current Testnet build does not yet perform native on-chain Groth16 pairing verification.

**Status:**

* Modular verifier architecture is implemented.
* Browser local verification is enforced.
* Native backend is planned once stable SDK host functions are available.

---

### 4.2 External Audit Not Yet Completed

Severity: **High for Mainnet readiness**

Fluppy has not yet completed an external smart contract audit.

**Planned action:**

* Prepare audit package.
* Apply for SCF Soroban Audit Bank support.
* Complete audit before mainnet usage.

---

### 4.3 Admin Is Not Yet Multisig

Severity: **Medium**

Current admin control is not yet multisig.

**Planned action:**

* Move root updates, pause control, and admin operations to multisig governance.
* Require threshold approval for critical updates.

---

### 4.4 Persistent Merkle Database Not Yet Deployed

Severity: **Medium**

The current Testnet Merkle enrollment flow is still mock/testnet-oriented and not yet backed by
a production persistent database.

**Planned action:**

* Replace in-memory/mock enrollment with persistent storage.
* Add merchant-scoped enrollment controls.
* Add root rebuild workflows.

---

### 4.5 API Rate Limiting Not Yet Production-Hardened

Severity: **Medium**

Merkle proof APIs are not yet protected with production-grade rate limiting and merchant API keys.

**Planned action:**

* Add rate limiting.
* Add merchant/developer API key authentication.
* Add request logging and abuse monitoring.

---

### 4.6 Trusted Setup Documentation Not Yet Finalized

Severity: **Medium**

The current proving key is available for Testnet validation, but the trusted setup process still
requires final public documentation before mainnet.

**Planned action:**

* Publish VK checksum.
* Document ceremony provenance.
* Publish artifact hashes.
* Provide reproducible verification steps.

---

### 4.7 Proof Generation Runs in Browser Main Thread

Severity: **Low to Medium**

Current proof generation works in the browser but may block the main thread on lower-end devices.

**Planned action:**

* Move proof generation into a Web Worker.
* Add proof timeout handling.
* Add cancellation-safe lifecycle handling.
* Add mobile performance testing.

---

### 4.8 No Mainnet Deployment

Severity: **Intentional MVP limitation**

Fluppy is deployed to Stellar Testnet only.

Mainnet deployment is explicitly out of scope for the current MVP.

---

<a id="threat-model"></a>

## 5. Threat Model

### 5.1 Assets

| Asset               | Protection                                                      |
| ------------------- | --------------------------------------------------------------- |
| User funds          | Freighter signature, `require_auth`, Soroban contract execution |
| User credential     | Encrypted browser storage, no raw secret sent to backend        |
| Merchant settlement | Atomic 95/5 split                                               |
| Protocol treasury   | Immutable configuration after initialization                    |
| Merkle root         | Admin-controlled root update, root sync guard                   |
| Proof validity      | Browser-side Groth16 verification, future native BN254 verifier |
| Replay protection   | Nullifier storage                                               |
| Network separation  | ChainId binding                                                 |
| Availability        | Pause mechanism                                                 |

---

### 5.2 Trust Boundaries

```text
User browser
  ├─ trusted to generate proof locally
  ├─ stores encrypted credential
  └─ signs with Freighter

Next.js API
  ├─ receives commitment only
  ├─ returns Merkle proof
  └─ does not receive raw secret

Soroban contract
  ├─ validates root
  ├─ validates nullifier
  ├─ validates recipient hash
  ├─ validates chainId
  └─ executes atomic split

Stellar network
  └─ finalizes transaction
```

---

### 5.3 Threat Matrix

| Threat                                       | Current Status                  | Mitigation                                 |
| -------------------------------------------- | ------------------------------- | ------------------------------------------ |
| Unauthorized payment submission              | Mitigated                       | Freighter signature + `require_auth`       |
| Credential exposure to backend               | Mitigated                       | Backend receives commitment only           |
| Raw secret leakage in UI                     | Mitigated                       | Secret not stored in React state           |
| Replay using same nullifier                  | Mitigated                       | Contract stores spent nullifiers           |
| Cross-network replay                         | Mitigated                       | ChainId binding                            |
| Wrong recipient attack                       | Mitigated                       | Recipient hash binding                     |
| Stale Merkle root proof                      | Mitigated                       | Root sync guard + contract root validation |
| Invalid local proof                          | Mitigated before submission     | Browser `snarkjs.groth16.verify()`         |
| Invalid proof accepted on-chain              | Not fully mitigated for mainnet | Native BN254 verifier pending              |
| Malicious admin root update                  | Partially mitigated             | Admin control exists; multisig planned     |
| API abuse / proof endpoint spam              | Not fully mitigated             | Rate limiting planned                      |
| Main thread freezing during proof generation | Partially mitigated             | Progress UX exists; Web Worker planned     |

---

<a id="zk-security-properties"></a>

## 6. ZK Security Properties

Current circuit and proof system:

* Proof system: Groth16
* Curve: BN254
* Circuit framework: Circom
* Proof generation: SnarkJS
* Hashing: Poseidon-based Merkle membership proof
* Tree depth: 20
* Public signal count: 7

Public signals include:

```text
[0] nullifier
[1] verifiedRoot
[2] merkleRoot
[3] recipientHash
[4] minAmount
[5] maxAmount
[6] chainId
```

Security properties:

* User proves membership in an approved Merkle set.
* Raw credential is not revealed.
* Nullifier prevents replay.
* Recipient hash binds proof to the intended merchant.
* ChainId binds proof to the intended Stellar network.
* Amount bounds constrain payment validity.
* verifiedRoot must equal merkleRoot.

---

<a id="test-coverage"></a>

## 7. Test Coverage

Contract test status:

```text
22 tests passing
```

Coverage includes:

* contract initialization
* constructor guard
* admin authorization
* Merkle root update
* wrong Merkle root rejection
* nullifier replay rejection
* payment marks nullifier as spent
* pause / unpause behavior
* fee cap validation
* atomic split precision
* successful payment flow
* distinct nullifiers succeeding independently

Current validation status:

```text
cargo test: 22 passed
Next.js build: passed
SDK builds: passed
SDK typecheck: passed
Production Testnet payment: confirmed
```

---

<a id="production-testnet-evidence"></a>

## 8. Production Testnet Evidence

### 8.1 Live App

```text
https://fluppy.vercel.app/app
```

### 8.2 Contract

```text
CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS
```

### 8.3 Latest Confirmed Transaction

```text
ca6227fd5c426cc2ab1dbd9c2ee2fb6a4fce16fb0b87412408d3a5cbe405b244
```

Explorer:

```text
https://stellar.expert/explorer/testnet/tx/ca6227fd5c426cc2ab1dbd9c2ee2fb6a4fce16fb0b87412408d3a5cbe405b244
```

### 8.4 Artifact Verification

```bash
curl -I https://fluppy.vercel.app/circuit/v3/fluppy_payment.wasm
curl -I https://fluppy.vercel.app/circuit/v3/circuit_final.zkey.bin
curl -I https://fluppy.vercel.app/circuit/v3/verification_key.json
```

Expected:

```text
HTTP/2 200
```

### 8.5 Contract Root Verification

```bash
curl https://fluppy.vercel.app/api/merkle-root
```

Observed:

```json
{
  "root": "01d36b99df9115ab2d12fc7a0d8ad24c73e1f0e99a8186161b30bd0981756972"
}
```

---

<a id="mainnet-readiness-checklist"></a>

## 9. Mainnet Readiness Checklist

### Cryptography

* [x] ChainId binding
* [x] Nullifier replay protection
* [x] Browser Groth16 proof generation
* [x] Browser local proof verification
* [x] Public signal ordering aligned across circuit, frontend, SDK, and contract
* [ ] Native on-chain BN254 pairing verification
* [ ] Public VK checksum
* [ ] Trusted setup documentation finalized

### Smart Contract

* [x] One-time initialization
* [x] Admin authorization
* [x] Pause mechanism
* [x] Merkle root validation
* [x] Atomic 95/5 settlement
* [x] Nullifier storage
* [x] Contract tests passing
* [ ] Multisig admin
* [ ] External audit

### Backend

* [x] Merkle proof API
* [x] Merkle root API
* [x] Root sync guard
* [ ] Persistent Merkle storage
* [ ] API rate limiting
* [ ] Merchant/developer API key authentication
* [ ] DDoS protection

### Frontend / SDK

* [x] Browser SDK artifact loader
* [x] Production artifact loading
* [x] Progress UX
* [x] User-friendly error mapping
* [x] Local transaction history
* [x] Internal telemetry
* [ ] Web Worker proof generation
* [ ] Artifact checksum validation
* [ ] Mobile performance testing

### Operations

* [x] Sentry integration scaffold
* [ ] Full monitoring dashboard
* [ ] Public status page
* [ ] Incident response runbook
* [ ] Bug bounty / formal disclosure program

---

<a id="responsible-disclosure"></a>

## 10. Responsible Disclosure

Please report security issues responsibly.

**Email:** [repmoonasci@gmail.com](mailto:repmoonasci@gmail.com)

Expected response time:

```text
Within 48 hours
```

Please include:

* affected component
* reproduction steps
* impact assessment
* suggested mitigation if known

Do not publicly disclose vulnerabilities before maintainers have had reasonable time to investigate
and remediate.

---

<a id="changelog"></a>

## 11. Changelog

| Version | Date       | Change                                                                                                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1.0   | 2025-04-29 | Initial security policy                                                                                                                                |
| 0.2.0   | 2026-05-26 | Updated for Phase 3C production Testnet E2E success, nullifier protection, chainId binding, root sync guard, SDK architecture, and current limitations |

---

<a id="known-silent-failure-risks"></a>

## Known Silent Failure Risks (bn254_native.rs)

Before activating the native backend in production, the following
must be explicitly validated with negative tests (tampered proofs):

### G2 Coordinate Serialization
- SnarkJS outputs G2 as `[[x_c1, x_c0], [y_c1, y_c0]]`
- Soroban `Bn254G2Affine` expects: `x_c1_be32 || x_c0_be32 || y_c1_be32 || y_c0_be32`
- **Risk**: wrong byte order causes silent accept of invalid proof
- **Mitigation**: round-trip verification in extract_vk.cjs (21/21 checks pass)

### IC Ordering
- IC array in `vk_constants.rs` must match circuit signal output order exactly:
  `[nullifier, verifiedRoot, merkleRoot, recipientHash, minAmount, maxAmount, chainId]`
- **Risk**: wrong IC order causes wrong vk_x computation → silent accept
- **Mitigation**: IC ordering locked across circuit, SDK, contract, and VK extraction

### Scalar Encoding
- `Bn254Fr::from_bytes(BytesN<32>)` expects Big-Endian encoding
- SnarkJS public signals are already Big-Endian
- **Risk**: endianness swap causes wrong scalar → silent accept

### Pairing Equation Order
- Groth16 equation must be:
  `e(pi_a, pi_b) · e(neg_alpha, beta) · e(neg_vk_x, gamma) · e(neg_pi_c, delta) == 1`
- **Risk**: wrong pair order causes silent accept

### Required Validation Before Production Activation
- [ ] Negative test: flip one byte in pi_a → must return `InvalidProof`
- [ ] Negative test: flip one byte in pi_b → must return `InvalidProof`
- [ ] Negative test: wrong public input → must return `InvalidProof`
- [ ] Positive test: real SnarkJS proof → must return `Ok(())`
- [ ] Cross-verify: same proof passes both snarkjs.groth16.verify() AND native verifier
