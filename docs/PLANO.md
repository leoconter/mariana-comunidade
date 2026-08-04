# Plano — Plataforma de Comunidade por Assinatura (Fisioterapia Pélvica)

## Contexto

Substituir a Circle.so por uma plataforma própria de comunidade paga para fisioterapeutas pélvicas. Mariana é a única produtora de conteúdo e admin — a UX de admin é feature crítica. Público mobile-first (~380px), 15–40 membros iniciais. Pagamento externo via Kirvano (a plataforma só consome webhooks e controla acesso). Projeto greenfield na pasta vazia `/Users/leo.conter/Desktop/Comunidade`.

**Decisões já tomadas com o cliente:**
- **Vídeo: Bunny Stream** (upload TUS resumível, HLS adaptativo, thumbnail automática, embed com token assinado)
- **Migração da Circle: repostagem manual** pela Mariana via painel (sem script de importação)
- **Infra existente:** Vercel, domínio + Resend, docs do webhook Kirvano. **Projeto Supabase será criado do zero** (integração Supabase conectada nesta sessão)
- **Identidade visual:** seguir marianavalentina.com.br — coral `#E9726D` (primária), pêssego `#FFB0A3`, laranja `#FF9C50` (accent), fundo creme `#FEFBF6`, tipografia **Gilda Display** (títulos) + **Montserrat** (corpo)

## Stack

Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Supabase (Postgres, Auth magic link, Storage, RLS) · Vercel · Resend · **Bunny Stream** · **Tiptap** (editor — ProseMirror JSON, headless, ideal para templates editáveis armazenados no banco) · PWA.

## Arquitetura

- **Um único repo Next.js.** Todas as integrações (Bunny, Resend, Kirvano) vivem no Next — Route Handlers para webhooks/jobs, Server Actions para mutações. **Sem Supabase Edge Functions** (dois runtimes para zero benefício nesta escala).
- **Leituras:** Server Components com cliente user-scoped (`@supabase/ssr`) — RLS é a camada de enforcement. **Escritas:** Server Actions (RLS ativo). **Service-role** apenas em webhooks, jobs de cron e exclusão/exportação de conta.
- **Cron: `pg_cron` + `pg_net`** (não Vercel Cron — Hobby só permite cron diário; pg_cron dá granularidade por minuto de graça). A cada minuto: `run_publish_sweep()` em SQL puro vira posts `scheduled→published` e insere notificações; `pg_net` chama `/api/jobs/*` para os e-mails (Resend). **Visibilidade não depende do cron:** RLS trata `scheduled AND publish_at <= now()` como publicado — o post da segunda aparece às 07:00:00 em ponto. Todos os jobs idempotentes (markers `*_sent_at`).

### Rotas

```
(auth)/entrar · auth/confirm · acesso-negado
(member)/           → layout: sidebar seções→espaços, gate de acesso, banner de carência
  /                 → feed unificado cronológico
  /e/[spaceSlug] · /e/[slug]/p/[postId] · /e/[slug]/evento/[eventId]
  /buscar · /salvos · /membros · /notificacoes · /perfil · /assinatura
(admin)/admin/      → layout exige role=admin
  / (dashboard) · /espacos · /posts · /posts/novo · /posts/[id] · /agenda
  /modelos · /midia · /tags · /eventos · /membros · /moderacao
  /comunicados · /configuracoes (templates de e-mail + simulador de webhook)
api/webhooks/{kirvano,bunny} · api/jobs/{publish-sweep,event-reminders,access-sweep,weekly-digest} · api/export/me
/termos · /privacidade · manifest.ts (PWA)
```

## Banco de dados (Postgres, tudo com RLS)

Extensões: `pg_cron`, `pg_net`, `unaccent`, `pg_trgm`.

- **Identidade/acesso:** `profiles` (role, muted_until, banned_at, **`access_valid_until`** denormalizado), `subscriptions` (plan, status `active|past_due|canceled|expired`, `current_period_end`, `grace_until`), `access_grants` (cortesia manual), `kirvano_webhook_events` (log + idempotência por `external_event_id`), `consents` (append-only: tos, privacidade, dados de saúde — versão do doc, IP, user agent)
- **Estrutura:** `sections`, `spaces` (type `feed|library|events`, visibility, position, archived_at), `space_memberships` (following → feed da home; notify)
- **Conteúdo:** `post_types` (**templates editáveis**: `body_template` jsonb = doc Tiptap com os blocos pré-escritos; `field_schema` jsonb = campos extras como o seletor de impacto clínico), `posts` (body jsonb Tiptap + `body_text` extraído no save + **`search_tsv` generated column** com config FTS customizada `pt` = `portuguese` + `unaccent`, índice GIN; `custom_fields` jsonb validado por zod contra o `field_schema`; status `draft|scheduled|published|archived`; publish_at, is_pinned, comments_closed, notify_members), `tags` + `post_tags` (rename + merge)
- **Mídia:** `media_assets` (storage_path OU `bunny_video_id` + `bunny_status`, thumbnail, duration), `post_attachments` (N:N com ordem → "onde este arquivo é usado"; delete bloqueado se anexado)
- **Engajamento:** `comments` (parent_id + **trigger que rejeita neto** = 1 nível garantido), `reactions` (única por user/alvo), `saved_posts`, `post_views`, `media_progress` (retomar vídeo — gravado via server action debounced do player Bunny)
- **Eventos:** `events` (meeting_url, `recording_post_id` — anexar gravação cria post na biblioteca, markers reminder_24h/1h), `event_rsvps`, `case_submissions` (`consent_id NOT NULL` → checkbox LGPD gera consent atomicamente; **RLS mais restrito do sistema: dono + admin, moderador excluído**)
- **Moderação/comms:** `reports`, `moderation_log` (append-only), `notifications` (fan-out = INSERT de ~40 linhas pelo sweep — sem filas), `announcements`, `email_templates` (editáveis no admin), `email_log`

## RLS — padrão central

Duas funções `SECURITY DEFINER STABLE`, sempre chamadas como `(select fn())` para virar InitPlan (avaliada 1x por query, não por linha — mata o N+1 de policies):

- `is_admin()` — role em `profiles`
- `has_access()` — `banned_at IS NULL AND access_valid_until > now()`

`access_valid_until` é **mantido por quem escreve** (webhook Kirvano, grant manual) e reconciliado por um sweep noturno a partir da verdade (`subscriptions` + `access_grants`). Rejeitado: claim no JWT (fica stale ao revogar — inaceitável em produto pago) e EXISTS por linha (N+1).

**Storage:** buckets privados (`media`, `avatars`); downloads sempre via `createSignedUrl` (TTL 1h) gerado após a query RLS-autorizada do post — evita duplicar a lógica de visibilidade em policies de `storage.objects`.

## Máquina de estados da assinatura (Kirvano)

```
activated → active · renewed → estende period_end
payment_failed → past_due (grace_until = +5 dias; acesso continua + banner "regularize até {data}")
grace expira (sweep) → expired (corta acesso)
canceled → acesso até current_period_end → expired (sweep)
reactivated → active · grants manuais sobrepõem tudo exceto ban
```

Handler: verifica assinatura, loga em `kirvano_webhook_events` (idempotente), aplica transição, atualiza `access_valid_until`, dispara e-mail. **Simulador de webhook** em `/admin/configuracoes` (só dev/flag) posta payloads prontos no handler real.

## Bunny Stream

1. Server action admin cria vídeo na API Bunny → insere `media_assets` → devolve pré-assinatura TUS
2. Browser sobe via `tus-js-client` (resumível, barra de progresso) → `bunny_status='processing'`
3. Webhook `/api/webhooks/bunny` marca `ready` + thumbnail/duração (com poll de fallback ao abrir asset em processing)
4. Playback: Token Authentication + Block direct play + referrer lock no library; server component gera token por visualização (`sha256(key + videoId + expires)`, 6h) no iframe `mediadelivery.net`; `&t={seconds}` para retomar; progresso via postMessage do player
5. Sem DRM (MediaCage) — token assinado + referrer lock é o nível certo para 40 membros

## Ordem de implementação (15 incrementos; Mariana carrega conteúdo a partir do 6)

1. **Scaffold + auth** — Next + shadcn + `@supabase/ssr`, magic link pt-BR, shells, manifest PWA. *Verificar: magic link no celular, sessão persiste.*
2. **Schema core + RLS** — migração 0001 (profiles, sections, spaces, subscriptions, grants, funções, seeds: Mariana admin + 4 espaços). *Verificar: membro sem acesso não vê nada; admin vê tudo (SQL editor).*
3. **Sidebar + admin de espaços** — CRUD, reorder dnd-kit (seções e espaços), visibilidade, arquivar. *Verificar: reorder reflete no mobile do membro; espaço oculto invisível.*
4. **Editor + publicar** — Tiptap, draft/publish, fixar, página do post, extração de body_text. *Verificar: rascunho invisível ao membro; post publicado aparece.*
5. **Mídia + anexos (não-vídeo)** — buckets, upload PDF/imagem/docx, preview inline de PDF, `/admin/midia` (busca, uso, renomear, delete com guarda). *Verificar: PDF inline no celular; delete bloqueado se anexado.*
6. **Bunny end-to-end** — create→TUS→webhook→embed assinado. **Marco: Mariana começa a subir o acervo.** *Verificar: upload 500MB com queda de wifi retoma; embed expirado bloqueia em aba anônima.*
7. **Agendamento + templates** — `post_types` seedados (5), editor de modelos, form de custom fields (impacto clínico), pg_cron sweep, `/admin/agenda`, duplicar, preview-como-membro. *Verificar: agendar +3min aparece no minuto exato; duplicar Artigo Comentado mantém estrutura.*
8. **Tags + busca** — FTS config `pt` sem acentos, `/buscar` com filtros de condição e tipo. *Verificar: "avaliacao" encontra "avaliação".*
9. **Feed + engajamento** — feed unificado, seguir espaço, salvos, visto, retomar vídeo. *Verificar: retomar vídeo em outro dispositivo.*
10. **Comentários + moderação** — 1 nível (trigger), reação, ocultar/fixar/excluir, fechar comentários, denúncia → fila, mute/ban, log. *Verificar: resposta-de-resposta rejeitada; toda ação no log.*
11. **Kirvano + gate de acesso** — handler assinado + idempotência, 5 eventos, banner de carência, `/acesso-negado`, access-sweep, simulador. *Verificar: sequência activated→failed→expirar carência→reactivated via simulador.*
12. **Gestão de membros** — lista com status/plano/último acesso, grants, papéis, reenviar link, CSV, editar perfil. *Verificar: cortesia entra; revogado bloqueia na próxima navegação.*
13. **Eventos** — CRUD, RSVP, submissão de caso com aviso LGPD + checkbox obrigatório (consent atômico), lista de casos no admin, anexar gravação → post na biblioteca, lembretes 24h/1h idempotentes. *Verificar: job de lembrete 2x = 1 e-mail; envio sem checkbox impossível.*
14. **Notificações + e-mails + comunicados** — sino in-app, prefs, templates editáveis (boas-vindas, digest), digest semanal, comunicado banner+email, histórico. *Verificar: publicação silenciosa não notifica.*
15. **Dashboard + LGPD + polish** — dashboard admin, exportação de dados (`/api/export/me`), exclusão de conta (anonimiza comentários), termos/privacidade + gate de consentimento no 1º login, ícones PWA, passada geral em 380px. *Verificar: Lighthouse PWA instalável; export completo.*

Arquivos críticos: `supabase/migrations/0001_init.sql` · `src/lib/access.ts` · `src/app/api/webhooks/kirvano/route.ts` · `src/lib/bunny.ts` · `src/components/editor/post-editor.tsx` · `CLAUDE.md` (criado no incremento 1: contexto, convenções — UI pt-BR, código en — e comandos).

## Pushback (discordâncias do brief)

1. **Prefs de notificação por espaço E por canal** → simplificar: on/off por espaço + 2 toggles globais de e-mail (digest, comunicados). Matriz de notificação é excesso para 40 pessoas.
2. **Fila de moderação + denúncias + log completos** são features de comunidade de 10k membros. Mantidos, mas como tabela simples com botão de resolver — não deixar crescer.
3. **Preview mobile fiel** → preview em nova aba + modo responsivo do navegador. Emulação de device real não vale o custo.
4. **Mesclar tags** — com uma única admin criando tags, quase não acontece. Fica, mas é o primeiro corte se apertar.
5. **"Todo o admin é incortável"** — na prática há dois tiers: essencial (espaços, editor, agendamento, templates, mídia, membros/grants) e tardio (CSV, histórico de envios, dashboard). Ambos entram, mas nessa ordem.
6. **Reconciliação Kirvano (faltava no brief):** webhooks serão perdidos. Todo webhook é logado; sweep noturno reconcilia expirações; grant manual é o fallback documentado. Perguntar à Kirvano se há API de consulta de status.
7. **Deliverability (faltava):** subdomínio dedicado de envio com SPF/DKIM/DMARC no Resend antes do primeiro e-mail.
8. **Backup/saída (faltava):** saem da Circle por ownership — PITR do Supabase Pro ou `pg_dump` semanal.
9. **Staging (faltava):** preview deploys da Vercel + branch/projeto Supabase secundário — deploy quebrado no domingo à noite = segunda sem Conduta.

## Pontos para advogado LGPD (saúde) antes do ar

1. Copy do formulário de submissão de caso (instruir e **estruturalmente desencorajar** identificadores — sem campo livre de "nome da paciente")
2. **Período de retenção** e auto-exclusão de `case_submissions` (sugestão: 6 meses pós-evento)
3. Política de privacidade nomeando Supabase/Bunny/Vercel/Resend como operadoras + transferência internacional de dados
4. Gravações dos Rounds onde casos são discutidos = dado de saúde (mesmo cuidado no fluxo de anexar gravação)
5. Encarregado (DPO) / canal de contato

## Custos estimados

Supabase Pro US$25 · Vercel Pro US$20 (Hobby veda uso comercial) · Bunny ~US$2–4 · Resend free tier → **~US$50/mês**.

## Decisões pendentes (não bloqueiam o início)

- Payloads reais do webhook Kirvano (vocês têm as docs — preciso deles no incremento 11) + mapeamento oferta→plano + se a Kirvano tem API de consulta
- Domínio do app e subdomínio de e-mail (quem controla o DNS)
- Dia/hora do digest semanal (sugestão: sexta 08:00)
- Algum dos 4 espaços de lançamento permite post de membro?
- Logo/ícone para o PWA (tenho a paleta e as fontes; falta o asset do logo)

## Verificação end-to-end

Cada incremento termina com verificação manual listada acima. Ao final: fluxo completo simulado — webhook `activated` → magic link → onboarding com consentimento → assistir vídeo no celular (4G throttled) → agendar Conduta para segunda 07:00 → confirmar publicação/notificação/e-mail no horário → `payment_failed` → banner de carência → expiração → reativação.
