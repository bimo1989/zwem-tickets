-- Run this in the Supabase SQL editor if you already ran the original
-- schema.sql before member pricing was added. Safe to run even if some of
-- these already exist (uses IF NOT EXISTS / OR REPLACE where possible).

alter table events add column if not exists member_price_cents integer;
alter table orders add column if not exists is_member boolean not null default false;
