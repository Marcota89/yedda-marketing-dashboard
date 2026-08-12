# Prompt para o Yedda MAS — rodada 9 (CI do PR #10)

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`).

O Marco pediu o PR. **Está aberto: [#10](https://github.com/Marcota89/Yedda-MAS/pull/10)**
— `feat/marketing-mas-integration` → `main`, 14 commits, 58 arquivos,
+3604/−126, sem conflitos.

Peguei o `ad57d63` de vocês (a correção da flake) e empurrei junto — vocês
commitaram no diretório principal enquanto eu trabalhava de um worktree, então
meu primeiro push não o incluía. Está no PR agora.

**O CI está vermelho, e preciso de vocês em uma das causas.**

---

## O que é dívida da main, não nossa

**Ruff (bloqueante): 123 dos 129 erros já existem na `main`.** Confirmei rodando
o lint nos dois lados. Os arquivos que o CI aponta — `test_per_agent_cost.py`,
`test_pricing_service.py`, `test_segment_backfill.py` — nenhum é tocado por este
PR. O CI roda `ruff check .` no repo inteiro, então **qualquer PR fica vermelho**
até isso ser quitado.

Corrigi os 7 que a branch introduziu (imports não usados, ordenação, e um
`zip()` sem `strict=` no `_matches_v1_native` — seguro, a linha acima já garante
os comprimentos iguais). Commit `b533d4b`. **Não toquei nos 123** — não é escopo
deste PR, e misturar tornaria o diff irrevisável.

**Tests: 12 falhas idênticas na `main`.** `test_run_backfill`,
`test_scheduler_csuite_jobs`, `test_run_scheduler_smoke`. Rodei nos dois lados
com o mesmo ambiente: falham igual.

Ou seja: **o CI completo não roda na `main` há tempo.** Os únicos runs verdes lá
são `Scheduler Heartbeat Monitor`. A dívida acumulou sem ninguém ver.

---

## O que é nosso — e onde travei

`tests/unit/test_api_version_rewrite.py` (os 9 testes que escrevi para o bug 1)
falha no CI com **"was rewritten to a dead path"** — o sintoma exato do bug 1,
num código onde o bug 1 está corrigido.

Não era o middleware. Adicionei uma asserção na fixture que **prova** isso:

```
AssertionError: marketing_router was not included in the app — the 404s that
follow would be an import problem, not the middleware regression this file guards
```

**O router não entra no app no CI.** As rotas nunca existiram; o 404 é honesto.
Sem `ModuleNotFoundError` no log — o import não explode, o router simplesmente
não está lá.

Commit `66b02d0` já fez duas coisas: adicionou `sys.modules.pop("marketing_router")`
(o pop só derrubava `mas_dashboard`, e o router é módulo top-level resolvido via
`sys.path` — cópia em cache sobrevivia) e trocou o 404 mudo pela asserção acima.
**Melhorou o diagnóstico e não resolveu a causa.**

### O que eu sei

`scripts/marketing_router.py` é importado como **módulo top-level**:

```python
# mas_dashboard.py:222 — fora de qualquer try
from marketing_router import router as marketing_router
app.include_router(marketing_router)
```

Isso depende de `scripts/` estar no `sys.path`. E o `conftest.py` da raiz insere
**só `src/`**, nunca `scripts/`. Cada teste que precisa do dashboard resolve o
caminho por conta própria — são cinco:

```
tests/integration/test_marketing_channel_loop.py
tests/unit/test_api_version_rewrite.py
tests/unit/test_chat_integration_contract.py
tests/unit/test_dashboard_api.py
tests/unit/test_rate_limiting.py
```

**É a mesma forma da flake dos verticais que vocês acabaram de corrigir**:
módulo resolvido por caminho, cacheado entre testes que discordam do caminho.
Vocês descreveram como *"set-difference contra um diretório que o código sob
teste nunca olhou"*. Aqui é `include_router` contra um módulo que o app nunca
achou.

### Por que estou passando para vocês

**Não reproduzo.** No meu ambiente os 9 passam isolados e na suíte completa. Só
falha no CI (Ubuntu, checkout único, `uv sync --all-extras`).

E tenho um agravante que polui meu diagnóstico: meu diretório principal está em
`main` — onde `src/yedda_mas/memory/content_pairs.py` **não existe**, porque é
arquivo novo desta branch. O venv resolve `yedda_mas` para lá. Então **do meu
lado** o import quebra com `ModuleNotFoundError: yedda_mas.memory.content_pairs`,
que é artefato do meu setup e **não** o que acontece no CI. Passei tempo
perseguindo essa pista errada antes de perceber.

Vocês têm o contexto do `sys.path` deste repo e acabaram de resolver a mesma
classe de problema. **A hipótese que eu investigaria**: `scripts/` no
`conftest.py` da raiz, ou transformar o import do router em relativo/pacote em
vez de top-level. A segunda mata a classe inteira; a primeira só este caso.

---

## Estado do CI

| Check | Estado | De quem |
|---|---|---|
| Secret Scan | **pass** | — |
| Dependency Audit | **pass** | — |
| Ruff | fail | **main** (123 de 129) |
| Tests — 12 falhas de scheduler/backfill | fail | **main** |
| Tests — `test_api_version_rewrite` (5) | fail | **nosso** ← preciso de vocês |
| Tests — `test_marketing_channel_loop` (5) | fail | **nosso**, mesma causa |
| Mypy strict | fail | **main** |

Os dois blocos de teste nossos provavelmente caem juntos:
`test_marketing_channel_loop` também faz `from mas_dashboard import app`.

**Mypy: dívida da main também.** Todos os erros são
`cognitive_router.py:211` (`Argument 3 to "GenerateContentConfig" has
incompatible type`) — arquivo que este PR não toca, linha que esta branch não
mudou. Provavelmente uma atualização do `google-genai` que mudou a assinatura.

**Placar: dos 4 checks vermelhos, 3 são inteiramente da `main`.** O único
bloqueio real deste PR é o router ausente.

---

## O que preciso de vocês

1. **A causa do router ausente no CI** — é o único bloqueio real do PR.
2. **Decidir sobre a dívida da main** (123 erros de Ruff + 12 testes). Ou quita
   num PR separado antes deste, ou o CI de vocês fica vermelho para sempre e
   deixa de significar alguma coisa. **Não é decisão minha** — só sinalizo que
   hoje um check bloqueante bloqueia tudo indiscriminadamente.
3. **Mypy** — se souberem de cabeça se é pré-existente, poupa uma rodada.

Não vou fazer merge. O PR fica aberto até o CI fechar e o Marco decidir.

## Pendências

| Pendência | Com quem |
|---|---|
| `QUEUE_INTAKE_SECRET` (Vercel + host do MAS, mesma string, canal seguro) | **Marco** |
| Créditos: Gemini esgotado, sem visibilidade do saldo Anthropic | **Marco** |
| Merge do PR #10 | **Marco** |
| Dívida de CI da main | **vocês** |
| Decks POC/produto | **Roi** |
| Posição do logo (`brand_assets.yaml` intocado) | **Roi** |
| Threshold BANT | **dono do E11** |
