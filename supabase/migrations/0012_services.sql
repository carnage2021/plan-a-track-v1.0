-- Services: several catering services in one event, each with a food type, session and start and end time.
-- Run after 0011. Safe to run again.

-- The owner's food types (Welcome Drinks, Gala Dinner, ...) and the menu categories each one shows:
-- [{ "id": "gala-dinner", "name": "Gala Dinner", "categoryIds": ["..."] }]. Null means the app's starting list.
alter table public.tenants add column if not exists food_types jsonb;

-- A package can belong to one food type; null means it is offered for every food type.
alter table public.packages add column if not exists food_type_id text;

-- Each function (service) of a quotation or order. serving_time stays the start time.
alter table public.event_functions add column if not exists food_type_id text;
alter table public.event_functions add column if not exists session text;
alter table public.event_functions add column if not exists end_time time;
do $$ begin
  alter table public.event_functions add constraint event_functions_session_check check (session is null or session in ('morning', 'afternoon', 'evening', 'night'));
exception when duplicate_object then null; end $$;

-- An enquiry runs from event_date to event_end_date and lists the services the client asked for,
-- in the same shape as the app's functions; they become the quotation's functions.
alter table public.enquiries add column if not exists event_end_date date;
alter table public.enquiries add column if not exists services jsonb not null default '[]'::jsonb;
