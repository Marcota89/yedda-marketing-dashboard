# Prompt para o Yedda MAS — rodada 2

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`), publicada em
`yedda-marketing-dashboard.vercel.app`.

Esta é a **rodada 2**. Na rodada 1 vocês entregaram 9 mudanças, a plataforma
verificou cada uma, achou um bug bloqueante de roteamento (corrigido em
`def1950`) e construiu o lado dela. Vocês responderam com `011c0ef`: endpoint de
verticais, vocabulário unificado em 47 termos, canal pessoal no F31 e RBAC do
`product_docs`.

Este documento fecha o ciclo: **o que a plataforma verificou do lado de vocês**,
**o que corrigimos aqui depois da pergunta de vocês**, e **o que continua
aberto**.

Como sempre: **não confie neste documento — verifique contra o código.** Foi
assim que os dois bugs desta integração apareceram, um de cada lado.

---

## PARTE A — Verificamos as 6 afirmações de vocês

Tudo confirmado contra os endpoints reais, com o servidor reiniciado e
`__pycache__` limpo (a primeira tentativa deu 404 porque o processo rodava
código anterior ao commit — vale o aviso).

| # | Afirmação | Verificado |
|---|---|---|
| 1 | Suíte 3275 | ✅ aceito como baseline |
| 2 | `GET /verticals` → 6 verticais | ✅ 6, com `key`, `label`, `summary`, `has_icp_config` |
| 3 | Vocabulário = união (47) | ✅ **47 termos, os nossos 12 presentes** |
| 4 | Canal pessoal no F31 | ✅ aceito (verificação real é de vocês) |
| 5 | `product_docs` concedido aos 5 agentes | ✅ aceito |
| 6 | `competitor_insights` + `short_form` | ✅ aceito (idem) |

**Correção que aceito de vocês:** eu afirmei que a coleção `product` precisava de
dois passos (mapear + conceder). Precisava de **um** — já estava mapeada como
`("product", "product_docs")`. Afirmei sem verificar; vocês checaram. Registrado.

**Concordo sobre `artificial intelligence`:** o BRAND-VOICE manda dizer "Visual
AI" e nunca o genérico. Proibir era o alinhamento correto.

---

## PARTE B — A pergunta de vocês tinha uma resposta pior que "não"

Vocês perguntaram: *"confirmem que a plataforma passa `channel:
'linkedin_post_personal'` quando o Roi gera para o perfil dele"*.

**Não passávamos. E o problema era maior que uma flag faltando.**

Dois gaps, ambos corrigidos e em produção (commit `9c36772`):

1. **`saveRevision` gravava `channel: 'linkedin_post'` fixo.** Uma reescrita de
   voz pessoal era arquivada como texto corporativo.

2. **O gerador de posts do Roi não tinha captura de revisão nenhuma.** Este é o
   grave: pedíamos exemplos de `linkedin_post_personal` sem **nunca escrever um
   único par nesse canal**. O corpus pessoal estava condenado aos 4 pares
   semeados para sempre — o loop de aprendizado da voz dele não existia.

**O que mudou:** `_channelForPost()` roteia empresa vs. pessoal, e o gerador do
Roi ganhou captura própria que envia `channel: "linkedin_post_personal"`. Um
detalhe que importa: o rascunho é **fotografado no momento da geração**, não lido
da textarea — ele edita no lugar, e sem isso o par compararia a versão editada
com ela mesma.

**Também consumimos `/verticals`:** a lista espelhada à mão morreu. O seletor se
reconstrói da taxonomia viva, então **uma vertical nova de vocês aparece sem
release da plataforma** (testado com um setor fictício). E o `summary` de vocês
chega ao prompt — o contexto regulatório real (ANTT, CT-e, ISO 28000) é melhor
que os hooks que eu tinha escrito à mão.

Verificação: **30 checks E2E** (subiu de 21).

---

## PARTE C — O que ainda depende de vocês

### C1 — Confirmem o outro lado do canal pessoal

Nós agora **escrevemos** em `linkedin_post_personal`. Vocês disseram que o F31
agora **lê** por canal. Falta a prova de que as duas metades se encontram — que é
exatamente o tipo de coisa que passou despercebida nas duas rodadas.

**Peço um teste de integração real**, não unitário:
1. `POST /revision` com `channel: "linkedin_post_personal"`.
2. `GET /examples?channel=linkedin_post_personal` — o par aparece?
3. Rode o F31 no modo pessoal e confirme que o bloco injetado veio **desse**
   canal, não do corporativo.
4. Confirme que os proof points **não** aparecem no post pessoal (vocês
   disseram que são retirados — vale ver na saída real).

Se os 4 passos passarem, o loop está fechado dos dois lados e podemos parar de
verificar isso.

### C2 — `product_docs` está pronto mas vazio

O mecanismo de entrada existe agora do nosso lado:
`scripts/ingest_product_docs.py` converte PDF/PPTX → markdown estruturado por
heading e **rastreia confidencialidade antes de escrever** (nomes de cliente,
tabelas de preço, linguagem de contrato, CPF, credenciais). Testado: um deck com
"Carrefour" + preços foi recusado com os marcadores nomeados; o limpo passou.

**Descoberta que vale para vocês:** `ingest_directory` faz glob de `*.md`
apenas. PDF e PPTX **não têm caminho de entrada no MAS**. Se quiserem que decks
entrem direto por aí no futuro, é um ingester novo em
`src/yedda_mas/rag/ingesters/`.

Bloqueio real: **os arquivos do Roi**. Nenhum dos dois lados pode destravar.

### C3 — Conflito do logo: continua parado, de propósito

- **MAS** (`config/brand_assets.yaml`): *"Always top-left"*
- **Plataforma**: base-esquerda, nos 3 caminhos de imagem (verificado — nenhum
  escapa do composite)
- **Teal `#4BADB8`**: idêntico nos dois lados (hipótese de divergência de cor
  descartada)

A anotação do Roi — *"the logo is wrong (bottom left)"* — **admite as duas
leituras**. Documentado em `DECISION-LOGO-POSITION.md`. **Não mudem
`brand_assets.yaml` até ele decidir**; um de nós vai ter que mudar, e adivinhar
agora custa retrabalho dos dois lados.

---

## PARTE D — Uma pergunta de arquitetura

Com o loop fechado, aparece uma sobreposição que vale decidir antes que vire
dívida:

**O F31 e o gerador da plataforma agora fazem a mesma coisa** — ambos leem
BRAND-VOICE, injetam os mesmos exemplos, aplicam o mesmo vocabulário e geram
post de LinkedIn. A diferença é que a plataforma tem aprovação humana, portão de
saída e captura de revisão; o F31 roda semanalmente sozinho.

Três caminhos:
1. **F31 vira o gerador, plataforma vira a interface** — a plataforma chama o
   F31 em vez de ter prompt próprio. Uma implementação, uma voz.
2. **Divisão por finalidade** — F31 para o lote semanal automático, plataforma
   para o sob demanda com revisão. Aceita a duplicação conscientemente.
3. **Status quo** — os dois evoluem separados. É o que produz drift (foi assim
   que "52% vs 54%" e as duas listas de vocabulário nasceram).

Minha inclinação é a **2**, com o F31 alimentando a fila de aprovação da
plataforma em vez de entregar por arquivo — mas a decisão envolve o roadmap de
vocês. Qual faz sentido?

---

## Como responder

1. **C1:** os 4 passos do teste de integração passaram?
2. **C2:** vão criar ingester de PDF/PPTX no MAS, ou a conversão continua deste lado?
3. **D:** qual dos três caminhos?
4. **Suíte:** número final.
5. **Qualquer afirmação deste documento que não se sustente contra o código de
   vocês** — digam. Nas duas rodadas, cada lado achou um bug do outro exatamente
   assim.
