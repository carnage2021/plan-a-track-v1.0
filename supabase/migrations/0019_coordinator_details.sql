-- The coordinator's name, phone and email, typed in or filled from the team, on each enquiry, quotation and booking:
-- { "name", "phone", "email" }. coordinator_id still links a team member when one is picked.
-- Run after 0018. Safe to run again.
alter table public.enquiries add column if not exists coordinator jsonb;
alter table public.quotations add column if not exists coordinator jsonb;
alter table public.orders add column if not exists coordinator jsonb;
