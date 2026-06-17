/**
 * Minimal forward-only SQL migration runner (no ORM).
 *
 * - Reads every `*.sql` file in /migrations, sorted by filename.
 * - Tracks applied filenames in a `_migrations` table.
 * - Runs each unapplied file inside its own transaction.
 *
 * Usage:  npm run migrate
 * Env:    DATABASE_URL
 */
import { Pool } from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await pool.query<{ name: string }>("SELECT name FROM _migrations")).rows.map(
        (r) => r.name
      )
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("[migrate] No migration files found.");
      return;
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[migrate] Applied ${file}`);
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] FAILED on ${file} — rolled back.`);
        throw err;
      } finally {
        client.release();
      }
    }

    console.log(
      ran === 0
        ? "[migrate] Already up to date."
        : `[migrate] Done — applied ${ran} migration(s).`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
