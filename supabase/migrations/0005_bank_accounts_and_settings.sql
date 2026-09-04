-- Run this in the Supabase SQL editor to add:
-- 1) a table of bank accounts (instead of one hardcoded IBAN in .env),
-- 2) a per-event choice of which account to deposit into,
-- 3) a configurable template for the payment remittance message,
-- 4) a sequential order number to use in that template.

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,            -- friendly name shown in the admin, e.g. "Hoofdrekening vzw"
  account_holder text not null,
  iban text not null,
  bic text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
alter table bank_accounts enable row level security;

-- Singleton settings row (the boolean-primary-key trick guarantees there's
-- ever only one row).
create table if not exists app_settings (
  id boolean primary key default true check (id),
  -- Tokens: {nummer} = sequential order number, {evenement} = event title,
  -- {naam} = buyer name.
  remittance_template text not null default '{nummer} - {evenement} - {naam}'
);
alter table app_settings enable row level security;
insert into app_settings (id) values (true) on conflict (id) do nothing;

alter table events add column if not exists bank_account_id uuid references bank_accounts(id);
alter table orders add column if not exists order_number bigserial;

-- One-time migration: turn the previously hardcoded test IBAN (from
-- .env.local) into a real row so existing test events keep working, and
-- point any event without a bank account at it. Rename/edit this row (or
-- add a real one and switch events over) once you're ready to go live.
insert into bank_accounts (label, account_holder, iban, is_default)
select 'Testrekening (vervang dit!)', 'MC Attawassul vzw (test)', 'BE68 5390 0754 7034', true
where not exists (select 1 from bank_accounts);

update events
set bank_account_id = (select id from bank_accounts where is_default limit 1)
where bank_account_id is null;
