---
milestone: cadencia-variedade
status: in_progress
current_phase: 4
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
