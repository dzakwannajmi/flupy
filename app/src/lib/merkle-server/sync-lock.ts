import { neon } from '@neondatabase/serverless';

/**
 * Distributed lock for the root-sync endpoint, backed by Postgres.
 *
 * Vercel Cron does not guarantee non-overlapping runs (a slow run +
 * short interval can overlap, and manual triggers are also possible).
 * Two concurrent set_merkle_root submissions from the same operator
 * account risk tx_BAD_SEQ, or worse, a last-write-wins race where a
 * newer root gets overwritten by a stale one still in flight.
 *
 * Uses a single-row table rather than a Postgres session-level advisory
 * lock, because @neondatabase/serverless issues each query as an
 * independent HTTP request (no persistent session to hold a session
 * lock across).
 *
 * Each function creates its own neon() client from the raw connection
 * string rather than sharing an instance across functions -- avoids a
 * TypeScript generic-inference mismatch between separately-created
 * NeonQueryFunction instances.
 */

const LOCK_STALE_AFTER_SECONDS = 120;

async function ensureLockSchema(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS sync_lock (
      id INTEGER PRIMARY KEY DEFAULT 1,
      locked_at TIMESTAMPTZ,
      CONSTRAINT sync_lock_single_row CHECK (id = 1)
    )
  `;

  await sql`
    INSERT INTO sync_lock (id, locked_at)
    VALUES (1, NULL)
    ON CONFLICT (id) DO NOTHING
  `;
}

/**
 * Attempts to acquire the sync lock. Returns true if acquired.
 *
 * A lock older than LOCK_STALE_AFTER_SECONDS is treated as abandoned
 * (e.g. a prior invocation crashed without releasing it) and can be
 * re-acquired -- this self-heals instead of requiring manual
 * intervention.
 */
export async function acquireSyncLock(databaseUrl: string): Promise<boolean> {
  await ensureLockSchema(databaseUrl);

  const sql = neon(databaseUrl);

  const result = await sql`
    UPDATE sync_lock
    SET locked_at = now()
    WHERE id = 1
      AND (
        locked_at IS NULL
        OR locked_at < now() - make_interval(secs => ${LOCK_STALE_AFTER_SECONDS})
      )
    RETURNING id
  ` as { id: number }[];

  return result.length > 0;
}

/** Releases the sync lock. Safe to call even if the lock was never held. */
export async function releaseSyncLock(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);

  await sql`
    UPDATE sync_lock SET locked_at = NULL WHERE id = 1
  `;
}
