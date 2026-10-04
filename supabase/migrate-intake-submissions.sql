-- Run this in Supabase SQL Editor if patient forms fail with:
-- "Could not find the table public.intake_submissions in the schema cache"
--
-- Project: Posture Clinic (nqhkxvcockersjhrthiz)
-- Safe to run more than once.

create table if not exists public.intake_submissions (
  id text primary key,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  data jsonb not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  patient_id text
);

alter table public.intake_submissions enable row level security;

drop policy if exists intake_submissions_insert_public on public.intake_submissions;
create policy intake_submissions_insert_public on public.intake_submissions
  for insert to anon
  with check (status = 'pending');

drop policy if exists intake_submissions_staff_select on public.intake_submissions;
create policy intake_submissions_staff_select on public.intake_submissions
  for select to authenticated
  using (public.is_staff());

drop policy if exists intake_submissions_staff_update on public.intake_submissions;
create policy intake_submissions_staff_update on public.intake_submissions
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists intake_submissions_staff_delete on public.intake_submissions;
create policy intake_submissions_staff_delete on public.intake_submissions
  for delete to authenticated
  using (public.is_staff());

create or replace function public.auto_add_intake_patient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snap record;
  new_patient jsonb;
  patients jsonb;
  pid text;
begin
  select * into snap from clinic_snapshot where id = 'main' for update;
  if not found then
    return new;
  end if;

  pid := coalesce(nullif(new.data->>'id', ''), new.id);
  new_patient := new.data || jsonb_build_object(
    'id', pid,
    'created', to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD')
  );

  patients := coalesce(snap.data->'patients', '[]'::jsonb);
  if not exists (
    select 1 from jsonb_array_elements(patients) elem
    where elem->>'id' = pid
  ) then
    patients := patients || jsonb_build_array(new_patient);
    update clinic_snapshot
    set data = jsonb_set(coalesce(snap.data, '{}'::jsonb), '{patients}', patients),
        updated_at = now()
    where id = 'main';
  end if;

  update public.intake_submissions
  set status = 'approved',
      patient_id = pid,
      reviewed_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists intake_submission_auto_patient on public.intake_submissions;
create trigger intake_submission_auto_patient
  after insert on public.intake_submissions
  for each row execute function public.auto_add_intake_patient();

-- Reload PostgREST schema cache (fixes "schema cache" errors)
notify pgrst, 'reload schema';
