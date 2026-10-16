-- Remember who already got a WhatsApp message.
--
-- WhatsApp's click-to-chat opens one conversation at a time on purpose, so a
-- round of messages is always one send per person. What can be taken out of
-- the volunteer's head is the bookkeeping: who is next, and who already had
-- theirs. Without this, two helpers working the same list both message the
-- same people.
--
-- It records that the chat was opened from the admin, which is as close to
-- "sent" as a site can get — WhatsApp never tells us whether the send button
-- was actually pressed.

alter table orders add column if not exists whatsapp_sent_at timestamptz;
