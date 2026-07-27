# Relatório — Prioridade por Estrelas (★1–5) no People's Posts

> **Data:** 21 jul 2026 · **Status:** proposta para decisão — **nada foi implementado**
> **Pedido:** mapear a função People's Posts e propor como um sistema de 5 estrelas nos
> contatos sinalizados pode ordenar a **prioridade de tratativa**, de forma intuitiva.

---

## 1. Resumo executivo

O People's Posts hoje responde bem a *"o que aconteceu?"* (posts chegam, são filtráveis,
geram comentário com aprovação), mas não responde a *"o que eu trato primeiro?"* — a
lista é puramente cronológica e, dentro de um mesmo tier, todos os contatos valem o
mesmo. A proposta: uma **nota de prioridade de 1 a 5 estrelas por contato**, visível e
editável no próprio card, que reordena o radar, a fila de aprovação e o funil de leads
em torno de uma regra simples: **quem tem mais estrelas é tratado primeiro**.

O insumo já existe: o CRM do Roi tem a coluna **"Willingness to help" (1–5)** — além de
"Rel Rank" e "Fin Rank" — para praticamente todos os contatos. A plataforma simplesmente
nunca capturou esse dado de forma estruturada. Não é preciso inventar um score: é
preciso **trazer o score do Roi para dentro do radar**.

São 8 sugestões, ordenadas da fundação ao refinamento. As sugestões S1–S3 formam o
núcleo (dados + visual + ordenação) e entregam o pedido por inteiro; S4–S8 são camadas
de refino que podem vir depois, cada uma independente.

---

## 2. Mapeamento do estado atual

### O que a função tem hoje

| Elemento | Comportamento atual |
|---|---|
| **Feed** | Posts dos 70 contatos, ordenados por **data (mais recente primeiro)** — nenhum peso por importância do contato |
| **Tier chip** | ★ Priority / Client / Network / Yedda — vem do CRM, carimbado em cada post por trigger no banco |
| **Policy chip** | 🔒 Review / ⚡ Auto — clicável, controla o fluxo de aprovação de comentários |
| **Filtros** | Por tier, janela de tempo (7/14/30d/tudo), esconder comentados, paginação 30/página |
| **Fila de aprovação** | "Awaiting Roi's approval" no topo — ordenada por **chegada**, não por importância |
| **Warm-lead** | 2+ comentários no mesmo contato → botão de handoff para o Hermes (regra igual para todos) |
| **Estados do card** | ⏳ awaiting → ✅ approved → ✓ posted, nota de repost, cargo/empresa |

### A lacuna exata

1. **Tier ≠ prioridade.** Tier codifica a *natureza da relação* (é cliente? é network? é
   interno?), não o *quanto vale atenção*. Dentro de "2-client" convivem contatos com
   Willingness 1/5 e 4/5 — o radar os trata identicamente.
2. **Cronologia manda em tudo.** Um post novo de um contato de baixo valor fica acima de
   um post de ontem do contato mais estratégico do CRM. Prioridade de tratativa é
   exatamente o inverso disso.
3. **O dado de prioridade existe mas está fora da plataforma.** Distribuição real:

   | Fonte | Cobertura |
   |---|---|
   | CRM master do Roi (coluna "Willingness to help 1–5") | ~todos os 70 contatos |
   | Plataforma (`contact_tiers` no Supabase) | **zero** — não há campo de score |
   | CSV local (score como texto solto na coluna notes) | só 13 de 70 (ex.: "Help 5/5") |

   No CRM master, os **5/5 confirmados entre os monitorados** incluem Anhul Chauhan
   (CEO Pizza Hut VN) e o time interno de maior peso (Noam Shalev, Michael Grinfeld);
   os 4/5 incluem Pierre Bertholat, Uday Sinha, Raffi Caspi, Christophe Echivard,
   Leonardo Garcia, Souly Hamed, Erik Jonsson, entre outros.
4. **A fila de aprovação também é cega a valor.** Se houver 6 pendências, o Roi as revisa
   na ordem em que chegaram — não começando pelos contatos 5★.

---

## 3. De onde vêm as estrelas (fonte e propriedade)

**Proposta: estrela = prioridade de tratativa, propriedade do Roi.**

- **Carga inicial (automática):** mapear a coluna "Willingness to help 1–5" do CRM
  diretamente para ★1–5. Quem não tiver score no CRM recebe um default derivado do tier
  (sugestão: 1-priority→★4 · 2-client→★3 · 3-network→★2 · internal→★3), para a lista
  nunca ter "buracos" sem nota.
- **Ajuste contínuo (manual, 1 clique):** as estrelas no card são clicáveis — o Roi (ou
  você) sobe/desce a nota de um contato na hora, sem planilha, sem redeploy. Mesmo
  padrão de interação do chip 🔒/⚡ que já existe e já é usado.
- **Por que não usar o tier como prioridade?** Porque destruiria a semântica que o tier
  carrega (cliente vs network vs interno) e o funil Hermes depende dela. As duas
  dimensões coexistem: *tier diz o que a pessoa é; estrela diz o quanto ela merece
  atenção agora.* São perguntas diferentes com respostas diferentes — ex.: um contato
  interno (tier Yedda) pode ser ★5, e um cliente formal pode ser ★2.

---

## 4. Sugestões de implementação

### S1 — Fundação: coluna `stars` no contato, carimbada em cada post
**O que é:** campo `stars` (1–5) em `contact_tiers`; o trigger que já carimba
tier/policy/cargo/empresa nos posts passa a carimbar as estrelas também; backfill
inicial a partir do CRM + defaults por tier.

**Justificativa:** é o mesmo padrão arquitetural já validado três vezes no projeto
(tier, approval_policy, title/company): o CRM é a fonte, o contato é o dono do dado, o
post recebe uma cópia desnormalizada e o front-end não precisa de nenhum join. Custo de
execução zero (nenhum scraping novo). Sem esta fundação, nenhuma das outras sugestões
existe.

**Esforço:** pequeno (migração + backfill + 1 edição no trigger).

---

### S2 — Estrelas visíveis e clicáveis no card
**O que é:** substituir a abstração por notação universal — o card mostra `★★★★★`
douradas/laranja preenchidas conforme a nota, ao lado do nome. Clicar na n-ésima
estrela define a nota (clicar na 5ª = ★5). Vale para todos os posts do contato,
presentes e futuros.

```
┌──────────────────────────────────────────────────────────────┐
│ ★★★★★  Anhul Chauhan — CEO · Pizza Hut VN                    │
│ Client · 🔒 Review · 2 Jul 2026 · 👍 333 · View post ↗       │
│ "After 32 years in the CPG world..."                          │
│ [💬 Generate for Roi's approval]  [✓ Mark posted]            │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ ★★☆☆☆  Bruno Jousselin — MD · MM Mega Market VN              │
│ ...                                                           │
└──────────────────────────────────────────────────────────────┘
```

**Justificativa (intuitividade):** estrelas de 1 a 5 são provavelmente o padrão de
priorização mais universal que existe (lojas de app, avaliações, e-mail). Ninguém
precisa aprender o que significam. E editar no local do uso — no card, na hora em que
se percebe que a nota está errada — elimina a fricção de "abrir o CRM para ajustar".
O padrão de interação (chip clicável, otimista, persiste via API) já existe no chip de
política; o usuário já sabe usá-lo.

**Esforço:** pequeno (render + handler no card; API reaproveita a action `set-policy`
generalizada ou ganha uma `set-stars` idêntica).

---

### S3 — Ordenação por prioridade (o coração do pedido)
**O que é:** o feed deixa de ser cronológico puro e passa a ordenar por
**estrelas (desc) → recência (desc)**: todos os posts de contatos ★5 primeiro (dos mais
novos aos mais antigos), depois ★4, e assim por diante.

**Alternativa considerada — "seção destacada":** manter o feed cronológico e criar um
bloco fixo no topo, "⭐ Priority attention", só com posts ★5/★4 não tratados (mesmo
padrão visual da fila de aprovação).

| Critério | Ordenação total | Seção destacada |
|---|---|---|
| Clareza do que fazer primeiro | Alta | Muito alta |
| Preserva leitura cronológica do resto | Não | Sim |
| Complexidade de código | Menor | Média |
| Risco de "enterrar" contatos ★1–2 para sempre | Existe | Menor |

**Recomendação:** começar pela **seção destacada** + um toggle de ordenação
("Sort: Priority / Newest") na barra de filtros. A seção responde "o que eu trato
primeiro?" sem tirar de você a visão cronológica completa; o toggle dá a ordenação
total para quem preferir. Os dois juntos custam pouco mais que qualquer um sozinho.

**Justificativa:** é a materialização literal do pedido — "prioridade de tratativa".
Sem mudança de ordenação, as estrelas seriam só decoração.

**Esforço:** pequeno-médio (sort client-side + bloco de seção; nenhum backend novo além
de S1).

---

### S4 — Filtro por estrelas na barra
**O que é:** um chip a mais na barra de filtros existente: `★5 · ★4+ · All`
(ao lado dos filtros de tier que já existem).

**Justificativa:** consistência — a barra já ensina o usuário que "chips filtram".
Cobrindo o caso de uso "me mostra só os VIPs agora", em 1 clique, sem nova tela.

**Esforço:** mínimo (mesma mecânica do filtro de tier).

---

### S5 — Urgência com o tempo (aging) para ★5/★4
**O que é:** post de contato ★5/★4 **sem tratativa** ganha um contador discreto:
"waiting 2 days". A partir de um limite (sugestão: 48h para ★5, 96h para ★4), o card
ganha borda/realce laranja.

**Justificativa:** prioridade de tratativa tem duas dimensões — *quem* e *há quanto
tempo espera*. Um post ★5 de 3 dias atrás importa mais que um ★5 de 1 hora atrás. O
aging transforma a estrela num compromisso de SLA implícito, sem criar nenhuma
notificação invasiva: é só cor e texto no card, na tela que você já olha todo dia.

**Esforço:** pequeno (cálculo client-side sobre `published_at` + `comment_status`).

---

### S6 — Fila de aprovação ordenada por estrelas
**O que é:** as pendências em "Awaiting Roi's approval" aparecem ordenadas por
estrelas (★5 primeiro), com as estrelas visíveis em cada item da fila.

**Justificativa:** o tempo do Roi é o recurso mais escasso do fluxo. Se ele tem 5
minutos e 6 pendências, deve gastar esses minutos nos contatos certos. Hoje a fila é
por ordem de chegada — o critério menos relevante possível para um CEO.

**Esforço:** mínimo (sort no render da fila, dado já carimbado por S1).

---

### S7 — Funil mais sensível para ★5 (warm-lead)
**O que é:** o gatilho de warm-lead → Hermes hoje exige 2+ comentários para qualquer
contato. Proposta: para contatos ★5, **1 comentário já habilita** o botão de handoff.

**Justificativa:** o threshold uniforme ignora que o custo de *demorar* com um contato
estratégico é maior que o custo de um handoff prematuro (que, aliás, já nasce como
`pending` e passa por revisão antes de qualquer abordagem — o guard-rail existe). Para
os ★5, velocidade > acúmulo de evidência.

**Esforço:** mínimo (1 condição no cálculo do sinal).

---

### S8 — Contador de pendências ★ no topo do Radar
**O que é:** junto ao título da seção, um resumo vivo:
`⭐ 3 posts from 5-star contacts awaiting action`. Clicar nele aplica o filtro ★5.

**Justificativa:** dá o "estado do dia" em uma linha, antes de qualquer scroll — o
mesmo papel que o badge da fila de aprovação já cumpre. Para o hábito diário de 10
minutos, começar pelo número certo economiza a triagem inteira.

**Esforço:** mínimo.

---

### Fase futura (registrada, fora do escopo agora)
- **Sincronização CRM → estrelas:** quando o Roi atualizar "Willingness to help" no CRM
  master, um sync (padrão MAS, como roi-voice/brand-prompts) atualiza `contact_tiers`.
  Por ora, a edição por clique no card cobre o caso com custo zero.
- **Estrelas nos Warm Engagers:** herdar/atribuir nota também aos leads novos capturados
  pelo sweep semanal, priorizando quem parece mais valioso (ex.: cargo C-level).

---

## 5. Como fica a tela (visão consolidada)

```
PEOPLE'S POSTS
⭐ 3 posts from 5-star contacts awaiting action          ← S8 (clicável)

┌─ ⏳ Awaiting Roi's approval (2) ── ordered by ★ ──────┐  ← S6
│ ★★★★★ Anhul Chauhan …                                  │
│ ★★★★☆ Pierre Bertholat …                               │
└────────────────────────────────────────────────────────┘

Filters:  [All·35] [★ Priority] [Client] … | [★5] [★4+]   ← S4
          [Last 30 days ▾] [Hide commented] Sort: [Priority ▾]  ← S3

┌─ ⭐ Priority attention ────────────────────────────────┐  ← S3
│ ★★★★★ Anhul — waiting 2 days  ⚠                        │  ← S5
│ ★★★★☆ Uday — waiting 5 hours                           │
└────────────────────────────────────────────────────────┘

(feed normal continua abaixo, cronológico)
```

## 6. Modelo de dados (esboço — NÃO aplicado)

```sql
alter table contact_tiers
  add column stars smallint not null default 3
  check (stars between 1 and 5);
-- backfill: CRM "Willingness to help" onde houver; senão default por tier
-- trigger tag_linkedin_post_tier: passa a carimbar stars no post (padrão já usado
-- para tier / approval_policy / title / company)
alter table linkedin_contacts_posts
  add column stars smallint;
```

## 7. Fases sugeridas

| Fase | Conteúdo | Esforço | Entrega |
|---|---|---|---|
| **A — núcleo** | S1 + S2 + S3 (dados, estrelas clicáveis, seção + sort) | ~1 sessão | O pedido completo: prioridade visível e operante |
| **B — refino** | S4 + S5 + S6 (filtro, aging, fila ordenada) | ~½ sessão | Urgência e fila inteligente |
| **C — funil** | S7 + S8 (threshold ★5, contador) | ~½ sessão | Prioridade chega ao Hermes |

Todas usam padrões já existentes na plataforma (chip clicável, trigger de carimbo,
filtros client-side, badge de contagem) — nenhuma introduz dependência externa nova,
custo de PhantomBuster, ou risco à quota de 20h/mês.

## 8. Decisões necessárias antes de implementar

- [ ] **Mapa inicial:** aceitar CRM "Willingness to help" → estrelas, com defaults por
      tier para quem não tem score (1-priority→★4 · 2-client→★3 · 3-network→★2 ·
      internal→★3)? Alternativa conservadora: todos começam ★3 e o Roi ajusta.
- [ ] **Ordenação padrão do feed:** seção destacada + toggle (recomendado) ou ordenação
      total por estrelas?
- [ ] **Limites de aging (S5):** 48h para ★5 e 96h para ★4 estão bons?
- [ ] **Threshold do Hermes (S7):** 1 comentário para ★5 — aprovar?
- [ ] **Quem edita as estrelas:** qualquer operador do dashboard (como o chip de
      política hoje) ou tratar como decisão só do Roi?
