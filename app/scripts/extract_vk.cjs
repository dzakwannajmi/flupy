/**
 * extract_vk.cjs
 *
 * Converts verification_key.json (SnarkJS Groth16 output) into
 * Rust [u8; N] byte array constants for vk_constants.rs.
 *
 * Usage:
 *   node app/scripts/extract_vk.cjs <path-to-vkey.json> [--verify]
 *
 * Flags:
 *   --verify   Run on-curve validation + round-trip check on all points.
 *              Recommended before updating vk_constants.rs.
 *
 * Output: paste into contracts/src/verifier/vk_constants.rs
 *
 * Byte formats (EIP-196/197, matches Soroban bn254 host functions):
 *   G1:  x_be32 || y_be32          (64 bytes)
 *   G2:  x_c1_be32 || x_c0_be32 || y_c1_be32 || y_c0_be32  (128 bytes)
 *   neg_alpha_g1: (x, p - y)       pre-negated for pairing
 */

'use strict';

const fs = require('fs');

// ── BN254 base field prime p ─────────────────────────────────────────────────
const BN254_P =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

// BN254 scalar field r
const BN254_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// ── CLI ──────────────────────────────────────────────────────────────────────

const vkPath   = process.argv[2] || 'circuits/vkey.json';
const doVerify = process.argv.includes('--verify');

const vk       = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
const nPublic  = vk.nPublic;
const icLength = vk.IC.length; // should be nPublic + 1

// ── Byte helpers ─────────────────────────────────────────────────────────────

/** Decimal string → 32-byte big-endian Buffer */
function decTo32Bytes(dec) {
  let hex = BigInt(dec).toString(16);
  while (hex.length < 64) hex = '0' + hex;
  return Buffer.from(hex, 'hex');
}

/** 32-byte Buffer → BigInt (for round-trip check) */
function bytesToBigInt(buf) {
  return BigInt('0x' + buf.toString('hex'));
}

/** G1 point → 64 bytes: x_be32 || y_be32 */
function g1(point) {
  return Buffer.concat([
    decTo32Bytes(point[0]),
    decTo32Bytes(point[1]),
  ]);
}

/** G1 point, pre-negated: x_be32 || (p - y)_be32 */
function g1Neg(point) {
  const x    = decTo32Bytes(point[0]);
  const y    = BigInt(point[1]);
  const negY = BN254_P - y;
  return Buffer.concat([x, decTo32Bytes(negY.toString())]);
}

/**
 * G2 point → 128 bytes: x_c1_be32 || x_c0_be32 || y_c1_be32 || y_c0_be32
 *
 * SnarkJS stores G2 as [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]] --
 * index 0 is c0 (real part), index 1 is c1 (imaginary part). This was
 * verified empirically 2026-07-23 via an on-curve check in both possible
 * orderings -- only (real=index0, imag=index1) landed on the BN254 twist
 * curve. An earlier version of this function had the labels backwards
 * (called index0 "c1") and therefore emitted c0||c1 instead of the
 * required c1||c0 -- Soroban/EIP-197 wants the imaginary component first.
 */
function g2(point) {
  return Buffer.concat([
    decTo32Bytes(point[0][1]), // x_c1 (imaginary)
    decTo32Bytes(point[0][0]), // x_c0 (real)
    decTo32Bytes(point[1][1]), // y_c1 (imaginary)
    decTo32Bytes(point[1][0]), // y_c0 (real)
  ]);
}

/** Buffer → Rust [u8; N] literal with hex bytes */
function toRustArrayHex(buf) {
  return `[${Array.from(buf)
    .map(b => `0x${b.toString(16).padStart(2, '0')}`)
    .join(', ')}]`;
}

// ── Validation helpers (used only with --verify) ─────────────────────────────

/**
 * Checks G1 point lies on BN254: y² ≡ x³ + 3 (mod p)
 * Basic affine check — not a full subgroup membership check.
 */
function validateG1OnCurve(point) {
  const x = BigInt(point[0]);
  const y = BigInt(point[1]);
  if (x === 0n && y === 0n) return true; // point at infinity
  const lhs = (y * y) % BN254_P;
  const rhs = (x * x * x + 3n) % BN254_P;
  return lhs === rhs;
}

/**
 * Round-trip check for G1: encode to bytes, decode, compare with original.
 */
function roundTripG1(point) {
  const buf = g1(point);
  return (
    bytesToBigInt(buf.slice(0, 32)) === BigInt(point[0]) &&
    bytesToBigInt(buf.slice(32, 64)) === BigInt(point[1])
  );
}

/**
 * Round-trip check for G2: encode to bytes, decode, compare with original.
 */
function roundTripG2(point) {
  const buf = g2(point);
  // g2() emits c1||c0||c1||c0 (imaginary before real) -- round-trip must
  // decode in that same order, matching index [1] first, then [0].
  return (
    bytesToBigInt(buf.slice(0, 32))   === BigInt(point[0][1]) &&
    bytesToBigInt(buf.slice(32, 64))  === BigInt(point[0][0]) &&
    bytesToBigInt(buf.slice(64, 96))  === BigInt(point[1][1]) &&
    bytesToBigInt(buf.slice(96, 128)) === BigInt(point[1][0])
  );
}

// ── Sanity checks (always run) ───────────────────────────────────────────────

let errors = 0;

function check(condition, label) {
  if (!condition) {
    process.stderr.write(`❌  ${label}\n`);
    errors++;
  } else {
    process.stderr.write(`✅  ${label}\n`);
  }
}

process.stderr.write('\n// ── Sanity checks ──────────────────────────────────────────\n');
check(vk.protocol === 'groth16',       `protocol == groth16 (got: ${vk.protocol})`);
check(vk.curve    === 'bn128',         `curve == bn128/BN254 (got: ${vk.curve})`);
check(icLength    === nPublic + 1,     `IC.length (${icLength}) == nPublic+1 (${nPublic+1})`);

// ── Extended validation (only with --verify) ─────────────────────────────────

// BN254 twist curve b2 = 3/(9+i) -- public parameter, used to validate G2 points.
const B2_C0 = 19485874751759354771024239261021720505790618469301721065564631296452457478373n;
const B2_C1 = 266929791119991161246907387137283842545076965332900288569378510910307636690n;

function fp2Mul(a0, a1, b0, b1) {
  const c0 = ((a0 * b0 - a1 * b1) % BN254_P + BN254_P) % BN254_P;
  const c1 = ((a0 * b1 + a1 * b0) % BN254_P + BN254_P) % BN254_P;
  return [c0, c1];
}

/** Checks G2 point lies on the BN254 twist: y² ≡ x³ + b2 (mod p), over Fp2. */
function validateG2OnCurve(point) {
  const x0 = BigInt(point[0][0]);
  const x1 = BigInt(point[0][1]);
  const y0 = BigInt(point[1][0]);
  const y1 = BigInt(point[1][1]);
  if (x0 === 0n && x1 === 0n && y0 === 0n && y1 === 0n) return true; // point at infinity
  const [ySq0, ySq1] = fp2Mul(y0, y1, y0, y1);
  const [xSq0, xSq1] = fp2Mul(x0, x1, x0, x1);
  const [xCube0, xCube1] = fp2Mul(xSq0, xSq1, x0, x1);
  const rhs0 = (xCube0 + B2_C0) % BN254_P;
  const rhs1 = (xCube1 + B2_C1) % BN254_P;
  return ySq0 === rhs0 && ySq1 === rhs1;
}

if (doVerify) {
  process.stderr.write('\n// ── On-curve validation ────────────────────────────────────\n');
  check(validateG1OnCurve(vk.vk_alpha_1), 'vk_alpha_1 on BN254 curve');
  check(validateG2OnCurve(vk.vk_beta_2), 'vk_beta_2 on BN254 twist curve');
  check(validateG2OnCurve(vk.vk_gamma_2), 'vk_gamma_2 on BN254 twist curve');
  check(validateG2OnCurve(vk.vk_delta_2), 'vk_delta_2 on BN254 twist curve');
  vk.IC.forEach((ic, i) => {
    check(validateG1OnCurve(ic), `IC[${i}] on BN254 curve`);
  });

  process.stderr.write('\n// ── Round-trip verification ────────────────────────────────\n');
  check(roundTripG1(vk.vk_alpha_1), 'vk_alpha_1 round-trip');
  check(roundTripG2(vk.vk_beta_2),  'vk_beta_2  round-trip');
  check(roundTripG2(vk.vk_gamma_2), 'vk_gamma_2 round-trip');
  check(roundTripG2(vk.vk_delta_2), 'vk_delta_2 round-trip');
  vk.IC.forEach((ic, i) => {
    check(roundTripG1(ic), `IC[${i}]    round-trip`);
  });
}

if (errors > 0) {
  process.stderr.write(`\n❌  ${errors} error(s). Fix before using output.\n\n`);
  process.exit(1);
}

process.stderr.write(`\n// ── All checks passed — output below ───────────────────────\n\n`);

// ── Rust output (stdout) ─────────────────────────────────────────────────────

console.log('// ════════════════════════════════════════════════════════');
console.log('// AUTO-GENERATED — do not edit by hand.');
console.log(`// Source:   ${vkPath}`);
console.log(`// Protocol: ${vk.protocol}  Curve: ${vk.curve}  nPublic: ${nPublic}`);
console.log(`// IC:       ${icLength} entries (IC[0]=constant + IC[1..${nPublic}]=signals)`);
console.log(`// Verified: ${doVerify ? 'on-curve + round-trip ✅' : 'sanity only (use --verify for full check)'}`);
console.log('// ════════════════════════════════════════════════════════\n');

// BN254 field constants
console.log('pub const BN254_SCALAR_FIELD_R: [u8; 32] =');
console.log(`    ${toRustArrayHex(decTo32Bytes(BN254_R.toString()))};\n`);

console.log('pub const BN254_FIELD_PRIME_P: [u8; 32] =');
console.log(`    ${toRustArrayHex(decTo32Bytes(BN254_P.toString()))};\n`);

// neg_alpha_g1
console.log('// neg_alpha_g1 = vk_alpha_1 negated: G1(x, p - y)');
console.log(`// Raw alpha x: ${vk.vk_alpha_1[0].slice(0, 24)}...`);
console.log('pub const NEG_ALPHA_G1: [u8; 64] =');
console.log(`    ${toRustArrayHex(g1Neg(vk.vk_alpha_1))};\n`);

// G2 points
[
  ['vk_beta_2',  'BETA_G2'],
  ['vk_gamma_2', 'GAMMA_G2'],
  ['vk_delta_2', 'DELTA_G2'],
].forEach(([key, name]) => {
  console.log(`// ${name}: x_c1_be32 || x_c0_be32 || y_c1_be32 || y_c0_be32 (EIP-197)`);
  console.log(`pub const ${name}: [u8; 128] =`);
  console.log(`    ${toRustArrayHex(g2(vk[key]))};\n`);
});

// IC points
const labels = [
  'constant',
  'nullifier',
  'verifiedRoot',
  'merkleRoot',
  'recipientHash',
  'payerHash',
  'amount',
  'chainId',
];

console.log(`// IC[0..=${nPublic}]: IC[0]=constant term, IC[1..${nPublic}]=public signals`);
console.log(`pub const IC: [[u8; 64]; ${icLength}] = [`);
for (let i = 0; i < icLength; i++) {
  const label = labels[i] ?? `signal_${i}`;
  console.log(`    // IC[${i}] = ${label}`);
  console.log(`    ${toRustArrayHex(g1(vk.IC[i]))},`);
}
console.log('];\n');
