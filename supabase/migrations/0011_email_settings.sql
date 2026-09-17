-- Move the confirmation-email configuration out of the environment
-- (RESEND_API_KEY / TICKET_EMAIL_FROM) and into /admin/settings, so the
-- ticket mail can be set up, tested and switched off without a redeploy.
--
-- Like the Mollie key, the Resend key lives in the singleton app_settings row:
-- RLS is on and it is only ever read server-side with the service-role key, so
-- it never reaches the browser. The environment variables keep working as a
-- fallback.

alter table app_settings add column if not exists resend_api_key text;
alter table app_settings add column if not exists ticket_email_from text;

-- Defaults to true so an install that already mails through the env vars keeps
-- doing so: sending requires (email_enabled and a key and a from-address).
alter table app_settings
  add column if not exists email_enabled boolean not null default true;
