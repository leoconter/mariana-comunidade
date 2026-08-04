-- 0002_hardening: fixes from Supabase security advisors after 0001.

-- Pin search_path on the generic trigger helper.
alter function public.set_updated_at() set search_path = public;

-- Trigger functions and the sweep must not be callable via PostgREST RPC.
-- (Triggers still fire — EXECUTE is only checked for direct calls.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.guard_space_membership() from public, anon, authenticated;
revoke execute on function public.guard_comment_insert() from public, anon, authenticated;
revoke execute on function public.run_publish_sweep() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Access helpers are needed by RLS policies (run as the querying role):
-- keep EXECUTE for authenticated, drop it for anon/public.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.has_access() from public, anon;
revoke execute on function public.visible_space_ids() from public, anon;

-- Move pg_net out of the public schema.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
