import bcrypt from "bcryptjs";
import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────────
// Seed Script (node-postgres)
//
// Creates a default ADMIN user for the initial deployment.
// Run with: npm run seed   (requires migrations applied first: npm run migrate)
//
// Credentials are sourced from environment variables.
// Never hard-code credentials in source — use .env.local for local dev.
//
// SEED_ADMIN_EMAIL    — admin login email
// SEED_ADMIN_PASSWORD — admin login password (must meet password policy)
// SEED_ADMIN_NAME     — admin display name
// ─────────────────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Administrator";

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in environment variables."
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert the admin; do nothing if the email already exists (idempotent re-seed).
    // `inserted` rows are non-empty only when a NEW row was created.
    const { rows: inserted } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, name, role, status)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email.toLowerCase().trim(), passwordHash, name]
    );

    if (inserted.length === 0) {
      console.log(`✔ Admin already exists: ${email} (no changes).`);
      return;
    }

    const adminId = inserted[0].id;

    // Only audit on a genuine first creation (avoids duplicate USER_CREATED rows).
    await pool.query(
      `INSERT INTO audit_logs (action, actor_id, target_id, details)
       VALUES ('USER_CREATED', $1, $1, $2)`,
      [
        adminId,
        JSON.stringify({
          method: "seed",
          note: "Initial administrator account created via seed script.",
        }),
      ]
    );

    console.log(`✔ Admin seeded: ${email} (id: ${adminId})`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
