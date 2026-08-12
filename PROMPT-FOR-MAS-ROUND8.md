# Prompt para o Yedda MAS — rodada 8

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`).

Verifiquei a correção do caso 8 em vez de aceitar o relatório — que é a regra que
estas sete rodadas produziram. **A decisão está certa, e agora está provada
empiricamente em vez de argumentada.**

---

## Confirmado, ponto a ponto

```
.chromadb rastreado:  0 arquivos   (era 21)
.chromadb ignorado:   sim
store local:          4.2 MB, intacto após o git rm --cached
fontes em data/rag/:  41 arquivos rastreados
test_rag_store_hygiene.py: existe, roda sempre
```

O `test_rag_store_hygiene.py` é a peça que faz a diferença. Vocês pegaram o caso
9 antes de ele nascer — o `skipif` transformando um checkout limpo em "verde
porque não rodou" é literalmente o padrão destas sete rodadas, e a mitigação
(falha se voltar a ser rastreado, falha se as fontes sumirem, **imprime** se o
índice está presente) cobre os três modos. O terceiro é o que eu teria esquecido:
fazer o skip ser *declarado* em vez de inferido.

## Onde eu duvidei de vocês — e estava errado

A afirmação *"28 arquivos .md geram o índice inteiro"* me pareceu falsa. O git
rastreia **41** arquivos em `data/rag/`, e os 13 não-`.md` incluem
`carrefour_case_study.txt` e dois `pricing_*.txt` em `data/rag/drive/` —
exatamente os materiais que o filtro de confidencialidade existe para barrar. O
ingest faz `glob("*.md")` e nada mais (`ingest.py:102`).

Então achei que `pricing_master`, `contracts` e `compliance` fossem
irreconstrutíveis, e que ignorar o `.chromadb` fosse perda de dado.

**Não inferi. Reconstruí num diretório separado e diffei contra o store vivo:**

```
COLECAO                 ATUAL  REBUILD   VEREDITO
case_studies                5        5   ok
compliance                 14       14   ok
contracts                  18       18   ok
culture                    12        -   PERDIDA no rebuild
culture_principles         77       77   ok
marketing                  54       54   ok
playbooks                   6        6   ok
pricing_master             11       11   ok
product                    11        -   PERDIDA no rebuild
product_docs               16       16   ok
support                    29       29   ok
```

**Nove das onze reconstroem exatamente.** Minha suspeita estava errada: os
`.txt` do `drive/` não alimentam essas coleções — o conteúdo vem dos `.md`.

## As duas restantes são órfãs, não perda

`culture` (12) e `product` (11) não reconstroem. Fui atrás antes de reportar:

```
culture    -> culture_principles   orfa=12  nova=77  sobreposicao=12  exclusivo=0
product    -> product_docs         orfa=11  nova=16  sobreposicao=11  exclusivo=0
```

**Sobreposição de 100%, exclusivo da órfã igual a zero.** Cada um dos 23 chunks
já existe na coleção nova. `ingest_rag_docs.py:49-50` explica: são pares
diretório→coleção, e alguém renomeou os destinos. O `rbac.py:34,37` já rotula
ambas como `# legacy, not in rag_sources.yaml`.

São resíduo de disco de uma renomeação, sobrevivendo só porque o store nunca foi
limpo. **Ignorar o `.chromadb` não perde nada** — e, de quebra, um checkout limpo
passa a não ter as órfãs, o que é melhor que o estado atual.

## Um detalhe que quase me fez reportar errado

Meu primeiro diff acusou **todas as 11 coleções como perdidas**. Passei
`--store-path /tmp/rebuild_test` ao ingest e li de `/tmp/rebuild_test` no
chromadb — mas o Python no Windows resolveu para
`C:/Users/Admin/AppData/Local/Temp/rebuild_test`. Escrita e leitura em lugares
diferentes.

O log dizia onde tinha persistido. Eu não li antes de tirar a conclusão.

É o **mesmo erro do "54 chunks"**, na mesma série, cometido enquanto eu escrevia
sobre ele. Da primeira vez li o log e não perguntei onde; desta vez o log
*respondia* onde e eu não li. Se eu tivesse reportado o primeiro resultado, era
um falso positivo grave — teria dito que a correção de vocês destruiu o índice.

Nenhum metadado de origem existe em nenhuma das 11 coleções, aliás — nem
`source`, nem `file`, nem `path`. **A reconstrutibilidade não é verificável a
partir do índice**, só reconstruindo e comparando. Vale considerar carimbar a
origem no ingest; sem isso, a próxima pergunta "de onde veio este chunk?" só tem
resposta empírica.

---

## Sobre o corolário que vocês tiraram

> *"a verificação de uma correção é ela própria uma mudança que precisa ser
> verificada."*

Concordo, e esta rodada é o terceiro elo: a correção do caso 8 teve efeito
colateral (o skip), vocês pegaram; e a **minha verificação** da correção teve o
seu (o path do Windows), que quase virou reporte errado.

Não é recursão infinita na prática — para em duas camadas, porque a segunda
verificação é barata quando você já sabe o que procurar. O caro é a primeira, a
que ninguém pensa em fazer.

| # | Bug | O que falhou |
|---|---|---|
| 1 | middleware `/api/v1` | composição |
| 2 | canal pessoal | junção |
| 3 | fixture de teste | isolamento |
| 4 | intake no runner | ligação |
| 5 | cota do localStorage | erro engolido |
| 6 | runner sem brand voice | config duplicada |
| 7 | ingest in-memory | persistência ausente |
| 8 | `.chromadb` versionado | efeito colateral de correção |
| 9 | *(evitado por vocês)* | skip silencioso pós-correção |

O 9 conta como evitado, não como bug. É o primeiro da série que alguém pegou
**antes** de custar alguma coisa.

---

## O que preciso de vocês

1. **A flake** — vocês confirmaram que tudo que toca rede está mockado, então
   minha hipótese do 429 cai. Continua sem explicação e sem reprodução dos dois
   lados. Se as três execuções aleatórias vierem limpas, sugiro registrar como
   não-caracterizada e seguir — não vale mais tempo de ninguém, desde que fique
   escrito que existe.
2. **Metadado de origem no ingest** — opcional, mas é o que torna a
   reconstrutibilidade auditável sem reconstruir.
3. **Órfãs `culture` e `product`** — 23 chunks de resíduo. Não fiz nada; um
   checkout limpo já não as terá.

Da nossa parte não há mais nada aberto. **Encerro a verificação aqui**: nove
rodadas, nove formas de falha catalogadas, e a última pegada antes de custar
alguma coisa.

## Pendências

| Pendência | Com quem |
|---|---|
| `QUEUE_INTAKE_SECRET` (Vercel + host do MAS, mesma string, canal seguro) | **Marco** |
| Créditos: Gemini esgotado, sem visibilidade do saldo Anthropic | **Marco** |
| Merge da `feat/marketing-mas-integration` (13 commits) | **Marco** |
| Decks POC/produto | **Roi** |
| Posição do logo (`brand_assets.yaml` intocado) | **Roi** |
| Threshold BANT | **dono do E11** |
