-- Paste this in Supabase → SQL Editor → Run
-- Fixes: new row violates row-level security policy for table "clinic_snapshot"

grant usage on schema public to authenticated;
grant select, insert, update on public.clinic_snapshot to authenticated;

drop policy if exists snapshot_select_authenticated on public.clinic_snapshot;
create policy snapshot_select_authenticated on public.clinic_snapshot
  for select to authenticated
  using (true);

drop policy if exists snapshot_insert_authenticated on public.clinic_snapshot;
create policy snapshot_insert_authenticated on public.clinic_snapshot
  for insert to authenticated
  with check (true);

drop policy if exists snapshot_update_authenticated on public.clinic_snapshot;
create policy snapshot_update_authenticated on public.clinic_snapshot
  for update to authenticated
  using (true)
  with check (true);

create or replace function public.save_clinic_snapshot(snapshot_id text, snapshot jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clinic_snapshot (id, data, updated_at)
  values (coalesce(nullif(snapshot_id, ''), 'main'), snapshot, now())
  on conflict (id) do update
    set data = excluded.data,
        updated_at = now();
  return coalesce(nullif(snapshot_id, ''), 'main');
end;
$$;

revoke all on function public.save_clinic_snapshot(text, jsonb) from public;
grant execute on function public.save_clinic_snapshot(text, jsonb) to authenticated;

insert into public.clinic_snapshot (id, data)
values ('main', '{"patients":[],"visits":[],"invoices":[],"appointments":[],"histories":[],"exams":[],"clinic":{}}'::jsonb)
on conflict (id) do nothing;
