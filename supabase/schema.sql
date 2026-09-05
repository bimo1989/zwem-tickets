-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,            -- friendly name shown in the admin, e.g. "Hoofdrekening vzw"
  account_holder text not null,
  iban text not null,
  bic text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  location text,
  price_cents integer not null,          -- lowest price tier, kept in sync automatically; used for homepage display/sorting
  capacity integer not null,             -- max number of tickets
  registration_deadline timestamptz,     -- optional; after this moment, no new orders even if not sold out
  bank_account_id uuid references bank_accounts(id), -- where a bank-transfer payment should land; null = bank transfer unavailable for this event
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Free-form list of price categories per event (e.g. "Leden", "Niet-leden",
-- "Studenten" — as many as needed). The buyer picks exactly one at checkout.
create table if not exists event_price_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  price_cents integer not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigserial,                 -- sequential number, usable in the remittance template
  event_id uuid not null references events(id) on delete cascade,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,                       -- used for the "WhatsApp sturen" admin action
  quantity integer not null check (quantity > 0),
  price_tier_label text not null default 'Standaard', -- snapshot of the chosen price category's name
  amount_cents integer not null,          -- quantity * the chosen tier's price at checkout time
  status text not null default 'open',    -- open | paid | expired | canceled | failed
  payment_method text not null default 'mollie', -- mollie | bank_transfer
  mollie_payment_id text,
  checked_in_count integer not null default 0,
  ticket_code text not null unique,       -- shown as QR code on the ticket
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_event_id_idx on orders(event_id);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_mollie_payment_id_idx on orders(mollie_payment_id);
create index if not exists event_price_tiers_event_id_idx on event_price_tiers(event_id);

-- Singleton settings row (the boolean-primary-key trick guarantees there's
-- ever only one row).
create table if not exists app_settings (
  id boolean primary key default true check (id),
  -- Tokens: {nummer} = sequential order number, {evenement} = event title,
  -- {naam} = buyer name.
  remittance_template text not null default '{nummer} - {evenement} - {naam}'
);
insert into app_settings (id) values (true) on conflict (id) do nothing;

-- Convenience view: how many tickets are already sold (paid) per event
create or replace view event_sales as
select
  e.id as event_id,
  e.title,
  e.capacity,
  coalesce(sum(o.quantity) filter (where o.status = 'paid'), 0) as tickets_paid,
  coalesce(sum(o.quantity) filter (where o.status = 'open'), 0) as tickets_pending,
  coalesce(sum(o.amount_cents) filter (where o.status = 'paid'), 0) as revenue_cents
from events e
left join orders o on o.event_id = e.id
group by e.id, e.title, e.capacity;

-- Row Level Security: lock the tables down. All access from the app goes
-- through the server using the Supabase service-role key, which bypasses RLS,
-- so the public/anon key can't read or write anything.
alter table bank_accounts enable row level security;
alter table events enable row level security;
alter table event_price_tiers enable row level security;
alter table orders enable row level security;
alter table app_settings enable row level security;
