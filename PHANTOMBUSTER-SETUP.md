# PhantomBuster Setup — People's Posts (Client Contact Radar)

> Como conectar o PhantomBuster ao dashboard para monitorar posts de CEOs/contatos
> de clientes no LinkedIn. A infraestrutura de recepção já está no ar — este guia
> cobre apenas a configuração do lado PhantomBuster.

## O que já está pronto (não precisa construir nada)

| Componente | Status |
|---|---|
| `api/linkedin-posts.js` — recebe o webhook e grava no Supabase | ✅ Deployed |
| Tabela `linkedin_contacts_posts` no Supabase (yedda-org) | ✅ Criada |
| Seção **People's Posts** no dashboard (acima do Comment Generator) | ✅ No ar |
| Botão "Generate Roi's Comment" com 1 clique (reusa o gerador existente) | ✅ Funcional |
| Formulário "Add post manually" (funciona já, sem PhantomBuster) | ✅ Funcional |

**URL do webhook:**

```
https://yedda-marketing-dashboard.vercel.app/api/linkedin-posts
```

## Passo a passo

### 1. Criar conta (trial de 14 dias, sem cartão)

- Acesse [phantombuster.com](https://phantombuster.com) → Start free trial
- Instale a extensão de browser do PhantomBuster (Chrome) — ela captura o
  session cookie do LinkedIn automaticamente

### 2. Criar a planilha de contatos

- Google Sheet com uma coluna contendo as URLs de perfil do LinkedIn dos
  CEOs/contatos-alvo (uma por linha)
- Compartilhar como "Anyone with the link can view"

### 3. Configurar o Phantom principal

- Na biblioteca, buscar **"LinkedIn Activity Extractor"**
- Configurar:
  - **Spreadsheet URL**: a URL do Google Sheet do passo 2
  - **Session cookie**: capturado pela extensão (clicar em "Connect to LinkedIn")
  - **Activities to scrape**: Posts
  - **Number of activities per profile**: 5 (suficiente para runs diários)
- **Settings → Notifications → HTTP webhook**: colar a URL do webhook acima
- **Settings → Repeated launches**: Once per day, ~8:00 AM

### 4. (Opcional, uma vez) Enriquecer contatos

- Rodar **"LinkedIn Profile Scraper"** na mesma planilha para obter
  nome/cargo/empresa limpos de cada contato

### 5. Testar

- Clicar **Launch** manualmente no Phantom
- Ao terminar, abrir o dashboard → seção **People's Posts** → ↻ Refresh
- Os posts dos contatos devem aparecer como cards

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

1. No Vercel: Settings → Environment Variables → `PB_WEBHOOK_SECRET` = um token
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
