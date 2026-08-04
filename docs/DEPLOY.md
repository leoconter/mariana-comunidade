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
| `NEXT_PUBLIC_SITE_URL` | a URL pública do deploy (ex.: `https://mariana-comunidade.vercel.app`) |

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

Em **Authentication → URL Configuration**, defina o *Site URL* como a URL de
produção e inclua `https://<seu-domínio>/auth/confirm` nas *Redirect URLs* —
sem isso o magic link volta para `localhost`.

## Diagnóstico

Se faltar credencial do Supabase, o app não devolve mais 500: toda rota é
reescrita para `/configuracao`, que lista exatamente quais variáveis faltam.
