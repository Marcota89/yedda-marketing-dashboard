# Relatório — Política de Aprovação por Contato para Comentários do Roi

> **Data:** 10 jul 2026 · **Autor:** Claude (Marketing Agent) · **Status:** proposta para decisão
> **Pedido:** Roi quer definir, contato a contato, quem exige análise e autorização dele
> antes de um comentário gerado ser publicado — e quem pode fluir direto
> (gerar → postar) sem passar por ele.

---

## 1. Resumo executivo

A proposta transforma o fluxo atual de comentários (100% manual: gerar → copiar →
colar no LinkedIn) em um **pipeline com política por contato**:

| Política do contato | O que acontece ao gerar |
|---|---|
| 🔒 **Review** (exige Roi) | Comentário vira rascunho em uma **Fila de Aprovação**. Roi lê, edita se quiser, aprova ou rejeita. Só depois é postado. |
| ⚡ **Auto** (não faz diferença) | Comentário é gerado e vai direto para a **fila de postagem** — sem parada no Roi. |

A postagem em si tem duas gerações: **Fase 1** mantém a publicação manual (copiar/colar,
zero risco novo) e **Fase 2** ativa a publicação automática via **PhantomBuster LinkedIn
Auto Commenter** — que o plano Start já cobre e se integra à planilha exatamente no
formato "URL do post + comentário".

**Recomendação central:** implementar em 3 fases (aprovação → auto-post → zero-touch),
com 4 guardrails inegociáveis descritos na seção 5 — em especial o **classificador de
posts sensíveis** (nenhum comentário automático em post sobre demissão, doença, luto ou
política, mesmo de contato ⚡ Auto) e um **PIN de aprovação**, porque o dashboard hoje
não tem login.

---

## 2. Estado atual (baseline)

- **Radar (People's Posts):** PhantomBuster monitora 73+ contatos diariamente às 08:00;
  posts chegam via webhook no Supabase (`linkedin_contacts_posts`) com tier automático
  (★ Priority / Client / Network / Yedda) via `contact_tiers` + trigger.
- **Botão por post (já existe):** "💬 Generate Roi's Comment" → troca para a aba Create,
  gera o comentário na voz do Roi (Gemini + persona MAS + few-shots + anti-AI-tells) e
  leva o usuário até o resultado.
- **Publicação:** manual — copiar comentário → abrir LinkedIn → colar → "Mark commented"
  (grava `roi_comment`, `commented=true`, alimenta `lead_interactions` e o sinal de
  warm-lead → Hermes).
- **Limitações relevantes:**
  - Não existe conceito de aprovação: quem clica gera e posta o que quiser.
  - O dashboard **não tem autenticação** — qualquer pessoa com a URL usa tudo.
  - A chave Gemini vive no `localStorage` do browser (não há geração server-side).
  - A fila de aprovação do MAS (F31, posts semanais) é localhost-only — padrão parecido,
    mas não reutilizável diretamente; este projeto pode virar o modelo para migrá-la.

---

## 3. Modelo proposto — política por contato

### 3.1 O conceito

A política mora no **contato** (não no post): é uma decisão de relacionamento
("com o CEO da Central eu reviso tudo; com contatos de network tanto faz").
Cada card do Radar mostra a política do autor e o botão de geração muda de
comportamento conforme ela.

### 3.2 Modelo de dados (Supabase)

```sql
-- 1. Política por contato
alter table contact_tiers
  add column approval_policy text not null default 'review'
  check (approval_policy in ('review','auto'));

-- 2. Workflow do comentário no próprio post (1 post = 1 comentário)
alter table linkedin_contacts_posts
  add column comment_status text not null default 'none'
  check (comment_status in
    ('none',              -- sem comentário ainda
     'pending_approval',  -- gerado, aguardando Roi
     'approved',          -- aprovado (ou contato auto) — pronto para postar
     'rejected',          -- Roi rejeitou (fica registrado o motivo)
     'posted')),          -- publicado no LinkedIn
  add column approved_at timestamptz,
  add column approved_by text,          -- 'roi' | 'marco' (auditoria)
  add column rejection_note text,
  add column posted_at timestamptz,
  add column comment_source text;       -- 'manual' | 'auto-policy'
```

**Defaults recomendados por tier** (Roi ajusta individualmente depois):

| Tier | Default sugerido | Racional |
|---|---|---|
| ★ 1-priority | 🔒 review | Relações de maior valor — erro custa caro |
| 2-client | 🔒 review | Clientes ativos — tom importa |
| 3-network | ⚡ auto | Volume, menor risco relacional |
| internal (Yedda) | ⚡ auto | Time interno — engajamento só ajuda |

### 3.3 Fluxos

```
Post chega no Radar
        │
   [política do autor?]
        │
   ┌────┴─────────────────┐
   🔒 review              ⚡ auto
   │                      │
   Gerar (voz Roi)        Gerar (voz Roi)
   │                      │
   status:                [classificador sensível?]──sim──► vira 🔒 review
   pending_approval       │não
   │                      status: approved
   ▼                      │
   FILA DE APROVAÇÃO      ▼
   (Roi: lê/edita/        FILA DE POSTAGEM
    aprova/rejeita)       │
   │ aprovado             ├─ Fase 1: card "pronto — copiar e postar"
   ▼                      └─ Fase 2: PhantomBuster Auto Commenter
   FILA DE POSTAGEM              (máx. 10/dia, horário comercial)
                                 │
                          status: posted → commented=true →
                          lead_interactions → sinal warm-lead → Hermes
```

### 3.4 UI proposta

**Card do Radar** — chip de política ao lado do tier + botão adaptativo:

```
┌─────────────────────────────────────────────────────────┐
│ ★ Priority · 🔒 Review   Uday Shankar Sinha             │
│ 2 Jul 2026 · 👍 333 · 💬 273 · View post ↗              │
│ "After 32 years in the CPG world..."                    │
│ [🔒 Gerar p/ aprovação do Roi]  [✓ Mark commented]      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Network · ⚡ Auto        Amit Bendor                     │
│ [⚡ Gerar e enfileirar]  [✓ Mark commented]              │
└─────────────────────────────────────────────────────────┘
```

- O **chip 🔒/⚡ é clicável** (com PIN — seção 5.2) e alterna a política do contato.
  Esse é o "botão do Roi": um clique por contato, vale para todos os posts futuros dele.
- Botão de política em massa no topo do Radar: "Definir política por tier…" para o
  setup inicial.

**Nova seção "Approvals"** (aba Queue, ao lado da fila de posts da empresa —
badge com contagem de pendências):

```
┌─ APPROVALS — Roi's comments ── 3 pending ───────────────┐
│ ★ Uday Sinha — post de 2 Jul (marco de carreira)        │
│ Post: "After 32 years in the CPG world..."       [ver ↗]│
│ Comentário proposto:                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Congrats, Uday — 32 years and still building. The  │ │  ← editável
│ │ operator's-chair angle is exactly right...          │ │
│ └─────────────────────────────────────────────────────┘ │
│ [✅ Aprovar] [✏️ Salvar edição e aprovar] [🔁 Regenerar] │
│ [❌ Rejeitar…]                                           │
└──────────────────────────────────────────────────────────┘
```

### 3.5 Mudanças de API (`api/linkedin-posts.js` + 1 endpoint novo)

| Ação | Método | Descrição |
|---|---|---|
| Alternar política | `PATCH /api/contact-policy` (novo) | `{profile_url, approval_policy, pin}` — valida PIN server-side |
| Salvar comentário gerado | `PATCH /api/linkedin-posts` (estende) | `{post_url, roi_comment, comment_status}` |
| Aprovar/rejeitar | `POST /api/linkedin-posts {action:'approve'\|'reject', pin}` | grava `approved_at/by` ou `rejection_note` |
| Fila p/ Auto Commenter | `GET /api/comment-feed?format=csv&secret=…` (novo) | Devolve `postUrl,comment` dos `approved` — o PhantomBuster lê direto |

O endpoint `comment-feed` em CSV elimina a necessidade de escrever numa planilha
Google: o Auto Commenter aceita URL de planilha **ou** CSV público — apontamos o
Phantom para a nossa própria API (com `?secret=`), e o pipeline fica 100% nosso.

---

## 4. A perna de postagem — opções avaliadas

| Opção | Viável? | Análise |
|---|---|---|
| **A. Manual (status quo)** | ✅ | Zero risco novo. Continua sendo o fallback permanente. |
| **B. PhantomBuster LinkedIn Auto Commenter** | ✅ recomendada p/ Fase 2 | Já coberto pelo plano Start; consome a mesma sessão LinkedIn do Roi já conectada; aceita fonte "URL + comentário" 1:1; gerenciável pelo nosso config-as-code (`pb-sync.mjs`). Limite seguro: **10 comentários/launch, 1 launch/dia**. |
| **C. API oficial do LinkedIn** | ❌ | A API de membros não permite comentar em posts de terceiros (restrita a parceiros Marketing/Community — inviável no nosso porte). |
| **D. Taplio/Publer etc.** | ❌ p/ este caso | Agendam posts próprios; não comentam em posts alheios. |

**Custo de execução adicional (Fase 2):** Auto Commenter ~10 posts/launch ≈ minutos/dia
→ ~1–2 h/mês extras. Somado às ~13–19 h/mês do Activity Extractor, encosta no teto de
20 h do plano Start. **Mitigação:** reduzir Activity Extractor para 5x/semana (seg–sex,
economiza ~28%) ou considerar upgrade Grow ($159, 80 h) se o auto-post se provar valioso.

---

## 5. Guardrails inegociáveis

### 5.1 Classificador de posts sensíveis (o mais importante)
Contato ⚡ Auto **não** significa incondicional. Antes de enfileirar auto-post, um
classificador (mesmo prompt Gemini, 1 chamada barata) rotula o post:
`milestone | opinion | company_news | personal_story | SENSITIVE`
(demissões, doença, luto, desastres, política/guerra, polêmica). `SENSITIVE` →
**rebaixa para 🔒 review** com aviso. Um comentário automático errado num post de
luto custa mais que todos os ganhos de eficiência do projeto.

### 5.2 Controle de acesso — PIN de aprovação
O dashboard é público (sem login). Aprovar/alternar política **assina como Roi**, então:
`ROI_APPROVAL_PIN` como env no Vercel; endpoints de aprovação/política exigem o PIN;
o browser guarda em `sessionStorage` após o primeiro uso. Simples, suficiente, e
nada de auto-post pode ser acionado por um visitante anônimo.

### 5.3 Caps e kill switch
- Máx. **10 auto-comentários/dia** (recomendação PhantomBuster para engajamento).
- Janela de postagem: horário comercial da APAC (fuso dos contatos), não madrugada.
- **Kill switch:** flag `AUTO_POST_ENABLED` no Vercel + botão "⏸ Pausar auto-post"
  na seção Approvals. Um clique congela a perna B inteira (o Phantom recebe feed vazio).
- Nunca incluir links nos comentários (padrão de spam para o LinkedIn).

### 5.4 Auditoria
Toda aprovação grava `approved_by` + `approved_at`; toda postagem automática grava
`comment_source='auto-policy'` + `posted_at`. O `lead_interactions` já existente
passa a receber também os auto-posts — o funil Marketing→Sales (Hermes) enxerga tudo.

---

## 6. Fases de implementação

| Fase | Escopo | Esforço | Risco |
|---|---|---|---|
| **1 — Aprovação** | Coluna `approval_policy` + chips 🔒/⚡ no Radar + botão adaptativo + seção Approvals + PIN + statuses no DB. Postagem continua manual. | ~1 sessão | Baixo (nada novo sai da plataforma) |
| **2 — Auto-post** | Endpoint `comment-feed` CSV + Phantom Auto Commenter (config-as-code, 10/dia) + kill switch + confirmação de postagem (webhook do Phantom → `posted`). | ~1 sessão | Médio (conta LinkedIn do Roi — mitigado pelos caps) |
| **3 — Zero-touch** | Geração automática na chegada do post (webhook → Gemini server-side com `GEMINI_API_KEY` no Vercel) + classificador sensível na entrada + aprovação via Slack (aproveita o SLACK_BOT_TOKEN já planejado p/ MAS) + métricas (aprovação %, tempo até post, respostas). | ~1–2 sessões | Médio |

Fase 1 já entrega o pedido do Roi na íntegra (o botão de política + a fila de
autorização). As fases 2–3 removem progressivamente o trabalho manual restante.

---

## 7. Decisões necessárias (checklist para o Roi)

- [ ] Defaults de política por tier — aceita a tabela da seção 3.2?
- [ ] Cap diário de auto-comentários (sugestão: 10/dia)
- [ ] Classificador sensível sempre ativo, sem exceção? (recomendação: sim)
- [ ] Quem além do Roi pode aprovar? (Marco? — define os valores de `approved_by`)
- [ ] Valor do PIN de aprovação (definir no Vercel, não em chat/e-mail)
- [ ] Fase 2 (auto-post via PhantomBuster na conta pessoal do Roi): autorizada?
- [ ] Se Fase 2 sim: manter plano Start com Extractor 5x/semana, ou upgrade Grow?

---

## 8. Apêndice — notas técnicas

- **Idempotência:** `comment_status` transita apenas para frente
  (`none → pending_approval → approved → posted`); `rejected` pode voltar a
  `pending_approval` via "Regenerar". Re-scrapes do PhantomBuster nunca tocam nessas
  colunas (merge-duplicates já preserva `roi_comment` hoje — mesmo mecanismo).
- **Geração server-side (Fase 3):** requer `GEMINI_API_KEY` como env no Vercel — hoje a
  chave é client-side (localStorage). O prompt/persona é o mesmo (`/api/roi-voice`).
- **Auto Commenter — fonte de dados:** apontar para
  `https://yedda-marketing-dashboard.vercel.app/api/comment-feed?secret=…&format=csv`.
  Colunas: `postUrl,comment` (formato nativo do Phantom, match 1:1, sem "random").
- **Config-as-code:** o Auto Commenter entra no `desired-config.json` como segundo
  agent gerenciado pelo `pb-sync.mjs` (o script já descobre agents por nome).
- **Reuso futuro:** a seção Approvals é o mesmo padrão da fila localhost do MAS (F31) —
  migrar a fila do MAS para este mecanismo Supabase unifica as aprovações do Roi
  num lugar só (e destrava aprovação mobile via Slack na Fase 3).

## Fontes

- [PhantomBuster — LinkedIn Auto Commenter (doc oficial)](https://support.phantombuster.com/hc/en-us/articles/26971012177042-How-to-use-the-LinkedIn-Auto-Commenter)
- [PhantomBuster — catálogo do Auto Commenter](https://phantombuster.com/automations/linkedin/16226/linkedin-auto-commenter)
- [PhantomBuster — use case: gerar comentários automaticamente](https://support.phantombuster.com/hc/en-us/community/posts/27658722540562--Use-case-Generate-LinkedIn-comments-automatically-with-PhantomBuster)
