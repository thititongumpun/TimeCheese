-- Run in the Supabase SQL editor.
-- Adds working-time columns to timesheets. Window is 09:00-18:00; overlap and
-- the 8h/day cap are validated in the app (src/lib/timeslot.ts).
alter table timesheets
  add column start_time time,
  add column end_time time;

alter table timesheets add constraint timesheets_time_window check (
  (start_time is null and end_time is null)
  or (start_time >= '09:00' and end_time <= '18:00' and start_time < end_time)
);
