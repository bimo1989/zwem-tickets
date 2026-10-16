-- A second kind of volunteer code.
--
-- Until now every code gave exactly one thing: the check-in scanner. Some
-- volunteers follow up the registrations instead — chasing unpaid transfers
-- over WhatsApp from their own phone, and freeing a seat when someone never
-- pays. They need the ticket overview, but nothing that changes money or
-- settings.
--
--   'scanner' - the camera at the door, nothing else (the existing behaviour)
--   'helper'  - the scanner, plus the ticket overview, the WhatsApp buttons
--               and cancelling an unpaid order
--
-- Marking an order paid stays with the admin: that is the one decision about
-- money that should not sit behind a code handed out on a slip of paper.

alter table scanner_codes
  add column if not exists role text not null default 'scanner';

alter table scanner_codes
  drop constraint if exists scanner_codes_role_check;

alter table scanner_codes
  add constraint scanner_codes_role_check check (role in ('scanner', 'helper'));
