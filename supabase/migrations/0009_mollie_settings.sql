-- Move the Mollie configuration out of the environment (MOLLIE_API_KEY) and
-- into /admin/settings, so online payments can be set up and switched on or
-- off from the admin area without a redeploy.
--
-- The API key is stored in the singleton app_settings row. That table has RLS
-- enabled and is only ever read with the service-role key on the server, so
-- the key is never reachable from the browser. MOLLIE_API_KEY keeps working as
-- a fallback for installs that already used it.

alter table app_settings add column if not exists mollie_api_key text;

-- Defaults to true so installs that already pay with the env key keep working
-- after this migration: availability is (mollie_enabled and a key is present),
-- so an install without any key still offers bank transfer only.
alter table app_settings
  add column if not exists mollie_enabled boolean not null default true;
