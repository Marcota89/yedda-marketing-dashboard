# Integração com Yedda MAS

Este projeto (Marketing Agent) está sincronizado com o **Yedda MAS** (Multi-Agent System), localizado em:

```
C:\Users\Admin\OneDrive\Área de Trabalho\yedda-mas-step1
```

---

## O que o Yedda MAS consome deste projeto

| Asset deste projeto | Destino no MAS | Finalidade |
|---|---|---|
| `BRAND-VOICE.md` | `data/rag/marketing/BRAND-VOICE.md` | RAG collection `yedda_marketing` — voz da marca para geração de posts |
| `LINKEDIN-CONTENT-BANK.md` | `data/rag/marketing/LINKEDIN-CONTENT-BANK.md` | RAG collection `yedda_marketing` — exemplos few-shot |
| `scripts/social_calendar.py` | `composio_adapters.make_social_calendar_fn()` | Geração de calendário editorial semanal |
| `scripts/competitor_scanner.py` | `composio_adapters.make_competitor_scan_fn()` | Análise de competidores por tópico |

---

## Workflow F31 — Content Marketing (MAS)

O MAS roda um workflow LangGraph chamado `f31_content_marketing` que:

1. **research_node** — busca web + competitor scan + injeta proof points Yedda (54% accuracy, 55s reports, ROI 180-400%)
2. **draft_node** — gera ≥2 posts LinkedIn + 1 research summary com culture overlay
3. **review_node** — valida vocabulário proibido (real-time, game-changing, revolutionary...) com rewrite loop
4. **deliver_node** — envia para aprovação no Slack (`#marketing`) ou salva em `output/content/YYYY-MM-DD_posts.md`

**Agendamento:** toda segunda-feira às 09:00 UTC (job `marketing_content_weekly` no APScheduler)

---

## Como verificar se a sincronização está OK

No projeto MAS, rodar:

```bash
python -X utf8 scripts/check_marketing_sync.py
```

Saída esperada: `SINCRONIZADO -- 0 problema(s) encontrado(s)`

---

## Como atualizar os assets RAG

Se `BRAND-VOICE.md` ou `LINKEDIN-CONTENT-BANK.md` forem editados aqui, rodar no MAS:

```bash
python -X utf8 scripts/check_marketing_sync.py --fix
```

Isso copia automaticamente os arquivos atualizados para `data/rag/marketing/` e re-ingere no pgvector.

Ou ingerir manualmente:

```bash
python scripts/ingest_marketing_docs.py --dry-run        # verificar chunks
python scripts/ingest_marketing_docs.py --store-type pgvector  # ingerir em produção
```

---

## Variáveis de ambiente necessárias (no MAS `.env`)

| Variável | Valor | Status |
|---|---|---|
| `MARKETING_AGENT_DIR` | `C:/Users/Admin/OneDrive/Área de Trabalho/Marketing agent` | Configurado |
| `SLACK_APPROVAL_CHANNEL` | `#marketing` | Configurado |
| `SLACK_BOT_TOKEN` | `xoxb-...` | Pendente — sem ele, entrega é por arquivo |

---

## Arquivos do MAS relacionados

```
src/yedda_mas/workflows/f31_content_marketing.py   # workflow principal
src/yedda_mas/integrations/composio_adapters.py    # make_social_calendar_fn, make_competitor_scan_fn
scripts/run_f31_content_marketing.py               # runner CLI (--fake para smoke test)
scripts/check_marketing_sync.py                    # diagnóstico de sincronização
scripts/ingest_marketing_docs.py                   # ingestão RAG yedda_marketing
data/rag/marketing/                                # cópias dos assets para RAG
```

---

## Quando editar algo neste projeto

| Alteração | Ação necessária no MAS |
|---|---|
| Editar `BRAND-VOICE.md` | Rodar `check_marketing_sync.py --fix` |
| Editar `LINKEDIN-CONTENT-BANK.md` | Rodar `check_marketing_sync.py --fix` |
| Editar `scripts/social_calendar.py` | Nenhuma — MAS importa dinâmicamente via `MARKETING_AGENT_DIR` |
| Editar `scripts/competitor_scanner.py` | Nenhuma — MAS importa dinâmicamente via `MARKETING_AGENT_DIR` |
| Adicionar novo script em `scripts/` | Criar nova factory em `composio_adapters.py` no MAS |
