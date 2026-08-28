# Wordrena build checklist

Living progress tracker. Each checked item is a commit.

## Phase 0 — Scaffold
- [x] Repo structure, git init, gitignore, checklist
- [x] Python venv + genvm-linter + pytest
- [x] Root package.json + genlayer-js, network set to studionet, deployer verified (0xBC13…7f53, studionet reachable)

## Phase 1 — Intelligent Contracts
- [ ] Bestiary.py (creatures + moves + natural-language forge via eq_principle)
- [ ] Arena.py (deterministic battle sim + biome web oracle)
- [ ] Tribunal.py (move-balance disputes + appeal jury)
- [ ] genvm-lint check passes on all three

## Phase 2 — Contract tests
- [ ] gl_runtime.py extended (web + eq_principle), conftest
- [ ] test_bestiary.py
- [ ] test_arena.py
- [ ] test_tribunal.py
- [ ] Full suite green

## Phase 3 — Deploy
- [ ] deploy.mjs wires all three on studionet, writes addresses.json
- [ ] Smoke test against live contracts

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
