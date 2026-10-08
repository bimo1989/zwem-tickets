-- Per-event rules ("reglement") that a buyer has to agree to before ordering.
--
-- Three parts:
--   1. events.rules_text      - free text shown above the checkboxes
--   2. events.rules_file_url  - an uploaded PDF or photo of the full rules
--   3. event_agreements       - the individual checkboxes, one row each, that
--                               all have to be ticked to order
--
-- What a buyer agreed to is snapshotted onto the order (orders.agreed_items),
-- not referenced by id: the texts can be edited or deleted later, and the
-- record has to keep saying what that person actually accepted at the time.

alter table events add column if not exists rules_text text;
alter table events add column if not exists rules_file_url text;

create table if not exists event_agreements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  text text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table event_agreements enable row level security;
create index if not exists event_agreements_event_id_idx on event_agreements(event_id);

alter table orders add column if not exists agreed_at timestamptz;
alter table orders add column if not exists agreed_items jsonb;

-- Public bucket for the rules document: the file is linked straight from the
-- public event page, so there is nothing secret in it.
insert into storage.buckets (id, name, public)
values ('event-rules', 'event-rules', true)
on conflict (id) do nothing;
