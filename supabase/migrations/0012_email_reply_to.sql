-- Optional reply-to address for the ticket mails.
--
-- The mail has to be sent from a domain verified in Resend (e.g.
-- tickets@mcattawassul.be), but replies are easier to follow up in a mailbox
-- someone actually reads. Setting this sends the mail from the verified
-- address while "Beantwoorden" goes wherever you want — a Gmail address, for
-- instance.

alter table app_settings add column if not exists ticket_email_reply_to text;
