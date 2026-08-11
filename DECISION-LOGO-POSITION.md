# Decisão necessária: posição do logo nas imagens

> **Para:** Roi · **De:** Marco / plataforma de marketing · **Data:** 10 ago 2026
> **Tempo estimado:** 15 minutos, olhando 2–3 imagens reais
> **Status:** os dois sistemas estão em desacordo. Um dos dois vai precisar mudar.

## O conflito, em uma linha

O MAS diz **topo-esquerdo**. A plataforma faz **base-esquerda**. Os dois não podem estar certos.

| Sistema | Declara | Onde |
|---|---|---|
| **MAS** | `"Always **top-left**, unmodified, clear space = height of the Y; min 30px/15mm; never recolored/rotated/recreated"` | `config/brand_assets.yaml` |
| **MAS** | `"Yedda.ai logo **top-left**, unchanged"` | mesma fonte, regra de imagem |
| **Plataforma** | Compõe no **canto inferior esquerdo** (margem de 4% da largura, logo a 20%) | `_compositeWithLogo()` |
| **Sua planilha** | *"The logo is wrong (**bottom left**). Once fixed, can be posted"* | 2 rejeições registradas |

## O que verifiquei antes de trazer isso

**Os três caminhos de imagem da plataforma são consistentes entre si.** Cada imagem
gerada — via Gemini, via FLUX ou pelo cartão de fallback — desenha o logo na **mesma
posição** (base-esquerda), com o mesmo padding. Não há caminho "escapando" do composite,
que era a minha principal hipótese anterior. Essa hipótese está **descartada**.

**A hipótese do azul divergente também está descartada.** O MAS declara `#4BADB8` de
forma consistente em todos os lugares onde a cor aparece, igual à plataforma.

## Então por que os posts foram rejeitados?

Restam duas explicações, e só você pode dizer qual é:

**Hipótese A — a regra do MAS está errada e a plataforma está certa.**
Sua anotação na planilha diz *"the logo is wrong (bottom left)"*. Se **base-esquerda é o
correto**, sua frase estava descrevendo onde ele **deveria** estar — e a rejeição foi de
imagens que saíram sem logo nenhum, ou com ele em outro lugar. Nesse caso o MAS é que
precisa mudar (`brand_assets.yaml`).

**Hipótese B — a regra do MAS está certa e a plataforma está errada.**
Se **topo-esquerdo é o correto**, sua frase estava apontando o erro: *"o logo está errado
(está em baixo à esquerda)"*. Nesse caso a plataforma é que muda — são duas linhas em
`_compositeWithLogo()` e no cartão de fallback.

A ambiguidade está na própria frase: *"the logo is wrong (bottom left)"* pode ser lida
das duas formas. Por isso não decidi sozinho.

## Sobre as 4 rejeições de cor

Separadamente, você rejeitou 4 posts com *"should add logo and change the blue color to
**our blue**"*. Como o teal declarado é o mesmo nos dois sistemas, a causa provável é que
**o modelo de imagem não acerta o tom exato quando a cor é apenas pedida no prompt**.

A recomendação do MAS — que eu subscrevo — é que elementos de marca sejam **compostos
deterministicamente**, nunca solicitados ao modelo. O logo já é. A cor de fundo/realce
ainda não; se isso continuar incomodando, dá para aplicar um ajuste de tom após a geração,
em vez de torcer para o modelo acertar.

## O que eu preciso de você

Olhando 2–3 imagens geradas recentemente:

1. **A posição atual (base-esquerda) está correta?**
   - Se **sim** → eu corrijo a regra no MAS e o conflito acaba.
   - Se **não** → eu mudo a plataforma para topo-esquerdo (as duas linhas).
2. **A cor está aceitável nessas imagens?** Se não, aplico o ajuste determinístico de tom.

Enquanto a decisão não vier, **nada muda** — a plataforma continua compondo em
base-esquerda, que é o comportamento que está em produção hoje.
