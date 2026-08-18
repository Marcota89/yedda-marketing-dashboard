---
milestone: cadencia-variedade
status: complete
current_phase: done
---
# State
Iniciado 2026-08-12 a partir do relatório aprovado. Fase 1 em andamento.

## Phase 1 — done (MAS PR #16, branch feat/f31-cadence-variety)
- R1.1–R1.6 + R2.4 entregues. 11ª forma de falha encontrada e corrigida (pg vazio → local).
- Verificado com LLM real: 3 posts, 3 ângulos, brand voice + exemplos no prompt.
- R4.1 já atendido pelo MAS por conta própria (e3443ca).

## Phase 2 — done (platform, deployed)
- R2.1 used_articles (Supabase) · R2.2/2.3 cloud dedupe by url_norm + title_hash · R2.5 weekly seeded pool from MAS verticals (fallback local) · R2.6 rotating article sets per post · R2.7 tolerant JSON unwrap (7/7 cases incl. live bug) · R2.8 weekly cache-bust.
- Verified: two-machine dedupe (utm/www variant + republished headline both caught). 32 historic titles backfilled.
- MAS temp process (PID 22124) running the new branch on :8000 for the mirror sync — replace by merging PR #16 and restarting start-dashboard.bat.

## Phase 3 — done (platform, deployed)
- V1 source chip · V2 vertical chip · V3 "This week: N of 3" · V4 "⚠ same source ×N" · V5 vertical filter · V6 render unwrap · R3.6 /api/posts?stats=1.
- Headless verified with seeded posts: dup badge fires on utm/www variants, cadence renders, 7 filter options, 0 JS errors.
- Baseline measured: 53 posts, 32 distinct sources, repeat_ratio 0.40, by_vertical all unknown (pre-change posts).
- Mirror fast-path: local MAS failure remembered per session → reads go straight to mirror (was ~12s wait for Roi).

## Phase 4 — closed
- R4.1 done by the MAS on their own (e3443ca, contract test for ContentPairStore).
- R4.2 (split index.html) deliberately deferred: phases 1-3 shipped with an unplanned 11th failure shape and three route fixes; refactoring 9.3k lines on top of week-old code doubles regression risk in the week Roi evaluates the result. Backlog with plan below.

## Milestone complete — 2026-08-18
MAS: PR #16 merged (ac3be61), CI 5/5 green, official dashboard restarted on new main, mirror synced.
Platform: 3 commits on main, deployed, headless-verified.

## Backlog (v-next)
- R4.2 Extract from index.html, in this order (each independently deployable): (1) news fetch + dedupe + pool → news.js; (2) generation prompts + parser → generate.js; (3) Radar/People's Posts → radar.js; (4) queue/intake UI → queue.js. Keep index.html as shell + boot. Gate: puppeteer smoke (seeded posts, 0 JS errors) before each step.
- Weight vertical rotation by /api/posts?stats=1 (least-covered) instead of ISO-week round-robin, now that the metric exists.
- Backfill _vertical on the 53 historic posts (classify by src keywords) so by_vertical stops reading "unknown".
