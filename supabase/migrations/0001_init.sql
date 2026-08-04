-- 0001_init: full domain schema, access functions, RLS, Portuguese FTS, storage buckets, seeds.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Portuguese FTS that ignores accents ("avaliacao" matches "avaliação").
create text search configuration public.pt (copy = portuguese);
alter text search configuration public.pt
  alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem;

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- Identity & access
-- ============================================================
create table public.admin_emails (
  email text primary key
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  city text,
  state char(2),
  crefito text,
  years_experience int,
  bio text,
  role text not null default 'member' check (role in ('member', 'moderator', 'admin')),
  directory_visible boolean not null default true,
  muted_until timestamptz,
  banned_at timestamptz,
  last_seen_at timestamptz,
  -- Denormalized access decision, maintained by Kirvano webhook + manual grants,
  -- reconciled nightly by the access sweep. NULL = never had access.
  access_valid_until timestamptz,
  email_prefs jsonb not null default '{"digest": true, "announcements": true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_access_idx on public.profiles (access_valid_until);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select exists (select 1 from admin_emails where email = new.email) into v_is_admin;
  insert into public.profiles (id, email, full_name, role, access_valid_until)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when v_is_admin then 'admin' else 'member' end,
    case when v_is_admin then 'infinity'::timestamptz else null end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Privilege-escalation guard: non-admins cannot touch moderation/access columns
-- (enforced here instead of in the RLS policy to avoid self-referential recursion).
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for service-role/postgres writers (webhooks, sweeps) — allow those.
  if (select auth.uid()) is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.access_valid_until is distinct from old.access_valid_until
       or new.banned_at is distinct from old.banned_at
       or new.muted_until is distinct from old.muted_until
       or new.email is distinct from old.email then
      raise exception 'você não pode alterar estes campos';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  kirvano_customer_id text,
  kirvano_subscription_id text,
  plan text check (plan in ('monthly', 'quarterly', 'annual')),
  status text not null check (status in ('active', 'past_due', 'canceled', 'expired')),
  current_period_end timestamptz,
  grace_until timestamptz,
  canceled_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  reason text,
  expires_at timestamptz, -- NULL = indefinite
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index access_grants_user_idx on public.access_grants (user_id);

create table public.kirvano_webhook_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('tos', 'privacy', 'case_health_data')),
  doc_version text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  user_agent text
);
create index consents_user_idx on public.consents (user_id);

-- ============================================================
-- Access decision functions (always call as `(select fn())` in
-- policies so they become InitPlans — evaluated once per query).
-- ============================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'admin'
  )
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role in ('admin', 'moderator')
  )
$$;

create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid())
      and banned_at is null
      and access_valid_until > now()
  )
$$;

-- ============================================================
-- Structure: sections & spaces
-- ============================================================
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections (id) on delete set null,
  type text not null check (type in ('feed', 'library', 'events')),
  name text not null,
  slug text not null unique,
  emoji text,
  description text,
  cover_url text,
  visibility text not null default 'all' check (visibility in ('all', 'hidden', 'invite')),
  position int not null default 0,
  allow_member_posts boolean not null default false,
  allow_comments boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger spaces_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();

create table public.space_memberships (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_member boolean not null default false, -- entry to invite-only spaces (admin-managed)
  following boolean not null default true,  -- drives the home feed
  notify text not null default 'all' check (notify in ('all', 'none')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- Only admins may flip is_member (invite-only entry); members manage follow/notify.
create or replace function public.guard_space_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.is_member)
     or (tg_op = 'UPDATE' and new.is_member is distinct from old.is_member) then
    -- auth.uid() is null for service-role writers (provisioning jobs) — allow those.
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'somente administradores podem alterar convites de espaço';
    end if;
  end if;
  return new;
end $$;
create trigger space_memberships_guard
  before insert or update on public.space_memberships
  for each row execute function public.guard_space_membership();

-- Space ids the current user can see (security definer avoids RLS recursion).
create or replace function public.visible_space_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from spaces s
  where s.archived_at is null
    and (
      s.visibility = 'all'
      or (
        s.visibility = 'invite'
        and s.id in (
          select m.space_id from space_memberships m
          where m.user_id = (select auth.uid()) and m.is_member
        )
      )
    )
$$;

-- ============================================================
-- Content: post types (editable templates), posts, tags
-- ============================================================
create table public.post_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  emoji text,
  description text,
  body_template jsonb not null default '{"type": "doc", "content": []}',
  field_schema jsonb not null default '[]',
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger post_types_updated_at before update on public.post_types
  for each row execute function public.set_updated_at();

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  post_type_id uuid references public.post_types (id) on delete set null,
  title text not null default '',
  body jsonb not null default '{"type": "doc", "content": []}',
  body_text text not null default '', -- plain text extracted server-side on save
  custom_fields jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  publish_at timestamptz,
  published_at timestamptz,
  is_pinned boolean not null default false,
  comments_closed boolean not null default false,
  notify_members boolean not null default true,
  notified_at timestamptz,
  search_tsv tsvector generated always as (
    to_tsvector('public.pt', coalesce(title, '') || ' ' || coalesce(body_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_space_idx on public.posts (space_id, status, publish_at desc);
create index posts_feed_idx on public.posts (status, published_at desc);
create index posts_search_idx on public.posts using gin (search_tsv);
create index posts_impact_idx on public.posts ((custom_fields ->> 'clinical_impact'));
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null default 'condition' check (kind in ('condition', 'material')),
  created_at timestamptz not null default now()
);

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag_idx on public.post_tags (tag_id);

-- ============================================================
-- Media
-- ============================================================
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('video', 'pdf', 'image', 'doc', 'sheet', 'other')),
  title text not null default '',
  filename text not null default '',
  mime text,
  size_bytes bigint,
  storage_path text,        -- Supabase Storage (non-video)
  bunny_video_id text unique, -- Bunny Stream (video)
  bunny_status text check (bunny_status in ('created', 'uploading', 'processing', 'ready', 'failed')),
  duration_seconds int,
  thumbnail_url text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();

create table public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete restrict,
  position int not null default 0,
  caption text,
  unique (post_id, media_id)
);
create index post_attachments_media_idx on public.post_attachments (media_id);

-- ============================================================
-- Engagement
-- ============================================================
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  is_pinned boolean not null default false,
  hidden_at timestamptz,
  hidden_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- Hard guarantee of 1-level nesting + closed/permission checks.
create or replace function public.guard_comment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_post posts%rowtype;
  v_space spaces%rowtype;
  v_profile profiles%rowtype;
begin
  select * into v_post from posts where id = new.post_id;
  if v_post.id is null then
    raise exception 'post não encontrado';
  end if;
  select * into v_space from spaces where id = v_post.space_id;
  select * into v_profile from profiles where id = new.author_id;

  if new.parent_id is not null then
    if exists (select 1 from comments c where c.id = new.parent_id and c.parent_id is not null) then
      raise exception 'respostas têm no máximo 1 nível';
    end if;
    if not exists (select 1 from comments c where c.id = new.parent_id and c.post_id = new.post_id) then
      raise exception 'comentário pai inválido';
    end if;
  end if;

  if not public.is_staff() then
    if v_post.comments_closed then
      raise exception 'os comentários deste post estão encerrados';
    end if;
    if not v_space.allow_comments then
      raise exception 'este espaço não permite comentários';
    end if;
    if v_profile.muted_until is not null and v_profile.muted_until > now() then
      raise exception 'você está temporariamente impedida de comentar';
    end if;
  end if;

  return new;
end $$;
create trigger comments_guard before insert on public.comments
  for each row execute function public.guard_comment_insert();

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1),
  unique (user_id, post_id),
  unique (user_id, comment_id)
);

create table public.saved_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.post_views (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.media_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  seconds numeric not null default 0,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

-- ============================================================
-- Events (Round Clínico)
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  duration_minutes int not null default 60,
  meeting_url text,
  accepts_cases boolean not null default true,
  recording_post_id uuid references public.posts (id) on delete set null,
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_starts_idx on public.events (starts_at);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'declined')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.case_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null,
  consent_id uuid not null references public.consents (id),
  status text not null default 'submitted' check (status in ('submitted', 'selected', 'discussed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index case_submissions_event_idx on public.case_submissions (event_id);

-- ============================================================
-- Moderation, notifications, comms
-- ============================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution text,
  created_at timestamptz not null default now()
);

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_post_id uuid references public.posts (id) on delete set null,
  target_comment_id uuid references public.comments (id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('new_post', 'comment_reply', 'post_comment', 'event_reminder', 'announcement')),
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body jsonb not null default '{"type": "doc", "content": []}',
  show_banner_until timestamptz,
  emailed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.email_templates (
  key text primary key,
  subject text not null,
  body_html text not null,
  updated_at timestamptz not null default now()
);
create trigger email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  template_key text,
  subject text,
  resend_id text,
  status text,
  related jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index email_log_related_idx on public.email_log using gin (related);

-- ============================================================
-- Scheduled publish sweep (side effects only; visibility is via RLS).
-- pg_cron schedule is added in a later migration once the app URL exists.
-- ============================================================
create or replace function public.run_publish_sweep() returns void
language plpgsql security definer set search_path = public as $$
begin
  with flipped as (
    update posts
    set status = 'published', published_at = publish_at
    where status = 'scheduled' and publish_at <= now()
    returning id, space_id, notify_members
  )
  insert into notifications (user_id, kind, post_id)
  select m.user_id, 'new_post', f.id
  from flipped f
  join space_memberships m on m.space_id = f.space_id
  join profiles p on p.id = m.user_id
  where f.notify_members
    and m.notify = 'all'
    and p.banned_at is null
    and p.access_valid_until > now();
end $$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.access_grants enable row level security;
alter table public.kirvano_webhook_events enable row level security;
alter table public.consents enable row level security;
alter table public.sections enable row level security;
alter table public.spaces enable row level security;
alter table public.space_memberships enable row level security;
alter table public.post_types enable row level security;
alter table public.posts enable row level security;
alter table public.tags enable row level security;
alter table public.post_tags enable row level security;
alter table public.media_assets enable row level security;
alter table public.post_attachments enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.saved_posts enable row level security;
alter table public.post_views enable row level security;
alter table public.media_progress enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.case_submissions enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_log enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_log enable row level security;

-- admin_emails: no policies — service role only.

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select is_staff())
    or ((select has_access()) and directory_visible)
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy profiles_admin_all on public.profiles for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- subscriptions: read own / admin; writes via service role only.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));

-- access_grants
create policy access_grants_select on public.access_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy access_grants_admin on public.access_grants for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- kirvano_webhook_events: admin read; writes via service role.
create policy kirvano_events_select on public.kirvano_webhook_events for select to authenticated
  using ((select is_admin()));

-- consents
create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- sections
create policy sections_select on public.sections for select to authenticated
  using ((select is_admin()) or (select has_access()));
create policy sections_admin on public.sections for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- spaces
create policy spaces_select on public.spaces for select to authenticated
  using (
    (select is_admin())
    or ((select has_access()) and id in (select public.visible_space_ids()))
  );
create policy spaces_admin on public.spaces for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- space_memberships
create policy space_memberships_select on public.space_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy space_memberships_write_own on public.space_memberships for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and ((select is_admin()) or space_id in (select public.visible_space_ids()))
  );
create policy space_memberships_update_own on public.space_memberships for update to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()))
  with check (user_id = (select auth.uid()) or (select is_admin()));
create policy space_memberships_delete_own on public.space_memberships for delete to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy space_memberships_admin_insert on public.space_memberships for insert to authenticated
  with check ((select is_admin()));

-- post_types
create policy post_types_select on public.post_types for select to authenticated
  using ((select is_admin()) or (select has_access()));
create policy post_types_admin on public.post_types for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- posts: members see published (or due-scheduled) posts in visible spaces.
create policy posts_select on public.posts for select to authenticated
  using (
    (select is_admin())
    or (
      (select has_access())
      and (status = 'published' or (status = 'scheduled' and publish_at <= now()))
      and space_id in (select public.visible_space_ids())
    )
    or (author_id = (select auth.uid())) -- own drafts (member posting, if enabled)
  );
create policy posts_insert on public.posts for insert to authenticated
  with check (
    (select is_admin())
    or (
      (select has_access())
      and author_id = (select auth.uid())
      and space_id in (select s.id from public.spaces s where s.allow_member_posts and s.archived_at is null)
    )
  );
create policy posts_update on public.posts for update to authenticated
  using ((select is_admin()) or author_id = (select auth.uid()))
  with check ((select is_admin()) or author_id = (select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated
  using ((select is_admin()) or author_id = (select auth.uid()));

-- tags
create policy tags_select on public.tags for select to authenticated
  using ((select is_admin()) or (select has_access()));
create policy tags_admin on public.tags for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- post_tags
create policy post_tags_select on public.post_tags for select to authenticated
  using ((select is_admin()) or (select has_access()));
create policy post_tags_admin on public.post_tags for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- media_assets: metadata readable by members (file bytes gated by signed URLs / embed tokens).
create policy media_assets_select on public.media_assets for select to authenticated
  using ((select is_admin()) or ((select has_access()) and deleted_at is null));
create policy media_assets_admin on public.media_assets for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- post_attachments: visible when the post is visible (posts RLS applies in the subquery).
create policy post_attachments_select on public.post_attachments for select to authenticated
  using (post_id in (select id from public.posts));
create policy post_attachments_admin on public.post_attachments for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- comments
create policy comments_select on public.comments for select to authenticated
  using (
    post_id in (select id from public.posts)
    and deleted_at is null
    and (hidden_at is null or author_id = (select auth.uid()) or (select is_staff()))
  );
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and ((select has_access()) or (select is_staff()))
    and post_id in (select id from public.posts)
  );
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) or (select is_staff()))
  with check (author_id = (select auth.uid()) or (select is_staff()));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select is_staff()));

-- reactions
create policy reactions_select on public.reactions for select to authenticated
  using ((select is_admin()) or (select has_access()));
create policy reactions_write on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and ((select has_access()) or (select is_staff())));
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- saved_posts / post_views / media_progress: own rows only.
create policy saved_posts_own on public.saved_posts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy post_views_own on public.post_views for all to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()))
  with check (user_id = (select auth.uid()));
create policy media_progress_own on public.media_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- events
create policy events_select on public.events for select to authenticated
  using (
    (select is_admin())
    or ((select has_access()) and space_id in (select public.visible_space_ids()))
  );
create policy events_admin on public.events for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- event_rsvps
create policy event_rsvps_select on public.event_rsvps for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy event_rsvps_write on public.event_rsvps for insert to authenticated
  with check (user_id = (select auth.uid()) and (select has_access()));
create policy event_rsvps_update on public.event_rsvps for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy event_rsvps_delete on public.event_rsvps for delete to authenticated
  using (user_id = (select auth.uid()));

-- case_submissions: owner + admin ONLY (sensitive health data — moderators excluded).
create policy case_submissions_select on public.case_submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select is_admin()));
create policy case_submissions_insert on public.case_submissions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select has_access()));
create policy case_submissions_update on public.case_submissions for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- reports
create policy reports_select on public.reports for select to authenticated
  using ((select is_staff()) or reporter_id = (select auth.uid()));
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and (select has_access()));
create policy reports_update on public.reports for update to authenticated
  using ((select is_staff())) with check ((select is_staff()));

-- moderation_log
create policy moderation_log_select on public.moderation_log for select to authenticated
  using ((select is_staff()));
create policy moderation_log_insert on public.moderation_log for insert to authenticated
  with check ((select is_staff()) and actor_id = (select auth.uid()));

-- notifications: own rows; inserts come from definer functions / service role.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- announcements
create policy announcements_select on public.announcements for select to authenticated
  using ((select is_admin()) or (select has_access()));
create policy announcements_admin on public.announcements for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- email_templates / email_log: admin only.
create policy email_templates_admin on public.email_templates for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));
create policy email_log_select on public.email_log for select to authenticated
  using ((select is_admin()));

-- ============================================================
-- Storage buckets & policies
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', false), ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy storage_media_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy storage_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
create policy storage_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
-- select needed to create signed URLs with the user-scoped client
create policy storage_media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((select public.is_admin()) or (select public.has_access())));

create policy storage_avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy storage_avatars_write_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy storage_avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============================================================
-- Seeds
-- ============================================================
insert into public.admin_emails (email) values ('elev@elev.ag');

insert into public.sections (id, name, position) values
  ('11111111-1111-4111-8111-111111111101', 'Comunidade', 0),
  ('11111111-1111-4111-8111-111111111102', 'Conteúdo Semanal', 1),
  ('11111111-1111-4111-8111-111111111103', 'Ao Vivo', 2);

insert into public.spaces (section_id, type, name, slug, emoji, description, position) values
  ('11111111-1111-4111-8111-111111111101', 'feed', 'Comece aqui', 'comece-aqui', '🆕',
   'Boas-vindas! Comece por este espaço para conhecer a comunidade e aproveitar tudo que ela oferece.', 0),
  ('11111111-1111-4111-8111-111111111102', 'feed', 'Conduta da Semana', 'conduta-da-semana', '🤸',
   'Toda segunda: um vídeo curto respondendo uma dúvida clínica prática e objetiva.', 0),
  ('11111111-1111-4111-8111-111111111102', 'feed', 'Artigos Comentados', 'artigos-comentados', '🔎',
   'Artigo científico recente comentado em vídeo, com o PDF anexado e classificação de impacto clínico.', 1),
  ('11111111-1111-4111-8111-111111111103', 'events', 'Round Clínico', 'round-clinico', '📁',
   'Call quinzenal ao vivo: traga seu caso impossível. Gravações anteriores ficam arquivadas aqui.', 0);

insert into public.post_types (key, name, emoji, description, body_template, field_schema, position) values
  ('conduta_semana', 'Conduta da Semana', '🤸',
   'Vídeo curto (~5 min) respondendo uma dúvida clínica. O título é a pergunta.',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Descreva em poucas linhas o que este vídeo responde e para quem ele é útil."}]}]}',
   '[{"key":"video","label":"Vídeo","type":"attachment_slots","slots":["video"]},{"key":"conditions","label":"Condições clínicas","type":"tags"}]',
   0),
  ('artigo_comentado', 'Artigo Comentado', '🔎',
   'Artigo científico comentado em vídeo (10–15 min) com PDF anexado e impacto clínico.',
   '{"type":"doc","content":[
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"1. O que o estudo avaliou"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"2. Vale a pena ler?"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"3. O que muda na prática?"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"4. Limitações"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"5. Como aplicar amanhã no consultório"}]},
     {"type":"paragraph"}
   ]}',
   '[{"key":"clinical_impact","label":"Impacto clínico","type":"select","required":true,"options":[
      {"value":"alto","label":"🟢 Alto — muda a conduta imediatamente","color":"green"},
      {"value":"medio","label":"🟡 Médio — muda o raciocínio clínico","color":"yellow"},
      {"value":"baixo","label":"🔵 Baixo — atualização científica","color":"blue"}]},
     {"key":"video","label":"Vídeo","type":"attachment_slots","slots":["video","pdf"]},
     {"key":"conditions","label":"Condições clínicas","type":"tags"}]',
   1),
  ('caso_clinico', 'Caso Clínico', '🧠',
   'Caso clínico estruturado para a biblioteca de Raciocínio Clínico Aplicado.',
   '{"type":"doc","content":[
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Condição"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hipóteses"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Avaliação"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Diagnóstico funcional"}]},
     {"type":"paragraph"},
     {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Conduta"}]},
     {"type":"paragraph"}
   ]}',
   '[{"key":"conditions","label":"Condições clínicas","type":"tags"}]',
   2),
  ('newsletter', 'Newsletter', '🌍',
   'Texto livre — resumo mensal do que mudou no mundo da pélvica.',
   '{"type":"doc","content":[{"type":"paragraph"}]}',
   '[]',
   3),
  ('material_download', 'Material para Download', '📝',
   'Arquivo (PDF, imagem, planilha) com descrição de uso em consultório.',
   '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Como usar este material"}]},{"type":"paragraph"}]}',
   '[{"key":"file","label":"Arquivo","type":"attachment_slots","slots":["pdf"]},{"key":"conditions","label":"Condições clínicas","type":"tags"}]',
   4);

insert into public.tags (name, slug, kind) values
  ('Endometriose', 'endometriose', 'condition'),
  ('Bexiga Dolorosa', 'bexiga-dolorosa', 'condition'),
  ('Dor na Relação', 'dor-na-relacao', 'condition'),
  ('Incontinência Urinária', 'incontinencia-urinaria', 'condition'),
  ('Gestação e Pós-parto', 'gestacao-e-pos-parto', 'condition'),
  ('Constipação', 'constipacao', 'condition'),
  ('Prolapso', 'prolapso', 'condition');

insert into public.email_templates (key, subject, body_html) values
  ('welcome', 'Bem-vinda à Comunidade! 💛',
   '<p>Olá, {{nome}}!</p><p>Sua assinatura está ativa e a comunidade já está aberta para você.</p><p>Comece pelo espaço <strong>🆕 Comece aqui</strong> — em poucos minutos você vai entender como aproveitar tudo.</p><p><a href="{{url}}">Entrar na comunidade</a></p><p>Nos vemos lá!<br>Mariana</p>'),
  ('payment_failed', 'Detectamos um problema no seu pagamento',
   '<p>Olá, {{nome}}!</p><p>O pagamento da sua assinatura não foi aprovado. Seu acesso continua ativo até <strong>{{data_limite}}</strong> — regularize até lá para não perder o acesso.</p><p><a href="{{url_pagamento}}">Regularizar pagamento</a></p>'),
  ('access_expired', 'Seu acesso à comunidade foi encerrado',
   '<p>Olá, {{nome}}!</p><p>Seu acesso à comunidade foi encerrado. Sentiremos sua falta!</p><p>Quando quiser voltar, é só reativar a assinatura: <a href="{{url_reativacao}}">reativar agora</a>.</p>'),
  ('new_post', '{{titulo}}',
   '<p>Novo conteúdo no espaço {{espaco}}:</p><h2>{{titulo}}</h2><p><a href="{{url}}">Ver na comunidade</a></p>'),
  ('event_reminder', 'Lembrete: {{titulo}} {{quando}}',
   '<p>Olá, {{nome}}!</p><p>O <strong>{{titulo}}</strong> começa {{quando}}.</p><p><a href="{{url_call}}">Entrar na call</a></p>'),
  ('weekly_digest', 'O que rolou na comunidade esta semana',
   '<p>Olá, {{nome}}!</p><p>Estes foram os conteúdos da semana:</p>{{lista_posts}}<p><a href="{{url}}">Abrir a comunidade</a></p>');
