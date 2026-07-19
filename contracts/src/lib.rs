//! lib.rs — Fluppy ZK Payment Contract (crate root)
//!
//! Module layout:
//!   lib.rs      → contract entry points, DataKey, shared helpers
//!   errors.rs   → FluppyError enum
//!   payment.rs  → execute_payment logic
//!   verify.rs   → Groth16 verifier (BN254)
//!   test.rs     → unit tests
//!
//! ## Role model (Tier 0 separation)
//! Admin        — cold key. Full control: pause, fee, rotate_operator.
//!                Can also call set_merkle_root directly (manual override).
//! RootOperator — hot key, intended for a server-side automated sync job.
//!                Can ONLY call set_merkle_root. Rotatable by Admin via
//!                rotate_operator() without needing a contract upgrade.
//!
//! Rationale: RootOperator key compromise is bounded to whitelist-integrity
//! bypass or root-anchoring DoS — it can never move funds (Flupy is
//! non-custodial) or change Admin/fee/pause state.
//!
//! ## Root history ring buffer
//! Because the Merkle root is now anchored by an automated sync job that
//! can run every few minutes, a proof generated against root N can land
//! on-chain after root N+1 has already been anchored (proof-in-flight
//! race). Rather than requiring an exact match to the single latest
//! root, the contract accepts a proof against ANY root within the last
//! ROOT_HISTORY_SIZE anchored roots — turning what would otherwise be a
//! hard correctness failure into a soft UX nicety (the proof still
//! succeeds; only a root far outside the window is rejected).

#![no_std]

// ── Module declarations (REQUIRED — without these, payment.rs cannot
//    use crate::errors / crate::verify / crate::DataKey) ──────────────────
mod errors;
mod payment;
mod verifier;

#[cfg(test)]
mod test;

// ── Re-exports ────────────────────────────────────────────────────────────
pub use errors::FluppyError;

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec,
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys
//
// Must be `pub` so payment.rs can access via `crate::DataKey`.
// All storage keys in the entire contract live here — prevents collisions.
// ─────────────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct PauseUpdated {
    pub paused: bool,
}

#[contractevent]
pub struct MerkleRootUpdated {
    pub new_root: BytesN<32>,
}

#[contractevent]
pub struct OperatorRotated {
    pub new_operator: Address,
}

/// Number of historical roots retained for proof acceptance.
/// See "Root history ring buffer" note above.
pub(crate) const ROOT_HISTORY_SIZE: u32 = 30;

#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Admin address — immutable after __constructor (rotatable only via
    /// contract upgrade, not via any callable function).
    Admin,
    /// Root operator address — the ONLY other identity permitted to call
    /// set_merkle_root. Rotatable by Admin via rotate_operator().
    RootOperator,
    /// Stellar Asset Contract address for USDC.
    UsdcToken,
    /// Treasury address — receives 5% protocol fee.
    Treasury,
    /// Fee in basis points (500 = 5.00%). Max 1000 (10%).
    FeePercent,
    /// Circuit-breaker flag. `true` = all payments blocked.
    IsPaused,
    /// Most recently anchored Merkle root (BytesN<32>). Kept for
    /// get_merkle_root() callers that want "the current canonical root"
    /// (e.g. the sync job's idempotency check) — NOT used directly for
    /// payment validation anymore; see RootAt / root_is_known().
    MerkleRoot,
    /// Ring buffer write pointer (0..ROOT_HISTORY_SIZE).
    RootHistoryIndex,
    /// Ring buffer slot: root anchored at ring position `u32`.
    RootAt(u32),
    /// Spent nullifier registry — keyed by nullifier field element.
    /// Stored in temporary storage. Presence = nullifier is spent.
    Nullifier(BytesN<32>),
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

#[contract]
pub struct FluppyContract;

#[contractimpl]
impl FluppyContract {
    // ── One-time initialisation ──────────────────────────────────────────────

    /// Anchors all immutable config on first call.
    /// Panics on any second invocation — re-initialisation attack prevention.
    pub fn __constructor(
        env: Env,
        admin: Address,
        root_operator: Address,
        usdc_token: Address,
        treasury: Address,
        merkle_root: BytesN<32>,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RootOperator, &root_operator);
        env.storage()
            .instance()
            .set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&DataKey::FeePercent, &500_i128);
        env.storage().instance().set(&DataKey::IsPaused, &false);
        env.storage()
            .instance()
            .set(&DataKey::MerkleRoot, &merkle_root);
        push_root_history(&env, &merkle_root);

        // Extend instance TTL: min 90 days, target 300 days
        env.storage().instance().extend_ttl(518_400, 2_592_000);
    }

    // ── Core payment ─────────────────────────────────────────────────────────

    /// ZK-verified USDC payment with atomic 95/5 fee split.
    /// Delegates full pipeline to payment.rs.
    pub fn execute_payment(
        env: Env,
        sender: Address,
        merchant: Address,
        amount: i128,
        pi_a: Bytes,
        pi_b: Bytes,
        pi_c: Bytes,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<(), FluppyError> {
        payment::execute_payment(
            env,
            sender,
            merchant,
            amount,
            pi_a,
            pi_b,
            pi_c,
            public_inputs,
        )
    }

    // ── Admin functions ──────────────────────────────────────────────────────

    /// Pause or unpause all payments. Admin only.
    pub fn set_pause(env: Env, caller: Address, paused: bool) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin(&env, &caller)?;

        env.storage().instance().set(&DataKey::IsPaused, &paused);

        PauseUpdated { paused }.publish(&env);

        Ok(())
    }

    /// Update the authorised Merkle root (new whitelist snapshot).
    /// Callable by Admin (manual override) OR RootOperator (automated sync).
    ///
    /// The new root is pushed into the root history ring buffer rather
    /// than replacing a single stored value — see module-level doc.
    pub fn set_merkle_root(
        env: Env,
        caller: Address,
        new_root: BytesN<32>,
    ) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin_or_operator(&env, &caller)?;

        env.storage()
            .instance()
            .set(&DataKey::MerkleRoot, &new_root);
        push_root_history(&env, &new_root);

        MerkleRootUpdated { new_root }.publish(&env);

        Ok(())
    }

    /// Update the protocol fee in basis points. Max 1000 (10%). Admin only.
    pub fn set_fee(env: Env, caller: Address, fee_bps: i128) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin(&env, &caller)?;

        if !(0..=1000).contains(&fee_bps) {
            return Err(FluppyError::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::FeePercent, &fee_bps);
        Ok(())
    }

    /// Rotates the RootOperator address. Admin only.
    ///
    /// Lets Admin revoke a compromised or retired operator hot key without
    /// a contract upgrade — the operator is a storage value, not baked
    /// into the WASM.
    pub fn rotate_operator(
        env: Env,
        caller: Address,
        new_operator: Address,
    ) -> Result<(), FluppyError> {
        caller.require_auth();
        require_admin(&env, &caller)?;

        env.storage()
            .instance()
            .set(&DataKey::RootOperator, &new_operator);

        OperatorRotated {
            new_operator: new_operator.clone(),
        }
        .publish(&env);

        Ok(())
    }

    // ── Read-only queries ────────────────────────────────────────────────────

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }

    /// Returns the most recently anchored root. For payment validation,
    /// use is_known_root() instead — a payment MAY be valid against an
    /// older root still within the history window.
    pub fn get_merkle_root(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::MerkleRoot)
    }

    /// Returns true if `root` is any of the last ROOT_HISTORY_SIZE roots
    /// anchored via set_merkle_root() (including the current one).
    pub fn is_known_root(env: Env, root: BytesN<32>) -> bool {
        root_is_known(&env, &root)
    }

    pub fn get_root_operator(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::RootOperator)
    }

    /// Returns true if this nullifier was already used in a previous payment.
    pub fn is_nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .temporary()
            .has(&DataKey::Nullifier(nullifier))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// pub(crate) helpers — shared with payment.rs via crate::
//
// `pub(crate)` = visible inside this crate only, not to external callers.
// payment.rs calls these as:
//   crate::check_not_paused(&env)?;
//   crate::require_admin(&env, &caller)?;
//   crate::root_is_known(&env, &proof_root);
// ─────────────────────────────────────────────────────────────────────────────

/// Returns Err(ContractPaused) if the circuit-breaker is active.
pub(crate) fn check_not_paused(env: &Env) -> Result<(), FluppyError> {
    if env
        .storage()
        .instance()
        .get(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(FluppyError::ContractPaused);
    }
    Ok(())
}

/// Returns Err(NotAdmin) if `caller` is not the stored admin address.
/// Always call after `caller.require_auth()`.
pub(crate) fn require_admin(env: &Env, caller: &Address) -> Result<(), FluppyError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(FluppyError::NotInitialized)?;

    if *caller != admin {
        return Err(FluppyError::NotAdmin);
    }
    Ok(())
}

/// Returns Err(NotAdmin) if `caller` is neither the Admin nor the
/// RootOperator. Used exclusively by set_merkle_root, which both roles
/// may call.
pub(crate) fn require_admin_or_operator(
    env: &Env,
    caller: &Address,
) -> Result<(), FluppyError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(FluppyError::NotInitialized)?;

    if *caller == admin {
        return Ok(());
    }

    let operator: Address = env
        .storage()
        .instance()
        .get(&DataKey::RootOperator)
        .ok_or(FluppyError::NotInitialized)?;

    if *caller != operator {
        return Err(FluppyError::NotAdmin);
    }
    Ok(())
}

/// Pushes `new_root` into the next ring buffer slot, advancing the write
/// pointer. The very first call (no RootHistoryIndex set yet) writes to
/// slot 0; subsequent calls advance modulo ROOT_HISTORY_SIZE.
pub(crate) fn push_root_history(env: &Env, new_root: &BytesN<32>) {
    let current_idx: Option<u32> = env.storage().instance().get(&DataKey::RootHistoryIndex);

    let next = match current_idx {
        Some(idx) => (idx + 1) % ROOT_HISTORY_SIZE,
        None => 0,
    };

    env.storage().instance().set(&DataKey::RootAt(next), new_root);
    env.storage()
        .instance()
        .set(&DataKey::RootHistoryIndex, &next);
}

/// Returns true if `root` matches any entry currently in the ring buffer.
pub(crate) fn root_is_known(env: &Env, root: &BytesN<32>) -> bool {
    for i in 0..ROOT_HISTORY_SIZE {
        let stored: Option<BytesN<32>> = env.storage().instance().get(&DataKey::RootAt(i));

        if let Some(r) = stored {
            if &r == root {
                return true;
            }
        }
    }
    false
}
