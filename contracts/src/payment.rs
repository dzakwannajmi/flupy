use soroban_sdk::{contractevent, token, xdr::ToXdr, Address, Bytes, BytesN, Env, Vec};

use crate::errors::FluppyError;
use crate::verifier::{self, Proof, PublicInputs};
use crate::DataKey;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Must match verifier::N_PUBLIC exactly.
const N_PUBLIC: usize = 7;

// Public signal indices — SnarkJS output order (outputs before declared inputs)
const IDX_NULLIFIER: u32 = 0; // circuit output  — one-time spend tag
const IDX_VERIFIED_ROOT: u32 = 1; // circuit output  — root re-derived inside circuit
const IDX_MERKLE_ROOT: u32 = 2; // declared public — authorised whitelist root
const IDX_RECIPIENT_HASH: u32 = 3; // declared public — hash of merchant address
const IDX_PAYER_HASH: u32 = 4; // declared public — hash of payer address
const IDX_AMOUNT: u32 = 5; // declared public — exact payment amount
const IDX_CHAIN_ID: u32 = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct PaymentExecuted {
    pub sender: Address,
    pub merchant: Address,
    pub amount: i128,
    pub merchant_amt: i128,
    pub treasury_amt: i128,
    pub nullifier: BytesN<32>,
    pub timestamp: u64,
}

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
    // ── 1. Circuit breaker ─────────────────────────────────────────────────
    crate::check_not_paused(&env)?;

    // ── 2. Public input count ──────────────────────────────────────────────
    if public_inputs.len() as usize != N_PUBLIC {
        return Err(FluppyError::InvalidInputCount);
    }

    // ── 3. Amount sanity ───────────────────────────────────────────────────
    if amount <= 0 {
        return Err(FluppyError::InvalidAmount);
    }

    // ── 4. Extract typed public signals ────────────────────────────────────
    let nullifier = public_inputs.get(IDX_NULLIFIER).unwrap();
    let verified_root = public_inputs.get(IDX_VERIFIED_ROOT).unwrap();
    let proof_root = public_inputs.get(IDX_MERKLE_ROOT).unwrap();
    let recipient_hash = public_inputs.get(IDX_RECIPIENT_HASH).unwrap();
    let payer_hash_sig = public_inputs.get(IDX_PAYER_HASH).unwrap();
    let amount_sig = public_inputs.get(IDX_AMOUNT).unwrap();
    let chain_id_signal = public_inputs.get(IDX_CHAIN_ID).unwrap();

    // ── 5. Merkle root integrity ────────────────────────────────────────────
    // The proof's merkleRoot signal must match ANY root within the last
    // ROOT_HISTORY_SIZE anchored roots (ring buffer), not just the most
    // recent one. Closes the proof-in-flight-vs-new-root race: a proof
    // fetched against root N remains valid even if the automated sync
    // job anchors root N+1 while the user is still generating the proof.
    // Prevents proof re-use against a whitelist snapshot outside the
    // acceptance window.
    if !crate::root_is_known(&env, &proof_root) {
        return Err(FluppyError::RootMismatch);
    }

    // ── 6. Circuit self-consistency ────────────────────────────────────────
    // The circuit re-derives verifiedRoot from the Merkle path.
    // It must equal the declared merkleRoot — any mismatch means
    // the prover used a different path than the committed root.
    if verified_root != proof_root {
        return Err(FluppyError::CircuitRootMismatch);
    }

    // ── 7. Recipient integrity ─────────────────────────────────────────────
    // The circuit binds recipientHash as a pass-through public signal.
    // Recompute here to ensure proof cannot be re-used for a different merchant.
    let expected_recipient_hash = compute_recipient_hash(&env, &merchant);
    if recipient_hash != expected_recipient_hash {
        return Err(FluppyError::RecipientMismatch);
    }

    // ── 8. Payer integrity ──────────────────────────────────────────────────
    // The circuit binds payerHash as a pass-through public signal.
    // Prevents a captured-but-unconfirmed proof from being resubmitted by a
    // different wallet (griefing: burns the original sender's nullifier
    // without stealing funds, since the attacker pays from their own balance).
    let expected_payer_hash = compute_payer_hash(&env, &sender);
    if payer_hash_sig != expected_payer_hash {
        return Err(FluppyError::PayerBindingMismatch);
    }

    // ── 9. Amount integrity ─────────────────────────────────────────────────
    // The circuit binds amount as a pass-through public signal (no in-circuit
    // range check — policy limits are enforced here on the real i128, per
    // the SOW constraint that circuits must not contain business logic).
    // Prevents a captured proof from being replayed with a different amount.
    let expected_amount_sig = amount_to_field_bytes(&env, amount);
    if amount_sig != expected_amount_sig {
        return Err(FluppyError::AmountBindingMismatch);
    }

    // ── 10. Chain binding integrity ─────────────────────────────────────────
    // Prevents cross-network proof replay (testnet ↔ mainnet).
    let expected_chain = compute_chain_id(&env);
    if chain_id_signal != expected_chain {
        return Err(FluppyError::ChainIdMismatch);
    }

    // ── 11. Nullifier replay protection ─────────────────────────────────────
    // Each proof has a unique nullifier. Once spent, reject all re-submissions.
    let nullifier_key = DataKey::Nullifier(nullifier.clone());
    if env.storage().temporary().has(&nullifier_key) {
        return Err(FluppyError::NullifierSpent);
    }

    // ── 12. Groth16 pairing verification ────────────────────────────────────
    // Convert Bytes → BytesN<N> with length validation.
    let pi_a_n: BytesN<64> = pi_a.try_into().map_err(|_| FluppyError::InvalidProof)?;
    let pi_b_n: BytesN<128> = pi_b.try_into().map_err(|_| FluppyError::InvalidProof)?;
    let pi_c_n: BytesN<64> = pi_c.try_into().map_err(|_| FluppyError::InvalidProof)?;

    // In test builds: mock always returns Ok(()).
    // In production with --features bn254_native: real BN254 pairing check.
    let proof = Proof {
        pi_a: pi_a_n,
        pi_b: pi_b_n,
        pi_c: pi_c_n,
    };

    let public_inputs = PublicInputs {
        nullifier: &nullifier,
        verified_root: &verified_root,
        merkle_root: &proof_root,
        recipient_hash: &recipient_hash,
        payer_hash: &payer_hash_sig,
        amount: &amount_sig,
        chain_id: &chain_id_signal,
    };

    verifier::verify_proof(&env, &proof, &public_inputs).map_err(|_| FluppyError::InvalidProof)?;

    // ── 13. Mark nullifier spent ────────────────────────────────────────────
    // Temporary storage: cheaper than persistent, auto-expires after max TTL.
    env.storage().temporary().set(&nullifier_key, &true);

    // ── 14. Atomic 95/5 split transfer ──────────────────────────────────────
    let fee_bps: i128 = env
        .storage()
        .instance()
        .get(&DataKey::FeePercent)
        .unwrap_or(500_i128);

    let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
    let usdc_token: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();

    let (merchant_amt, treasury_amt) = calculate_split(amount, fee_bps)?;

    // sender must authorise the two token transfers
    sender.require_auth();
    let client = token::TokenClient::new(&env, &usdc_token);
    client.transfer(&sender, &merchant, &merchant_amt);
    client.transfer(&sender, &treasury, &treasury_amt);

    // ── 15. Emit payment event ──────────────────────────────────────────────
    let timestamp = env.ledger().timestamp();

    PaymentExecuted {
        sender: sender.clone(),
        merchant: merchant.clone(),
        amount,
        merchant_amt,
        treasury_amt,
        nullifier: nullifier.clone(),
        timestamp,
    }
    .publish(&env);

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (private to this module unless marked pub(crate))
// ─────────────────────────────────────────────────────────────────────────────

/// Splits `amount` into (merchant_amount, treasury_amount) using basis points.
/// Uses checked arithmetic — returns ArithmeticOverflow instead of panicking.
pub(crate) fn calculate_split(amount: i128, fee_bps: i128) -> Result<(i128, i128), FluppyError> {
    let treasury_amt = amount
        .checked_mul(fee_bps)
        .ok_or(FluppyError::ArithmeticOverflow)?
        .checked_div(10_000)
        .ok_or(FluppyError::ArithmeticOverflow)?;
    let merchant_amt = amount
        .checked_sub(treasury_amt)
        .ok_or(FluppyError::ArithmeticOverflow)?;
    Ok((merchant_amt, treasury_amt))
}

/// Computes a BN254-safe chain identifier from the Stellar network id.
///
/// MUST stay identical with computeChainId() in zkp.ts.
///
/// Current approach:
/// - use ledger network_id()
/// - zero most-significant byte
/// - resulting value always fits BN254 field
pub(crate) fn compute_chain_id(env: &Env) -> BytesN<32> {
    let network_id = env.ledger().network_id();

    let mut bytes = network_id.to_array();

    // zero MSB → guarantee < BN254_R
    bytes[0] = 0;

    BytesN::from_array(env, &bytes)
}

#[cfg(test)]
pub(crate) fn compute_chain_id_pub(env: &Env) -> BytesN<32> {
    compute_chain_id(env)
}

/// Computes a BN254-safe recipient hash from a Stellar address.
///
/// MUST stay identical with computeRecipientHash() in
/// packages/fluppy-core/src/recipient-hash.ts (SHA-256 of address XDR,
/// MSB zeroed to guarantee the result is < BN254_R).
pub(crate) fn compute_recipient_hash(env: &Env, addr: &Address) -> BytesN<32> {
    let xdr = addr.to_xdr(env);

    let mut hash = env.crypto().sha256(&xdr).to_array();

    // zero MSB → result always < BN254_R
    hash[0] = 0;

    BytesN::from_array(env, &hash)
}

/// Computes a BN254-safe payer hash from a Stellar address.
///
/// Uses the exact same derivation as compute_recipient_hash() — same
/// address-serialization pattern, different semantic field. Deliberately
/// NOT a new variant, per the encoding-consistency principle established
/// for recipientHash.
///
/// MUST stay identical with computePayerHash() in
/// packages/fluppy-core/src/payer-hash.ts (to be added to the SDK).
pub(crate) fn compute_payer_hash(env: &Env, addr: &Address) -> BytesN<32> {
    compute_recipient_hash(env, addr)
}

/// Encodes a positive i128 amount as a canonical 32-byte big-endian field
/// element, matching how SnarkJS emits the `amount` public signal (the
/// circuit passes amount through unmodified as a decimal field element,
/// so its canonical byte encoding is simply the zero-padded big-endian
/// representation of the same integer).
///
/// MUST stay identical with the amount encoding used when building circuit
/// inputs in packages/fluppy-browser/src/prover.ts. `amount` is validated
/// as > 0 before this is called, so the u128 cast is always in range.
pub(crate) fn amount_to_field_bytes(env: &Env, amount: i128) -> BytesN<32> {
    let amount_u128 = amount as u128;
    let amount_be = amount_u128.to_be_bytes(); // 16 bytes

    let mut bytes = [0u8; 32];
    bytes[16..32].copy_from_slice(&amount_be);

    BytesN::from_array(env, &bytes)
}
