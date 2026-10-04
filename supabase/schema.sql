-- Run in Supabase SQL editor so public forms add patients to the shared list.

create table if not exists public.intake_submissions (
  id text primary key,
  status text not null default 'pending',
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.intake_submissions enable row level security;

drop policy if exists intake_insert_anon on public.intake_submissions;
create policy intake_insert_anon on public.intake_submissions
  for insert to anon, authenticated
  with check (true);

drop policy if exists intake_select_authenticated on public.intake_submissions;
create policy intake_select_authenticated on public.intake_submissions
  for select to authenticated
  using (true);

drop policy if exists intake_update_authenticated on public.intake_submissions;
create policy intake_update_authenticated on public.intake_submissions
  for update to authenticated
  using (true)
  with check (true);

create table if not exists public.clinic_snapshot (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.clinic_snapshot enable row level security;

drop policy if exists snapshot_select_authenticated on public.clinic_snapshot;
create policy snapshot_select_authenticated on public.clinic_snapshot
  for select to authenticated
  using (true);

drop policy if exists snapshot_write_authenticated on public.clinic_snapshot;
create policy snapshot_write_authenticated on public.clinic_snapshot
  for all to authenticated
  using (true)
  with check (true);

insert into public.clinic_snapshot (id, data)
values ('main', '{"patients":[],"visits":[],"invoices":[],"appointments":[],"histories":[],"exams":[],"clinic":{}}'::jsonb)
on conflict (id) do nothing;

create or replace function public.submit_patient_intake(patient jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id text;
  first_name text;
  last_name text;
  full_name text;
begin
  new_id := coalesce(nullif(patient->>'id', ''), replace(gen_random_uuid()::text, '-', ''));
  first_name := coalesce(patient->>'first', patient->>'firstName', '');
  last_name := coalesce(patient->>'last', patient->>'lastName', '');
  full_name := lower(trim(first_name || ' ' || last_name));

  insert into public.intake_submissions (id, status, data, submitted_at)
  values (new_id, 'pending', patient || jsonb_build_object('id', new_id), now())
  on conflict (id) do update
    set data = excluded.data,
        submitted_at = now();

  insert into public.clinic_snapshot (id, data, updated_at)
  values ('main', jsonb_build_object('patients', jsonb_build_array(patient || jsonb_build_object('id', new_id, 'sourceSubmissionId', new_id))), now())
  on conflict (id) do update
    set updated_at = now(),
        data = case
          when exists (
            select 1
            from jsonb_array_elements(coalesce(clinic_snapshot.data->'patients', '[]'::jsonb)) p
            where coalesce(p->>'id', '') in (new_id, coalesce(patient->>'id', ''))
               or (
                 full_name <> ''
                 and lower(trim(coalesce(p->>'first','') || ' ' || coalesce(p->>'last',''))) = full_name
               )
          ) then clinic_snapshot.data
          else jsonb_set(
            coalesce(clinic_snapshot.data, '{}'::jsonb),
            '{patients}',
            coalesce(clinic_snapshot.data->'patients', '[]'::jsonb) || jsonb_build_array(
              patient || jsonb_build_object('id', new_id, 'sourceSubmissionId', new_id)
            ),
            true
          )
        end;

  return new_id;
end;
$$;

grant execute on function public.submit_patient_intake(jsonb) to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.clinic_snapshot to authenticated;
grant select, insert, update on public.intake_submissions to authenticated;
grant insert on public.intake_submissions to anon;

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

create or replace function public.list_intake_submissions()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  from public.intake_submissions s;
$$;

revoke all on function public.list_intake_submissions() from public;
grant execute on function public.list_intake_submissions() to authenticated;
