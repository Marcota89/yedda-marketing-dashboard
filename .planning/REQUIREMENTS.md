# Requirements

## Fase 1 — Cadência + rotação de tópico (MAS)
- R1.1 Job semanal constrói via `build_runtime().f31_graph()`, nunca F31Config à mão
- R1.2 Guard de paridade varre `F31Config(` em todo `scripts/`, não só `run_*.py`
- R1.3 `F31Config.posts_per_run` (default 3); prompt pede N posts com ângulos distintos
- R1.4 `max_output_tokens` suficiente para 3 posts + summary sem truncar (testado)
- R1.5 Vertical da semana por `week % len(verticals)`; tópico derivado dela
- R1.6 Alerta (log ERROR + email se adapter) quando run entrega < posts_per_run

## Fase 2 — Variedade de notícias + dedupe global (plataforma + Supabase)
- R2.1 Tabela `used_articles` no Supabase (url_norm PK, title_hash, first_used_at, used_by)
- R2.2 `_filterSeen` consulta a nuvem via `/api/used-articles`; fallback localStorage se offline
- R2.3 `_markSeen` grava na nuvem (best-effort) além do local
- R2.4 Pool de queries por vertical em `config/verticals/*/news_queries.yaml` (MAS), servido em `/verticals`
- R2.5 Página sorteia 5 queries/semana do pool, com peso para verticais menos cobertas; fallback = pool local
- R2.6 Batch: nenhum par de posts com mesma fonte (url) nem mesma vertical
- R2.7 Parser desembrulha JSON aninhado (`{"content": {...}}` / `{"content": "{...}"}`) antes do last-resort
- R2.8 Cache-bust do RSS por semana ISO, não por request

## Fase 3 — Visibilidade para o Roi (plataforma)
- R3.1 Chip de fonte (domínio da URL) em cada card, clicável
- R3.2 Chip de vertical ao lado do chip de ângulo
- R3.3 Indicador "This week: N of 3" no topo do painel Create
- R3.4 Badge "⚠ same source" quando 2+ posts na lista compartilham url
- R3.5 Filtro por vertical na barra de filtros
- R3.6 `/api/v1/marketing/stats` expõe distribuição por vertical e por fonte (30 dias)

## Fase 4 — Dívida estrutural
- R4.1 Teste de contrato `ContentPairStore` no MAS (já pedido na rodada 10)
- R4.2 Extração de módulos do index.html — SOMENTE se fases 1-3 fecharem com folga; caso contrário, registrar como backlog

## Verificação (todas as fases)
- Cada fase termina com uma checagem contra a fila/site real, com número, não com "verde"
