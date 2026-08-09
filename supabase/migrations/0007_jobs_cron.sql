-- Email side of the scheduled jobs: pg_cron + pg_net -> /api/jobs/*.
-- The in-app publish sweep (run_publish_sweep) stays in 0003_publish_cron.sql;
-- these schedules only drive the outgoing email routes, all of them idempotent
-- via *_sent_at / notified_at markers, so a retry never double-sends.
--
-- No secret lives in this file. Configure once per environment:
--   select vault.create_secret('<JOBS_SECRET>',          'jobs_secret');
--   select vault.create_secret('https://<host-do-app>',  'jobs_base_url');

create or replace function public.call_job(job_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  job_secret text;
  request_id bigint;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets
   where name = 'jobs_base_url';

  select decrypted_secret into job_secret
    from vault.decrypted_secrets
   where name = 'jobs_secret';

  -- Missing config must not abort the cron transaction: warn and skip.
  if base_url is null or job_secret is null then
    raise warning 'call_job(%): jobs_base_url/jobs_secret ausentes no vault', job_path;
    return null;
  end if;

  select net.http_post(
    url := base_url || job_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-jobs-secret', job_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) into request_id;

  return request_id;
end;
$$;

comment on function public.call_job(text) is
  'Authenticated POST to /api/jobs/*. Base URL and secret come from Vault.';

-- Never reachable from a member-initiated request.
revoke all on function public.call_job(text) from public;

-- Re-running this migration must not stack duplicate schedules.
select cron.unschedule(jobname)
  from cron.job
 where jobname in (
   'jobs-publish-sweep',
   'jobs-event-reminders',
   'jobs-access-sweep',
   'jobs-weekly-digest'
 );

-- pg_cron runs in UTC; comments give the America/Sao_Paulo equivalent.
select cron.schedule(
  'jobs-publish-sweep', '*/5 * * * *',
  $job$select public.call_job('/api/jobs/publish-sweep')$job$
);

-- Windows are "starts_at <= now + 24h / + 1h", so a 5-minute tick keeps the
-- "1 hour before" reminder within ~5 minutes of the intended moment.
select cron.schedule(
  'jobs-event-reminders', '*/5 * * * *',
  $job$select public.call_job('/api/jobs/event-reminders')$job$
);

-- 06:00 UTC = 03:00 em São Paulo.
select cron.schedule(
  'jobs-access-sweep', '0 6 * * *',
  $job$select public.call_job('/api/jobs/access-sweep')$job$
);

-- Segunda 11:00 UTC = 08:00 em São Paulo.
select cron.schedule(
  'jobs-weekly-digest', '0 11 * * 1',
  $job$select public.call_job('/api/jobs/weekly-digest')$job$
);
