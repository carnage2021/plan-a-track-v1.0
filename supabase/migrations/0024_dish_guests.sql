-- Kitchen guests per dish, and a package price changed for one booking.
-- A booking for 500 guests rarely cooks every dish for 500: soups and starters go to everyone, but after a big
-- spread of starters the main course may be made for 200. The kitchen count of a dish scales its raw material,
-- its agency work order and its dispatch portions; the client is still billed for the booked guests.
-- Run after 0023. Safe to run again.

-- Guests a dish is cooked for on one event; empty means the event's booked guests.
alter table public.function_items add column if not exists prep_pax integer;

-- The package price per plate for this quotation or booking only; empty means the package's own price.
alter table public.event_functions add column if not exists package_price numeric(12, 2);
