/// <reference path="./types/circomlibjs.d.ts" />

import { buildPoseidon } from 'circomlibjs';

import {
  BN254_R,
  CIRCUIT_DEPTH,
  POSEIDON_TAGS,
} from '@flupy/core';

export interface BrowserMerkleProof {
  readonly pathElements: bigint[];
  readonly pathIndices: number[];
  readonly root: bigint;
}

export interface EnrollCommitmentResult {
  readonly enrolled: number;
  readonly alreadyEnrolled?: boolean;
}

export interface MerkleClientOptions {
  readonly baseUrl?: string;
}

interface LeafSetApiResponse {
  readonly leaves: string[];
  readonly root: string;
}

let poseidonInstance: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

async function getPoseidon(): Promise<Awaited<ReturnType<typeof buildPoseidon>>> {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }

  return poseidonInstance;
}

function resolveApiUrl(
  path: string,
  options?: MerkleClientOptions,
): string {
  const baseUrl = options?.baseUrl ?? '';

  return `${baseUrl}${path}`;
}

function validateSecret(secret: string): void {
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error('[Merkle] Invalid secret: must be 64-char hex string.');
  }
}

function secretToField(hexSecret: string): bigint {
  return BigInt(`0x${hexSecret}`) % BN254_R;
}

function commitmentToHex(commitment: bigint): string {
  return commitment
    .toString(16)
    .padStart(64, '0')
    .toLowerCase();
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const data = await response.json() as {
        error?: unknown;
        message?: unknown;
      };

      return String(
        data.error ??
        data.message ??
        fallback,
      );
    }

    return `${fallback}. HTTP ${response.status}`;
  } catch {
    return `${fallback}. HTTP ${response.status}`;
  }
}

/**
 * Computes a Merkle commitment locally from a secret.
 *
 * The raw secret never leaves the browser.
 */
export async function computeCommitment(secret: string): Promise<bigint> {
  validateSecret(secret);

  const poseidon = await getPoseidon();
  const field = secretToField(secret);

  return poseidon.F.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      field,
    ]),
  ) as bigint;
}

/**
 * Enrolls a locally computed commitment into the Merkle backend.
 *
 * This is intended for local/testnet/mock enrollment flows.
 * Production should use authenticated admin enrollment.
 */
export async function enrollCommitment(
  secret: string,
  options?: MerkleClientOptions,
): Promise<EnrollCommitmentResult> {
  const commitment = await computeCommitment(secret);
  const commitmentHex = commitmentToHex(commitment);

  const response = await fetch(
    resolveApiUrl('/api/merkle-proof/enroll', options),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commitment: commitmentHex,
      }),
    },
  );

  if (!response.ok) {
    const error = await readApiError(
      response,
      '[Merkle] Enrollment failed',
    );

    throw new Error(error);
  }

  return await response.json() as EnrollCommitmentResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side Merkle path computation
//
// Privacy rationale: the backend serves the SAME leaf set to every caller
// (see /api/merkle-proof route) rather than a per-commitment path. This
// prevents the server from learning "which commitment is about to be
// used for payment" from request timing — a deanonymization vector that
// requires no wallet address to ever be transmitted. All tree-walking
// happens locally, mirroring app/src/lib/merkle-server/tree-builder.ts
// exactly (same zero-hash derivation, same NODE_TAG domain separation).
// ─────────────────────────────────────────────────────────────────────────────

let zeroHashCache: readonly bigint[] | null = null;

async function getZeroHashes(): Promise<readonly bigint[]> {
  if (zeroHashCache) {
    return zeroHashCache;
  }

  const poseidon = await getPoseidon();
  const field = poseidon.F;
  const hashes: bigint[] = new Array(CIRCUIT_DEPTH + 1);

  hashes[0] = field.toObject(
    poseidon([
      POSEIDON_TAGS.LEAF,
      0n,
    ]),
  ) as bigint;

  for (let level = 1; level <= CIRCUIT_DEPTH; level++) {
    const previous = hashes[level - 1];

    if (previous === undefined) {
      throw new Error(`[Merkle] Missing zero hash for level ${level - 1}`);
    }

    hashes[level] = field.toObject(
      poseidon([
        POSEIDON_TAGS.NODE,
        previous,
        previous,
      ]),
    ) as bigint;
  }

  zeroHashCache = hashes;

  return zeroHashCache;
}

/**
 * Builds a sparse Merkle tree from the full leaf set and extracts the
 * membership path for a single leaf index — entirely client-side.
 *
 * Mirrors buildMerkleTree() + extractMerklePath() in
 * app/src/lib/merkle-server/tree-builder.ts. Any change to the hashing
 * rules there MUST be mirrored here.
 */
async function buildPathFromLeaves(
  leaves: readonly bigint[],
  leafIndex: number,
): Promise<{ pathElements: bigint[]; pathIndices: number[]; root: bigint }> {
  const poseidon = await getPoseidon();
  const field = poseidon.F;
  const zeroHashes = await getZeroHashes();

  const levels: Map<number, bigint>[] = Array.from(
    { length: CIRCUIT_DEPTH + 1 },
    () => new Map<number, bigint>(),
  );

  const leafLevel = levels[0];

  if (!leafLevel) {
    throw new Error('[Merkle] Missing leaf level');
  }

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];

    if (leaf === undefined) {
      throw new Error(`[Merkle] Missing leaf at index ${i}`);
    }

    leafLevel.set(i, leaf);
  }

  for (let level = 0; level < CIRCUIT_DEPTH; level++) {
    const currentLevel = levels[level];
    const nextLevel = levels[level + 1];
    const zeroHash = zeroHashes[level];

    if (!currentLevel || !nextLevel || zeroHash === undefined) {
      throw new Error(`[Merkle] Invalid tree state at level ${level}`);
    }

    const parentIndices = new Set<number>();

    for (const nodeIndex of currentLevel.keys()) {
      parentIndices.add(Math.floor(nodeIndex / 2));
    }

    for (const parentIndex of parentIndices) {
      const leftIndex = parentIndex * 2;
      const rightIndex = leftIndex + 1;

      const leftHash = currentLevel.get(leftIndex) ?? zeroHash;
      const rightHash = currentLevel.get(rightIndex) ?? zeroHash;

      const parentHash = field.toObject(
        poseidon([
          POSEIDON_TAGS.NODE,
          leftHash,
          rightHash,
        ]),
      ) as bigint;

      nextLevel.set(parentIndex, parentHash);
    }
  }

  const rootLevel = levels[CIRCUIT_DEPTH];
  const defaultRoot = zeroHashes[CIRCUIT_DEPTH];

  if (!rootLevel || defaultRoot === undefined) {
    throw new Error('[Merkle] Missing root level');
  }

  const root = rootLevel.get(0) ?? defaultRoot;

  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let index = leafIndex;

  for (let level = 0; level < CIRCUIT_DEPTH; level++) {
    const levelNodes = levels[level];
    const zeroHash = zeroHashes[level];

    if (!levelNodes || zeroHash === undefined) {
      throw new Error(`[Merkle] Missing proof data at level ${level}`);
    }

    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;
    const siblingHash = levelNodes.get(siblingIndex) ?? zeroHash;

    pathElements.push(siblingHash);
    pathIndices.push(isRight ? 1 : 0);

    index = Math.floor(index / 2);
  }

  return { pathElements, pathIndices, root };
}

/**
 * Fetches the full enrolled leaf set from the backend and computes this
 * secret's Merkle membership proof entirely client-side.
 *
 * The backend receives NO commitment, NO secret, and no indication of
 * which leaf is being proven — see the privacy rationale on
 * buildPathFromLeaves() above.
 */
export async function getMerkleProof(
  secret: string,
  options?: MerkleClientOptions,
): Promise<BrowserMerkleProof> {
  const commitment = await computeCommitment(secret);
  const commitmentDecimal = commitment.toString();

  const response = await fetch(
    resolveApiUrl('/api/merkle-proof', options),
    {
      method: 'GET',
    },
  );

  if (!response.ok) {
    const error = await readApiError(
      response,
      '[Merkle] Leaf set request failed',
    );

    throw new Error(`[Merkle] ${error}`);
  }

  const data = await response.json() as LeafSetApiResponse;

  const leafIndex = data.leaves.indexOf(commitmentDecimal);

  if (leafIndex === -1) {
    throw new Error(
      '[Merkle] Commitment not found in enrolled leaf set. ' +
      'Has this credential been enrolled?',
    );
  }

  const leaves = data.leaves.map(leaf => BigInt(leaf));

  const { pathElements, pathIndices, root } = await buildPathFromLeaves(
    leaves,
    leafIndex,
  );

  const serverRoot = BigInt(data.root);

  if (root !== serverRoot) {
    throw new Error(
      '[Merkle] Locally computed root does not match server-reported root. ' +
      'This indicates a tree construction mismatch.',
    );
  }

  return {
    pathElements,
    pathIndices,
    root,
  };
}
