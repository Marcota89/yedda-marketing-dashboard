# Yedda Marketing — Cadência e Variedade

## O que é
Dashboard LinkedIn da Yedda.ai (`index.html` + `api/*.js` na Vercel) integrado ao
Yedda MAS (`yedda-mas-step1`, FastAPI local + scheduler). Este milestone responde
a duas reclamações do CEO com causa-raiz confirmada no código.

## Reclamações (Roi, 12 ago 2026)
1. "only creating 3 posts instead of 3 per week"
2. "keeps repeating and not much variety — only retail and ai-vision over and over"

## Causas-raiz confirmadas
| # | Causa | Onde |
|---|---|---|
| 1 | Prompt do F31 pede 2 posts + 1 summary; summary filtrado → 2/run | `f31_content_marketing.py:228` |
| 2 | Job semanal monta F31Config à mão (2 campos) — bug 6 sobrevivente | `run_scheduler.py:1344` |
| 3 | Tópico fixo "restaurant technology operations" | `run_scheduler.py:1353` |
| 4 | 5 queries de notícia fixas, 3 com retail/CV | `index.html:5827` |
| 5 | Dedupe de artigos em localStorage (por navegador) | `index.html:5857` |

Dado: em 53 posts, a mesma notícia gerou até 5 posts. 2 posts com JSON cru como texto.

## Referência
Relatório completo: https://claude.ai/code/artifact/4ab1b1a0-d6ef-489e-bae6-5327ab05e388

## Restrições
- Nenhum termo do vocabulário proibido (CLAUDE.md)
- Proof points canônicos: 54%, 55s, ROI 180-400%
- MAS está em milestone v1.5 (segurança) noutra sessão — não tocar `.planning/` deles
- Roi usa a página sem MAS local — tudo deve degradar e/ou passar pelo espelho na nuvem
- Verificar cada fase contra a fila real, não contra "passou o teste"
