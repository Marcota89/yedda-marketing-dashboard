# Verificação da integração MAS ↔ Plataforma (Parte A)

> **Data:** 10 ago 2026 · **Escopo:** validar as 9 mudanças do MAS (2026-08-10) antes de
> construir o lado da plataforma. Nada foi assumido como verdade — cada afirmação foi
> testada contra o código e contra a resposta real dos endpoints.

## Veredito: **8 de 9 afirmações confirmadas · 1 bug bloqueante encontrado**

As mudanças fazem o que dizem. Mas existe **um defeito de roteamento no MAS** que torna
os 4 endpoints inalcançáveis por HTTP — e é justamente a superfície sobre a qual a
plataforma deveria construir.

---

## ✅ A1 — BUG CORRIGIDO (MAS commit `def1950`, 10 ago 2026)

> O bug abaixo foi **corrigido e verificado por HTTP real**. Mantido documentado
> porque a causa e a lição valem para os dois lados.
>
> **Estado atual — servidor novo, `pycache` limpo:**
> ```
> GET  /api/v1/marketing/stats                  -> 200
> GET  /api/v1/marketing/forbidden-vocabulary   -> 200  (35 termos)
> GET  /api/v1/marketing/examples               -> 200
> POST /api/v1/marketing/revision (curto)       -> 422  (intencional)
> GET  /api/v1/version (rewrite legado)         -> 200  (sem regressão)
> ```
> Ciclo funcional confirmado: `POST /revision` → `{"stored":true,"similarity":0.093,
> "corpus_size":2}` → `GET /stats` → `{"count":2,"mean_similarity":0.0941}`.
> O corpus foi **limpo dos pares de teste** e está em 0, pronto para os 14 reais.
>
> **Escopo real do defeito:** não era só o marketing. O `onboarding_router` (Fase 6)
> estava quebrado do mesmo jeito — 404 em todas as rotas. Por isso a correção foi feita
> no **middleware** (causa única) e não no prefixo de cada router.
>
> **Correção aplicada** (`scripts/mas_dashboard.py`): o rewrite só remove a versão
> quando o caminho **não** é servido por uma rota nativamente versionada. Os caminhos
> registrados são coletados após todos os `include_router` e comparados com suporte a
> parâmetros (`/api/v1/onboarding/{run_id}` resolve). O comportamento não-quebrante
> permanece: `/api/v1/version` continua caindo no handler `/api/version`.
>
> **Cobertura contra regressão:** novo `tests/unit/test_api_version_rewrite.py` (9 testes)
> que importa o **app real** com a pilha completa de middlewares — inclusive um teste
> genérico que falha se *qualquer* rota aparecer no schema sendo inalcançável.
> Validado por reintrodução do bug: **6 dos 9 falham**; com a correção, todos passam.
> Suíte completa: **3236 passando** (3227 + 9), zero regressões.

---

## 🔴 A1 (registro do diagnóstico original)

### Sintoma

| Rota | Esperado | Real |
|---|---|---|
| `GET /api/v1/marketing/stats` | 200 | **404** |
| `GET /api/v1/marketing/forbidden-vocabulary` | 200 | **404** |
| `GET /api/v1/marketing/examples` | 200 | **404** |
| `POST /api/v1/marketing/revision` | 200/422 | **404** |

Não é ambiente: reproduzido também in-process via `TestClient`.

### Causa raiz (isolada e provada)

`scripts/mas_dashboard.py:136` define o middleware `_api_version_rewrite`, o **mais
externo** da pilha. Ele reescreve o caminho **antes do roteamento**:

```python
if path.startswith("/api/v1/"):
    request.scope["path"] = "/api/" + path[len("/api/v1/"):]
```

O `marketing_router` registra suas rotas em `/api/v1/marketing/*` (prefixo próprio,
linha 43). Resultado: uma chamada a `/api/v1/marketing/stats` é reescrita para
`/api/marketing/stats` — caminho que **não existe** em nenhum router. As rotas aparecem
no OpenAPI mas são inalcançáveis por **qualquer** URL.

O middleware pressupõe que todo router se registre em `/api/*` (sem versão) e ganhe o
`/v1` de graça. Os routers anteriores seguem essa convenção; o `marketing_router` não.

### Prova

Removendo apenas esse middleware, no mesmo processo:

```
middlewares: 5 -> 4 (rewrite removido)
  /api/v1/marketing/stats                 -> 200
  /api/v1/marketing/forbidden-vocabulary  -> 200
```

### Correção sugerida (lado MAS — 1 linha)

Alinhar o router à convenção existente:

```python
# scripts/marketing_router.py:43
router = APIRouter(prefix="/api/marketing", tags=["marketing"])
```

O middleware então serve **as duas** superfícies: `/api/marketing/*` e
`/api/v1/marketing/*` — sem duplicação, exatamente como o comentário do middleware
descreve. Alternativa (pior): excluir `marketing` do rewrite, criando exceção à regra.

> **Nota:** os 3227 testes passam porque exercitam o router **isoladamente**
> (via `TestClient(router)` ou chamada direta), nunca através do app completo com a
> pilha de middlewares. É o mesmo padrão de falha silenciosa do cron vazio e do webhook
> apagado: **o componente está correto, a composição não** — e só um teste de integração
> ponta a ponta pegaria.

---

## ✅ A1b — Os endpoints, contornado o bug, funcionam como documentado

Testados in-process com o rewrite desativado:

| Verificação | Resultado |
|---|---|
| `GET /stats` | `{"count":0,"mean_similarity":null,"channels":{}}` — corpus vazio, como avisado |
| `GET /examples` | 200, bloco few-shot bem formado |
| `POST /revision` (curto) | **422** — comportamento intencional confirmado |
| `POST /revision` (válido) | `{"stored":true,"similarity":0.0952,"verdict_reconciled":false,"corpus_size":1}` |

A similaridade Jaccard funciona: 0.0952 no par de teste — na mesma faixa dos 5–15%
medidos na planilha do Roi.

---

## ✅ A2 — Vocabulário: 35 termos confirmados (e a divergência é maior que o previsto)

O endpoint retorna exatamente **35 termos**, começando por `real-time`, `real time`,
`realtime`, `tempo real`… conforme documentado.

**A divergência com a plataforma é bidirecional** — e mais grave do que "faltam termos":

| Fonte | Termos |
|---|---|
| MAS canônico | 35 |
| Plataforma (`_FORBIDDEN_FALLBACK`) | 13 |
| Plataforma (`brand-prompts.json`) | 13 (mesma lista) |

**Só o MAS bloqueia (34 termos)** — e a natureza deles importa: além das variantes de
"real-time" em 3 idiomas, há um bloco inteiro de **risco jurídico e de conformidade**
que a plataforma ignora hoje:

`guarantee` · `guaranteed` · `guarantees compliance` · `ensure` · `ensures` ·
`certifies compliance` · `prevent` · `prevents` · `95% accuracy` ·
`all events are detected` · `nothing will be missed` · `surveillance` ·
`monitor employees` · `track workers` · `monitor 24/7` · `watch continuously` ·
`the system decides` · `the system enforces` · `enforcement` · `continuous monitoring`

> Estes não são preferências de estilo. São promessas que a Yedda não pode fazer
> (garantia de detecção, conformidade certificada) e vocabulário de vigilância que
> contradiz o posicionamento de *intelligence augmentation*. **A plataforma está
> publicando sem essa proteção.**

**Só a plataforma bloqueia (12 termos)** — o léxico anti-marketing genérico:
`revolutionary` · `game-changing` · `leverage` · `AI-powered` · `disruptive` ·
`cutting-edge` · `best-in-class` · `seamless` · `robust` · `artificial intelligence` ·
`synergy` · `utilize`

**Conclusão:** nenhuma das duas listas é superconjunto da outra. A unificação (B4) deve
ser a **união das duas** (≈47 termos), não a substituição de uma pela outra — senão
perdemos as 12 regras de estilo que já funcionam.

---

## ✅ A3 — Coleção `marketing` indexada: 54 chunks

```
INFO Ingerindo coleção 'marketing' de: .../data/rag/marketing
INFO ingest_document: BRAND-VOICE.md — 32 chunks (classificação base: public)
INFO ingest_document: LINKEDIN-CONTENT-BANK.md — 22 chunks (classificação base: public)
INFO ingest_directory: ... — total 54 chunks
```

**32 + 22 = 54.** Confere exatamente com o declarado.

**RBAC (A3b):** 5 agentes declaram `marketing` em `rag_collections` — Head of Marketing,
Content & SEO, Content Marketing, Brand Design e LinkedIn Digital. Confere.

---

## ✅ A4 — O F31 produz saída real (a verificação decisiva)

```
$ python scripts/run_f31_content_marketing.py --topic "visual AI for logistics operations"
Posts generated: 3
Delivered: True
```

Arquivo `2026-08-10_posts.md` — **2.431 bytes** (contra os 40 bytes dos batches vazios).

**Auditei a saída contra os 35 termos: nenhum termo proibido.** E o conteúdo mostra a voz
de marca aplicada — abertura contrastiva, proof point correto (54%), sem jargão:

> *"Most logistics AI vendors sell you a camera system and call it intelligence. They show
> you a feed. You're supposed to watch it. Yedda works backwards: we surface what matters
> — exceptions, anomalies, operational gaps — without asking you to monitor anything."*

A afirmação de que "o F31 gerava texto sem nunca ter visto o BRAND-VOICE" é consistente
com o que observamos deste lado (o Roi reescrevendo do zero), e a correção é observável
na qualidade da saída.

---

## 🟡 Achado próprio: auditoria dos fallbacks da plataforma

Seguindo o alerta do MAS (o `_heuristic_vsl` com "real-time intelligence"), varri os
templates estáticos da plataforma contra os 35 termos.

**Resultado: nenhum vazamento nos geradores.** As ocorrências de `real-time` no
`index.html` são:

| Onde | Natureza |
|---|---|
| Linhas 5260, 5355, 5876 | **Dentro da própria regra de proibição** ("Never use: … real-time …") — uso legítimo |
| Linhas 2371, 2414, 2418, 2487, 2722 | Conteúdo estático do site (cases, exemplos de calendário) — fora dos geradores |
| Linhas 3724, 3982 | Prompts de imagem de posts pré-existentes — fora do fluxo de geração |

Os fallbacks **ativos** dos geradores (sufixo de imagem, regras de marca inline) estão
limpos. O portão de saída `_enforceBrandVoice` já protege o texto gerado.

> **Mas a lição do MAS se aplica em outro lugar:** o conteúdo estático do site (seções de
> cases) usa "real-time" livremente. Não passa por nenhum portão porque não é gerado.
> Vale uma decisão à parte: ou o site é corrigido, ou aceita-se que a regra vale só para
> conteúdo novo.

---

## Recomendação

1. **Reportar o bug A1 ao MAS** — é 1 linha e destrava tudo. Enquanto não for corrigido,
   a plataforma **não consegue** falar com os endpoints por HTTP.
2. **Construir o lado da plataforma mesmo assim** (B1–B5), com o cliente HTTP apontando
   para `/api/v1/marketing/*` **e** com fallback para `/api/marketing/*` — assim funciona
   antes e depois da correção, seja qual for a escolhida.
3. **B4 deve unir as listas** (≈47 termos), não substituir.
