-- Run this in the Supabase SQL editor to add the buyer's phone number,
-- used for the "WhatsApp sturen" action in the admin panel.

alter table orders add column if not exists buyer_phone text;
