-- Run in Supabase SQL Editor if public intake submit shows "Failed to fetch"
-- or "new row violates row-level security policy".

alter table public.intake_submissions enable row level security;

drop policy if exists intake_submissions_insert_public on public.intake_submissions;
create policy intake_submissions_insert_public on public.intake_submissions
  for insert to anon, authenticated
  with check (status = 'pending');

-- Confirm the project is Active (not paused) in Supabase Dashboard.
-- Confirm api-config.js uses the current Project URL + anon/publishable key.
