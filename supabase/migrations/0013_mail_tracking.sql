-- Track which mails an order has actually received.
--
-- ticket_email_sent_at makes a failed confirmation visible in /admin (Resend's
-- free tier stops at 100 mails a day, so a busy day can silently drop a few)
-- and lets an admin resend that one mail.
--
-- reminder_sent_at is what makes the reminder run resumable: sending a
-- reminder to an event only mails the orders that don't have one yet, so
-- hitting the daily cap halfway just means finishing tomorrow instead of
-- mailing everyone twice.

alter table orders add column if not exists ticket_email_sent_at timestamptz;
alter table orders add column if not exists reminder_sent_at timestamptz;
