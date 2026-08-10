# Planejamento — 12 solicitações do CEO (Roi)

> **Data:** 28 jul 2026 · **Status:** PLANEJAMENTO — nada executado
> **Origem:** mensagem do Roi sobre marketing e LinkedIn
> **Método:** cada item foi mapeado contra o código/dados atuais antes de propor.

---

## Sumário executivo

> **Atualizado em 28 jul 2026** após receber e analisar a planilha editorial do Roi.
> Duas classificações mudaram (itens 4 e 6) e a Fase 1 ficou maior — e muito mais potente.

Dos 12 pedidos, o mapeamento revelou uma distribuição que muda a ordem de ataque:

| Categoria | Itens | Observação |
|---|---|---|
| 🟢 **Rápido** (≤ ½ sessão cada) | 2, 3, 8, 10 | Alto impacto imediato na qualidade percebida |
| 🟢 **Destravado pela planilha** | **4**, **6** | Deixaram de estar bloqueados/"prontos" — ver abaixo |
| 🟡 **Médio** (~1 sessão cada) | 7, 9, 11 | 11 ainda depende das apresentações de produto |
| 🔴 **Grande / externo** | 1, 5, 12 | Vídeo, dashboard de interações, Salesforce |

### As duas descobertas centrais

**1. Quatro pedidos são o mesmo problema raiz.** Os itens 3, 4, 8 e 10 são sintomas de
uma base de aprendizado estreita sem circuito de retorno. Resolvê-los juntos elimina
"comentários repetitivos", "muito retail" e "preciso corrigir tudo no ChatGPT" de uma vez.

**2. A planilha revelou que o problema é maior — e a solução, mais próxima.** Comparando
os 14 pares rascunho → publicado, a similaridade é de apenas **5–15%**:

> **O Roi não edita os rascunhos. Ele reescreve do zero.**

Mas a mesma planilha entrega a matéria-prima da correção: **14 pares reais** de
antes/depois e **12 critérios de julgamento** ditos com as palavras dele. É o material
mais eficaz possível para ensinar estilo a um LLM — e já está em mãos.

**Recomendação de sequência:** Fase 1 (qualidade do texto + ingestão da planilha:
2+3+4+6+8+10) → Fase 2 (nutrir a IA: 11+9+7) → Fase 3 (infra: 5+1+12).

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

> **✅ DESBLOQUEADO — planilha recebida e analisada em 28 jul 2026.**
> `docs.google.com/spreadsheets/d/11T29zdJ_ohi6sCLNjYG3cjEtF9TAzJPTfCz-5HoRb4o`

**Estado atual:** 🔴 A resposta honesta continua sendo **não** — a planilha nunca foi
ingerida. Mas ela **não é o que eu supunha** (um arquivo de regras). É muito mais
valiosa: é o **histórico real de produção editorial**, com o rascunho da IA, a versão
publicada e o julgamento do Roi lado a lado.

### O que a planilha contém (mapeado)

| Coluna | Preenchimento | O que é |
|---|---|---|
| `Yedda Post` | 18/38 | Rascunho gerado pela IA (post da empresa) |
| `Roi Post` | 12/38 | Rascunho de post pessoal do Roi |
| `Final Post` | 18/38 | **A versão que realmente foi publicada** |
| `Roi` | 31/38 | Veredito: **23 Yes / 8 No** |
| `Roi's comment` | 21/38 | **O motivo da rejeição, em linguagem natural** |
| `Imige prompt` / `D-AI` | 19/38 | Prompt de imagem e marcação de geração |
| `Gabor` / `Fernando` / `Amir` | poucos | Segunda camada de revisão (outros revisores) |

### 🔴 O achado que muda o diagnóstico

Comparei os 14 pares rascunho → publicado. A similaridade textual é de **5% a 15%**.

> **O Roi não está editando os posts. Ele está reescrevendo do zero.**

Isso reposiciona o item 4: o problema **não é ajuste fino de estilo** — é que o rascunho
não serve como ponto de partida. E explica por que ele recorre ao ChatGPT: é mais rápido
recomeçar do que consertar.

### Os 12 critérios de julgamento do Roi (extraídos textualmente)

Este é o material mais valioso do arquivo — os padrões que hoje só existem na cabeça
dele, agora explícitos:

| Crítica do Roi | Regra que vira |
|---|---|
| *"In Roi's posts should be **less Yedda and more personal** — what do we stand for, people in the company, anecdotes"* | Post pessoal ≠ post de empresa. Proibir pitch nos posts do Roi |
| *"The logo is wrong (bottom left). Once fixed, can be posted"* | **Confirma o item 6** — ver nota abaixo |
| *"Should add logo and change the blue color to **'our blue'**"* | A imagem gerada não está saindo no teal da marca |
| *"Would be better if the image will **add value to the reader** (a quote for example)"* | Imagem deve informar, não decorar |
| *"Will be better if **adding a diagram**"* | Preferência por conteúdo visual explicativo |
| *"Should make the image more interesting, and **add something users can learn**"* | Idem — critério recorrente (3×) |
| *"I don't think enough people will answer the poll (**so it will look lame**)"* | Evitar enquetes de baixo engajamento previsível |
| *"It's **not our core** (video analysis etc.)"* | Guarda de escopo: não posicionar a Yedda como análise de vídeo |
| *"**We run in more countries.** Please check + add the missing countries"* | Fato desatualizado na base — precisa de correção |
| *"It's **not a great post, but ok**…"* / *"It's ok, but nothing great"* | Aprovações mornas: sinal de que o padrão está no limite |
| *"It shows **we care about data security**"* | Tema que ele valoriza — usar mais |

**Plano sugerido (Fase 1 — subiu de prioridade, já não está bloqueado):**
1. **Ingerir a planilha** como base de treino em duas partes:
   - `data/roi-editorial-rules.json` — os 12 critérios acima como regras explícitas.
   - **14 pares rascunho→publicado** como few-shot: *"a IA escreveu X, o Roi publicou Y —
     escreva como Y"*. Pares reais ensinam mais que qualquer descrição de estilo.
2. **Corrigir os fatos:** revisar a lista de países (o Roi apontou que está incompleta) e
   sincronizar com `brand-prompts.json`.
3. **Separar as vozes:** criar um bloco de regras distinto para post pessoal do Roi
   (menos Yedda, mais pessoal/anedota) vs post da empresa — hoje compartilham a mesma base.
4. **Fechar o circuito** com o item 8: as futuras revisões dele alimentam o mesmo formato,
   automaticamente, sem depender de planilha.

**Nota sobre o item 6:** a planilha prova que a reclamação do logo é **real e recorrente**
(2 menções diretas + 4 sobre a cor). Isso muda o veredito do item 6 — ver seção revisada.

**Justificativa:** deixou de ser o item mais bloqueado para ser o de **maior alavancagem
imediata**. Com 14 pares reais + 12 critérios explícitos, o rascunho pode deixar de ser
descartável — que é a única métrica que importa para o Roi.

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

> **⚠️ VEREDITO REVISTO após a planilha (28 jul).** Eu havia classificado como "já
> pronto". A planilha mostra que o Roi rejeitou posts por isso **6 vezes** — logo,
> alguma coisa não está chegando ao resultado final.

**O que o código faz (verificado):**
- `_compositeWithLogo()` desenha o `yedda-logo.png` **no canto inferior esquerdo**
  (padding de 4% da largura, logo a 20% da largura), com transparência preservada.
- O prompt injeta teal `#4BADB8` + laranja `#F07830` e proíbe o modelo de desenhar marcas.

**O que a planilha registra (evidência real de rejeição):**
- *"The logo is wrong (bottom left). Once fixed, can be posted"* — **2×**
- *"Should add logo and change the blue color to **'our blue'** — like in the other
  posts"* — **4×**

**Hipóteses para a divergência (a investigar, nesta ordem):**
1. **O caminho de imagem usado não passa pelo composite.** Existem 3 caminhos de geração
   (Gemini → FLUX → Canvas) e um caminho de prompt manual; se o post foi montado fora do
   fluxo que chama `_compositeWithLogo()`, sai **sem logo** — o que explica *"should add
   logo"*.
2. **O azul do gerador não é o azul da marca.** A crítica *"change the blue to our blue"*
   sugere que o modelo está produzindo um azul genérico em vez do teal `#4BADB8` —
   provável, porque o prompt **pede** a cor mas não há verificação do resultado.
3. **Posição/tamanho divergentes** do que o Roi considera correto.

**Plano sugerido (Fase 1 — reclassificado de "validar" para "corrigir"):**
1. **Sessão de validação com o Roi** (~15 min) com exemplos reais, para identificar qual
   das três hipóteses é a verdadeira — sem isso, corrigir seria adivinhação.
2. Garantir que **todo** caminho de imagem passe pelo composite do logo (fechar a lacuna
   da hipótese 1).
3. Reforçar a direção de cor no prompt e considerar um **pós-processamento** que ajuste a
   dominante para o teal da marca (não depender do modelo acertar a cor sozinho).

**Justificativa:** este é o exemplo mais claro do valor da planilha — sem ela, eu teria
reportado "já está pronto" e o Roi continuaria rejeitando posts pelo mesmo motivo.

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

### Fase 1 — Qualidade do texto + ingestão da planilha (~2,5 sessões)
**Itens 4, 3, 2, 10, 8, 6** — ingerir os 14 pares e os 12 critérios do Roi; remover
categorias + 3 variações + memória anti-repetição; tom mais leve; expansão setorial;
campo de versão revisada; investigar e corrigir o logo/cor.
> Cresceu com a chegada da planilha — e passou a atacar a causa real ("reescrevo do
> zero"), não só os sintomas. **É a fase que muda a percepção do Roi.**
>
> **Sugestão de ordem interna:** começar pelo item 4 (ingestão) — ele melhora a linha de
> base de tudo que vem depois, e os itens 2, 3 e 10 rendem mais em cima de um rascunho
> que já nasce melhor.

### Fase 2 — Nutrir a IA (~2 sessões)
**Itens 11, 9, 7** — apresentações de produto; inteligência de concorrentes; verificação
anti-repetição contra o que já foi publicado.
> **Bloqueio restante: 1 insumo** — as apresentações de POC/produto (item 11).

### Fase 3 — Nova infraestrutura (~3 sessões + decisões)
**Itens 5, 1, 12** — dashboard de interações; produção de vídeo semanal; Salesforce.
> Cada um exige decisões do Roi antes de começar.

---

## O que precisamos do Roi para destravar

| # | Item | O que é necessário |
|---|---|---|
| ~~1~~ | ~~**Planilha editorial** (item 4)~~ | ✅ **RECEBIDA e analisada em 28 jul** |
| 1 | **Apresentações** de POC e produto (item 11) | PDFs/PPTX + o que é confidencial — **agora o único bloqueio da Fase 2** |
| 2 | **Sessão de logo/cor** (item 6) | 15 min com exemplos reais, para achar por que 6 posts foram rejeitados |
| 3 | **Lista de países atualizada** (item 4) | O Roi apontou que a base está incompleta — quais faltam? |
| 4 | **Lista de concorrentes/referências** (item 9) | Quem monitorar |
| 5 | **Salesforce** (item 12) | Existe org? É fonte da verdade ou destino? |
| 6 | **Vídeo** (item 1) | Quem produz? Aceita roteiro+legenda com gravação manual? |

### Perguntas que a planilha abriu

- **Quem são Gabor, Fernando e Amir?** Aparecem como colunas de revisão. Se são
  revisores ativos, o fluxo de aprovação da plataforma deveria contemplá-los (hoje só
  existe "aprovado pelo Roi").
- **A planilha continua sendo usada?** Se sim, vale decidir se ela migra para a
  plataforma ou se as duas coexistem — manter dois lugares de verdade costuma custar caro.

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
