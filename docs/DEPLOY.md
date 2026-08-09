# Deploy (Vercel)

## Variáveis de ambiente

Configure em **Settings → Environment Variables** (Production, Preview e Development) e **faça um novo deploy depois de salvar**.

> As variáveis `NEXT_PUBLIC_*` são embutidas durante o build. Adicionar a
> variável sem reconstruir não conserta um deploy que já subiu — foi
> exatamente isso que causou o `Internal Server Error` em todas as rotas na
> primeira publicação.

### Obrigatórias para o site subir

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yoxmayikaipqzbzbnema.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_E-ZZ-wJ4sYCFQuLZBvzNgw_QDdUbqnu` |
| `NEXT_PUBLIC_SITE_URL` | `https://app.marianavalentina.com.br` (domínio de produção) |

Trocar de domínio exige **novo deploy**: `NEXT_PUBLIC_SITE_URL` é embutida no
build e alimenta os links de todos os e-mails (boas-vindas, novo conteúdo,
digest, lembretes) e o retorno do magic link.

Estas duas primeiras são públicas por natureza — vão no bundle do navegador e
são protegidas por RLS. As de baixo, não: são segredos.

### Necessárias para webhooks, jobs e exclusão de conta

| Variável | Onde obter |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API keys (**secreta**) |
| `JOBS_SECRET` | gere com `openssl rand -hex 32` |
| `KIRVANO_WEBHOOK_TOKEN` | o mesmo token configurado no webhook da Kirvano |
| `KIRVANO_PAYMENT_URL` | link de regularização de pagamento (usado nos e-mails) |

### Necessárias para e-mail e vídeo

| Variável | Onde obter |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend (domínio verificado com SPF/DKIM) |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_CDN_HOST`, `BUNNY_EMBED_TOKEN_KEY` | Bunny Stream → sua library |

## Supabase Auth

### URL Configuration (obrigatório)

Em **Authentication → URL Configuration**:

- **Site URL**: `https://app.marianavalentina.com.br`. Enquanto isso ficar
  como `http://localhost:3000`, todo magic link enviado leva a pessoa para a
  máquina dela — e não abre.
- **Redirect URLs**: adicione `https://app.marianavalentina.com.br/**`,
  `https://mariana-comunidade.vercel.app/**` (previews) e
  `http://localhost:3000/**`. Sem o curinga, o Supabase ignora o
  `redirect_to` que o app envia e joga o código na raiz do site.

O app tolera esse segundo caso: o proxy encaminha `code`/`token_hash` de
qualquer rota para `/auth/confirm`. Mas o Site URL errado não tem contorno
possível pelo código — o link já sai errado do servidor de e-mail.

### Template de e-mail (só importa no modo de contingência)

O login é por **e-mail + senha**. Com `SUPABASE_SERVICE_ROLE_KEY` e Resend
configurados, o app gera e envia o link de criação de senha por conta
própria, sem passar pelos templates do Supabase.

Se esses dois não estiverem configurados, `/esqueci-senha` cai para o e-mail
do próprio Supabase. Nesse caso, ajuste **Authentication → Email Templates →
Reset Password** para:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&proximo=/nova-senha">
  Criar minha senha
</a>
```

O padrão usa PKCE, que exige abrir o link **no mesmo navegador** que o
solicitou — e o público costuma pedir no computador e abrir no celular.

## Diagnóstico

Se faltar credencial do Supabase, o app não devolve mais 500: toda rota é
reescrita para `/configuracao`, que lista exatamente quais variáveis faltam.
