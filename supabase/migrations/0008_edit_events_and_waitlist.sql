-- Run this in the Supabase SQL editor to add:
-- 1) a per-event toggle for enabling a waitlist once an event is sold out,
-- 2) a table storing waitlist sign-ups.
-- (Editing events itself needed no schema change — just new admin UI/API.)

alter table events add column if not exists waitlist_enabled boolean not null default false;

create table if not exists waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  -- Set once an admin converts this waitlist entry into a real order.
  promoted_order_id uuid references orders(id)
);
alter table waitlist_entries enable row level security;
create index if not exists waitlist_entries_event_id_idx on waitlist_entries(event_id);
