# PhantomBuster Setup — People's Posts (Client Contact Radar)

> Como conectar o PhantomBuster ao dashboard para monitorar posts de CEOs/contatos
> de clientes no LinkedIn. A infraestrutura de recepção já está no ar — este guia
> cobre apenas a configuração do lado PhantomBuster.

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

- [ ] Conta PhantomBuster criada e e-mail confirmado
- [ ] Extensão Chrome instalada + logado no LinkedIn
- [ ] Google Sheet com URLs dos contatos, compartilhado como "qualquer pessoa com o link"
- [ ] LinkedIn Activity Extractor configurado (cookie + planilha + Posts + 5 por perfil)
- [ ] Webhook apontando para `/api/linkedin-posts`
- [ ] Agendamento diário às 08:00 ativo
- [ ] Launch manual de teste → cards visíveis no dashboard

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
