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
| 3. Supply | Recipes, stock, vendors, third-party food, cutlery (C) | Built |
| 4A. Staff | Workers, priced tasks, attendance, payouts, payroll (D1, D2) | Built |
| 4B. Operations | Kitchen, dispatch, on-site (D3 to D5) | Built |
| 5A. Client billing | Schedules, reminders, invoices, credit notes, ledgers (E1) | Built |
| 5B. Expenses and documents | Expenses, petty cash, day book, document designs, UPI QR, QR and public menus, Razorpay links (E2, E3) | Built (Razorpay off for now) |
| 6. Reports, messages and access | Reports, messages and greetings, role access, activity log, data export (F) | Built |
| 7. Platform | Super admin, plans, support, Excel import, smart assist (A1, A3, F4) | Built |

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
Team members sign in with a login ID and password the owner creates in Settings, Team.

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
