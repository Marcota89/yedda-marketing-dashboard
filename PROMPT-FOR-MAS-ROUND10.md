# Prompt para o Yedda MAS — rodada 10

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`).

O ciclo de nove rodadas fechou e o PR #10 está mergeado. Esta rodada não abre
bug novo — **avisa de um acoplamento que criei entre os dois repositórios**, e
que hoje só existe do meu lado.

---

## O que construí: um espelho na nuvem

Descobri um problema que as nove rodadas não tinham tocado: **tudo que
construímos era servido por um MAS que roda numa máquina só.** O Marco tem o
MAS em `localhost:8000`; o Roi (CEO) abre a mesma URL da plataforma e recebia
silenciosamente os fallbacks offline — vocabulário local em vez dos 47 termos,
lista de setores fixa em vez das 6 verticais, e **zero exemplos few-shot**.

Mesma página, produto diferente. E as revisões do Roi — os únicos exemplos da
voz pessoal dele que existem — eram **descartadas**: a UI dizia literalmente
*"this example was not saved"* quando o MAS não respondia.

A solução, toda do lado da plataforma:

- **`api/mas-mirror.js`** — serve os assets do MAS a partir do Supabase e aceita
  revisões de qualquer máquina. Leituras abertas; `sync`/`consume` reusam o
  `QUEUE_INTAKE_SECRET`.
- **`scripts/sync_mas_mirror.py`** — empurra os assets para o espelho e puxa de
  volta o que foi salvo enquanto o MAS estava fora. Tarefa agendada a cada 30 min.
- **`index.html`** — leituras caem no espelho quando o MAS local não responde;
  escritas de revisão vão para a fila da nuvem.

Verificado ponta a ponta: revisão POSTada como Roi (sem MAS local) → apareceu
como pendente → o sync importou → **stats 18 → 19**, canal pessoal 4 → 5.

## O acoplamento que precisa do aviso de vocês

O `sync_mas_mirror.py` faz isto:

```python
sys.path.insert(0, str(MAS_ROOT / "src"))
from yedda_mas.memory.content_pairs import ContentPairStore
store = ContentPairStore(path=MAS_ROOT / "data" / "content_pairs.jsonl")
store.record(pair_id=..., channel=..., draft=..., published=..., note=...)
```

**A plataforma agora depende da assinatura de `ContentPairStore.record()` e do
construtor aceitar `path=`.** Nada no repo de vocês registra isso — um `git grep`
por `mas-mirror` ou `sync_mas_mirror` no `yedda-mas-step1` não retorna nada.

Se alguém renomear `record()`, mudar a ordem dos parâmetros ou trocar o formato
do `.jsonl`, o sync quebra — e quebra **do jeito ruim**: o script já trata
exceção por par, então imprimiria `[skip]` e seguiria. Revisões do Roi
acumulariam na fila da nuvem sem nunca chegar ao MAS, e ninguém veria.

É a **oitava forma de falha do catálogo aplicada entre repositórios**: cada lado
verifica até a própria borda. A borda agora é uma import statement que atravessa
projetos.

**O que peço:** um teste no lado de vocês que trave o contrato — algo como
`test_content_pairs_public_api.py` afirmando que `record()` aceita
`(pair_id, channel, draft, published, *, author, note)` e que o construtor aceita
`path=`. Se preferirem outra forma, é de vocês; o que não dá é ficar sem sinal
nenhum.

## Duas armadilhas que peguei construindo — as duas do catálogo

**Bug 5 outra vez.** `ContentPairStore.record()` retorna `False` (nunca lança)
quando a revisão é curta demais. Minha primeira versão marcava como *consumida*
uma revisão que o MAS tinha recusado — o sinal de aprendizado sumia entre os dois
sistemas, com log de sucesso dos dois lados. Agora só consome no `True`, e as
recusadas ficam pendentes para a próxima tentativa.

**Bug 7 verbatim.** `ContentPairStore` usa `Path("data")` relativo ao
**diretório de execução**. Rodando o sync a partir do repo da plataforma, os
pares caíam em `Marketing agent/data/content_pairs.jsonl` — onde o MAS nunca lê.
O script imprimiu `imported and consumed 1 revision`, o `/stats` continuou em
**18**, e a revisão já estava marcada como entregue.

Só apareceu porque conferi o número em vez de aceitar o "ok". Se eu tivesse
parado no exit code, teria declarado o ciclo fechado com ele quebrado.

> Vale considerar do lado de vocês: um default relativo ao cwd é a mesma
> armadilha do `--store-path` in-memory que vocês corrigiram na rodada 6.
> `ContentPairStore` sem `path=` explícito grava em lugar diferente conforme
> quem chama.

## Um achado operacional

O `data/content_pairs.jsonl` **não estava versionado** no repo de vocês — e já
tinha se perdido uma vez: um `git stash` de contorno o capturou como
não-rastreado, e o `/examples` passou a servir vazio sem nada acusar. Recuperei
do stash e versionei (commit `bb8038a`), junto com um `start-dashboard.bat`.

Sete dos dez `.jsonl` de `data/` já eram versionados — este era o único cujo
sumiço degrada a geração em silêncio.

---

## Estado geral: tudo técnico fechado

| Item | Estado |
|---|---|
| PR #10 (integração) | ✅ mergeado — `08d449ae` |
| PR #11 (dívida de CI) | ✅ mergeado — `ce4d8958`, **CI 100% verde na main** |
| `QUEUE_INTAKE_SECRET` | ✅ MAS + Vercel, validação testada (401/401/400) |
| Créditos Gemini | ✅ renovados, testados com chamada real |
| Espelho na nuvem + sync a cada 30 min | ✅ verificado ponta a ponta |

**Pendências que sobram, nenhuma técnica:**

| Pendência | Com quem |
|---|---|
| Contrato do `ContentPairStore` (o pedido acima) | **vocês** |
| Decks POC/produto | Roi |
| Posição do logo (`brand_assets.yaml` intocado) | Roi |
| Threshold BANT (runner 6 vs produção 7) | dono do E11 |

Da minha parte não há mais nada aberto.
