-- An optional expiry date on a volunteer code.
--
-- Handing out a code for one swimming evening and then having to remember to
-- revoke it is how codes quietly stay alive for months. With an expiry the
-- code stops working by itself; null means it keeps working until it is
-- deleted, which stays the default.
--
-- The expiry is checked wherever the code is looked up, so it also ends a
-- session that is already open — not only new logins.

alter table scanner_codes add column if not exists expires_at timestamptz;
