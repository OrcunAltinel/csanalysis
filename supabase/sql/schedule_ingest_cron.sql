-- Run this manually in the Supabase SQL editor AFTER you have deployed the
-- Next.js app somewhere reachable over HTTPS (e.g. Vercel).
--
-- It is not a migration (it depends on values only known post-deploy) and is
-- not applied automatically by `supabase db push`.
--
-- Replace:
--   <YOUR_DEPLOYED_APP_URL>  e.g. https://csanalysis.vercel.app
--   <YOUR_CRON_SECRET>       must match the CRON_SECRET env var on the app

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Runs every 5 minutes. Adjust the schedule string to change frequency
-- (pg_cron uses standard 5-field cron syntax).
select cron.schedule(
  'csanalysis-ingest',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := '<YOUR_DEPLOYED_APP_URL>/api/ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To inspect scheduled jobs:
--   select * from cron.job;
-- To see run history:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- To remove the schedule:
--   select cron.unschedule('csanalysis-ingest');
