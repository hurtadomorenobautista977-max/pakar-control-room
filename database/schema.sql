create table public.workspace_members (
 email text primary key check (email=lower(email)),
 role text not null default 'editor' check (role in ('owner','editor','viewer')),
 created_at timestamptz not null default now()
);
alter table public.workspace_members enable row level security;
revoke all on public.workspace_members from anon, authenticated;
grant select on public.workspace_members to authenticated;
create policy members_read_self on public.workspace_members for select to authenticated
using (email=lower((select auth.jwt()->>'email')) and (select auth.uid()) is not null);

create table public.records (
 id text primary key default gen_random_uuid()::text,
 kind text not null check (kind in ('issue','knowledge')),
 title text not null check (length(trim(title)) between 1 and 180),
 domain text not null default 'عمومی',
 priority text not null default 'normal' check (priority in ('normal','high','critical')),
 status text not null default 'open' check (status in ('open','progress','closed')),
 owner text not null default '', due text not null default '' check (due='' or due ~ '^\d{4}-\d{2}-\d{2}$'),
 summary text not null default '' check (length(summary)<=8000),
 decision text not null default '' check (length(decision)<=8000),
 action text not null default '' check (length(action)<=8000),
 reference text not null default '' check (reference='' or reference ~ '^https?://'),
 tags text not null default '', pinned boolean not null default false,
 "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 "deletedAt" timestamptz
);
alter table public.records enable row level security;
revoke all on public.records from anon, authenticated;
grant select on public.records to authenticated;
grant insert (id,kind,title,domain,priority,status,owner,due,summary,decision,action,reference,tags,pinned) on public.records to authenticated;
grant update (kind,title,domain,priority,status,owner,due,summary,decision,action,reference,tags,pinned,"updatedAt","deletedAt") on public.records to authenticated;
create policy records_read_members on public.records for select to authenticated
using (exists (select 1 from public.workspace_members where email=lower((select auth.jwt()->>'email'))));
create policy records_insert_editors on public.records for insert to authenticated
with check (created_by=(select auth.uid()) and exists (select 1 from public.workspace_members where email=lower((select auth.jwt()->>'email')) and role in ('owner','editor')));
create policy records_update_editors on public.records for update to authenticated
using (exists (select 1 from public.workspace_members where email=lower((select auth.jwt()->>'email')) and role in ('owner','editor')))
with check (exists (select 1 from public.workspace_members where email=lower((select auth.jwt()->>'email')) and role in ('owner','editor')));
create index records_updated_at_idx on public.records ("updatedAt" desc);
create index records_created_by_idx on public.records (created_by);
create function public.set_record_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$
begin new."updatedAt"=now(); return new; end; $$;
revoke all on function public.set_record_updated_at() from public,anon,authenticated;
create trigger record_updated_at before update on public.records for each row execute function public.set_record_updated_at();
