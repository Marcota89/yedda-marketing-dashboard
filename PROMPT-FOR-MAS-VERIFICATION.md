# Prompt para o projeto Yedda MAS — verificação e pendências

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`), o sistema multi-agente.
Do outro lado existe a **Yedda Marketing** (`Marketing agent`), a plataforma de
geração de conteúdo, publicada em `yedda-marketing-dashboard.vercel.app`.

Em 2026-08-10 vocês entregaram 9 mudanças para atender os pedidos do CEO. A
plataforma **verificou cada uma** e depois construiu o lado dela em cima. Este
prompt tem três partes: **(A) o que foi verificado e o que quebrou**, **(B) o que
a plataforma implementou e que agora depende de vocês**, e **(C) pendências que
só o MAS pode resolver**.

Não confie neste documento como verdade — ele foi escrito do outro lado.
**Verifique cada afirmação contra o código e contra a resposta real dos
endpoints antes de agir.** Foi exatamente assim que o bug abaixo apareceu.

---

## PARTE A — O que a verificação encontrou

### 🔴 Um bug bloqueante (já corrigido, commit `def1950` neste repo)

**Os 4 endpoints de marketing retornavam 404.** Não era ambiente: reproduzido
também in-process com `TestClient`.

**Causa:** `scripts/mas_dashboard.py` define `_api_version_rewrite` como o
middleware **mais externo**. Ele reescrevia `/api/v1/X` → `/api/X` **antes do
roteamento**. O `marketing_router` registra em `/api/v1/marketing/*`, então toda
requisição caía em `/api/marketing/*` — caminho que nenhum router serve. As rotas
apareciam no OpenAPI e eram **inalcançáveis por qualquer URL**.

**O escopo era maior que o marketing:** o `onboarding_router` (Fase 6) estava
quebrado do mesmo jeito. Por isso a correção foi no middleware, não no prefixo de
cada router.

**Correção aplicada:** o rewrite só remove a versão quando o caminho **não** é
servido por uma rota nativamente versionada. Os caminhos são coletados após todos
os `include_router` e comparados com suporte a parâmetros. O comportamento
não-quebrante continua: `/api/v1/version` ainda cai no handler `/api/version`.

**Por que os 3227 testes não pegaram:** eles montam routers em um `FastAPI()`
novo e nunca exercitam a pilha de middlewares — componente correto, composição
quebrada. Foi adicionado `tests/unit/test_api_version_rewrite.py` (9 testes) que
importa o **app real**, incluindo um teste genérico que falha se *qualquer* rota
aparecer no schema estando inalcançável. Validado reintroduzindo o bug: 6 dos 9
falham. Suíte: **3236 passando**.

**➡️ Verifiquem:** rodem a suíte completa e confirmem que continua 3236. Se
discordarem da abordagem (middleware vs. prefixo por router), a decisão é de
vocês — mas mantenham cobertura que exercite o app completo.

### ✅ As outras 8 afirmações se confirmaram

| Afirmação | Verificado |
|---|---|
| 54 chunks na coleção `marketing` | ✅ BRAND-VOICE 32 + CONTENT-BANK 22 = 54 |
| RBAC para 5 agentes | ✅ Head of Marketing, Content & SEO, Content Marketing, Brand Design, LinkedIn Digital |
| `runtime.f31_graph` existe | ✅ linha 611 |
| F31 produz saída não-vazia | ✅ rodado: **3 posts, 2.431 bytes** (antes: 40 bytes) |
| 35 termos no vocabulário | ✅ exatamente 35 |
| `/revision` rejeita curto com 422 | ✅ intencional, confirmado |
| Similaridade Jaccard | ✅ 0.0952 num par de teste |
| Voz de marca aplicada na saída | ✅ zero termos proibidos, proof points corretos |

### ⚠️ Uma correção ao que vocês reportaram

**A divergência de vocabulário é bidirecional**, não "faltam termos na
plataforma":

- **Só o MAS bloqueia (34):** as variantes de real-time em 3 idiomas **e** um
  bloco de risco jurídico — `guarantee`, `ensures`, `certifies compliance`,
  `prevent`, `95% accuracy`, `all events are detected`, `nothing will be missed`,
  `surveillance`, `monitor employees`, `track workers`, `the system decides`.
- **Só a plataforma bloqueia (12):** `revolutionary`, `game-changing`,
  `leverage`, `AI-powered`, `disruptive`, `cutting-edge`, `best-in-class`,
  `seamless`, `robust`, `artificial intelligence`, `synergy`, `utilize`.

Nenhuma lista contém a outra. A plataforma implementou a **união**, não a
substituição.

**➡️ Decisão de vocês:** o endpoint `/forbidden-vocabulary` deveria passar a
servir a união (~47 termos), virando fonte única de verdade? Hoje o F31 aplica só
os 35 — ou seja, **o F31 pode gerar "revolutionary" ou "seamless" sem bloqueio**.

---

## PARTE B — O que a plataforma construiu (e o que isso exige de vocês)

Tudo abaixo está **em produção** e verificado com 21 checks E2E.

| # | O que foi feito | Depende de vocês |
|---|---|---|
| B1 | Campo "cole a versão publicada" no fluxo de aprovação → `POST /revision`. Mostra ao Roi quanto do rascunho sobreviveu. Salva local quando o MAS está offline; trata 422 como esperado. | — |
| B3 | **Corpus semeado: 18 pares** da planilha do Roi (14 `linkedin_post` + 4 `linkedin_post_personal`), similaridade média **0.20** | Confirmar que o F31 lê os dois canais |
| B2 | O bloco de `/examples` alimenta os 3 geradores, **canais separados** | Ver abaixo ⚠️ |
| B4 | Vocabulário = união (35 do MAS + 12 nossos), com cache e fallback | Ver decisão acima |
| B5 | Seletor de setor espelhando `config/verticals/` **exatamente** | Ver abaixo ⚠️ |

**⚠️ B2 — canal pessoal:** a plataforma pede
`/examples?channel=linkedin_post_personal` para o gerador de posts do Roi,
porque a anotação dele na planilha é explícita: *"In Roi's posts should be **less
Yedda and more personal** — what do we stand for, people in the company,
anecdotes"*. **Confirmem que o F31 também distingue os dois canais** — se ele
injetar exemplos de post de empresa num post pessoal, a voz volta a divergir.

**⚠️ B5 — verticais sem endpoint:** as 6 verticais só existem como arquivos
(`config/verticals/*/culture_overlay_extension.md`). A plataforma **espelhou as
chaves manualmente** (`food_retail`, `fashion`, `qsr`, `logistics`,
`manufacturing`, `safety`). Isso é frágil: se vocês adicionarem ou renomearem uma
vertical, as taxonomias divergem em silêncio — o mesmo risco das duas listas de
vocabulário.

**➡️ Pedido:** exponham as verticais num endpoint
(`GET /api/v1/marketing/verticals`) devolvendo chave, rótulo e o resumo do
contexto. A plataforma passa a consumir e o espelhamento manual morre.

---

## PARTE C — Pendências que só o MAS resolve

### C1 — Coleção `product` (pedido #11 do CEO)

O CEO pediu: *"Upload our POC and Product presentations to the AI so it can learn
our product better."* Hoje a IA conhece proof points soltos (54%, 55s, ROI
180-400%) mas nada de módulos, arquitetura, casos por setor ou objeções.

**O que a plataforma já fez:** criou `scripts/ingest_product_docs.py`, que
converte PDF/PPTX/MD em markdown estruturado por heading e **rastreia
confidencialidade antes de escrever** (nomes de cliente, tabelas de preço,
linguagem de contrato assinado, CPF, credenciais). Testado: um deck com
"Carrefour" + tabela de preços foi **recusado**; o limpo passou. A saída vai para
`data/rag/product/`.

**Descoberta importante:** `ingest_directory` faz glob de `*.md` apenas — PDF e
PPTX **não têm caminho de entrada no MAS**. Por isso a conversão acontece do lado
da plataforma.

**➡️ Falta de vocês (os mesmos 2 passos que a coleção `marketing` precisou):**
1. Mapear `("product", "product")` em `RAG_COLLECTIONS` no
   `scripts/ingest_rag_docs.py`.
2. Conceder `product` em `rag_collections` para os agentes de marketing no
   `config/org_registry.yaml`.
3. Confirmar que o `ingest_gate` aceita a coleção (hoje `dpo_approved: true`).

Depois disso: `python scripts/ingest_rag_docs.py` e os decks entram no RAG.

**Ainda bloqueado:** os arquivos em si. O Roi não os enviou. O mecanismo está
pronto e vazio — igual ao corpus de pares antes da planilha chegar.

### C2 — Verificar o que vocês afirmaram sobre o F31

Duas afirmações que **não consegui verificar deste lado** e que valem checar aí:

1. **`competitor_insights` ligado ao prompt** (item 7 da lista de vocês) — confirmem
   com um run real que o campo chega ao prompt e não é dado morto de novo.
2. **Modo `short_form` para vídeo** (item 9) — rodem e confirmem que o roteiro sai
   com hook de 3s, 3 pontos, CTA, legendas e notas de b-roll. A plataforma **não**
   vai prometer auto-publicação: nenhum Phantom publica vídeo nativo.

### C3 — Conflito aberto: posição do logo

Vocês deixaram registrado como conflito, e está correto:

- **MAS** (`config/brand_assets.yaml`): *"Always **top-left**"*
- **Plataforma**: compõe em **base-esquerda**, nos 3 caminhos de imagem

**Verifiquei duas hipóteses e ambas estão descartadas:**
- Não é caminho de imagem escapando do composite — Gemini, FLUX e o cartão de
  fallback desenham na **mesma** posição.
- Não é divergência de cor — o teal `#4BADB8` é idêntico nos dois lados.

A anotação do Roi (*"the logo is wrong (bottom left)"*) **admite as duas
leituras**, então nenhum dos lados deve decidir sozinho. Está documentado em
`DECISION-LOGO-POSITION.md` na plataforma, aguardando 15 minutos dele com
imagens reais. **Não mudem `brand_assets.yaml` até essa decisão.**

---

## Como responder

Ao terminar, devolvam um resumo curto com:

1. **Suíte:** o número final de testes passando.
2. **Endpoint de verticais:** vão expor? Se sim, o contrato.
3. **Vocabulário:** o `/forbidden-vocabulary` passa a servir a união?
4. **Canal pessoal:** o F31 distingue `linkedin_post` de `linkedin_post_personal`?
5. **Coleção `product`:** mapeada e concedida?
6. **C2:** o que os runs reais de `competitor_insights` e `short_form` mostraram.

E o mais importante: **se alguma afirmação deste documento não se sustentar
contra o código de vocês, digam.** Foi checando afirmação por afirmação que o bug
de roteamento apareceu — a mesma disciplina na direção contrária tende a
encontrar o que passou despercebido aqui.
