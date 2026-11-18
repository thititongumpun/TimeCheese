-- Run in the Supabase SQL editor. Lets users edit their own archived rows (Archived page).
-- No UPDATE policy on archived_timesheets exists in the repo migrations; drop-if-exists keeps this re-runnable.
drop policy if exists "owner can update archived" on archived_timesheets;
create policy "owner can update archived" on archived_timesheets
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
