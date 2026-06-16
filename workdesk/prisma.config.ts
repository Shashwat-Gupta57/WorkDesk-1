import { defineConfig, env } from "prisma/config";

// ─────────────────────────────────────────────────────────────────────────────
// Prisma 7 Config
//
// Connection URL is sourced from DATABASE_URL in environment variables.
// For PrismaClient, pass the adapter via the constructor in src/lib/db.ts.
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
