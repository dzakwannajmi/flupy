#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Bytes, BytesN, Env, Vec};

// ─────────────────────────────────────────────────────────────────────────────
// Test fixture
// ─────────────────────────────────────────────────────────────────────────────

struct F {
    env: Env,
    client: FluppyContractClient<'static>,
    admin: Address,
    root_operator: Address,
    treasury: Address,
    usdc: token::Client<'static>,
    usdc_sa: token::StellarAssetClient<'static>,
    root: BytesN<32>,
}

fn setup() -> F {
    setup_with_root([0x01; 32])
}

/// Same as setup(), but with a caller-chosen Merkle root instead of the
/// [0x01; 32] placeholder. Needed for Phase 2 bn254_native tests, which
/// must register the contract with the REAL root a pre-generated proof
/// was built against (a fixed [0x01;32] placeholder would never match).
fn setup_with_root(root_bytes: [u8; 32]) -> F {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let root_operator = Address::generate(&env);
    let treasury = Address::generate(&env);

    let usdc_id = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let usdc = token::Client::new(&env, &usdc_id);
    let usdc_sa = token::StellarAssetClient::new(&env, &usdc_id);

    let root = BytesN::from_array(&env, &root_bytes);

    // __constructor fires here — pass args as tuple matching parameter order:
    // (admin, root_operator, usdc_token, treasury, merkle_root)
    let contract_id = env.register(FluppyContract, (&admin, &root_operator, &usdc_id, &treasury, &root));
    let client = FluppyContractClient::new(&env, &contract_id);

    F {
        env,
        client,
        admin,
        root_operator,
        treasury,
        usdc,
        usdc_sa,
        root,
    }
}

/// Builds a valid proof payload for tests.
///
/// Public signal ordering matches payment.rs IDX_* constants:
///   [0] nullifier, [1] verifiedRoot, [2] merkleRoot, [3] recipientHash,
///   [4] payerHash, [5] amount, [6] chainId.
///
/// payerHash and amount are now real bound signals (post payer/amount
/// binding migration) — payment.rs recomputes both and rejects on
/// mismatch, so tests must pass the SAME payer and amount used in the
/// execute_payment() call, or the payment will fail with
/// PayerBindingMismatch / AmountBindingMismatch instead of the error the
/// test is actually trying to exercise.
fn make_proof(
    env: &Env,
    nullifier: &BytesN<32>,
    root: &BytesN<32>,
    payer: &Address,
    merchant: &Address,
    amount: i128,
) -> (Bytes, Bytes, Bytes, Vec<BytesN<32>>) {
    let recipient_hash = payment::compute_recipient_hash(env, merchant);
    let payer_hash = payment::compute_payer_hash(env, payer);
    let amount_sig = payment::amount_to_field_bytes(env, amount);
    let chain_id = payment::compute_chain_id_pub(env);

    let mut inputs: Vec<BytesN<32>> = Vec::new(env);
    inputs.push_back(nullifier.clone()); // [0] nullifier      — unique spend tag
    inputs.push_back(root.clone()); // [1] verifiedRoot   — circuit re-derived root
    inputs.push_back(root.clone()); // [2] merkleRoot     — must match stored root
    inputs.push_back(recipient_hash); // [3] recipientHash  — SHA256(XDR(merchant))[MSB=0]
    inputs.push_back(payer_hash); // [4] payerHash      — SHA256(XDR(payer))[MSB=0]
    inputs.push_back(amount_sig); // [5] amount         — canonical BE encoding
    inputs.push_back(chain_id); // [6] chainId        — circuit chain identifier

    // Proof points can be zeros in test mode — pairing check is mocked
    let pi_a = Bytes::from_slice(env, &[0u8; 64]);
    let pi_b = Bytes::from_slice(env, &[0u8; 128]);
    let pi_c = Bytes::from_slice(env, &[0u8; 64]);

    (pi_a, pi_b, pi_c, inputs)
}

const PAYMENT: i128 = 100_000_000; // 10 USDC

// ─────────────────────────────────────────────────────────────────────────────
// §1  Initialization
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_constructor_sets_correct_state() {
    let f = setup();
    assert_eq!(f.client.is_paused(), false, "Must not be paused after init");
    assert_eq!(
        f.client.get_merkle_root(),
        Some(f.root.clone()),
        "Root must match"
    );
}

/// Note: __constructor is invoked by env.register() and cannot be called
/// again via the client (by design — this is the Soroban security guarantee).
/// Each env.register() creates a new contract address with fresh storage,
/// so double-registration creates two DIFFERENT contracts, not a re-init.
/// The guard `if env.storage().instance().has(&DataKey::Admin) { panic!() }`
/// is verified here by confirming Admin IS set after the first registration.
#[test]
fn test_constructor_guard_sets_admin_immutably() {
    let f = setup();
    // Admin was set — the guard `has(&DataKey::Admin)` would fire on re-init
    // We verify state is consistent (admin is implicitly verified via ACL tests)
    assert_eq!(f.client.is_paused(), false);
    assert!(f.client.get_merkle_root().is_some());

    // Non-admin cannot change critical state — proves admin is locked
    let imposter = Address::generate(&f.env);
    assert!(
        f.client.try_set_pause(&imposter, &true).is_err(),
        "Admin is locked — imposter must be rejected"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// §2  Payment execution and 95/5 split
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_successful_payment_atomic_split() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x01; 32]);
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);

    assert_eq!(
        f.usdc.balance(&merchant),
        95_000_000,
        "Merchant must receive 95%"
    );
    assert_eq!(
        f.usdc.balance(&f.treasury),
        5_000_000,
        "Treasury must receive 5%"
    );
    assert_eq!(f.usdc.balance(&payer), 0, "Payer must be fully debited");
}

#[test]
fn test_payment_marks_nullifier_spent() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x02; 32]);
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);

    assert!(
        !f.client.is_nullifier_spent(&nullifier),
        "Must be unspent before payment"
    );
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(
        f.client.is_nullifier_spent(&nullifier),
        "Must be spent after payment"
    );
}

#[test]
fn test_small_payment_split_precision() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    let amount = 1_000_000_i128; // 0.1 USDC
    f.usdc_sa.mint(&payer, &amount);

    let nullifier = BytesN::from_array(&f.env, &[0x03; 32]);
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, amount);

    f.client
        .execute_payment(&payer, &merchant, &amount, &pi_a, &pi_b, &pi_c, &inputs);

    assert_eq!(f.usdc.balance(&merchant), 950_000);
    assert_eq!(f.usdc.balance(&f.treasury), 50_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// §3  Nullifier replay protection
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_nullifier_replay_rejected() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &(PAYMENT * 2));

    let nullifier = BytesN::from_array(&f.env, &[0x04; 32]);

    // First payment — must succeed
    let (a1, b1, c1, i1) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a1, &b1, &c1, &i1);

    // Second payment with SAME nullifier — must fail
    let (a2, b2, c2, i2) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);
    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &a2, &b2, &c2, &i2);
    assert!(result.is_err(), "Replayed nullifier must be rejected");
}

#[test]
fn test_two_distinct_nullifiers_both_succeed() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &(PAYMENT * 2));

    let n1 = BytesN::from_array(&f.env, &[0x05; 32]);
    let n2 = BytesN::from_array(&f.env, &[0x06; 32]);

    let (a1, b1, c1, i1) = make_proof(&f.env, &n1, &f.root, &payer, &merchant, PAYMENT);
    let (a2, b2, c2, i2) = make_proof(&f.env, &n2, &f.root, &payer, &merchant, PAYMENT);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a1, &b1, &c1, &i1);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a2, &b2, &c2, &i2);

    assert_eq!(f.usdc.balance(&merchant), 190_000_000);
    assert_eq!(f.usdc.balance(&payer), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// §4  Merkle root enforcement
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_wrong_merkle_root_rejected() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);

    let wrong_root = BytesN::from_array(&f.env, &[0x03; 32]);
    let nullifier = BytesN::from_array(&f.env, &[0x07; 32]);
    // Error occurs at step 5 (root mismatch) — before payer/recipient checks,
    // so payer/merchant hashes don't matter here, but we pass them correctly anyway
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &wrong_root, &payer, &merchant, PAYMENT);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(result.is_err(), "Wrong Merkle root must be rejected");
}

#[test]
fn test_wrong_input_count_rejected() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);

    // Only 3 inputs — fails at step 2 (count guard), before any hash check
    let mut short: Vec<BytesN<32>> = Vec::new(&f.env);
    for _ in 0..3 {
        short.push_back(BytesN::from_array(&f.env, &[0u8; 32]));
    }
    let pi_a = Bytes::from_slice(&f.env, &[0u8; 64]);
    let pi_b = Bytes::from_slice(&f.env, &[0u8; 128]);
    let pi_c = Bytes::from_slice(&f.env, &[0u8; 64]);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &short);
    assert!(result.is_err(), "Wrong input count must be rejected");
}

// ─────────────────────────────────────────────────────────────────────────────
// §5  Circuit-breaker
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_pause_blocks_payments() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);

    f.client.set_pause(&f.admin, &true);
    assert!(f.client.is_paused(), "Must be paused");

    let nullifier = BytesN::from_array(&f.env, &[0x08; 32]);
    // Error at step 1 (paused) — before any other check
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(result.is_err(), "Paused contract must reject all payments");
}

#[test]
fn test_unpause_restores_payments() {
    let f = setup();
    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    f.client.set_pause(&f.admin, &true);
    f.client.set_pause(&f.admin, &false);
    assert!(!f.client.is_paused(), "Must be unpaused");

    let nullifier = BytesN::from_array(&f.env, &[0x09; 32]);
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert_eq!(f.usdc.balance(&merchant), 95_000_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// §6  Access control
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_non_admin_cannot_pause() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    assert!(f.client.try_set_pause(&imposter, &true).is_err());
}

#[test]
fn test_non_admin_cannot_update_root() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    let new_root = BytesN::from_array(&f.env, &[0xCD; 32]);
    assert!(f.client.try_set_merkle_root(&imposter, &new_root).is_err());
}

#[test]
fn test_non_admin_cannot_set_fee() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    assert!(f.client.try_set_fee(&imposter, &100_i128).is_err());
}

// ─────────────────────────────────────────────────────────────────────────────
// §7  Admin management
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_admin_can_update_merkle_root() {
    let f = setup();
    let new_root = BytesN::from_array(&f.env, &[0xCD; 32]);
    f.client.set_merkle_root(&f.admin, &new_root);
    assert_eq!(f.client.get_merkle_root(), Some(new_root));
}

#[test]
fn test_fee_above_cap_rejected() {
    let f = setup();
    assert!(f.client.try_set_fee(&f.admin, &1001_i128).is_err());
}

#[test]
fn test_custom_fee_applied_correctly() {
    let f = setup();
    f.client.set_fee(&f.admin, &1000_i128); // 10%

    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x0A; 32]);
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);

    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);

    assert_eq!(
        f.usdc.balance(&merchant),
        90_000_000,
        "Merchant receives 90% at 10% fee"
    );
    assert_eq!(
        f.usdc.balance(&f.treasury),
        10_000_000,
        "Treasury receives 10%"
    );
}

#[test]
fn test_root_within_history_window_still_accepted() {
    // Root history ring buffer: closes the proof-in-flight-vs-new-root
    // race. A proof against a root that was replaced by a NEWER root
    // must still succeed, as long as it's within ROOT_HISTORY_SIZE.
    let f = setup();
    let new_root = BytesN::from_array(&f.env, &[0x02; 32]);
    f.client.set_merkle_root(&f.admin, &new_root);

    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &(PAYMENT * 2));

    // Proof with the OLD (pre-update) root — must still succeed, it's
    // within the history window.
    let n1 = BytesN::from_array(&f.env, &[0x0B; 32]);
    let (a1, b1, c1, i1) =
        make_proof(&f.env, &n1, &f.root, &payer, &merchant, PAYMENT);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a1, &b1, &c1, &i1);
    assert_eq!(f.usdc.balance(&merchant), 95_000_000);

    // Proof with the NEW root — must also succeed.
    let n2 = BytesN::from_array(&f.env, &[0x0C; 32]);
    let (a2, b2, c2, i2) =
        make_proof(&f.env, &n2, &new_root, &payer, &merchant, PAYMENT);
    f.client
        .execute_payment(&payer, &merchant, &PAYMENT, &a2, &b2, &c2, &i2);
    assert_eq!(f.usdc.balance(&merchant), 190_000_000);
}

#[test]
fn test_root_outside_history_window_rejected() {
    // Push ROOT_HISTORY_SIZE (30) more roots past the original — the
    // ring buffer fully wraps, so the original setup() root must no
    // longer be accepted.
    let f = setup();

    for i in 0u8..30 {
        let root = BytesN::from_array(&f.env, &[0x10 + i; 32]);
        f.client.set_merkle_root(&f.admin, &root);
    }

    let payer = Address::generate(&f.env);
    let merchant = Address::generate(&f.env);
    f.usdc_sa.mint(&payer, &PAYMENT);

    let nullifier = BytesN::from_array(&f.env, &[0x0D; 32]);
    let (pi_a, pi_b, pi_c, inputs) =
        make_proof(&f.env, &nullifier, &f.root, &payer, &merchant, PAYMENT);

    let result = f
        .client
        .try_execute_payment(&payer, &merchant, &PAYMENT, &pi_a, &pi_b, &pi_c, &inputs);
    assert!(
        result.is_err(),
        "Root outside the history window must be rejected"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// §8  Pure arithmetic (no env — instantaneous)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_split_standard_5pct() {
    let (m, t) = payment::calculate_split(100_000_000, 500).unwrap();
    assert_eq!(m, 95_000_000);
    assert_eq!(t, 5_000_000);
}

#[test]
fn test_split_10pct() {
    let (m, t) = payment::calculate_split(100_000_000, 1000).unwrap();
    assert_eq!(m, 90_000_000);
    assert_eq!(t, 10_000_000);
}

#[test]
fn test_split_zero_amount() {
    let (m, t) = payment::calculate_split(0, 500).unwrap();
    assert_eq!(m, 0);
    assert_eq!(t, 0);
}

#[test]
fn test_split_no_overflow_on_large_amount() {
    // Maximum safe amount: must satisfy amount * max_fee_bps <= i128::MAX
    // Safe upper bound: i128::MAX / 10_000 (the divisor used in calculate_split)
    let safe_large = i128::MAX / 10_000;
    let result = payment::calculate_split(safe_large, 500);
    assert!(
        result.is_ok(),
        "Large amounts within safe bounds must not overflow"
    );
    let (m, t) = result.unwrap();
    assert!(m > 0);
    assert!(t > 0);
    assert_eq!(m + t, safe_large);
}

// ─────────────────────────────────────────────────────────────────────────────
// §9  Root operator role separation (Tier 0)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_operator_can_update_merkle_root() {
    let f = setup();
    let new_root = BytesN::from_array(&f.env, &[0xEE; 32]);
    f.client.set_merkle_root(&f.root_operator, &new_root);
    assert_eq!(f.client.get_merkle_root(), Some(new_root));
}

#[test]
fn test_admin_can_still_update_merkle_root_directly() {
    let f = setup();
    let new_root = BytesN::from_array(&f.env, &[0xFF; 32]);
    f.client.set_merkle_root(&f.admin, &new_root);
    assert_eq!(f.client.get_merkle_root(), Some(new_root));
}

#[test]
fn test_non_admin_non_operator_cannot_update_root() {
    let f = setup();
    let imposter = Address::generate(&f.env);
    let new_root = BytesN::from_array(&f.env, &[0xAA; 32]);
    assert!(
        f.client.try_set_merkle_root(&imposter, &new_root).is_err(),
        "Neither admin nor operator — must be rejected"
    );
}

#[test]
fn test_operator_cannot_pause() {
    let f = setup();
    assert!(
        f.client.try_set_pause(&f.root_operator, &true).is_err(),
        "Operator has no pause authority — must be rejected"
    );
}

#[test]
fn test_operator_cannot_set_fee() {
    let f = setup();
    assert!(
        f.client.try_set_fee(&f.root_operator, &100_i128).is_err(),
        "Operator has no fee authority — must be rejected"
    );
}

#[test]
fn test_operator_cannot_rotate_operator() {
    let f = setup();
    let new_operator = Address::generate(&f.env);
    assert!(
        f.client
            .try_rotate_operator(&f.root_operator, &new_operator)
            .is_err(),
        "Operator cannot rotate itself — admin only"
    );
}

#[test]
fn test_admin_can_rotate_operator() {
    let f = setup();
    let new_operator = Address::generate(&f.env);
    f.client.rotate_operator(&f.admin, &new_operator);
    assert_eq!(f.client.get_root_operator(), Some(new_operator.clone()));

    // Old operator must lose access after rotation
    let new_root = BytesN::from_array(&f.env, &[0xBB; 32]);
    assert!(
        f.client
            .try_set_merkle_root(&f.root_operator, &new_root)
            .is_err(),
        "Old operator must be rejected after rotation"
    );

    // New operator must gain access
    f.client.set_merkle_root(&new_operator, &new_root);
    assert_eq!(f.client.get_merkle_root(), Some(new_root));
}

#[test]
fn test_get_root_operator_returns_current_operator() {
    let f = setup();
    assert_eq!(f.client.get_root_operator(), Some(f.root_operator.clone()));
}

// ═════════════════════════════════════════════════════════════════════════
// Phase 2 Blue Belt — bn254_native integration tests.
//
// Proof source: circuits/proof_bn254_native_test.json /
// public_bn254_native_test.json, generated 2026-07-23 from
// circuits/input_bn254_native_test.json (secret=123, nonce=456, an
// all-zero 20-level Merkle path, recipientHash/payerHash/chainId computed
// from THIS test env's compute_recipient_hash/compute_payer_hash/
// compute_chain_id for the two fixed addresses below — see
// contracts/src/verifier/vk_constants.rs for the matching VK provenance.
// snarkjs groth16 verify confirmed this proof valid before conversion.
// ═════════════════════════════════════════════════════════════════════════

/// Merkle root produced by secret=123/nonce=456/all-zero path — must match
/// what the contract is registered with for this proof to be accepted.
const BN254_NATIVE_TEST_ROOT: [u8; 32] = [
    0x2e, 0xc7, 0x9c, 0x3e, 0x32, 0xe5, 0xa2, 0x82, 0xe3, 0x6c, 0x95, 0xc1, 0x92, 0x56, 0x58, 0x00,
    0x0c, 0xfb, 0x78, 0x9a, 0x8e, 0x1f, 0xf9, 0xd4, 0xeb, 0x82, 0x76, 0x3f, 0xab, 0xc6, 0x3b, 0xef,
];

const BN254_NATIVE_TEST_PAYER: &str = "GDPAPDZWAKBXUPCNMI4YHAZ7DS7UOUTPGXAFDSWZG4URRMWHFSQTDQBM";
const BN254_NATIVE_TEST_MERCHANT: &str = "GBP4L62CF2BWZNVZCBZEK34NG425Q772AMDYWQL5KAVPKXXGSGVB4MRO";
const BN254_NATIVE_TEST_AMOUNT: i128 = 100_000_000;

/// Builds the (pi_a, pi_b, pi_c, public_inputs) tuple for the verified real
/// proof above, ready to pass to execute_payment().
fn bn254_native_test_fixture(env: &Env) -> (Bytes, Bytes, Bytes, Vec<BytesN<32>>) {
    let pi_a = Bytes::from_array(env, &[
        0x2a, 0xb6, 0x56, 0x7d, 0xd3, 0xba, 0x3c, 0x4a, 0x14, 0x64, 0xb4, 0x20, 0x48, 0xf7, 0xba, 0x40,
        0xcb, 0xc9, 0xfd, 0x71, 0xa2, 0x43, 0x64, 0x62, 0xb2, 0x82, 0xd0, 0xda, 0x6a, 0x7e, 0x19, 0xde,
        0x2d, 0x39, 0x85, 0xb9, 0x8d, 0xb6, 0xa8, 0x4f, 0xd1, 0x44, 0xed, 0xf6, 0x9d, 0xe3, 0x28, 0x38,
        0x0f, 0x40, 0x59, 0x98, 0x8c, 0x40, 0x4b, 0x03, 0xa3, 0xac, 0x09, 0x38, 0x2a, 0x27, 0x0c, 0x80,
    ]);
    // FIXED 2026-07-23: c1||c0 ordering (imaginary component first),
    // matching the same fix applied to vk_constants.rs's beta/gamma/delta.
    let pi_b = Bytes::from_array(env, &[
        0x12, 0x52, 0x52, 0x8c, 0xa3, 0xa8, 0xc2, 0x3b, 0x5f, 0x47, 0xba, 0x0b, 0xbf, 0x87, 0xdf, 0x61,
        0x6b, 0x0d, 0xd5, 0x82, 0x87, 0x58, 0xe2, 0xe9, 0x35, 0x03, 0x22, 0xa6, 0xf4, 0x0d, 0x8b, 0x0a,
        0x13, 0xfe, 0x18, 0xb7, 0x93, 0xe4, 0x2b, 0xda, 0x0a, 0x1c, 0xc4, 0x49, 0x56, 0x18, 0x89, 0x3f,
        0x00, 0x33, 0x6f, 0xe7, 0xff, 0xdb, 0xb0, 0xff, 0x95, 0x10, 0x0b, 0xe4, 0x04, 0x4c, 0x18, 0xe1,
        0x04, 0x7b, 0xa1, 0xd2, 0x80, 0x2b, 0x38, 0x88, 0x39, 0xc3, 0x57, 0x28, 0xfa, 0x12, 0x34, 0x46,
        0xca, 0x87, 0xc6, 0xbb, 0x4b, 0x30, 0x36, 0x4b, 0xf2, 0xc8, 0x87, 0x6e, 0x83, 0x97, 0x5e, 0xe0,
        0x04, 0xb7, 0x8d, 0x95, 0x7d, 0x89, 0xbd, 0x9c, 0x89, 0xe7, 0x98, 0x4d, 0x68, 0x46, 0x84, 0x58,
        0x71, 0x6e, 0xaf, 0xcf, 0xab, 0x97, 0x25, 0x7e, 0x4e, 0xdb, 0x75, 0xf0, 0xf9, 0xaf, 0x65, 0x28,
    ]);
    let pi_c = Bytes::from_array(env, &[
        0x0a, 0xc0, 0x7c, 0x9c, 0x63, 0x5a, 0x21, 0xb6, 0xd4, 0x61, 0xb7, 0x74, 0x5e, 0xf6, 0x14, 0x04,
        0x76, 0x87, 0xe0, 0x34, 0xc7, 0x0f, 0x28, 0x45, 0x7c, 0x12, 0xf3, 0xda, 0xe1, 0x13, 0xd3, 0x0f,
        0x17, 0xd3, 0x46, 0xa1, 0xcc, 0x36, 0x7d, 0x1d, 0xda, 0xdd, 0x4c, 0xe2, 0xe2, 0x86, 0x1a, 0xd0,
        0x4b, 0x85, 0xf4, 0x5f, 0x04, 0xf6, 0x11, 0xbf, 0x15, 0x53, 0x09, 0x9c, 0xfc, 0x3d, 0x4f, 0x42,
    ]);

    let nullifier = BytesN::from_array(env, &[
        0x2b, 0x8c, 0x31, 0x70, 0x73, 0xd6, 0x69, 0xab, 0x41, 0x77, 0x59, 0x4d, 0xc4, 0xb9, 0xe7, 0x05,
        0xca, 0x61, 0x04, 0x1f, 0x2a, 0xf7, 0xaf, 0xce, 0x00, 0xab, 0xbb, 0xed, 0xa5, 0xe3, 0x68, 0xcb,
    ]);
    let verified_root = BytesN::from_array(env, &BN254_NATIVE_TEST_ROOT);
    let merkle_root = BytesN::from_array(env, &BN254_NATIVE_TEST_ROOT);
    let recipient_hash = BytesN::from_array(env, &[
        0x00, 0x40, 0x04, 0xa3, 0x82, 0x4f, 0x5c, 0x87, 0x07, 0x3a, 0x76, 0x31, 0xad, 0x8b, 0xb2, 0x07,
        0x69, 0x29, 0xdc, 0x75, 0x7a, 0x22, 0xa6, 0x12, 0x73, 0x9c, 0xd2, 0x4b, 0x69, 0x84, 0x99, 0x5b,
    ]);
    let payer_hash = BytesN::from_array(env, &[
        0x00, 0x3b, 0x81, 0xca, 0xb8, 0xa4, 0x8e, 0x15, 0x41, 0xfb, 0xff, 0x8b, 0xd0, 0xa8, 0xc4, 0x2b,
        0xd0, 0x21, 0xe6, 0x03, 0x8d, 0x04, 0xb8, 0x18, 0x48, 0x0a, 0x20, 0x47, 0x51, 0x92, 0x51, 0x31,
    ]);
    let amount_sig = BytesN::from_array(env, &[
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05, 0xf5, 0xe1, 0x00,
    ]);
    let chain_id = BytesN::from_array(env, &[0u8; 32]);

    let mut inputs: Vec<BytesN<32>> = Vec::new(env);
    inputs.push_back(nullifier);
    inputs.push_back(verified_root);
    inputs.push_back(merkle_root);
    inputs.push_back(recipient_hash);
    inputs.push_back(payer_hash);
    inputs.push_back(amount_sig);
    inputs.push_back(chain_id);

    (pi_a, pi_b, pi_c, inputs)
}

/// Proves bn254_native.rs accepts a REAL, independently-verified Groth16
/// proof (snarkjs confirmed it valid before this test was written) — the
/// thing bn254_demo could never prove, since it never runs a real pairing
/// check. Run with: cargo test --features bn254_native
#[cfg(feature = "bn254_native")]
#[test]
fn test_bn254_native_accepts_real_verified_proof() {
    // Calls verifier::verify_proof() directly, bypassing execute_payment()'s
    // USDC/account plumbing entirely -- scoped to "is the pairing math
    // correct", not full payment integration (which needs real classic
    // Stellar accounts and belongs in Phase 3's testnet E2E instead).
    let env = Env::default();
    let (pi_a, pi_b, pi_c, public_inputs) = bn254_native_test_fixture(&env);

    let pi_a_n: BytesN<64> = pi_a.try_into().unwrap();
    let pi_b_n: BytesN<128> = pi_b.try_into().unwrap();
    let pi_c_n: BytesN<64> = pi_c.try_into().unwrap();

    let proof = verifier::Proof {
        pi_a: pi_a_n,
        pi_b: pi_b_n,
        pi_c: pi_c_n,
    };

    let inputs = verifier::PublicInputs {
        nullifier: &public_inputs.get(0).unwrap(),
        verified_root: &public_inputs.get(1).unwrap(),
        merkle_root: &public_inputs.get(2).unwrap(),
        recipient_hash: &public_inputs.get(3).unwrap(),
        payer_hash: &public_inputs.get(4).unwrap(),
        amount: &public_inputs.get(5).unwrap(),
        chain_id: &public_inputs.get(6).unwrap(),
    };

    let result = verifier::verify_proof(&env, &proof, &inputs);

    assert!(
        result.is_ok(),
        "real proof must be accepted by native pairing check, got: {:?}",
        result
    );
}

/// Proves bn254_native.rs actually rejects an invalid proof mathematically
/// — flips one byte of pi_a from the same otherwise-valid fixture above.
/// bn254_demo could never fail this test (it always accepts); this is the
/// core guarantee native verification is supposed to add.
#[cfg(feature = "bn254_native")]
#[test]
#[should_panic(expected = "bn254 G1: point not on curve")]
fn test_bn254_native_rejects_tampered_proof() {
    // The BN254 host function panics (rather than returning an error) when
    // given a point that isn't on the curve, so this test's success
    // condition is the panic itself -- see #[should_panic] above, matched
    // against the exact host error message so an unrelated panic (e.g. a
    // bug in this test's own setup) still fails the test as expected.
    let env = Env::default();
    let (pi_a, pi_b, pi_c, public_inputs) = bn254_native_test_fixture(&env);

    let mut pi_a_bytes = [0u8; 64];
    pi_a.copy_into_slice(&mut pi_a_bytes);
    pi_a_bytes[40] ^= 0xff;
    let tampered_pi_a: BytesN<64> = Bytes::from_array(&env, &pi_a_bytes).try_into().unwrap();

    let pi_b_n: BytesN<128> = pi_b.try_into().unwrap();
    let pi_c_n: BytesN<64> = pi_c.try_into().unwrap();

    let proof = verifier::Proof {
        pi_a: tampered_pi_a,
        pi_b: pi_b_n,
        pi_c: pi_c_n,
    };

    let inputs = verifier::PublicInputs {
        nullifier: &public_inputs.get(0).unwrap(),
        verified_root: &public_inputs.get(1).unwrap(),
        merkle_root: &public_inputs.get(2).unwrap(),
        recipient_hash: &public_inputs.get(3).unwrap(),
        payer_hash: &public_inputs.get(4).unwrap(),
        amount: &public_inputs.get(5).unwrap(),
        chain_id: &public_inputs.get(6).unwrap(),
    };

    let _ = verifier::verify_proof(&env, &proof, &inputs);
}

#[test]
fn dump_phase3_hashes() {
    let env = Env::default();
    let merchant = Address::from_str(&env, "GAZ7MMG76VMYM2EIZ2UX5OHAJS63I7XODWQMC6ULFNKQ5GPCCAW5TFQW");
    let payer = Address::from_str(&env, "GDPAPDZWAKBXUPCNMI4YHAZ7DS7UOUTPGXAFDSWZG4URRMWHFSQTDQBM");

    let recipient_hash = crate::payment::compute_recipient_hash(&env, &merchant);
    let payer_hash = crate::payment::compute_payer_hash(&env, &payer);

    panic!(
        "recipient_hash={:?} payer_hash={:?}",
        recipient_hash.to_array(),
        payer_hash.to_array()
    );
}
