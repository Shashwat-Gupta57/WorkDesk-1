-- ─────────────────────────────────────────────────────────────────────────────
-- 0002 — audit_logs.target_id is polymorphic, not a user FK
--
-- The baseline schema (inherited from the original Prisma model) constrained
-- audit_logs.target_id with a foreign key to users(id). But audit targets are
-- polymorphic: a target may be a User (suspend/role change), a Set (folder
-- delete), or an Artifact (create/update/delete/version events). The FK made
-- every archive audit insert fail — and because the artifact-create audit runs
-- inside the same transaction, it aborted artifact creation entirely.
--
-- Fix: drop the target_id → users FK. actor_id keeps its FK (an actor is always
-- a real user). The target_id index is retained for lookups.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_target_id_fkey;
