# PhantomBuster Setup — People's Posts (Client Contact Radar)

> Como conectar o PhantomBuster ao dashboard para monitorar posts de CEOs/contatos
> de clientes no LinkedIn. A infraestrutura de recepção já está no ar — este guia
> cobre apenas a configuração do lado PhantomBuster.

> **✅ Status (10 jul 2026): plano Start (pago) ativo.** A conta saiu do trial.
> Ver seção **"Plano Start — configuração pós-upgrade"** abaixo para os ajustes
> que destravam a operação completa (70 contatos/dia + agendamento automático).

## Plano Start — configuração pós-upgrade (automatizada via API/CI)

Com o plano pago, os limites do trial caem. A configuração do Phantom agora é
**config-as-code** — não precisa clicar na interface:

### Setup único (≈ 3 min): criar a API key

1. PhantomBuster → **Workspace settings → Third-party apps & API → API keys**
   → gerar uma chave
2. Adicionar como secret no GitHub (uma vez):
   ```bash
   gh secret set PHANTOMBUSTER_API_KEY
   ```
   (cola a chave quando pedir)

### Como funciona a partir daí

- **Estado desejado:** `scripts/phantombuster/desired-config.json`
  (hoje: 70 perfis/launch + agendamento diário 08:00 America/Sao_Paulo)
- **Aplicar:** push na `main` tocando `scripts/phantombuster/**` dispara o
  workflow **PhantomBuster config sync** automaticamente, ou rode manualmente:
  ```bash
  gh workflow run phantombuster-sync.yml            # aplicar
  gh workflow run phantombuster-sync.yml -f dry_run=true   # só prever
  ```
- **Local (sem CI):**
  ```bash
  PHANTOMBUSTER_API_KEY=xxx node scripts/phantombuster/pb-sync.mjs --show      # inspecionar
  PHANTOMBUSTER_API_KEY=xxx node scripts/phantombuster/pb-sync.mjs --apply     # aplicar + verificar
  ```
- O script acha o Phantom pelo nome ("LinkedIn Activity Extractor"), aplica o
  argument e o agendamento em chamadas separadas (falha no schedule nunca
  bloqueia o ajuste de perfis) e verifica o resultado relendo o agent.

### MCP (controle conversacional pelo Claude)

O MCP oficial da PhantomBuster já está registrado no projeto (`.mcp.json` →
`https://mcp.phantombuster.com`). **Autenticar 1 vez:** abrir uma sessão
interativa do Claude Code neste diretório e rodar `/mcp` → login OAuth na
PhantomBuster → escolher o workspace. Depois disso o Claude consegue lançar
Phantoms, checar runs, buscar resultados e ajustar configs por conversa.

### Fallback manual (interface web, se preferir)

1. Phantom → Settings → **Number of profiles to process per launch** → `70`
2. Settings → **Repeated launches** → Once per day · 08:00
3. Conferir webhook: Settings → Notifications → HTTP webhook URL =
   `https://yedda-marketing-dashboard.vercel.app/api/linkedin-posts`
4. (Opcional) rodar o **LinkedIn Profile Scraper** uma vez na mesma planilha

### Higiene da planilha de contatos — status 10 jul 2026

| Contato | Situação | Resolução |
|---|---|---|
| Philippe Broianigo | URL antiga morta | ✅ Novo perfil: `/in/philippe-broianigo-ba0921300` (hoje The CrownX/Masan). Supabase + CSV atualizados; **falta colar na planilha** |
| Bruno Jousselin (`/in/103300`) | Handle numérico suspeito | ✅ Verificado — é vanity URL legítima (MD MM Mega Market VN). Sem mudança |
| Souly Hamed (handle gigante) | URL possivelmente inválida | ✅ Verificado — perfil ativo (Founder THEOTHER4). Sem mudança |
| Kfir Chervinski (prio 5/5) | Sem LinkedIn no CRM | ✅ Encontrado: `/in/kfir-chervinski-b77542` (SkillOnNet). Supabase + CSV atualizados; **falta colar na planilha** |
| Tomer Weisman | Sem LinkedIn no CRM | ✅ Confirmado 10 jul: `/in/tomer-weissman-4123b04` (sócio EBN, litígio). Supabase + CSV atualizados; **falta colar na planilha** |
| Oded Grinstein | Sem LinkedIn no CRM | ✅ Confirmado 10 jul: `/in/oded-grinstein-a2a0673`. Supabase + CSV atualizados; **falta colar na planilha** |
| Dan Thai (CEO Pho24) | Sem LinkedIn no CRM | 🟡 Nenhum perfil público confiável ligado à Pho24/VTI — confirmar com Roi |
| Nguyen Phan | Sem LinkedIn no CRM | 🟡 É do time Yedda (e-mail interno) — pedir a URL diretamente a ele |
| Kham | Sem sobrenome/empresa no CRM | 🔴 Não localizável — pedir dados ao Roi |

O trigger de tier no Supabase agora tolera barra final e maiúsculas/minúsculas
na comparação de URLs (migração `normalize_tier_url_match`).

### O que já foi ajustado no dashboard para o novo volume (10 jul 2026)

Com 70 contatos × 5 posts/dia o feed cresce ~10x. O Radar foi atualizado:

- API `GET /api/linkedin-posts` agora retorna até **300 posts** (era 100) e
  aceita `?limit=`, `?days=` e `?tier=`
- Seção **People's Posts** ganhou **filtros**: chip por tier
  (★ Priority / Client / Network / Yedda), janela de tempo (7/14/30 dias/tudo,
  padrão 30 dias), **Hide commented** e paginação "Show more" (30 por página)

## Links rápidos

| Recurso | Link |
|---|---|
| Criar conta PhantomBuster (trial 14 dias, sem cartão) | <https://phantombuster.com/signup> |
| Login PhantomBuster | <https://phantombuster.com/login> |
| Catálogo de Phantoms LinkedIn | <https://phantombuster.com/automations/linkedin> |
| Extensão Chrome (captura o cookie do LinkedIn) | <https://chromewebstore.google.com/search/PhantomBuster> |
| Criar Google Sheet novo | <https://sheets.new> |
| Dashboard — seção People's Posts | <https://yedda-marketing-dashboard.vercel.app/#people-posts> |
| Vercel (variáveis de ambiente, se quiser secret) | <https://vercel.com/dashboard> |
| Supabase — ver dados da tabela | <https://supabase.com/dashboard/project/mxjlvgzmjmnltfzcwfsh/editor> |
| Suporte/documentação PhantomBuster | <https://support.phantombuster.com> |

**URL do webhook (colar no PhantomBuster no passo 5):**

```
https://yedda-marketing-dashboard.vercel.app/api/linkedin-posts
```

## O que já está pronto (não precisa construir nada)

| Componente | Status |
|---|---|
| `api/linkedin-posts.js` — recebe o webhook e grava no Supabase | ✅ Deployed |
| Tabela `linkedin_contacts_posts` no Supabase (yedda-org) | ✅ Criada |
| Seção **People's Posts** no dashboard (acima do Comment Generator) | ✅ No ar |
| Botão "Generate Roi's Comment" com 1 clique (reusa o gerador existente) | ✅ Funcional |
| Formulário "Add post manually" (funciona já, sem PhantomBuster) | ✅ Funcional |

---

## Passo a passo

### Passo 1 — Criar a conta (≈ 3 min)

1. Acesse <https://phantombuster.com/signup>
2. Cadastre com o e-mail de trabalho → **Start free trial** (14 dias, sem cartão)
3. Confirme o e-mail de verificação

### Passo 2 — Instalar a extensão do Chrome (≈ 2 min)

1. Abra <https://chromewebstore.google.com/search/PhantomBuster>
2. Instale a extensão oficial **PhantomBuster**
3. Faça login no LinkedIn normalmente em <https://www.linkedin.com> na mesma janela
   — a extensão captura o session cookie automaticamente quando você conectar
   um Phantom (passo 4)

### Passo 3 — Criar a planilha de contatos (≈ 5 min)

1. Crie a planilha: <https://sheets.new>
2. Na **coluna A**, cole as URLs de perfil do LinkedIn dos CEOs/contatos-alvo,
   uma por linha. Exemplo:
   ```
   https://www.linkedin.com/in/nome-do-ceo-1/
   https://www.linkedin.com/in/nome-do-ceo-2/
   ```
3. **Compartilhar** → Acesso geral → **"Qualquer pessoa com o link"** → Leitor
4. Copie a URL da planilha (será usada no passo 4)

### Passo 4 — Configurar o Phantom principal (≈ 10 min)

1. Acesse <https://phantombuster.com/automations/linkedin>
2. Busque **"LinkedIn Activity Extractor"** → **Use this Phantom**
3. Configure:
   - **Connect to LinkedIn** → clique no botão; a extensão do Chrome entrega o
     cookie sozinha (precisa estar logado no LinkedIn no mesmo browser)
   - **Spreadsheet URL** → cole a URL do Google Sheet do passo 3
   - **Activities to scrape** → `Posts`
   - **Number of activities per profile** → `5` (suficiente para runs diários)

### Passo 5 — Conectar o webhook ao dashboard (≈ 2 min)

1. Ainda nas configurações do Phantom: **Settings → Notifications**
   (ou "Webhooks", conforme a versão da interface)
2. Em **HTTP webhook URL**, cole:
   ```
   https://yedda-marketing-dashboard.vercel.app/api/linkedin-posts
   ```
3. Salvar

### Passo 6 — Agendar execução diária (≈ 1 min)

1. **Settings → Repeated launches** (ou "Schedule")
2. Frequência: **Once per day** · Horário: **08:00**
3. Salvar

### Passo 7 — Testar (≈ 5 min)

1. Clique **Launch** manualmente no Phantom e aguarde o run terminar
2. Abra <https://yedda-marketing-dashboard.vercel.app/#people-posts>
3. Clique **↻ Refresh** na seção People's Posts
4. Os posts dos contatos devem aparecer como cards
5. Conferência opcional dos dados brutos: tabela `linkedin_contacts_posts` em
   <https://supabase.com/dashboard/project/mxjlvgzmjmnltfzcwfsh/editor>

### Passo 8 — (Opcional, uma vez) Enriquecer contatos

1. Em <https://phantombuster.com/automations/linkedin>, busque
   **"LinkedIn Profile Scraper"**
2. Rode uma vez na mesma planilha para obter nome/cargo/empresa limpos
   de cada contato

---

## ✅ Checklist final

- [x] Conta PhantomBuster criada e e-mail confirmado
- [x] **Plano Start (pago) ativo** — 10 jul 2026
- [x] Extensão Chrome instalada + logado no LinkedIn
- [x] Google Sheet com URLs dos contatos, compartilhado como "qualquer pessoa com o link"
- [x] LinkedIn Activity Extractor configurado (cookie + planilha + Posts + 5 por perfil)
- [x] Webhook apontando para `/api/linkedin-posts`
- [x] Launch manual de teste → cards visíveis no dashboard (38 resultados, 8 jul)
- [ ] **API key criada + `gh secret set PHANTOMBUSTER_API_KEY`** (setup único do CI)
- [ ] **Profiles per launch = 70** (aplicado pelo workflow `phantombuster-sync`)
- [ ] **Agendamento diário às 08:00 ativo** (aplicado pelo workflow `phantombuster-sync`)
- [ ] **MCP autenticado** (`/mcp` numa sessão interativa → OAuth PhantomBuster)
- [ ] URLs mortas corrigidas na planilha (Philippe Broianigo + verificar 2 suspeitas)

## Como funciona o fluxo no dashboard

1. Card do post aparece com nome · cargo · empresa · trecho · link
2. **💬 Generate Roi's Comment** → o texto vai para o Comment Generator e o
   comentário é gerado automaticamente (se a chave Gemini estiver em Settings)
3. Revisar → **📋 Copy Comment** → colar no LinkedIn
4. **✓ Mark commented** → marca o post como respondido (salva o comentário
   usado no Supabase; o card fica esmaecido)

## Segurança do webhook (opcional)

Por padrão o endpoint aceita POSTs sem autenticação (os dados são posts
públicos do LinkedIn; o pior caso é lixo na tabela). Para restringir:

1. No Vercel (<https://vercel.com/dashboard> → projeto → Settings →
   Environment Variables): criar `PB_WEBHOOK_SECRET` = um token
2. No PhantomBuster, usar a URL: `.../api/linkedin-posts?secret=SEU_TOKEN`

**Atenção:** com o secret ativo, o formulário "Add post manually" do dashboard
para de funcionar (ele POSTa sem o secret). Ativar apenas se necessário.

## Formatos de payload aceitos pelo endpoint

O receptor normaliza automaticamente três formatos:

1. **Webhook PhantomBuster**: `{ "resultObject": "<json string>" }`
2. **Dashboard manual**: `{ "posts": [ {...} ] }`
3. **Array direto**: `[ {...}, {...} ]`

Campos reconhecidos (qualquer alias funciona): `postUrl/url/postLink`,
`postContent/text/textContent`, `fullName/name/author`, `title/headline`,
`company/companyName`, `postDate/postTimestamp`, `likeCount`, `commentCount`.
Deduplicação por `post_url` — re-scrapes atualizam likes/comments sem apagar
o `roi_comment` salvo.
