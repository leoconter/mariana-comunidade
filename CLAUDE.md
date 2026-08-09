@AGENTS.md

# Comunidade — Plataforma de comunidade por assinatura (Fisioterapia Pélvica)

Substitui a Circle.so. Mariana é a única produtora de conteúdo e admin — a UX de admin é feature crítica. Público: fisioterapeutas pélvicas, mobile-first (~380px primeiro), 15–40 membros. Pagamento externo via Kirvano (a plataforma só consome webhooks e controla acesso).

Plano completo e decisões: `docs/PLANO.md`.

## Convenções

- **UI em pt-BR; código, identificadores e comentários em inglês.**
- Segmentos de URL voltados ao membro em português: `/entrar`, `/buscar`, `/e/[spaceSlug]`, `/admin/espacos`…
- Mobile-first de verdade: projetar a partir de ~380px; desktop é a expansão.
- Estados vazios sempre com próximo passo sugerido — nunca parecer abandono.
- Leituras: Server Components com cliente user-scoped (`src/lib/supabase/server.ts`) — RLS é a camada de enforcement.
- Escritas: Server Actions (RLS ativo). Admin valida `role='admin'` em código, mas RLS é o gate real.
- `src/lib/supabase/admin.ts` (service role, bypassa RLS): SÓ em webhooks, jobs de cron e exclusão/exportação de conta.
- Sem dados mockados permanentes. Seeds explícitos e isolados em migração/SQL.
- Datas/agendamento: armazenar UTC; UI sempre em `America/Sao_Paulo`.

## Stack

Next.js 16 (App Router) + TS · Tailwind v4 + shadcn/ui (estilo radix-nova, componentes em `src/components/ui`) · Supabase (Postgres 17, Auth por e-mail + senha, Storage, RLS) · Vercel · Resend · Bunny Stream (vídeo: TUS upload, HLS, embed com token) · Tiptap (editor; templates editáveis vivem no banco em `post_types`).

### Vídeo (Bunny Stream)

Library `comunidade-pelvica` (id `724585`), replicação só BR, pull zone `vz-e98880bf-472.b-cdn.net`. `BUNNY_EMBED_TOKEN_KEY` é a Token Authentication Key da aba Security da library (não é exposta pela API do `videolibrary`).

O token do embed protege **apenas o iframe** — os arquivos em `<cdn-host>/<guid>/playlist.m3u8` continuam servíveis por quem tiver o GUID. O que fecha isso é a lista de referrers permitidos da library (`app.marianavalentina.com.br`, `iframe.mediadelivery.net`, `localhost`) combinada com `BlockNoneReferrer`. Ao adicionar um domínio novo (preview da Vercel, domínio próprio), incluir na lista via `POST /videolibrary/724585/addAllowedReferrer` — senão o vídeo simplesmente não toca lá. Referrer é falsificável: contra pirataria determinada só DRM resolve.

### Autenticação

Login é **e-mail + senha** (o magic link foi removido a pedido do cliente). Como o webhook da Kirvano cria a conta sem senha, o acesso da membra nova depende do e-mail de boas-vindas com o link de criação de senha:

- `createPasswordSetupLink()` em `src/lib/auth-links.ts` gera um link para `/auth/confirm?token_hash=…&type=recovery&proximo=/nova-senha`. Aponta direto para o app — não depende da Site URL nem da lista de redirects do Supabase, e funciona em outro aparelho (o fluxo PKCE não funcionaria).
- `/esqueci-senha` usa esse caminho quando `SUPABASE_SERVICE_ROLE_KEY` + Resend estão configurados; senão cai para `resetPasswordForEmail()` (e-mail do próprio Supabase).
- `/nova-senha` exige sessão — a sessão vem da verificação do token de recuperação.

### Branding (marianavalentina.com.br)

Coral `#E9726D` (primary) · pêssego `#FFB0A3` · laranja `#FF9C50` (accent) · creme `#FEFBF6` (background). Fontes: Gilda Display (títulos, `font-heading`) + Montserrat (corpo, `font-sans`). Tokens em `src/app/globals.css`.

## Supabase

- Projeto: `comunidade-pelvica` (`yoxmayikaipqzbzbnema`, região `sa-east-1`). Migrações versionadas em `supabase/migrations/` e aplicadas via MCP `apply_migration` (manter os dois em sincronia).
- Padrão RLS: funções `is_admin()` e `has_access()` (SECURITY DEFINER STABLE), sempre chamadas como `(select fn())` nas policies para virar InitPlan (evita N+1).
- `profiles.access_valid_until` é denormalizado: mantido pelo webhook Kirvano/grants manuais, reconciliado por sweep noturno.
- Visibilidade de post agendado NÃO depende de cron: policy trata `scheduled AND publish_at <= now()` como publicado. `pg_cron` (a cada minuto) só cuida de efeitos colaterais (flip de status, notificações, e-mails via `pg_net` → `/api/jobs/*`). Jobs idempotentes (markers `*_sent_at`).
- Storage: buckets privados `media` e `avatars`; downloads sempre via `createSignedUrl` (TTL 1h) após query RLS-autorizada — não duplicar lógica de visibilidade em policies de `storage.objects`.

## Comandos

- `npm run dev` — dev server (Turbopack)
- `npm run build` — build de produção (rodar antes de considerar um incremento pronto)
- `npm run lint` — ESLint

## Pendências de configuração manual (dashboard)

Produção (`app.marianavalentina.com.br`) já tem todas as variáveis configuradas — conferir pelo health check `GET /api/webhooks/kirvano`, que reporta a presença de cada uma sem expor valor. `.env.local` ainda precisa de `SUPABASE_SERVICE_ROLE_KEY` e `KIRVANO_WEBHOOK_TOKEN` para rodar esses fluxos localmente.

- Site URL / Redirect URLs de produção em Auth → URL Configuration
- Ícones PWA reais em `public/icons/` (192/512/maskable) — placeholder até o logo chegar
- Bunny: cadastrar cartão antes de **23/08/2026**; o crédito de trial expira junto com o período e a library para de servir vídeo

## Estado dos incrementos

**Todos os 15 incrementos do plano estão implementados** (código completo, builds e lint limpos, RLS e sweep verificados via SQL). O que falta é configuração externa e verificação manual em produção — ver pendências acima e a seção "Verificação end-to-end" do plano.

## Jobs e automações

- `pg_cron` roda `run_publish_sweep()` a cada minuto (flip scheduled→published + notificações in-app).
- Rotas `/api/jobs/{publish-sweep,event-reminders,access-sweep,weekly-digest}` (header `x-jobs-secret: $JOBS_SECRET`) cuidam dos e-mails. Agendadas em `0007_jobs_cron.sql` via `pg_cron`+`pg_net` → `public.call_job(path)`, que lê `jobs_base_url` e `jobs_secret` do Vault (nenhum segredo no repositório). Todas idempotentes. Publish/lembretes a cada 5min, access-sweep 06:00 UTC, digest segunda 11:00 UTC.
- `/api/jobs` e `/api/webhooks` precisam estar em `PUBLIC_PATHS` (`src/lib/supabase/middleware.ts`): eles se autenticam por header, e sem isso o POST vira redirect para `/entrar` com status 200 — job silenciosamente morto.
- Webhooks: `/api/webhooks/kirvano` (header `security-token`) e `/api/webhooks/bunny?secret=$JOBS_SECRET`.
- Mapeamento de eventos Kirvano→interno: `EVENT_MAP` em `src/lib/kirvano.ts` — ajustar com os payloads reais.
