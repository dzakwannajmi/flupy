# Fluppy — Stellar Master Journey Submission

## Project Overview

**Fluppy** is a privacy-preserving, eligibility-based merchant payment protocol built on Stellar Soroban.

Users prove private membership or eligibility using a Groth16 ZK proof generated in the browser via Circom and SnarkJS. The Soroban smart contract enforces nullifier uniqueness, Merkle root integrity, recipient and amount binding, and executes atomic payment settlement — 95% to the merchant, 5% to the protocol treasury.

**What is private:** The user's credential or eligibility.  
**What is not private:** The payment amount and merchant address — the merchant receives a normal direct settlement.  
**This is not a mixer.** There is no pool deposit or anonymous withdrawal flow.

### Technical Stack

- Stellar Soroban (Testnet)
- Freighter wallet
- Circom + SnarkJS (Groth16 proof generation)
- Poseidon hash (Merkle tree)
- Nullifier-based replay protection
- Next.js frontend
- TypeScript

### Known Limitations

- Native on-chain BN254/Groth16 verification is **not yet production-complete**. Cryptographic proof validity is currently enforced in the browser via SnarkJS local verification before transaction submission. The Soroban contract verifier module is a modular scaffold prepared for native Protocol 25 host function integration.
- This is a Testnet MVP. Not audited. Not mainnet-ready.

---

## Submission Links

| | |
|---|---|
| **GitHub Repository** | [View Repo](https://github.com/dzakwannajmi/Fluppy) |
| **Live Demo** | [Open Fluppy](https://fluppy.vercel.app/) |
| **Contract Address** | `CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS` |
| **Transaction Hash** | `1b3ad3d7b28208a9a5572755bd6e5479177d5b58f23d8445128bfeae1caea739` |
| **Demo Video** | [Watch Demo](https://youtu.be/7R9P7tibI08) |

---

## Level 1 — White Belt Checklist

> Requirement: Freighter wallet integration, Stellar Testnet transaction, success/failure feedback.

| Requirement | Status | Evidence |
|---|---|---|
| Freighter wallet setup | ✅ Complete | [Screenshot 01](./screenshots/01-wallet-connected.png) |
| Stellar Testnet configured | ✅ Complete | Contract deployed on Testnet |
| Wallet connect functionality | ✅ Complete | [Screenshot 01](./screenshots/01-wallet-connected.png) |
| Wallet disconnect functionality | ✅ Complete | Disconnect button in UI |
| Fetch and display XLM balance | ✅ Complete | [Screenshot 02](./screenshots/02-balance-displayed.png) |
| Send a transaction on Stellar Testnet | ✅ Complete | [Screenshot 05](./screenshots/05-transaction-success.png) |
| Success/failure feedback shown | ✅ Complete | Toast + status message in UI |
| Transaction hash displayed to user | ✅ Complete | [Screenshot 06](./screenshots/06-stellar-explorer.png) |
| Public GitHub repository | ✅ Complete | [Repository](https://github.com/dzakwannajmi/Fluppy) |
| README with setup instructions | ✅ Complete | See root README |

### Notes

The existing Fluppy Soroban payment flow satisfies the Level 1 transaction requirement. The transaction is submitted on Stellar Testnet using XLM for fees, with full Freighter wallet signing. Mentor confirmed this flow is sufficient for Level 1.

---

## Level 2 — Yellow Belt Checklist

> Requirement: Contract deployed and called from frontend, error handling, meaningful commits.

| Requirement | Status | Evidence |
|---|---|---|
| Wallet integration | ✅ Complete | Freighter via Stellar Wallets Kit |
| 3+ error types handled | ✅ Complete | See error handling section below |
| Contract deployed on Testnet | ✅ Complete | `CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS` |
| Contract called from frontend | ✅ Complete | [Screenshot 03](./screenshots/03-payment-flow.png) |
| Transaction status visible | ✅ Complete | Status indicator + explorer link |
| 2+ meaningful commits | ✅ Complete | See commit history |
| README setup instructions | ✅ Complete | Root README |
| Deployed contract address | ✅ Complete | `CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS` |
| Transaction hash of contract call | ✅ Complete | `1b3ad3d7b28208a9a5572755bd6e5479177d5b58f23d8445128bfeae1caea739` |

### Error Types Handled

1. **Wallet not connected** — User prompted to connect Freighter before payment flow starts
2. **Nullifier already used** — Contract rejects duplicate payment attempts; frontend shows specific error message
3. **Proof generation failure** — Circuit input validation fails; error caught and shown to user before submission
4. **Transaction rejection** — Freighter user rejection or network failure; caught with status feedback

---

## Level 3 — Orange Belt Checklist

> Requirement: Advanced contract logic, CI/CD, testing, mobile responsive, production-ready architecture docs.

| Requirement | Status | Evidence |
|---|---|---|
| Advanced smart contract logic | ✅ Complete | Merkle root check, nullifier enforcement, recipient/amount binding, atomic split settlement |
| Contract interaction architecture | ✅ Complete | Browser → SDK → Soroban contract; see architecture docs |
| Event streaming / activity tracking | ✅ Complete | Transaction status polling + explorer link |
| CI/CD pipeline | ✅ Complete | [Screenshot 09](./screenshots/09-ci-cd-or-vercel-deployment.png) |
| Smart contract deployment workflow | ✅ Complete | Documented in `/contracts/README.md` |
| Mobile responsive frontend | ✅ Complete | [Screenshot 07](./screenshots/07-mobile-responsive.png) |
| Error handling and loading states | ✅ Complete | Loading spinner, error states, wallet guard |
| Contract/frontend testing evidence | ✅ Complete | [Screenshot 08](./screenshots/08-test-output.png) |
| Production-ready architecture docs | ✅ Complete | See `ARCHITECTURE.md` in root |
| Public GitHub repository | ✅ Complete | [Repository](https://github.com/dzakwannajmi/Fluppy) |
| README with complete documentation | ✅ Complete | This document |
| 10+ meaningful commits | ✅ Complete | See commit history |
| Live demo link | ✅ Complete | [Open Fluppy](https://fluppy.vercel.app/) |
| Contract deployment address | ✅ Complete | `CAGJIQ4W5Q7ZAYJ2QLH4M4TRIZJHFSDDJZ43PYAR4QEZVP76FTBDIBAS` |
| Transaction hash | ✅ Complete | `1b3ad3d7b28208a9a5572755bd6e5479177d5b58f23d8445128bfeae1caea739` |
| Demo video (1–2 minutes) | ✅ Complete | [Watch Demo](<DEMO_VIDEO_URL>) |

### Advanced Contract Logic Detail

The Fluppy Soroban contract implements:

- **Merkle root check** — Verifies the submitted root matches the stored on-chain root before processing
- **Nullifier replay protection** — Each proof submission uses a unique nullifier stored on-chain; duplicate nullifiers are rejected
- **Recipient and amount binding** — Payment target and amount are bound inside the proof public inputs; the contract verifies these match the transaction parameters
- **Atomic settlement** — A single contract invocation splits payment: 95% to merchant, 5% to protocol treasury
- **ChainId binding** — Prevents cross-network proof replay

> **Honest note on ZK verification:** Browser-side Groth16 proof generation and local SnarkJS verification are implemented and working. Native on-chain BN254/Groth16 verification via Soroban Protocol 25 host functions is the next technical milestone and is not yet production-complete. The contract verifier module is a modular scaffold designed for this integration.

---

## Screenshots Index

| File | What it shows |
|---|---|
| [01-wallet-connected.png](./screenshots/01-wallet-connected.png) | Freighter wallet connected state |
| [02-balance-displayed.png](./screenshots/02-balance-displayed.png) | XLM balance fetched and displayed |
| [03-payment-flow.png](./screenshots/03-payment-flow.png) | Payment flow initiated, contract called |
| [04-proof-generation.png](./screenshots/04-proof-generation.png) | Browser-side ZK proof generation in progress |
| [05-transaction-success.png](./screenshots/05-transaction-success.png) | Successful testnet transaction confirmed |
| [06-stellar-explorer.png](./screenshots/06-stellar-explorer.png) | Transaction hash on Stellar Explorer |
| [07-mobile-responsive.png](./screenshots/07-mobile-responsive.png) | Mobile responsive UI |
| [08-test-output.png](./screenshots/08-test-output.png) | Test output with passing tests |
| [09-ci-cd-or-vercel-deployment.png](./screenshots/09-ci-cd-or-vercel-deployment.png) | CI/CD pipeline or Vercel deployment

## Next Milestones

These are planned but not yet implemented:

1. **Native on-chain Groth16 verifier** — Integrate BN254 pairing via Soroban Protocol 25 host functions (`pairing_check`, `g1_add`, `g1_mul`)
2. **VK converter pipeline** — Automated `verification_key.json` → Rust constants generator for Soroban
3. **Multi-merchant support** — Configurable merchant registry on-chain
4. **Circuit audit** — Third-party review of Circom circuit constraints