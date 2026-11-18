create extension if not exists pg_net;
create extension if not exists pg_cron;
do $$
begin
  if not exists(select 1 from vault.secrets where name='pakar_sheet_monitor_scheduler') then
    perform vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text,'pakar_sheet_monitor_scheduler');
  end if;
end $$;
select cron.schedule('pakar-sheet-monitor-hourly','7 * * * *',$job$
  select net.http_post(
    url:='https://ihcpohnoduvwxdpnjcze.supabase.co/functions/v1/sheet-monitor',
    body:='{}'::jsonb,
    headers:=jsonb_build_object('Content-Type','application/json','X-Monitor-Scheduler',
      (select decrypted_secret from vault.decrypted_secrets where name='pakar_sheet_monitor_scheduler')),
    timeout_milliseconds:=25000
  );
$job$);
