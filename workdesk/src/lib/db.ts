import { Pool, PoolClient, QueryResultRow } from "pg";

// ─────────────────────────────────────────────────────────────────────────────
// PostgreSQL access layer (node-postgres) — replaces Prisma.
//
// A single shared Pool is created per process. In Next.js dev, module
// hot-reloading would otherwise spawn multiple pools; the globalThis pattern
// prevents that (same approach used previously for the Prisma singleton).
//
// Query helpers:
//   query<T>(sql, params)        → all rows
//   queryOne<T>(sql, params)     → first row or null
//   transaction(fn)              → run fn within BEGIN/COMMIT (ROLLBACK on throw)
//
// SQL is written by hand. Always use parameterized queries ($1, $2, …) — never
// string-interpolate user input.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPg = globalThis as unknown as {
  pgPool: Pool | undefined;
};

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

export const pool: Pool = globalForPg.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

/** Runs a query and returns all rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = []
): Promise<T[]> {
  const result = await pool.query<T>(sql, params as unknown[]);
  return result.rows;
}

/** Runs a query and returns the first row, or null if none. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: ReadonlyArray<unknown> = []
): Promise<T | null> {
  const result = await pool.query<T>(sql, params as unknown[]);
  return result.rows[0] ?? null;
}

/**
 * Runs `fn` inside a single transaction on a dedicated client.
 * Commits on success, rolls back on any thrown error, and always releases
 * the client back to the pool.
 *
 * Use tx.query(...) for every statement inside `fn` so they share one connection.
 */
export async function transaction<T>(
  fn: (tx: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
