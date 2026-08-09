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

- `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` (Settings → API keys)
- `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY`/`EMAIL_FROM`: sem eles nenhuma membra nova consegue criar senha (o e-mail não sai). Deixaram de ser opcionais quando o login virou só senha.
- Site URL / Redirect URLs de produção em Auth → URL Configuration
- Ícones PWA reais em `public/icons/` (192/512/maskable) — placeholder até o logo chegar

## Estado dos incrementos

**Todos os 15 incrementos do plano estão implementados** (código completo, builds e lint limpos, RLS e sweep verificados via SQL). O que falta é configuração externa e verificação manual em produção — ver pendências acima e a seção "Verificação end-to-end" do plano.

## Jobs e automações

- `pg_cron` roda `run_publish_sweep()` a cada minuto (flip scheduled→published + notificações in-app).
- Rotas `/api/jobs/{publish-sweep,event-reminders,access-sweep,weekly-digest}` (header `x-jobs-secret: $JOBS_SECRET`) cuidam dos e-mails — agendar via `pg_cron`+`pg_net` (migração futura com a URL de produção) ou Vercel Cron. Todas idempotentes.
- Webhooks: `/api/webhooks/kirvano` (header `security-token`) e `/api/webhooks/bunny?secret=$JOBS_SECRET`.
- Mapeamento de eventos Kirvano→interno: `EVENT_MAP` em `src/lib/kirvano.ts` — ajustar com os payloads reais.
