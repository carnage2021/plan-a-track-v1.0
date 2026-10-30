-- Main course priced at booking: dishes in a ticked category (Sweets, Breads, Sabji, Rice, Dal, ...) carry no price
-- of their own. The rate per plate for them is typed in at the end of the booking, once per event.
-- Run after 0021. Safe to run again.

-- Ticked on a category; its sub-categories follow it.
alter table public.menu_categories add column if not exists priced_at_booking boolean not null default false;

-- The main course rate per plate typed in for one event of a quotation or booking.
alter table public.event_functions add column if not exists main_rate numeric(12, 2);
