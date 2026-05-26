# Marketing Agent — Contexto para Claude

> Este arquivo é carregado automaticamente em toda sessão Claude Code aberta neste diretório.

## O que é este projeto

**Marketing Agent** = suite de skills Claude Code para geração de conteúdo LinkedIn da Yedda.ai.
Skills, scripts utilitários e assets de brand voice.

## Integração com Yedda MAS

Este projeto está **sincronizado com o Yedda MAS** (Multi-Agent System).
O MAS consome os assets deste projeto para automação de marketing semanal.

Detalhes completos da integração: [YEDDA_MAS_INTEGRATION.md](YEDDA_MAS_INTEGRATION.md)

**Projeto MAS:** `C:\Users\Admin\OneDrive\Área de Trabalho\yedda-mas-step1`

## Scripts disponíveis

| Script | Função |
|---|---|
| `scripts/social_calendar.py` | Gerador de calendário editorial — `generate_calendar(topic, platforms, days)` |
| `scripts/competitor_scanner.py` | Scanner de competidores — `main()` recebe URLs como args CLI |
| `scripts/analyze_page.py` | Análise de página web |
| `scripts/generate_pdf_report.py` | Geração de relatório PDF |

## Assets RAG

| Arquivo | Uso |
|---|---|
| `BRAND-VOICE.md` | Guia de voz da marca Yedda — ingerido no MAS como RAG |
| `LINKEDIN-CONTENT-BANK.md` | Banco de posts LinkedIn — exemplos few-shot para geração |

## Regra de sincronização automática — OBRIGATÓRIO

**Sempre que o usuário pedir:**
- Gerar novas notícias / novos posts
- Atualizar o calendário de conteúdo
- Editar `BRAND-VOICE.md` ou `LINKEDIN-CONTENT-BANK.md`
- Adicionar posts ao `LINKEDIN-CONTENT-BANK.md`

**Executar automaticamente após a tarefa:**

```bash
python -X utf8 "C:\Users\Admin\OneDrive\Área de Trabalho\yedda-mas-step1\scripts\check_marketing_sync.py" --fix
```

Saída esperada: `SINCRONIZADO -- 0 problema(s) encontrado(s)`
Se houver erro, reportar ao usuário antes de continuar.

## Proof points canônicos Yedda (usar em todo conteúdo)

- **54%** de melhoria em accuracy de relatórios operacionais
- **55 segundos** para geração automatizada de relatórios
- **ROI 180-400%** em 12 meses de deployment

## Vocabulário proibido (nunca usar)

`revolutionary`, `game-changing`, `leverage`, `AI-powered` (sem outcome), `real-time`, `disruptive`, `cutting-edge`, `best-in-class`, `seamless`, `robust`
