-- Paste in Supabase → SQL Editor → Run
-- Lets staff see submitted patient forms on Applications.

grant usage on schema public to anon, authenticated;
grant insert on public.intake_submissions to anon, authenticated;
grant select, update on public.intake_submissions to authenticated;

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
