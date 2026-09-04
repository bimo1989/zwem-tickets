-- Run this in the Supabase SQL editor to replace the fixed "lid/niet-lid"
-- pricing with a free-form list of price categories per event (e.g. Leden,
-- Niet-leden, Studenten, ... — as many as you like).

create table if not exists event_price_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,             -- e.g. "Leden", "Niet-leden", "Studenten"
  price_cents integer not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table event_price_tiers enable row level security;

-- Snapshot of which tier an order was bought at (kept even if the tier is
-- later renamed/removed, same reasoning as amount_cents already being a
-- snapshot rather than a live lookup).
alter table orders add column if not exists price_tier_label text not null default 'Standaard';

-- One-time backfill: turn every existing event's price_cents (+ optional
-- member_price_cents) into rows in the new table, and label existing paid
-- orders based on the is_member flag being replaced.
insert into event_price_tiers (event_id, label, price_cents, display_order)
select id, 'Standaard', price_cents, 0
from events
where not exists (select 1 from event_price_tiers t where t.event_id = events.id);

insert into event_price_tiers (event_id, label, price_cents, display_order)
select id, 'Leden', member_price_cents, 1
from events
where member_price_cents is not null
  and not exists (
    select 1 from event_price_tiers t where t.event_id = events.id and t.label = 'Leden'
  );

update orders set price_tier_label = 'Leden' where is_member = true;
update orders set price_tier_label = 'Standaard' where is_member = false;

alter table events drop column if exists member_price_cents;
alter table orders drop column if exists is_member;
