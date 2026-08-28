# Wordrena build checklist

Living progress tracker. Each checked item is a commit.

## Phase 0 — Scaffold
- [x] Repo structure, git init, gitignore, checklist
- [x] Python venv + genvm-linter + pytest
- [x] Root package.json + genlayer-js, network set to studionet, deployer verified (0xBC13…7f53, studionet reachable)

## Phase 1 — Intelligent Contracts
- [x] Bestiary.py (creatures + moves + natural-language forge via eq_principle)
- [x] Arena.py (deterministic battle sim + biome web oracle)
- [x] Tribunal.py (move-balance disputes + appeal jury)
- [x] genvm-lint check passes on all three

## Phase 2 — Contract tests
- [x] gl_runtime.py extended (web + eq_principle), conftest
- [x] test_bestiary.py
- [x] test_arena.py
- [x] test_tribunal.py
- [x] Full suite green (32 passing)

## Phase 3 — Deploy
- [x] deploy.mjs wires all three on studionet, writes addresses.json
- [x] Smoke test against live contracts (green: craft, forge, duel, record all on chain)

## Phase 4 — Web app
- [ ] Next.js scaffold + config + design system (uniform theme)
- [ ] Logo + brand + favicon
- [ ] Chain/auth/db/wallet/session/indexer libs
- [ ] Privy email auth + custodial wallet flow
- [ ] Server-relayed write API (abstracted transactions)
- [ ] State/read API routes
- [ ] Pages: Landing
- [ ] Pages: Forge (craft creature + write moves)
- [ ] Pages: Bestiary (the living meta)
- [ ] Pages: Arena (battle + watch the fight)
- [ ] Pages: Tribunal (disputes + watch the appeal)
- [ ] Pages: How to play (teaching)
- [ ] Pages: My roster / account
- [ ] Lint + typecheck green

## Phase 5 — Finalize
- [ ] Human-written README (no AI artifacts, no stray hyphens)
- [ ] Push to GitHub
