# Planejamento — 12 solicitações do CEO (Roi)

> **Data:** 28 jul 2026 · **Status:** PLANEJAMENTO — nada executado
> **Origem:** mensagem do Roi sobre marketing e LinkedIn
> **Método:** cada item foi mapeado contra o código/dados atuais antes de propor.

---

## Sumário executivo

Dos 12 pedidos, o mapeamento revelou uma distribuição que muda a ordem de ataque:

| Categoria | Itens | Observação |
|---|---|---|
| ✅ **Já existe** (só validar/ajustar) | 6 | Logo/cores já implementados exatamente como pedido |
| 🟢 **Rápido** (≤ ½ sessão cada) | 3, 2, 10 | Alto impacto imediato na qualidade percebida |
| 🟡 **Médio** (~1 sessão cada) | 8, 11, 7, 9 | Dependem de insumos do Roi ou de nova infra |
| 🔴 **Grande / externo** | 1, 5, 12 | Vídeo, dashboard de interações, Salesforce |

**A descoberta mais importante:** os itens 3, 4, 8 e 10 são sintomas do **mesmo problema
raiz** — o gerador aprende de uma base estreita e não tem circuito de feedback. Resolvê-los
juntos (Fase 1) elimina "comentários repetitivos", "muito retail" e "preciso corrigir tudo
no ChatGPT" de uma vez. Atacá-los isoladamente desperdiça esforço.

**Recomendação de sequência:** Fase 1 (qualidade do texto: 3+2+10+8) → Fase 2 (nutrir a
IA: 11+4+9+7) → Fase 3 (infra: 5+1+12).

---

## Item 1 — Um vídeo curto por semana (páginas Yedda e Roi), preferencialmente sextas

**Estado atual:** ⛔ Não existe nada de vídeo na plataforma. O gerador de imagens usa
Gemini/FLUX/Canvas — nenhum caminho de vídeo. O Auto Poster do PhantomBuster
**não suporta vídeo nem imagem** (apenas texto e links, confirmado na documentação).

**Análise das opções:**

| Opção | Como funciona | Custo | Veredito |
|---|---|---|---|
| **A. Roteiro + produção manual** | A IA gera roteiro de 30–45s (hook, 3 pontos, CTA) + storyboard + legendas; alguém grava/edita | $0 | ✅ **Recomendado p/ começar** |
| **B. Vídeo por IA** (Veo/Runway/Pika) | Geração automática a partir do roteiro | ~$20–100/mês | 🟡 Fase 2 — qualidade B2B ainda irregular |
| **C. Slideshow automatizado** | Canvas → frames → MP4 (ffmpeg) com as imagens que já geramos | $0 (dev) | 🟢 Meio-termo viável |
| **D. Publicação automática** | — | — | ❌ **Impossível hoje**: nenhum Phantom publica vídeo; a API oficial exigiria Marketing Partner |

**Plano sugerido (Fase 3):**
1. Nova aba **"Weekly Video"** no dashboard com um gerador de **roteiro** (usa a mesma
   voz de marca e a persona do Roi que já temos), saída estruturada: hook (3s),
   3 bullets, CTA, legendas prontas e sugestão de b-roll.
2. Agendamento editorial: o roteiro da semana é gerado **toda quarta**, dando 2 dias
   para produzir e publicar na sexta.
3. Publicação **sempre manual** (limitação da plataforma, não escolha).
4. *Futuro:* opção C (slideshow) reaproveitando as imagens da semana.

**Justificativa:** o gargalo real do vídeo semanal não é a ideia — é produzir. Entregar
roteiro+legenda+storyboard remove 80% do atrito com custo zero e sem prometer uma
automação que a plataforma não suporta.

---

## Item 2 — Comentários do Roi mais leves, menos pesados/sérios

**Estado atual:** 🟡 O prompt atual pede "peer-to-peer com CEOs", "ganhe a opinião",
"aterre em algo real" — isso empurra para um tom **denso e analítico**. Há regras
anti-clichê, mas nenhuma regra de **leveza**. A temperatura é 0.82.

**Plano sugerido (Fase 1):**
1. Reescrever a seção VOICE do prompt de comentários: frases curtas, contrações,
   permissão explícita para humor seco, uma observação humana em vez de análise
   completa. Regra prática: **"escreva como quem responde no celular entre reuniões,
   não como quem escreve um memorando"**.
2. Adicionar **limite rígido**: 1–2 frases para a maioria dos casos (hoje são 2–3).
   Comentário curto é intrinsecamente mais leve.
3. Novos few-shot examples com tom leve (os atuais são todos analíticos —
   **os exemplos ensinam mais que as regras**, como aprendemos no incidente do
   "real time").
4. Ampliar o detector `_AI_TELLS` com marcadores de peso: "it's worth noting",
   "fundamentally", "the reality is", "at scale", "the question becomes".

**Justificativa:** o tom é 100% ditado por prompt + exemplos. É a mudança de maior
impacto por menor esforço de toda a lista.

---

## Item 3 — Comentários repetitivos; remover as categorias; sugestões automáticas

**Estado atual mapeado:**
- São **5 categorias** (não 4): insight, challenge, agree, question, experience.
- Elas **forçam** o comentário para um molde fixo → repetição estrutural.
- O campo "cole o post aqui" é manual — daí a percepção de "me pede sugestões".

**Plano sugerido (Fase 1) — 3 mudanças:**

1. **Remover o seletor de categorias.** O modelo passa a **classificar sozinho** o post
   (marco pessoal / opinião / resultado de empresa / história pessoal) e escolher o
   movimento certo — lógica que **já existe** no prompt e hoje é sobreposta pela
   categoria escolhida à mão.
2. **Gerar 3 variações de uma vez**, lado a lado, para o Roi escolher/editar. Elimina o
   ciclo "gerar → não gostei → gerar de novo" e ataca a repetição na raiz: com 3 opções
   por post, o espaço de saída se amplia naturalmente.
3. **Memória anti-repetição:** injetar no prompt os últimos ~15 comentários já usados,
   com a instrução "não repita estas aberturas nem estas estruturas". Temos todos
   gravados em `linkedin_contacts_posts.roi_comment` — dado ocioso hoje.

**Justificativa:** a repetição tem três causas (molde fixo, geração única, nenhuma
memória do que já foi dito) e as três precisam cair juntas. Este é o item de **maior
retorno percebido** pelo Roi.

---

## Item 4 — "Vocês usam meu arquivo? Ainda corrijo tudo no ChatGPT"

**Estado atual:** 🔴 **Não.** As fontes atuais são: `brand-prompts.json` (proof points,
vocabulário proibido), `roi-voice.json` (princípios do Roi, vindos do MAS) e
`LINKEDIN-CONTENT-BANK.md` (exemplos). **O arquivo Excel do Roi nunca foi ingerido** —
provavelmente nem chegou até nós.

**Plano sugerido (Fase 2):**
1. **Pedir o arquivo** (com a explicação do Roi sobre a estrutura). Sem ele, este item
   não avança — é a dependência mais crítica da lista.
2. Converter para `data/roi-writing-rules.json` (regras + exemplos aprovados/rejeitados),
   servido por `/api/roi-writing-rules` — mesmo padrão de `roi-voice`.
3. Injetar nos geradores de post e comentário do Roi.
4. **Sobre "rodar pelo ChatGPT":** não é preciso trocar de IA. O que falta não é o
   modelo — é o **conteúdo das regras** que hoje só existe na cabeça do Roi e no Excel.
   Com o arquivo ingerido + o circuito de feedback do item 8, a taxa de correção manual
   cai drasticamente. Se ainda assim persistir, avaliamos um segundo passe de revisão
   automática (o mesmo padrão de "gerar → criticar → reescrever" que já usamos no
   detector anti-jargão).

**Justificativa:** é o item de maior alavancagem sobre a **qualidade final**, e o único
bloqueado por um insumo externo. Deve ser pedido **hoje**.

---

## Item 5 — Dashboard de interações (likes, comentários, mensagens) + próximo passo

**Estado atual:** 🟡 Metade da fundação existe: o **Warm Engagers** já captura quem
curte os posts em que o Roi participa (365 pessoas coletadas na 1ª varredura) e o
handoff para o Hermes já funciona. **Não existe:** captura de comentários, mensagens
(inbox), interações na página da empresa, nem visão consolidada por pessoa.

**Análise de viabilidade por fonte:**

| Interação | Como capturar | Viável? |
|---|---|---|
| Likes em posts do Roi | Post Likers Export (já roda) | ✅ Pronto |
| **Comentários** em posts | Post Commenters Export (Phantom existe no catálogo) | ✅ Fácil |
| **Mensagens** (inbox) | LinkedIn Inbox Scraper (existe no catálogo) | 🟡 Requer sessão do Roi |
| Interações na **página Yedda** | Company Follower Collector / Page analytics | 🟡 Parcial |

**Plano sugerido (Fase 3):**
1. Adicionar o **Post Commenters Export** ao pipeline (custo ~igual ao de likers).
2. Nova aba **"Interactions"**: uma linha por pessoa, consolidando likes + comentários +
   mensagens, com **estado explícito de próximo passo** — `New → Replied → In
   conversation → Handed to sales → Dormant`.
3. Regras de "próximo passo" sugerido: comentou → responder em 24h; mandou mensagem →
   responder no mesmo dia; 2+ interações → handoff Hermes (já existe, com o gatilho de
   ★5 previsto no relatório de estrelas).
4. Quota: o teto de 20h/mês é a restrição — sugerido rodar o coletor de comentários
   junto do de likes (segundas), não diariamente.

**Justificativa:** o Roi pediu "onde vejo as interações **e** qual o próximo passo" —
a segunda metade é a que gera valor comercial e é exatamente o que o funil Hermes já
sabe receber.

---

## Item 6 — Cores da marca e logo original no canto inferior esquerdo

**Estado atual:** ✅ **Já implementado exatamente assim.**
- `_compositeWithLogo()` desenha o `yedda-logo.png` **no canto inferior esquerdo**
  (padding de 4% da largura, logo a 20% da largura).
- O PNG original é usado sem recriação, com transparência preservada (regra registrada
  no projeto: nunca colocar fundo branco atrás do logo).
- O prompt de imagem já injeta teal `#4BADB8` + laranja `#F07830` e **proíbe** o modelo
  de desenhar qualquer logo/marca (o logo é composto depois, por cima).

**Plano sugerido:** apenas **validação com o Roi** — mostrar 2–3 exemplos gerados para
confirmar que o resultado corresponde ao que ele espera. Se houver divergência, é
questão de **tamanho/opacidade**, não de implementação. Custo: ~10 minutos.

---

## Item 7 — A IA deve revisar os posts já publicados na página para não repetir

**Estado atual:** 🟡 Existe dedup **de artigos de notícia** (`yedda_seen_articles`, 300
URLs), mas **nenhuma verificação contra os posts já publicados** no LinkedIn.

**Plano sugerido (Fase 2):**
1. **Fonte dos posts publicados:** já temos o Phantom certo — o **LinkedIn Activity
   Extractor** (o mesmo do Radar) pode apontar para a página da Yedda e o perfil do Roi,
   trazendo o histórico real do que foi publicado.
2. Guardar em `published_posts` (Supabase) com data e tema.
3. **Verificação de similaridade** antes de aprovar um post novo: comparar tema/abertura
   com os últimos ~30 publicados. Duas camadas:
   - **Barata (client-side):** sobreposição de trigramas → alerta "similar ao post de
     12/jul (68%)".
   - **Semântica (opcional):** embeddings via Gemini, para pegar repetição de *ideia*
     com palavras diferentes.
4. UI: aviso no card do post — não bloqueio (a decisão continua humana).

**Justificativa:** reusa infraestrutura existente (Phantom + trigger + padrão de
alerta). O alerta não-bloqueante respeita o modelo de aprovação já consolidado.

---

## Item 8 — Campo para colar o post revisado pelo ChatGPT (para a IA aprender)

**Estado atual:** 🔴 Confirmado: existe o botão **"🔁 Revise"**, mas **nenhum campo para
a versão corrigida**. O feedback do Roi se perde — a IA nunca vê o que ele mudou.

**Plano sugerido (Fase 1) — o "circuito de feedback":**
1. Ao marcar 🔁 Revise, abrir um campo **"Paste your improved version"**.
2. Gravar o par em `post_revisions`: `original` + `revised` + data + tipo de post.
3. **Usar como few-shot dinâmico:** injetar os últimos 5–10 pares nos geradores como
   *"o Roi reescreveu assim — siga este padrão"*. É a forma mais eficaz de ensinar
   estilo a um LLM: mostrar antes/depois reais.
4. *(Opcional)* Painel "o que a IA aprendeu": diff visual das correções mais frequentes.

**Justificativa:** este item é o **motor de melhoria contínua** de toda a plataforma —
transforma o trabalho manual que o Roi já faz hoje (item 4) em ativo de treino, sem
custo adicional para ele. Combinado com o item 4, é o que faz a correção manual diminuir
com o tempo em vez de se repetir para sempre.

---

## Item 9 — Aprender com concorrentes e empresas do setor

**Estado atual:** 🟡 Existe `scripts/competitor_scanner.py` e uma seção "Competitive"
(alimentada pelo MAS, hoje offline), mas **nada disso realimenta o gerador de posts**.

**Plano sugerido (Fase 2):**
1. Definir a lista-alvo com o Roi (sugestão inicial, do relatório competitivo existente:
   Wobot, Everyangle, Coram AI + 2–3 contas de referência de conteúdo).
2. Coletar os posts dessas páginas com o **Activity Extractor** apontado para elas
   (mesmo Phantom, custo marginal).
3. Análise semanal automática: temas recorrentes, ângulos usados, o que gera
   engajamento, **lacunas** (o que ninguém está dizendo).
4. Injetar como contexto no gerador: *"o mercado está falando de X e Y; a lacuna é Z"* —
   com a instrução explícita de **diferenciar, nunca imitar**.

**Justificativa:** o valor não é copiar — é achar o espaço vazio. E a regra de nunca
imitar precisa ser explícita no prompt, senão o modelo tende a convergir para a média
do setor (exatamente o oposto da voz do Roi).

---

## Item 10 — O gerador é muito voltado a retail; precisa expandir

**Estado atual:** 🟡 Confirmado no código: a palavra "retail" aparece **87 vezes** no
dashboard; os prompts dizem "retail, logistics and manufacturing" mas os **exemplos e
proof points são quase todos de varejo** (Carrefour, shrinkage, filas de checkout) — e
exemplo pesa mais que instrução.

**Plano sugerido (Fase 1):**
1. Adicionar um seletor de **setor** no gerador: Retail · Logistics · Manufacturing ·
   F&B/QSR · Healthcare & Safety · (Todos).
2. Criar **proof points e exemplos por setor** no `brand-prompts.json`
   (hoje é uma lista única, dominada por varejo).
3. Rebalancear o `LINKEDIN-CONTENT-BANK.md`: hoje é majoritariamente varejo.
4. **Rotação automática** no calendário: distribuir setores ao longo do mês para o feed
   não parecer uma empresa só de varejo.

**Justificativa:** a Yedda vende para 4 setores em 8+ países; o conteúdo atual projeta
uma empresa de varejo. É um problema de **posicionamento**, não só de variedade —
e a correção é majoritariamente de dados (JSON), não de código.

---

## Item 11 — Subir apresentações de POC e produto para a IA aprender

**Estado atual:** 🔴 Não existe. A IA conhece apenas proof points soltos
(54%, 55s, ROI 180–400%) — sem o contexto de produto, arquitetura, casos e objeções que
vivem nas apresentações.

**Plano sugerido (Fase 2):**
1. **Receber os arquivos** (PDF/PPTX de POC e produto) — dependência do Roi.
2. Extrair e estruturar em `data/product-knowledge.json`: módulos, capacidades, casos
   por setor, objeções e respostas, números validados.
3. Servir via `/api/product-knowledge` (padrão consolidado) e injetar nos geradores.
4. **Guard-rail obrigatório:** marcar claramente o que é **confidencial de cliente** e
   nunca pode aparecer em post público (o content bank já tem a regra de não citar
   nomes de clientes — precisa valer para esta base também).

**Justificativa:** é o que permite sair do genérico ("Visual AI melhora operações") para
o específico e verificável — que é a voz que o Roi quer. Junto do item 4, forma a base
de conhecimento que hoje falta.

---

## Item 12 — Migrar os contatos do Roi para o Salesforce

**Estado atual:** 🟡 Os 70 contatos vivem em: Google Sheet (fonte do Phantom),
`contact_tiers` no Supabase (tier, política, estrelas, cargo/empresa) e no CRM master do
Roi (Google Sheets, com dados sensíveis: telefones, e-mails, família).

**Perguntas a responder antes de planejar a execução:**
- Já existe org Salesforce ativa na Yedda? Qual edição (afeta limites de API)?
- O Salesforce vira a **fonte da verdade** (o Phantom passaria a ler dele) ou é só
  destino de leitura?
- Como fica o Hermes, que hoje consome `hermes_mas_handoff` no Supabase?

**Plano sugerido (Fase 3), assumindo Salesforce como destino:**
1. Mapear campos: `contact_tiers` → Contact/Lead (tier → rating, estrelas → campo
   customizado, política → campo customizado).
2. Sincronização **unidirecional** Supabase → Salesforce a princípio (menor risco);
   bidirecional só depois, se necessário.
3. Levar junto o histórico de engajamento (comentários, handoffs) como Activities —
   é isso que dá valor ao dado no CRM.
4. **Atenção:** dados confidenciais do CRM master (telefones, notas pessoais, família)
   exigem decisão explícita do Roi sobre o que migra.

**Justificativa:** é o item mais dependente de contexto externo. Sem as respostas acima,
qualquer estimativa seria chute.

---

## Fases sugeridas

### Fase 1 — Qualidade do texto (impacto imediato, ~1,5 sessão)
**Itens 3, 2, 10, 8** — remove categorias + 3 variações + memória anti-repetição; tom
mais leve; expansão setorial; campo de versão revisada.
> Ataca junto o que o Roi mais sente no dia a dia: repetição, peso e retrabalho.

### Fase 2 — Nutrir a IA (~2 sessões + insumos do Roi)
**Itens 11, 4, 9, 7** — apresentações de produto; arquivo Excel de regras; inteligência
de concorrentes; verificação anti-repetição contra o que já foi publicado.
> **Bloqueado por 2 insumos:** o Excel (item 4) e as apresentações (item 11).

### Fase 3 — Nova infraestrutura (~3 sessões + decisões)
**Itens 5, 1, 12** — dashboard de interações; produção de vídeo semanal; Salesforce.
> Cada um exige decisões do Roi antes de começar.

### Validação avulsa (10 min)
**Item 6** — confirmar com o Roi que o logo/cores atuais atendem.

---

## O que precisamos do Roi para destravar

| # | Item | O que é necessário |
|---|---|---|
| 1 | **Arquivo Excel** de regras de escrita (item 4) | O arquivo + a explicação da estrutura |
| 2 | **Apresentações** de POC e produto (item 11) | PDFs/PPTX + o que é confidencial |
| 3 | **Lista de concorrentes/referências** (item 9) | Quem monitorar |
| 4 | **Salesforce** (item 12) | Existe org? É fonte da verdade ou destino? |
| 5 | **Vídeo** (item 1) | Quem produz? Aceita roteiro+legenda com gravação manual? |
| 6 | **Logo** (item 6) | Validar 2–3 exemplos gerados |

---

## Notas de restrição (para gerenciar expectativa)

- **Publicação de vídeo não pode ser automatizada** hoje: nenhum Phantom publica vídeo e
  a API oficial do LinkedIn exigiria parceria Marketing Partner.
- **Quota PhantomBuster:** plano Start = 20h/mês. Radar (~5h) + engajadores (~1h) já
  consomem ~30%. Itens 7 e 9 (raspar página Yedda, perfil do Roi e concorrentes) e
  item 5 (comentários) precisam caber no restante — a sequência semanal proposta cabe,
  mas não há espaço para tudo diariamente.
- **Auto Poster segue desligado** até a sessão do LinkedIn do Roi ser conectada — não
  afeta nenhum destes 12 itens, mas continua pendente.
