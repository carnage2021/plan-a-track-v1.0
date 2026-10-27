-- More contact details for clients, and a coordinator from the team on each enquiry, quotation and booking.
-- Run after 0015. Safe to run again.

-- A second phone number for the client (email and address are already on clients).
alter table public.clients add column if not exists alt_phone text;

-- The team member coordinating the event with the client. It follows the enquiry into its quotation and booking.
alter table public.enquiries add column if not exists coordinator_id uuid references public.profiles (id) on delete set null;
alter table public.quotations add column if not exists coordinator_id uuid references public.profiles (id) on delete set null;
alter table public.orders add column if not exists coordinator_id uuid references public.profiles (id) on delete set null;
