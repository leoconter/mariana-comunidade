-- 0003_publish_cron: run the publish sweep every minute.
-- Visibility of due scheduled posts does NOT depend on this (RLS treats
-- `scheduled AND publish_at <= now()` as published); the sweep only flips the
-- status and fans out in-app notifications. Email side effects are wired in a
-- later migration via pg_net once the production URL exists.

select cron.schedule(
  'publish-sweep',
  '* * * * *',
  $$select public.run_publish_sweep()$$
);
