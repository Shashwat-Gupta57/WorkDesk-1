import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma Seed Script
//
// Creates a default ADMIN user for the initial deployment.
// Run with: npx prisma db seed
//
// Credentials are sourced from environment variables.
// Never hard-code credentials in source — use .env.local for local dev.
//
// SEED_ADMIN_EMAIL    — admin login email
// SEED_ADMIN_PASSWORD — admin login password (must meet password policy)
// SEED_ADMIN_NAME     — admin display name
// ─────────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
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

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {}, // Do not overwrite an existing admin on re-seed.
    create: {
      email,
      passwordHash,
      name,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // Write a USER_CREATED audit record for the bootstrapped admin.
  await prisma.auditLog.create({
    data: {
      action: "USER_CREATED",
      actorId: admin.id,
      targetId: admin.id,
      details: {
        method: "seed",
        note: "Initial administrator account created via prisma db seed.",
      },
    },
  });

  console.log(`✔ Admin seeded: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
