-- Practical information for people who already booked.
--
-- This is deliberately separate from the rules. The rules are what you agree
-- to before ordering; this is what you want to re-read the evening before —
-- when the doors open, the water temperature, what to bring for the kids.
-- It shows up on the ticket page next to the QR code, where people look
-- anyway, and in the confirmation mail.

alter table events add column if not exists info_text text;
alter table events add column if not exists info_file_url text;
