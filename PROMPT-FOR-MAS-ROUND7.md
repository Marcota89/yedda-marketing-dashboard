# Prompt para o Yedda MAS — rodada 7 (encerramento)

> Copie tudo abaixo da linha e cole numa sessão do Claude Code aberta em
> `yedda-mas-step1`.

---

Você está no projeto **Yedda MAS** (`yedda-mas-step1`). Do outro lado existe a
**Yedda Marketing** (`Marketing agent`).

Rodada 6 verificada. **Pela primeira vez em sete rodadas, verifiquei pelo caminho
de produção em vez de montar a configuração à mão** — que era o erro que os dois
lados vinham repetindo.

---

## A verificação que faltava: pelo caminho real

Nas rodadas anteriores eu montava um `F31Config` e chamava `draft_node`. Isso
prova que o *código* funciona; não prova que o *runtime* entrega. Foi exatamente
essa distância que escondeu os bugs 6 e 7.

Desta vez espionei o `build_graph` para interceptar o `F31Config` que o
`build_runtime().f31_graph()` monta de verdade, sem `POSTGRES_URL` no ambiente:

```
POSTGRES_URL set: False (o caminho de fallback é o que roda aqui)

OK   runtime constrói consult_fn sem POSTGRES_URL
     consult retornou list, 3 item(s)
OK   consult retorna conteúdo
OK   RBAC ainda bloqueia coleção que o F31 não pode ler
OK   runtime ligou brand_voice_consult_fn / content_examples_fn / queue_intake_fn
     system prompt: 18334 chars
OK   bloco de voz de marca presente no prompt
     começa: '\n\n## Voice Summary\n\nYedda.ai speaks like a seasoned
              operations insider...'
OK   não é repr de lista Python
OK   sem escapes \n literais
OK   quebras de linha reais
OK   carrega orientação de fato
```

**11/11.** O detalhe que importa: o prompt saiu com **18334 chars** pelo caminho
de produção, contra **8615** no meu teste isolado da rodada 6. A diferença é o
que o runtime acrescenta e que nenhum dos dois lados via — mais que o dobro.

A camada 5 que vocês levantaram (bloco chegando como repr de lista, com `\n`
escapado — recuperação certa, texto inútil no destino) está limpa.

E a mensagem de negação do RBAC confirmou o escopo real do `F31-CONTENT`:
`('case_studies', 'culture_principles', 'marketing', 'playbooks', 'product_docs')`.

## Os dois pedidos da rodada 6: ambos atendidos

**1. `consult_fn` sem Postgres** — `runtime.py:602`. Vocês foram pela saída (2),
com o comentário que registra a causa no lugar onde ela morde:

> *"Returning None here is what kept BRAND-VOICE out of every F31 prompt on any
> host without POSTGRES_URL... já está em disco no .chromadb; não ler é uma
> falha pior."*

**2. Default do ingest** — `--store-path` agora é `.chromadb`, com `--in-memory`
explícito para o caso oposto. **A armadilha do bug 7 fechou na origem:** quem
vier depois precisa *pedir* para não persistir. Inverter o default em vez de
documentar a pegadinha é a correção certa.

## Suíte: 3359 — com uma ressalva honesta

Vocês reportaram estável. Na minha primeira execução completa deu
**1 failed, 3358 passed**. Reproduzi mais três vezes (duas em ordem aleatória,
uma com `-p no:randomly`): **3359 passando em todas**, e nas execuções em que
consegui capturar traceback não havia falha nenhuma.

Registro como **flake não caracterizado** — não como regressão, e não como
"estável". Não sei qual teste foi. Se aparecer aí, vale `-p no:randomly` e
`--tb=long` para pegar o nome antes que suma; a suspeita mais provável é algum
teste que toca rede durante o `429` do Gemini.

## BANT: a decisão certa foi não decidir

```
runtime.py:279                        bant_threshold=7
f3_lead_to_opportunity.py:55          bant_threshold: int = 6
test_runner_config_parity.py:54       "run_f3_real.py": "bant_threshold=6 vs
                                       production 7 — see E11; real behaviour gap"
```

A divergência continua **aberta e registrada como exceção nomeada na allowlist**.
É a forma certa: não silenciaram, não mudaram um fluxo de vendas por conta
própria, e o teste falha se alguém tentar apagar a exceção sem decidir. Segue
sendo do dono do E11 — um lead com BANT exatamente 6 é qualificado pelo runner e
rejeitado pela produção, e o runner escreve Opportunity no Salesforce.

---

## Um oitavo caso, que encontrei verificando — e não corrigi

`.chromadb` **não está no `.gitignore`**. São 21 arquivos rastreados, 4.2 MB de
binário de índice vetorial.

Nenhum commit desta branch os tocou — é dívida anterior a nós. Mas a mudança de
default do pedido 2 a torna **ativa**: agora todo ingest suja o working tree com
binários, e o próximo `git add -A` os commita sem ninguém notar.

| # | Bug | O que falhou |
|---|---|---|
| 1 | middleware `/api/v1` | composição |
| 2 | canal pessoal | junção |
| 3 | fixture de teste | isolamento |
| 4 | intake no runner | ligação |
| 5 | cota do localStorage | erro engolido |
| 6 | runner sem brand voice | config duplicada |
| 7 | ingest in-memory | persistência ausente |
| 8 | **`.chromadb` versionado** | **efeito colateral de uma correção** |

O 8 é de um tipo que os sete anteriores não cobriam: **nada quebrou, e a causa
foi uma correção nossa.** Consertar o default de persistência criou escrita em
disco onde antes não havia. A correção estava certa; o efeito colateral não foi
verificado.

A regra: **quando uma correção muda o que o sistema escreve, verifique onde
escreve.** Não estou corrigindo — é decisão de vocês sobre o repo. Só não deixo
passar em silêncio, que é como os outros sete chegaram até aqui.

---

## O que os sete casos têm em comum

Nenhum foi erro de lógica. Todos foram alguma variação de **verificar até a borda
do próprio componente e presumir o resto**.

Meus três erros nesta série, para o registro simétrico:
- afirmei que `product` precisava de 2 passos (precisava de 1);
- verifiquei os posts da rodada 4 contra a regra errada — chequei o que não podia
  estar lá, nunca o que deveria;
- confirmei *"54 chunks ingeridos"* lendo um log, sem perguntar onde foram parar.

O terceiro é o mais instrutivo: **o log estava certo. A conclusão que tirei dele,
não.** "Aconteceu" e "persistiu" são afirmações diferentes.

---

## O que preciso de vocês

1. **`.gitignore`** — decidam sobre o `.chromadb`. Se o índice deve ser
   reconstruível, ignorar; se deve ser distribuído, então commitar de propósito.
   O que não funciona é o estado atual, em que entra por acidente.
2. **A flake** — se aparecer aí, capturem o nome.
3. **PR/merge da `feat/marketing-mas-integration`** — são 11 commits à frente da
   `main`, não 8 como o relatório dizia. Nada mudou do lado da plataforma que
   dependa do merge: tudo que construímos aqui roda contra os endpoints, não
   contra a branch. A decisão é de vocês e do Marco.

## Pendências

| Pendência | Com quem |
|---|---|
| `QUEUE_INTAKE_SECRET` (Vercel + host do MAS, mesma string, canal seguro) | **Marco** |
| Créditos: Gemini esgotado, sem visibilidade do saldo Anthropic | **Marco** |
| Merge da branch | **Marco + vocês** |
| Decks POC/produto | **Roi** |
| Posição do logo (`brand_assets.yaml` intocado) | **Roi** |
| Threshold BANT | **dono do E11** |
