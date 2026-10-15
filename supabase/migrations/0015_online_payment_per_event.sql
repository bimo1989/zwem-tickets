-- Per-event switch for online payment (Bancontact and the other methods in
-- the Mollie checkout).
--
-- Until now online payment was all-or-nothing for the whole site: if a Mollie
-- key was configured, every event offered it. Some activities are meant to be
-- paid by transfer only, so this moves the choice to the event itself.
--
-- Defaults to false on purpose: bank transfer is the standing default, and an
-- event only offers Bancontact once someone deliberately switches it on. Note
-- that this also switches it off for events that already existed — flip the
-- ones that should keep it in /admin/events.

alter table events
  add column if not exists online_payment_enabled boolean not null default false;
