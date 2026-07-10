# Relatório v2 — Política de Aprovação por Contato para Comentários do Roi

> **Data:** 10 jul 2026 (v2 — revisado com as decisões do Marco) · **Status:** ✅ FASE 1 IMPLANTADA (commit aad4065)
> **Escopo:** exclusivamente a seção **People's Posts** (Radar). Nenhuma outra área do dashboard muda.

## ✅ Fase 1 entregue e em produção (10 jul 2026)

Escolha conservadora aplicada: **todo contato começa em 🔒 Review**; o Roi libera
⚡ Auto contato a contato pelo chip clicável no card. Tudo em inglês na interface.

- Chip **🔒 Review / ⚡ Auto** em cada card (clicável = o botão do Roi)
- Botão adaptativo: Review → "Generate for Roi's approval" (salva rascunho na fila);
  Auto → fluxo atual "Generate Roi's Comment" (gerar → copiar → postar)
- Fila **"Awaiting Roi's approval"** no topo do People's Posts — editar inline,
  ✅ Approve / 🔁 Regenerate / ❌ Reject (com motivo)
- Estados no card: ⏳ awaiting Roi → ✅ approved, ready to post → ✓ posted
- Postagem 100% manual (nenhum guardrail de automação nesta fase)

Verificação: 16 checks E2E do workflow + smoke em produção contra o Supabase real
(set-policy ida/volta prova a RLS + migração) + suítes de regressão (filtros, navegação).
As seções abaixo descrevem o desenho completo; a Fase futura (§4) segue pendente.

## O que mudou da v1 para v2 (decisões do Marco)

| Item da v1 | Decisão | Consequência no desenho |
|---|---|---|
| PIN de aprovação | ❌ Removido por ora | Sem burocracia: qualquer operador do dashboard alterna política e aprova. Coerente porque a postagem continua manual — o gate real é quem tem o login do LinkedIn do Roi. O PIN volta como **pré-requisito** só quando houver auto-post. |
| Integração Slack | ❌ Descartada | Roi não usa Slack. A notificação de pendências é o **badge na própria seção** (e, se quiser no futuro, resumo por e-mail — decisão adiada). |
| Cap de comentários/dia | ❌ Não existe agora | O fluxo inicial é manual — um limite só atrapalharia. Caps (e kill switch) entram **junto com a automação futura**, quando os resultados atuais derem confiança. |
| Fila na aba Queue | 🔁 Movida | A fila de aprovação vive **dentro do People's Posts**, no topo da seção — tudo num lugar só. |

---

## 1. Resumo executivo

Cada contato do Radar ganha uma **política de comentário**, alternada por um chip
clicável no próprio card — este é o botão do Roi:

| Política | Comportamento ao gerar o comentário |
|---|---|
| 🔒 **Review** | O comentário gerado **não é postado**: vira pendência na fila "Aguardando aprovação do Roi", no topo do People's Posts. Roi lê, edita se quiser, aprova ou rejeita. Só depois de aprovado aparece o botão de copiar/postar. |
| ⚡ **Auto** | Fluxo idêntico ao de hoje: gera, navega até o comentário, copia e posta — sem parada. A única novidade é o registro de status para rastreabilidade. |

Postagem permanece **100% manual** (copiar → LinkedIn → colar → marcar como postado).
Automação é uma fase futura condicionada à confiança nos resultados — e é nela que
entram os guardrails hoje removidos (caps, kill switch, classificador de posts
sensíveis e controle de acesso).

---

## 2. Estado atual (baseline)

- Radar monitora 73+ contatos via PhantomBuster (diário, 08:00) com tier automático.
- Botão por post "💬 Generate Roi's Comment" → gera na voz do Roi → usuário copia e
  posta manualmente → "Mark commented" grava no Supabase e alimenta o funil
  warm-lead → Hermes.
- Não existe conceito de aprovação nem rastro de quem autorizou o quê.

## 3. Modelo proposto

### 3.1 Política por contato (o "botão do Roi")

- Chip **🔒 Review / ⚡ Auto** ao lado do tier em cada card — 1 clique alterna e vale
  para todos os posts futuros daquele contato (persistido em `contact_tiers`).
- Botão "Definir por tier…" no topo do Radar para o setup inicial em massa.
- **Defaults sugeridos** (Roi ajusta caso a caso): ★ Priority e Client = 🔒 Review;
  Network e Yedda = ⚡ Auto.

### 3.2 Fluxos

```
Post no Radar → operador clica gerar
        │
   [política do autor]
   ┌────┴──────────────────────┐
   🔒 Review                   ⚡ Auto
   │                           │
   Gera (voz Roi, fluxo atual) Gera (voz Roi, fluxo atual)
   │                           │
   Botão: "📥 Enviar p/        Comentário pronto na tela →
   aprovação do Roi"           copiar → postar no LinkedIn →
   │                           "✓ Mark posted"
   status: pending_approval    status: posted
   │
   ▼
   FILA no topo do People's Posts — "⏳ Aguardando Roi (3)"
   Roi: lê │ edita inline │ [✅ Aprovar] [🔁 Regenerar] [❌ Rejeitar]
   │ aprovado
   ▼
   Card mostra "✅ Aprovado — copiar e postar" → copiar → LinkedIn →
   "✓ Mark posted" → status: posted → lead_interactions → warm-lead → Hermes
```

Observações de desenho:
- Para ⚡ Auto, **nada muda na experiência de hoje** — só ganha bookkeeping.
- Para 🔒 Review, quem gera não posta: o novo botão "Enviar p/ aprovação" salva o
  rascunho e devolve o operador ao Radar.
- Rejeição pede um motivo curto (1 linha) — vira aprendizado para regenerar melhor.

### 3.3 UI (dentro do People's Posts apenas)

**Topo da seção — fila de aprovação** (visível só quando houver pendências):

```
┌─ ⏳ Aguardando aprovação do Roi (2) ─────────────────────┐
│ ★ Uday Sinha · post de 2 Jul                     [ver ↗] │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Congrats, Uday — 32 years and still building...      │ │ ← editável inline
│ └──────────────────────────────────────────────────────┘ │
│ [✅ Aprovar] [🔁 Regenerar] [❌ Rejeitar…]                │
└───────────────────────────────────────────────────────────┘
```

**Card do feed — chip de política + botão adaptativo:**

```
│ ★ Priority · 🔒 Review   Uday Shankar Sinha              │
│ [💬 Gerar p/ aprovação]  [✓ Mark commented]              │

│ Network · ⚡ Auto        Amit Bendor                      │
│ [💬 Generate Roi's Comment]  [✓ Mark commented]          │
```

**Estados do card conforme o comentário avança:**
`sem comentário → ⏳ aguardando Roi → ✅ aprovado (copiar e postar) → ✓ postado`
(rejeitado volta para "sem comentário" com o motivo visível ao passar o mouse).

### 3.4 Modelo de dados (Supabase)

```sql
-- Política por contato
alter table contact_tiers
  add column approval_policy text not null default 'review'
  check (approval_policy in ('review','auto'));

-- Workflow no post (1 post = 1 comentário; roi_comment já existe)
alter table linkedin_contacts_posts
  add column comment_status text not null default 'none'
  check (comment_status in ('none','pending_approval','approved','rejected','posted')),
  add column approved_at timestamptz,
  add column rejection_note text,
  add column posted_at timestamptz;
```

Transições apenas para frente (`none → pending_approval → approved → posted`);
`rejected` pode voltar a `pending_approval` via Regenerar. Re-scrapes do
PhantomBuster nunca tocam nessas colunas (o merge-duplicates atual já preserva
`roi_comment` — mesmo mecanismo).

### 3.5 Mudanças de API (tudo em `api/linkedin-posts.js`, sem endpoint novo)

| Ação | Chamada | Notas |
|---|---|---|
| Alternar política | `POST {action:'set-policy', profile_url, approval_policy}` | Sem PIN (decisão v2) |
| Enviar p/ aprovação | `PATCH {post_url, roi_comment, comment_status:'pending_approval'}` | Estende o PATCH atual |
| Aprovar / rejeitar | `POST {action:'approve'\|'reject', post_url, roi_comment?, rejection_note?}` | Aprovar aceita o texto editado |
| Marcar postado | `PATCH {post_url, commented:true, comment_status:'posted'}` | Une-se ao "Mark commented" atual |
| Listar fila | `GET /api/linkedin-posts` (já traz tudo) | Front filtra `pending_approval` |

## 4. Fase futura (fora de escopo agora) — automação

Documentada para não se perder; **só entra quando os resultados manuais derem
confiança**, e cada item abaixo é pré-requisito dela (não do fluxo atual):

1. **Postagem automática** via PhantomBuster LinkedIn Auto Commenter (plano Start já
   cobre) lendo um feed CSV da nossa API (`postUrl,comment` dos aprovados).
2. **Caps diários** (~10/dia, recomendação PhantomBuster) + janela de horário comercial
   + **kill switch** ("⏸ Pausar auto-post").
3. **Classificador de posts sensíveis** — mesmo ⚡ Auto rebaixa para 🔒 se o post for
   sobre demissão, luto, doença ou política.
4. **Controle de acesso** (PIN ou login) — passa a ser obrigatório no momento em que
   um clique puder publicar como Roi sem humano no meio.
5. **Geração automática na chegada** (webhook → Gemini server-side, requer
   `GEMINI_API_KEY` no Vercel) e notificação por e-mail das pendências (sem Slack).

## 5. Implementação da Fase 1 (escopo aprovado)

| # | Entrega | Detalhe |
|---|---|---|
| 1 | Migração Supabase | `approval_policy` + colunas de workflow (§3.4) |
| 2 | API | 2 actions novas + extensão do PATCH (§3.5) |
| 3 | Chip de política no card | Clicável, otimista, persiste via API |
| 4 | Botão adaptativo | 🔒 → "Gerar p/ aprovação" (salva pendência) · ⚡ → fluxo atual |
| 5 | Fila de aprovação | Topo do People's Posts, badge, editar inline, aprovar/regenerar/rejeitar |
| 6 | Estados no card | ⏳ / ✅ copiar e postar / ✓ postado |
| 7 | Testes E2E | Puppeteer local (mock API + Gemini), padrão dos anteriores |

**Esforço:** 1 sessão. **Risco:** baixo — nada sai da plataforma; postagem segue humana.

## 6. Única decisão pendente

- [ ] Defaults de política por tier: ★ Priority e Client = 🔒 / Network e Yedda = ⚡ — confirma?
      (alternativa conservadora: todos começam 🔒 e o Roi vai liberando ⚡ contato a contato)

## Fontes (fase futura)

- [PhantomBuster — LinkedIn Auto Commenter](https://support.phantombuster.com/hc/en-us/articles/26971012177042-How-to-use-the-LinkedIn-Auto-Commenter)
- [PhantomBuster — catálogo Auto Commenter](https://phantombuster.com/automations/linkedin/16226/linkedin-auto-commenter)
