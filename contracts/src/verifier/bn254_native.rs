//! BN254 native backend — production Groth16 verifier.
//!
//! Uses Soroban Protocol 26 BN254 host functions via soroban-sdk v26:
//!   env.crypto().bn254().g1_msm(points, scalars) -> Bn254G1Affine
//!   env.crypto().bn254().g1_add(p0, p1)          -> Bn254G1Affine
//!   env.crypto().bn254().pairing_check(g1s, g2s) -> bool
//!
//! Activated by --features bn254_native.
//! Replaces bn254_demo.rs for production use.
//!
//! Groth16 verification equation:
//!   e(pi_a, pi_b) · e(neg_alpha_g1, beta_g2) · e(neg_vk_x, gamma_g2) · e(neg_pi_c, delta_g2) == 1
//!
//! Public input ordering (matches FluppyPayment.circom):
//!   IC[1]=nullifier, IC[2]=verifiedRoot, IC[3]=merkleRoot,
//!   IC[4]=recipientHash, IC[5]=minAmount, IC[6]=maxAmount, IC[7]=chainId
//!
//! ── PRE-DEPLOY VERIFICATION NOTE ─────────────────────────────────────────────
//! Confirm the exact `soroban_sdk::crypto::bn254` module path and method
//! signatures against the specific soroban-sdk v26 release pinned in Cargo.toml
//! before mainnet deployment. The published SDK historically exposed BLS12-381;
//! the BN254 module names below follow the confirmed Protocol 26 API as provided.
//! If a method path differs in your pinned version, only the import line and the
//! three host-call sites need adjustment — the verification logic is correct.

use soroban_sdk::{
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    BytesN, Env, Vec,
};

use super::types::{Proof, PublicInputs, VerifyError, N_PUBLIC};
use super::vk_constants::{BN254_FIELD_PRIME_P, BN254_SCALAR_FIELD_R, VK};

/// Field element width in bytes (big-endian).
const FE_LEN: usize = 32;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/// Verifies a Groth16 proof against the embedded verification key.
///
/// Verification equation (neg_alpha_g1 is pre-negated in VK):
///   e(pi_a, pi_b)
///     · e(neg_alpha_g1, beta_g2)
///     · e(neg_vk_x,     gamma_g2)
///     · e(neg_pi_c,     delta_g2) == 1
pub fn verify_proof_impl(
    env: &Env,
    proof: &Proof,
    inputs: &PublicInputs,
) -> Result<(), VerifyError> {
    // 1. Field validation — every public input must be a canonical scalar (< r).
    validate_public_inputs(inputs)?;

    // 2. vk_x = IC[0] + MSM(IC[1..=7], inputs[0..=6])
    let vk_x = compute_vk_x(env, inputs);

    // 3. Negate vk_x and pi_c for the pairing product.
    let neg_vk_x = g1_negate(env, &g1_affine_to_array(&vk_x));
    let neg_pi_c = g1_negate(env, &proof.pi_c.to_array());

    // 4. Four-pairing Groth16 product check.
    let ok = run_pairing_check(env, proof, &neg_vk_x, &neg_pi_c);

    if ok {
        Ok(())
    } else {
        Err(VerifyError::InvalidProof)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FIELD VALIDATION
//    Copied (not imported) from bn254_demo.rs — independent backend.
// ─────────────────────────────────────────────────────────────────────────────

/// Ensures every public input is a canonical field element (strictly < r).
fn validate_public_inputs(inputs: &PublicInputs) -> Result<(), VerifyError> {
    let arr = inputs.as_array();

    if arr.len() != N_PUBLIC {
        return Err(VerifyError::InputCountMismatch);
    }

    for input in arr.iter() {
        if !is_less_than_field(&input.to_array(), &BN254_SCALAR_FIELD_R) {
            return Err(VerifyError::InputOutOfField);
        }
    }

    Ok(())
}

/// Big-endian unsigned comparison: returns true iff `value < modulus`.
fn is_less_than_field(value: &[u8; FE_LEN], modulus: &[u8; FE_LEN]) -> bool {
    for i in 0..FE_LEN {
        if value[i] < modulus[i] {
            return true;
        }
        if value[i] > modulus[i] {
            return false;
        }
    }
    // Equal ⇒ not strictly less.
    false
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MULTI-SCALAR MULTIPLICATION (vk_x)
//    vk_x = IC[0] + IC[1]*in[0] + ... + IC[7]*in[6]
//    Computed as IC[0] + MSM(IC[1..=7], inputs) in a single metered call.
// ─────────────────────────────────────────────────────────────────────────────

/// Computes the IC linear combination using the host MSM, then adds IC[0].
fn compute_vk_x(env: &Env, inputs: &PublicInputs) -> Bn254G1Affine {
    let bn254 = env.crypto().bn254();
    let arr = inputs.as_array();

    // Build parallel vectors: IC[1..=7] points and the 7 public-input scalars.
    let mut points: Vec<Bn254G1Affine> = Vec::new(env);
    let mut scalars: Vec<Bn254Fr> = Vec::new(env);

    for i in 0..N_PUBLIC {
        // IC index is i+1 (IC[0] is the constant term, added afterwards).
        points.push_back(Bn254G1Affine::from_array(env, &VK.ic[i + 1]));
        scalars.push_back(Bn254Fr::from_bytes(BytesN::from_array(env, &arr[i].to_array())));
    }

    // Single metered MSM call: Σ IC[i+1] * inputs[i].
    let msm = bn254.g1_msm(points, scalars);

    // Add the constant term IC[0].
    let ic0 = Bn254G1Affine::from_array(env, &VK.ic[0]);
    bn254.g1_add(&ic0, &msm)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. G1 NEGATION
//    Negate point (x, y) → (x, p - y), p = BN254 base field prime.
//    Point at infinity (all-zero y) maps to itself.
//    Copied (not imported) from bn254_demo.rs.
// ─────────────────────────────────────────────────────────────────────────────

/// Negates a G1 point encoded as 64 BE bytes (x_be32 ∥ y_be32).
/// Returns a `Bn254G1Affine` of (x, p - y).
fn g1_negate(env: &Env, point: &[u8; 64]) -> Bn254G1Affine {
    // Split into x (first 32) and y (last 32).
    let mut x = [0u8; FE_LEN];
    let mut y = [0u8; FE_LEN];
    x.copy_from_slice(&point[..FE_LEN]);
    y.copy_from_slice(&point[FE_LEN..]);

    // Point at infinity: y == 0 ⇒ negation is the identity.
    let y_is_zero = y.iter().all(|&b| b == 0);

    let neg_y = if y_is_zero {
        y
    } else {
        // neg_y = p - y (p > y guaranteed for a valid affine coordinate).
        be_sub(&BN254_FIELD_PRIME_P, &y)
    };

    // Reassemble x ∥ neg_y.
    let mut out = [0u8; 64];
    out[..FE_LEN].copy_from_slice(&x);
    out[FE_LEN..].copy_from_slice(&neg_y);

    Bn254G1Affine::from_array(env, &out)
}

/// Big-endian subtraction `a - b`, assuming a >= b. Returns 32-byte BE result.
fn be_sub(a: &[u8; FE_LEN], b: &[u8; FE_LEN]) -> [u8; FE_LEN] {
    let mut result = [0u8; FE_LEN];
    let mut borrow: i16 = 0;

    // Least-significant byte first (index 31 → 0).
    for i in (0..FE_LEN).rev() {
        let diff = (a[i] as i16) - (b[i] as i16) - borrow;
        if diff < 0 {
            result[i] = (diff + 256) as u8;
            borrow = 1;
        } else {
            result[i] = diff as u8;
            borrow = 0;
        }
    }

    result
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PAIRING CHECK
//    e(pi_a, pi_b) · e(neg_alpha, beta) · e(neg_vk_x, gamma) · e(neg_pi_c, delta) == 1
// ─────────────────────────────────────────────────────────────────────────────

/// Runs the four-pairing Groth16 product check.
fn run_pairing_check(
    env: &Env,
    proof: &Proof,
    neg_vk_x: &Bn254G1Affine,
    neg_pi_c: &Bn254G1Affine,
) -> bool {
    let bn254 = env.crypto().bn254();

    // G1 operands, in product order.
    let pi_a = Bn254G1Affine::from_array(env, &proof.pi_a.to_array());
    let neg_alpha_g1 = Bn254G1Affine::from_array(env, &VK.neg_alpha_g1); // pre-negated in VK

    // G2 operands, in the same order.
    let pi_b = Bn254G2Affine::from_array(env, &proof.pi_b.to_array());
    let beta_g2 = Bn254G2Affine::from_array(env, &VK.beta_g2);
    let gamma_g2 = Bn254G2Affine::from_array(env, &VK.gamma_g2);
    let delta_g2 = Bn254G2Affine::from_array(env, &VK.delta_g2);

    // Two parallel vectors, equal length, index-aligned.
    let mut g1_points: Vec<Bn254G1Affine> = Vec::new(env);
    let mut g2_points: Vec<Bn254G2Affine> = Vec::new(env);

    g1_points.push_back(pi_a);
    g2_points.push_back(pi_b);

    g1_points.push_back(neg_alpha_g1);
    g2_points.push_back(beta_g2);

    g1_points.push_back(neg_vk_x.clone());
    g2_points.push_back(gamma_g2);

    g1_points.push_back(neg_pi_c.clone());
    g2_points.push_back(delta_g2);

    // Returns true iff Π e(g1[i], g2[i]) == 1 in the target field.
    bn254.pairing_check(g1_points, g2_points)
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/// Extracts the raw 64-byte encoding (x_be32 ∥ y_be32) from a G1 affine point.
fn g1_affine_to_array(point: &Bn254G1Affine) -> [u8; 64] {
    point.to_array()
}