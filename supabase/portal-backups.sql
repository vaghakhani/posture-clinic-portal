-- Dated clinic backups (run in Supabase SQL editor).

create table if not exists public.clinic_backups (
  id uuid primary key default gen_random_uuid(),
  stamp text not null,
  kind text not null default 'database',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clinic_backups_created_at_idx on public.clinic_backups (created_at desc);
create index if not exists clinic_backups_stamp_idx on public.clinic_backups (stamp);

alter table public.clinic_backups enable row level security;

drop policy if exists clinic_backups_select_authenticated on public.clinic_backups;
create policy clinic_backups_select_authenticated on public.clinic_backups
  for select to authenticated
  using (true);

drop policy if exists clinic_backups_insert_authenticated on public.clinic_backups;
create policy clinic_backups_insert_authenticated on public.clinic_backups
  for insert to authenticated
  with check (true);

create or replace function public.save_clinic_backup(backup_stamp text, backup_kind text, backup_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.clinic_backups (stamp, kind, data)
  values (
    coalesce(nullif(backup_stamp, ''), to_char(now(), 'YYYY-MM-DD_HH24-MI')),
    coalesce(nullif(backup_kind, ''), 'database'),
    coalesce(backup_data, '{}'::jsonb)
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.save_clinic_backup(text, text, jsonb) from public;
grant execute on function public.save_clinic_backup(text, text, jsonb) to authenticated, service_role;
grant select, insert on public.clinic_backups to authenticated, service_role;
