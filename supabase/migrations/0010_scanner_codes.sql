-- Scan-only access for volunteers at the door.
--
-- Each volunteer (or team) gets their own short code, handed out by an admin
-- from /admin/settings. They type it on /admin/login instead of the admin
-- password and land on the check-in scanner; they can reach nothing else in
-- the admin area. Revoking someone is deleting their row — no redeploy and no
-- shared password that has to be changed for everyone at once.

create table if not exists scanner_codes (
  id uuid primary key default gen_random_uuid(),
  label text not null,          -- who this code was handed to, e.g. "Youssef" or "zaalploeg"
  code text not null unique,    -- what the volunteer types in; stored uppercase without separators
  created_at timestamptz not null default now(),
  last_used_at timestamptz      -- so an admin can see which codes are actually in use
);
alter table scanner_codes enable row level security;
