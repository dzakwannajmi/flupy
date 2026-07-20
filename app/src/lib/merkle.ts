'use client';

import {
  enrollCommitment,
  getMerkleProof as getBrowserMerkleProof,
  type BrowserMerkleProof,
} from '@flupy/browser';

export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

/**
 * Enrolls a secret by computing its commitment locally and posting only the
 * commitment to the backend.
 *
 * The raw secret never leaves the browser.
 */
export async function addToMockWhitelist(secret: string): Promise<void> {
  await enrollCommitment(secret);
}

/**
 * Fetches a Merkle membership proof from the backend.
 *
 * This wrapper preserves the existing app API while delegating the browser
 * implementation to @flupy/browser.
 */
export async function getMerkleProof(secret: string): Promise<MerkleProof> {
  const proof: BrowserMerkleProof = await getBrowserMerkleProof(secret);

  return {
    pathElements: proof.pathElements,
    pathIndices: proof.pathIndices,
    root: proof.root,
  };
}
