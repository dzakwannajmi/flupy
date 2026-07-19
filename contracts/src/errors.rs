//! FluppyError — all contract error codes.
//!
//! Error code allocation:
//!   1–3:   Lifecycle / initialization errors
//!   4–5:   ZK proof / nullifier errors
//!   6, 8–9: Business logic / payment constraint errors
//!   10:    Access control errors
//!   11:    Circuit-breaker state
//!   12–13: Merkle root integrity errors
//!   17:    Chain binding integrity
//!   18–19: Public-signal binding errors (amount, payer)
//!
//! Code 7 (formerly AmountOutOfBounds) is intentionally retired and left
//! unused — the circuit no longer performs amount range checks (see
//! FluppyPayment.circom design note), so this error can never fire.
//! Left as a gap rather than reused, per the rule below.
//!
//! These codes are returned as Soroban `Error` values and parsed by
//! `parseContractError()` in the frontend's `errorMapper.ts`.
//! ⚠️  Never reorder or reuse a code once deployed — indexers key on them.

use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FluppyError {
    /// `__constructor` was called on an already-initialised contract.
    AlreadyInitialized = 1,
    /// A function that requires initialisation was called before `__constructor`.
    NotInitialized = 2,
    /// `public_inputs.len()` ≠ `verifier::N_PUBLIC` (7).
    InvalidInputCount = 3,
    /// The nullifier in `public_inputs[0]` has already been spent.
    NullifierSpent = 4,
    /// Groth16 pairing check failed — proof is invalid.
    InvalidProof = 5,
    /// `public_inputs[3]` (recipientHash) ≠ hash of the `merchant` argument.
    RecipientMismatch = 6,
    /// Intermediate arithmetic would overflow `i128`.
    ArithmeticOverflow = 8,
    /// `amount` is not a positive integer.
    InvalidAmount = 9,
    /// Caller is not the stored admin address.
    NotAdmin = 10,
    /// Payment rejected because the contract is paused.
    ContractPaused = 11,
    /// `public_inputs[2]` (merkleRoot) ≠ the root stored in contract state.
    RootMismatch = 12,
    /// `public_inputs[1]` (verifiedRoot) ≠ `public_inputs[2]` (merkleRoot).
    /// Indicates the circuit re-derived a different root — proof is internally inconsistent.
    CircuitRootMismatch = 13,
    /// The proof's declared chain ID does not match the current network's chain ID.
    /// Prevents cross-network proof replay (e.g. testnet ↔ mainnet).
    ChainIdMismatch = 17,
    /// `public_inputs[5]` (amount) ≠ the actual `amount` argument transferred.
    /// Prevents a captured proof from being replayed with a different amount.
    AmountBindingMismatch = 18,
    /// `public_inputs[4]` (payerHash) ≠ hash of the authenticated `sender` argument.
    /// Prevents a captured proof from being griefed/replayed by a different payer.
    PayerBindingMismatch = 19,
}
