import { neon } from '@neondatabase/serverless';

import type { MutableCommitmentSource } from './types';

/**
 * Postgres-backed commitment source (Neon serverless driver).
 *
 * Replaces InMemoryCommitmentSource for production: Vercel serverless
 * functions are stateless and lose in-memory state on every cold start,
 * which would silently drop enrolled commitments. This is a durable
 * store — every enrollment survives cold starts, deploys, and restarts.
 *
 * Leaf index allocation is atomic via a Postgres sequence (starting at
 * 0, to preserve the existing 0-indexed tree layout used throughout
 * tree-builder.ts) — this avoids divergent trees under concurrent
 * enrollment, which app-level counting could not guarantee.
 */
export class PostgresCommitmentSource implements MutableCommitmentSource {
  private readonly sql: ReturnType<typeof neon>;
  private schemaReady: Promise<void> | null = null;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await this.sql`
          CREATE SEQUENCE IF NOT EXISTS commitments_leaf_index_seq
            START WITH 0
            MINVALUE 0
        `;

        await this.sql`
          CREATE TABLE IF NOT EXISTS commitments (
            leaf_index INTEGER PRIMARY KEY
              DEFAULT nextval('commitments_leaf_index_seq'),
            commitment_hex TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            anchored BOOLEAN NOT NULL DEFAULT false
          )
        `;

        await this.sql`
          ALTER SEQUENCE commitments_leaf_index_seq
            OWNED BY commitments.leaf_index
        `;
      })();
    }

    return this.schemaReady;
  }

  private toKey(commitment: bigint): string {
    return commitment
      .toString(16)
      .padStart(64, '0')
      .toLowerCase();
  }

  async getAllCommitments(): Promise<bigint[]> {
    await this.ensureSchema();

    const rows = await this.sql`
      SELECT commitment_hex
      FROM commitments
      ORDER BY leaf_index ASC
    ` as { commitment_hex: string }[];

    return rows.map(row => BigInt('0x' + row.commitment_hex));
  }

  /**
   * Inserts a commitment if it doesn't already exist. Returns true if a
   * new row was inserted, false if the commitment was already enrolled.
   *
   * ON CONFLICT DO NOTHING + checking the result set size is the atomic
   * equivalent of "check exists, else insert" — avoids a race where two
   * concurrent enrollments of the same commitment both see "not present"
   * and both attempt to insert.
   */
  async add(commitment: bigint): Promise<boolean> {
    await this.ensureSchema();

    const key = this.toKey(commitment);

    const result = await this.sql`
      INSERT INTO commitments (commitment_hex)
      VALUES (${key})
      ON CONFLICT (commitment_hex) DO NOTHING
      RETURNING leaf_index
    ` as { leaf_index: number }[];

    return result.length > 0;
  }

  async has(commitment: bigint): Promise<boolean> {
    await this.ensureSchema();

    const key = this.toKey(commitment);

    const result = await this.sql`
      SELECT 1 FROM commitments WHERE commitment_hex = ${key}
    ` as unknown[];

    return result.length > 0;
  }

  async size(): Promise<number> {
    await this.ensureSchema();

    const result = await this.sql`
      SELECT COUNT(*)::int AS count FROM commitments
    ` as { count: number }[];

    return result[0]?.count ?? 0;
  }
}
