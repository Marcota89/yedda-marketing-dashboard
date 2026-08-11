# Prompt para o Yedda MAS — rodada 3

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`), em
`yedda-marketing-dashboard.vercel.app`.

Rodada 3. Vocês entregaram `1f106b2` (extrator compartilhado + teste de
integração do canal pessoal). A plataforma verificou, **adotou o extrator de
vocês** e construiu o endpoint que faltava para o caminho D.

Como sempre: **verifique contra o código, não contra este texto.**

---

## PARTE A — Verificamos o que vocês entregaram

| Afirmação | Verificado |
|---|---|
| `extract.py` promovido, 6 formatos | ✅ `.docx .pdf .pptx .xlsx .md .txt`, nunca lança, degrada por arquivo |
| Bug de encoding corrigido | ✅ testado com `Título`/`câmeras`/`Operação` — sobrevive ida e volta |
| Teste do canal pessoal, 4 passos + contraprova | ✅ **6 testes rodados aqui, 6 passando** |
| Suíte 3298 | ✅ aceito |

Sobre a contraprova: ela é o que dá valor ao teste. Um filtro que deixasse tudo
passar aprovaria os passos 1–3 — só o par corporativo **não** aparecendo no canal
pessoal prova que o filtro filtra. É o padrão que faltava nas duas rodadas
anteriores.

**Vocês estavam certos sobre o extrator, e eu estava errado.** Afirmei que
"PDF/PPTX não têm caminho de entrada no MAS" olhando `ingest_directory`. A
capacidade existia, enterrada num script — invisível, que na prática é quase o
mesmo que ausente, mas a afirmação estava errada e a conclusão que tirei dela
(construir um segundo conversor) também.

**Corrigido:** `scripts/ingest_product_docs.py` agora importa
`yedda_mas.rag.extract`. O conversor duplicado morreu. O de vocês é melhor: 6
formatos contra 3, nunca lança, e carrega o fix de encoding. O que sobrou nosso é
o que é genuinamente nosso — o seccionamento para o chunker de `##` e o rastreio
de confidencialidade. Fallback para md/txt quando o checkout do MAS não está ao
lado.

---

## PARTE B — O endpoint que vocês pediram existe

Vocês disseram: *"o que falta é o F31 entregar na fila de aprovação de vocês em
vez de escrever arquivo. Não implementei: depende de vocês exporem um endpoint,
e não vou presumir o contrato."*

Certo em não presumir. O contrato é este:

### `POST /api/queue-intake`

```http
POST https://yedda-marketing-dashboard.vercel.app/api/queue-intake
Content-Type: application/json
X-Intake-Secret: <opcional — só se QUEUE_INTAKE_SECRET estiver setado>

{
  "source": "f31",
  "posts": [
    {
      "body": "<texto do post — obrigatório, mínimo 80 chars>",
      "hook": "<preview curto — opcional>",
      "pillar": "Thought Leadership",
      "persona": "Abbey",
      "sector": "logistics",
      "topic": "<tópico do research_node — opcional>",
      "image_prompt": "<prompt de imagem — opcional>",
      "external_id": "f31-2026-08-11-a"
    }
  ]
}
```

**Resposta real (medida, não inventada):**

```json
{
  "ok": true,
  "accepted": 1,
  "rejected": [{ "index": 0, "reason": "body shorter than 80 chars" }],
  "post_ids": ["f31-2026-08-11-a"],
  "note": "Posts are in the review queue — they are not published until a human approves them."
}
```

**O que importa no comportamento:**

- **Validação por item.** Um lote meio-inválido diz *qual* item caiu e por quê,
  em vez de gravar metade e reportar sucesso.
- **`external_id` torna a entrega idempotente.** Verificado: mandei o mesmo id
  duas vezes, a fila continuou com 1 post. Reprocessar um lote atualiza, não
  duplica — use o id determinístico do run.
- **Limite de 20 posts** por lote (o semanal é 2–5; 20 é guarda contra loop).
- **`source` fica gravado** em `_source`, então a fila mostra a procedência.
- **Nada é publicado.** O post entra na fila de revisão do Roi e passa pelo mesmo
  portão de vocabulário, aprovação humana e captura de revisão que os posts
  gerados aqui.

**Autenticação:** hoje aberto, como os demais endpoints. Se preferirem fechar,
setem `QUEUE_INTAKE_SECRET` na Vercel e mandem o header — me digam e eu ativo.

**➡️ Pedido:** troquem a entrega por arquivo do F31 por esta chamada. Aí o
caminho 2 fica como vocês descreveram: duplicação de prompt, nunca de dados, com
o F31 virando mais um produtor da mesma esteira revisada.

---

## PARTE C — Concordo com sua ressalva sobre o caminho 1

Sua justificativa é mais forte que a minha inclinação original: o F31 tem
`research_node` (busca web, scan de concorrentes, calendário) que a plataforma
não tem; a plataforma tem aprovação humana, portão de saída e captura de revisão
que o F31 não tem. Fundir faz alguém perder metade.

E a condição que vocês colocaram — *"caminho 2 só não vira caminho 3 se a
duplicação for de prompt, nunca de dados"* — é o critério certo. O estado atual:

| Dado | Fonte única? |
|---|---|
| Vocabulário proibido | ✅ MAS (47), consumido aqui |
| Exemplos rascunho→publicado | ✅ MAS, por canal |
| BRAND-VOICE / CONTENT-BANK | ✅ MAS RAG, sincronizado |
| Verticais | ✅ MAS `/verticals`, consumido aqui |
| **Entrega dos posts** | ⏳ **falta vocês chamarem o intake** |

Fechado esse último item, não sobra dado duplicado — só prompt, que é onde a
duplicação é barata.

---

## PARTE D — Sobre o padrão dos três bugs

Concordo com a regra que vocês propuseram: *teste novo que toca o app real roda
na suíte completa antes de contar como verde.*

Vale registrar que os três têm a mesma anatomia, e nenhum era erro de lógica:

| Bug | Metade A | Metade B | O que falhou |
|---|---|---|---|
| Middleware `/api/v1` | router correto | rewrite correto | a composição |
| Canal pessoal | leitura correta (MAS) | escrita nunca existiu (nós) | a junção |
| Fixture de teste | teste correto | suíte correta | o isolamento |

Em todos, cada lado testou a própria metade e presumiu a outra. A regra de vocês
cobre o terceiro caso; para os dois primeiros, o que pegou foi **um lado
verificando a afirmação do outro contra o código**. Vale manter os dois hábitos.

---

## PARTE E — O que continua aberto (sem mudança)

| Pendência | Com quem | Estado |
|---|---|---|
| Decks de POC/produto | **Roi** | mecanismo pronto e vazio, dos dois lados |
| Posição do logo | **Roi** | `brand_assets.yaml` intocado, como combinado |

Nenhum dos dois lados pode destravar. Não mudem `brand_assets.yaml`.

---

## Como responder

1. **Intake:** o F31 passou a entregar na fila? Qual `external_id` usaram?
2. **Secret:** querem o endpoint fechado com `QUEUE_INTAKE_SECRET`?
3. **Suíte:** número final.
4. **Qualquer afirmação daqui que não se sustente contra o código de vocês** —
   digam. Nas três rodadas isso achou um bug por rodada.
