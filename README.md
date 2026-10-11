# Catering Manager

SaaS for catering agencies: enquiries, quotations, orders and events, built from the
Catering Management Software project plan.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 (add `-- -p 3210` if that port is taken). Create an account with your
name, business name, email and password; leave "Start with sample enquiries and orders" on to
get a filled workspace. The owner can preview other roles from the profile menu.

## Phases

The full roadmap, including features added after the plan was written, is in `docs/ROADMAP.md`.

| Phase | Scope | Status |
| --- | --- | --- |
| 1. Foundation | Design system (G), app shell, login, setup wizard, dashboard, settings, schema | Built |
| 2. Sales | Menu master, packages, enquiries, quotation builder, orders, calendar, booking mode (B1 to B5) | Built |
| 3. Supply | Recipes, stock, vendors, third-party food, cutlery (C) | Planned |
| 4. Staff and operations | Workers, tasks, kitchen, dispatch, on-site (D) | Planned |
| 5. Payments and documents | Schedules, invoices, server-side PDFs, Razorpay (E) | Planned |
| 6. Reports and access | Reports, WhatsApp API, permissions (F) | Planned |
| 7. Platform | Super admin, subscription billing, Excel import, AI add-ons (A1, A3, F4) | Planned |

## Where the data lives

Supabase (Postgres, Auth, Storage). `.env.local` holds the project URL, anon key and the
server-only service role key; copy `.env.example` to set up another machine. The schema and
row-level security are in `supabase/migrations/`; each caterer only sees rows with its own tenant id.

- `lib/store.ts` is the in-memory copy of the signed-in caterer's data: it loads everything after
  sign-in, updates the screen at once and writes each change to Supabase behind it.
- `lib/db.ts` maps between app objects and table rows.
- `app/api/signup` creates the login, tenant, owner profile and starter menu with the service role.
- Unfinished quotation drafts, language and sidebar state stay in the browser.

Login is email and password. Mobile OTP needs an SMS provider connected in Supabase Auth first.
Team invites are saved but invited people cannot join yet.

## Layout

- `app/(auth)` login and setup wizard; `app/(app)` everything inside the shell; `app/booking` full-screen booking mode
- `components/ui` primitives, `components/shared` the G5 shared components, `components/menu` the G6 menu selection screen
- `app/globals.css` the G2 colour tokens (light and dark) mapped into Tailwind
- `lib/pricing.ts` package rules, pax slabs, discount, GST and margin
- `messages/` English, Hindi and Gujarati strings

## Demo photos

`public/dishes` holds placeholder photos downloaded from Wikimedia Commons; sources are listed in
`public/dishes/credits.json`. Their licences need attribution, so replace them with your own
photos (or a licensed stock set) before this goes in front of customers.
