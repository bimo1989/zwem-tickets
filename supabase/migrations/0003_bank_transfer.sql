-- Run this in the Supabase SQL editor to add support for the "pay by bank
-- transfer (QR)" flow alongside Mollie.

alter table orders
  add column if not exists payment_method text not null default 'mollie';
  -- 'mollie' | 'bank_transfer'
