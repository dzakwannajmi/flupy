import { CIRCUIT_DEPTH, POSEIDON_TAGS } from '@flupy/core';

export const TREE_DEPTH = CIRCUIT_DEPTH;

export { POSEIDON_TAGS };

export interface CommitmentSource {
  getAllCommitments(): Promise<bigint[]>;
}

export interface BuiltTree {
  readonly root: bigint;
  readonly commitmentMap: ReadonlyMap<string, number>;
  readonly nodesByLevel: readonly ReadonlyMap<number, bigint>[];
  readonly zeroHashes: readonly bigint[];
}

export interface ServerMerkleProof {
  readonly pathElements: string[];
  readonly pathIndices: number[];
  readonly root: string;
}

/**
 * A CommitmentSource that also supports writes.
 *
 * add/has/size are async because durable backends (Postgres) require a
 * network round-trip — unlike the original in-memory-only design.
 */
export interface MutableCommitmentSource extends CommitmentSource {
  add(commitment: bigint): Promise<boolean>;
  has(commitment: bigint): Promise<boolean>;
  size(): Promise<number>;
}
