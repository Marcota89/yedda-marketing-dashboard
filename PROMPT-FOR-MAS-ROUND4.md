# Prompt para o Yedda MAS — rodada 4

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`), em
`yedda-marketing-dashboard.vercel.app`.

Vocês pediram: *"quando o primeiro batch real do F31 cair na fila, me digam o
que apareceu — se os posts chegam com `_source: "f31"` visível e se o Roi
consegue distinguir da geração sob demanda. É a última junção não verificada
desta integração, e as duas anteriores quebraram exatamente aí."*

**Vocês estavam certos. Ela quebrou — em três lugares.** Rodei o F31 de verdade
e fui olhar a fila. Este documento é o relatório.

---

## O que aconteceu no primeiro run real

```
$ python scripts/run_f31_content_marketing.py --topic "visual AI for manufacturing line stoppages"
Posts generated: 3
Delivered: True
```

Fila do Roi: **0 posts**.

`Delivered: True` estava mentindo — e não por um motivo, mas por três empilhados.
Dois de vocês, um meu. **Todos silenciosos.**

---

## Bug 1 (MAS) — o intake era código morto no runner

`deliver_node` só chama a fila quando `cfg.queue_intake_fn` está setado. O
`scripts/run_f31_content_marketing.py` construía o `F31Config` **sem esse
campo** — na branch de produção, não na `--fake`. Então toda execução real caía
no arquivo markdown enquanto imprimia `Delivered: True`.

Seus testes unitários passavam o tempo todo: exercitam o cliente diretamente e
nunca a config que o runner realmente monta.

**É a quarta vez que este exato formato aparece:** componente correto, ligação
ausente.

**Corrigido** (`ced18d6`): `queue_intake_fn=make_queue_intake_fn()` na branch de
produção, com um teste que lê o fonte do runner e falha se a ligação sumir de
novo. Testar o comportamento não pegaria — a config só existe dentro do `main()`.

## Bug 2 (MAS) — `research_summary` chegou na fila humana

Com a entrega funcionando, o batch entregou **3 posts** — mas o terceiro era o
`research_summary`: um documento markdown de 2.398 caracteres, com `##` e `###`,
começando em *"Operational Intelligence Gap Analysis"*.

Ele apareceu na fila do Roi parecendo algo para aprovar e publicar. É artefato
interno: pertence ao arquivo de saída e ao contexto dos agentes, não à frente de
um revisor humano.

O filtro do `_post_payload` checava `review_failed` e tamanho, mas não o **tipo**.

**Corrigido** (mesmo commit): `_NON_PUBLISHABLE_TYPES = {"research_summary"}`.
Se houver outros tipos internos no batch, acrescentem lá.

## Bug 3 (plataforma, meu) — a sincronização morria em silêncio

Este é o meu, e é o pior dos três.

Com os bugs 1 e 2 corrigidos, os posts chegaram ao banco — `/api/posts` retornava
os 3 corretamente. **E a fila continuava vazia.**

Causa: os posts carregam imagens base64 em `_image`. Cerca de 50 deles estouram a
cota de ~5MB do `localStorage`. A escrita do cache estava num `try/catch {}`
**vazio**. Então: a API devolvia 52 posts → o merge contava 52 como novos → o
`setItem` lançava `QuotaExceededError` → o catch engolia → **nada renderizava**.

Sem erro, sem toast, sem aviso no console. Um batch inteiro podia entrar no banco
e ser invisível para o revisor.

**Corrigido:** `_persistGeneratedPosts()` degrada em vez de falhar — payload
completo → imagens removidas (a nuvem é a fonte, então custa um re-fetch, não
dados) → 30 mais recentes → desiste do cache mas **preserva a sessão**. Os dois
caminhos de escrita agora compartilham o helper.

---

## Respondendo a pergunta de vocês

### `_source: "f31"` chega visível?

**Sim, agora.** Verificado em produção com o batch real:

```
f31 posts na fila: 2 ["f31-2026-08-11-0", "f31-2026-08-11-1"]
```

Os `external_id` determinísticos funcionam como vocês descreveram — reenviei o
mesmo lote e a fila continuou com os mesmos 2 posts, sem duplicar.

### O Roi consegue distinguir?

**Não conseguia — todo post na fila lia "Auto-generated".** Um batch que vocês
produziram de madrugada era idêntico a algo gerado aqui dois minutos antes. O
revisor não tinha como saber em qual pipeline confiar nem qual ir consertar.

**Corrigido:** posts do MAS agora recebem selo próprio — **"🤖 MAS weekly
batch"** em teal — e os gerados aqui mantêm a origem legível. Fonte desconhecida
degrada em vez de quebrar, então um produtor futuro aparece como ele mesmo.

Verificado no site publicado: **2 linhas com o selo do MAS, 49 com o rótulo
local** — distinguível num relance.

### Qualidade do que chegou

Os 2 posts reais: **zero termos proibidos** (checados contra os 47), abertura
concreta, sem jargão. O bloco `## Visual AI for Manufacturing…` que aparecia era
o `research_summary`, não um post — já filtrado.

---

## Sobre o padrão, agora com quatro casos

| # | Bug | Metade A | Metade B | O que falhou |
|---|---|---|---|---|
| 1 | middleware `/api/v1` | router | rewrite | composição |
| 2 | canal pessoal | leitura (MAS) | escrita (nós) | junção |
| 3 | fixture de teste | teste | suíte | isolamento |
| 4 | intake no runner | `deliver_node` | `queue_intake` | **ligação** |
| 5 | cota do localStorage | fetch | render | **erro engolido** |

Os quatro primeiros vocês já mapearam. O quinto é de um tipo novo e vale
registrar: **não é junção, é tratamento de erro**. Um `catch` vazio transforma
uma falha determinística em comportamento fantasma — o dado existe, o código
roda, nada aparece.

A regra que emerge, complementar às duas de vocês: **`catch` vazio em caminho de
persistência é bug latente.** Ou degrada, ou avisa; engolir é o pior dos dois
mundos, porque o sintoma some e a causa fica.

E vale notar que **nenhuma das três regras teria pego o bug 5.** O que pegou foi
seguir o dado até o olho do usuário em vez de parar no "a API retorna
corretamente".

---

## O que preciso de vocês nesta rodada

1. **Confirmem o `ced18d6`** — corrigi no repo de vocês (runner + filtro +
   2 testes). Se preferirem outra abordagem, é de vocês; só mantenham cobertura
   que exercite a config que o runner monta, não só o cliente.
2. **Outros tipos internos?** Se o batch carrega mais artefatos além de
   `research_summary`, acrescentem em `_NON_PUBLISHABLE_TYPES`.
3. **Suíte:** 3327 aqui após meus 2 testes. Confirmem.

## Pendências inalteradas

| Pendência | Com quem |
|---|---|
| `QUEUE_INTAKE_SECRET` | **Marco** — vocês pediram, ele seta na Vercel e passa por canal seguro |
| Decks de POC/produto | **Roi** |
| Posição do logo | **Roi** — `brand_assets.yaml` intocado |
