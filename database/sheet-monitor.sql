create table public.sheet_monitor_latest (
  source text primary key,
  successful_at timestamptz,
  attempted_at timestamptz not null,
  payload jsonb,
  failed boolean not null
);
create table public.sheet_monitor_history (
  source text not null,
  captured_at timestamptz not null,
  payload jsonb not null,
  primary key (source,captured_at)
);
alter table public.sheet_monitor_latest enable row level security;
alter table public.sheet_monitor_history enable row level security;
revoke all on public.sheet_monitor_latest, public.sheet_monitor_history from anon, authenticated;
grant select on public.sheet_monitor_latest to authenticated;
grant all on public.sheet_monitor_latest, public.sheet_monitor_history to service_role;
create policy sheet_monitor_read on public.sheet_monitor_latest for select to authenticated using (
  exists (select 1 from public.workspace_members m
    where m.email=lower((select auth.jwt()->>'email'))
    and (source not in ('requests','settlements') or m.role='owner'))
);

create schema if not exists pakar_internal;
create table pakar_internal.monitor_lease (singleton boolean primary key check (singleton), expires_at timestamptz not null);
grant usage on schema pakar_internal to service_role;
grant select, insert, update on pakar_internal.monitor_lease to service_role;

-- Privileged functions are restricted to the server role. The scheduler token is
-- compared inside Postgres and never returned to the browser or the Edge handler.
create function public.pakar_monitor_scheduler_matches(token text) returns boolean
language sql security definer set search_path='' as $$
  select exists(select 1 from vault.decrypted_secrets
    where name='pakar_sheet_monitor_scheduler' and decrypted_secret=token);
$$;
revoke all on function public.pakar_monitor_scheduler_matches(text) from public, anon, authenticated;
grant execute on function public.pakar_monitor_scheduler_matches(text) to service_role;

create function public.pakar_monitor_claim() returns boolean
language sql security invoker set search_path='' as $$
  with claimed as (
    insert into pakar_internal.monitor_lease as lease values(true,now()+interval '45 seconds')
    on conflict (singleton) do update set expires_at=excluded.expires_at where lease.expires_at<=now()
    returning singleton
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.pakar_monitor_claim() from public, anon, authenticated;
grant execute on function public.pakar_monitor_claim() to service_role;

create function public.pakar_monitor_store(results jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  insert into public.sheet_monitor_latest (source,successful_at,attempted_at,payload,failed)
  select key, case when value<>'null'::jsonb then now() end, now(), nullif(value,'null'::jsonb), value='null'::jsonb
  from jsonb_each(results)
  on conflict (source) do update set
    successful_at=coalesce(excluded.successful_at,sheet_monitor_latest.successful_at),
    attempted_at=excluded.attempted_at,
    payload=coalesce(excluded.payload,sheet_monitor_latest.payload),
    failed=excluded.failed;
  insert into public.sheet_monitor_history (source,captured_at,payload)
  select key,now(),value from jsonb_each(results) where value<>'null'::jsonb
  on conflict do nothing;
end;
$$;
revoke all on function public.pakar_monitor_store(jsonb) from public, anon, authenticated;
grant execute on function public.pakar_monitor_store(jsonb) to service_role;
