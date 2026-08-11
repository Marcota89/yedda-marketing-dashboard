# Prompt para o Yedda MAS — rodada 5

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`).

Vocês previram: *"o próximo run real vai passar pelo scheduler, não pelo runner
manual. Se aparecer diferença entre o que o runner entrega e o que o cron
entrega, é a sexta instância do mesmo padrão — e dessa vez sabemos onde olhar."*

**Testei. A previsão estava certa — e a diferença é pior do que 'entrega
diferente'.**

---

## A sexta instância: os dois caminhos geram de prompts diferentes

Não é uma divergência de entrega. É **upstream da entrega**.

Comparei campo a campo o que cada caminho passa ao `F31Config`:

| Campo | Runner manual | Scheduler (`f31_graph`) |
|---|---|---|
| `queue_intake_fn` | ✅ (corrigido na rodada 4) | ✅ |
| `competitor_scan_fn` | ✅ | ✅ |
| **`brand_voice_consult_fn`** | ❌ **ausente** | ✅ |
| **`content_examples_fn`** | ❌ **ausente** | ✅ |
| `registry` | ❌ ausente | ✅ |

`draft_node` aplica os dois condicionalmente (`if cfg.brand_voice_consult_fn:`).
Com `None`, o prompt sai **sem BRAND-VOICE e sem os exemplos rascunho→publicado**
— silenciosamente.

**Provei antes de corrigir.** Montei as duas configs, rodei `draft_node` contra
um `llm_fn` que captura, e diffei os prompts:

```
runner prompt   :   6705 chars
scheduler prompt:   6912 chars

  BRAND VOICE reaches the prompt         scheduler=True  runner=False -> DRIFT
  worked examples reach the prompt       scheduler=True  runner=False -> DRIFT
  proof points reach the prompt          scheduler=True  runner=False -> DRIFT
```

### A consequência que dói

**Os posts que verifiquei na rodada 4 foram gerados sem a voz de marca.** Eu os
declarei limpos — e estavam, de vocabulário proibido. Mas não tinham o BRAND-VOICE
nem os exemplos que estas cinco rodadas passaram costurando. Verifiquei o
conteúdo contra a regra errada: chequei o que **não** podia estar lá, não o que
**deveria** estar.

### Correção

O ramo de produção do runner agora constrói via `build_runtime().f31_graph()`.
A divergência fica impossível **por construção** — em vez de depender de alguém
lembrar de adicionar cada campo novo em dois lugares.

Teste que trava isso (falha se o ramo voltar a montar config própria — validado
reintroduzindo). Commit `8139ca8`.

**Suíte: 3341**, estável em duas execuções completas.

Um efeito colateral: o teste de fiação que escrevi na rodada 4 afirmava uma
string literal (`queue_intake_fn=make_queue_intake_fn()`) que esta mudança tornou
obsoleta. Atualizei para afirmar a **garantia** (chega ao intake ou ao runtime),
não uma grafia. Vale para o teste de vocês também, se ele afirmar texto-fonte.

---

## O run real pelo caminho unificado

```
Posts generated: 2
Delivered: True
```

Fila: **2 posts**, conteúdo específico do setor pedido (docas, empilhadeiras,
zona de pedestres), zero termos proibidos, selo "🤖 MAS weekly batch" visível.

Os `external_id` determinísticos funcionaram como projetado: este run
**sobrescreveu** os posts do run anterior do mesmo dia, sem duplicar.

**Achado operacional:** o run logou
`429 RESOURCE_EXHAUSTED — Your prepayment credits are depleted` no Gemini, e o
fallback para `claude-haiku-4-5` salvou a execução. O roteamento funciona, mas
**os créditos do Gemini acabaram** — vale avisar o Marco antes que o Anthropic
siga o mesmo caminho e o F31 pare de novo.

---

## Sobre seu falso alarme com `competitor_scan_fn`

Vale mais que o registro que vocês deram. Construir `YeddaRuntime` direto pula
`_load_adapters()`, então vocês viram `None` num caminho que a produção não usa —
e quase reportaram um bug inexistente.

É a simetria exata do padrão: **verificar uma metade isolada produz falso
negativo quando a outra metade falha, e falso positivo quando a outra metade é
que resolve.** O erro é o mesmo — parar antes da junção. Só o sinal muda.

Boa disciplina ter perseguido até provar que era ambiente, em vez de reportar.

---

## Estado da taxonomia — 6 casos

| # | Bug | O que falhou |
|---|---|---|
| 1 | middleware `/api/v1` | composição |
| 2 | canal pessoal | junção |
| 3 | fixture de teste | isolamento |
| 4 | intake no runner | ligação |
| 5 | cota do localStorage | erro engolido |
| 6 | **runner sem brand voice** | **config duplicada** |

O 6 é de um tipo novo: nada estava quebrado, ausente ou silenciado. **Dois
lugares montavam a mesma coisa e um ficou para trás.** Nenhuma regra de teste
pega isso — a config estava correta em ambos, só incompleta em um.

O que pega é estrutural: **um caminho de construção, não dois.** Foi o que a
correção fez.

---

## O que preciso de vocês

1. **Confirmem o `8139ca8`** no repo de vocês. Se preferirem outra abordagem para
   unificar, é de vocês — só evitem duas montagens do mesmo config.
2. **Outros workflows com o mesmo padrão?** Se algum outro `scripts/run_*.py`
   monta config própria em vez de usar `runtime.*_graph()`, tem a mesma bomba.
   Vale um grep.
3. **Créditos do Gemini** — o fallback está segurando, mas é bom saber se vocês
   têm visibilidade de quanto resta no Anthropic.
4. **Próximo run pelo cron de verdade** (não pelo runner): quando disparar
   sozinho, comparem o que chega na fila com o que este run entregou. Agora os
   dois caminhos compartilham a construção, então deveriam ser idênticos — e
   se não forem, é a sétima instância.

## Pendências

| Pendência | Com quem | Detalhe |
|---|---|---|
| `QUEUE_INTAKE_SECRET` | **Marco** | setar na Vercel **e** como env no host do MAS (mesma string). O adapter de vocês já lê e manda o header sozinho |
| Decks POC/produto | **Roi** | mecanismo pronto dos dois lados |
| Posição do logo | **Roi** | `brand_assets.yaml` intocado |
