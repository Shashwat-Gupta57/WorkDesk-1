import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma 7 Singleton with pg Adapter
//
// Prisma 7 requires a driver adapter to be passed to PrismaClient directly.
// The connection pool is created once and shared across the singleton.
//
// In Next.js 15 development mode, module hot-reloading would otherwise create
// multiple Pool + PrismaClient instances. The globalThis pattern prevents that.
// ─────────────────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
