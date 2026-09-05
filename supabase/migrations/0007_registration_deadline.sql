-- Run this in the Supabase SQL editor to add an optional registration
-- deadline per event (separate from selling out or the event date itself).

alter table events add column if not exists registration_deadline timestamptz;
