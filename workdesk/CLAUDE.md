@AGENTS.md

The full project guide lives at the repository root: ../CLAUDE.md

Quick reminder for this directory: this is the WorkDesk Next.js 16 codebase. Run all
commands here. Edge route protection is `src/proxy.ts` (not `middleware.ts`). The data layer
is raw SQL over `pg` (no ORM) — see `src/lib/db.ts`; apply schema with `npm run migrate`.
See ../CLAUDE.md for architecture conventions and ../mindmap.md for the detailed backend map.
