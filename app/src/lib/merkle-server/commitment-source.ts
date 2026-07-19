import { PostgresCommitmentSource } from './postgres-commitment-source';
import type { MutableCommitmentSource } from './types';

/**
 * In-memory commitment source for local development ONLY.
 *
 * WARNING: state is lost on every process restart. Never used when
 * DATABASE_URL is set (see getCommitmentSource() below) — production
 * and any Vercel deployment always uses PostgresCommitmentSource.
 */
export class InMemoryCommitmentSource implements MutableCommitmentSource {
  private readonly commitments: bigint[] = [];
  private readonly commitmentKeys = new Set<string>();

  async getAllCommitments(): Promise<bigint[]> {
    return [...this.commitments];
  }

  async add(commitment: bigint): Promise<boolean> {
    const key = this.toKey(commitment);

    if (this.commitmentKeys.has(key)) {
      return false;
    }

    this.commitments.push(commitment);
    this.commitmentKeys.add(key);

    return true;
  }

  async has(commitment: bigint): Promise<boolean> {
    return this.commitmentKeys.has(
      this.toKey(commitment),
    );
  }

  async size(): Promise<number> {
    return this.commitments.length;
  }

  private toKey(commitment: bigint): string {
    return commitment
      .toString(16)
      .padStart(64, '0')
      .toLowerCase();
  }
}

let sourceInstance: MutableCommitmentSource | null = null;

/**
 * Returns the process-wide commitment source singleton.
 *
 * Uses PostgresCommitmentSource whenever DATABASE_URL is set (Vercel
 * injects this automatically once the Neon integration is installed —
 * true for every deployed environment). Falls back to
 * InMemoryCommitmentSource only for local development without a
 * configured database.
 */
export function getCommitmentSource(): MutableCommitmentSource {
  if (!sourceInstance) {
    const databaseUrl = process.env.DATABASE_URL;

    sourceInstance = databaseUrl
      ? new PostgresCommitmentSource(databaseUrl)
      : new InMemoryCommitmentSource();
  }

  return sourceInstance;
}
