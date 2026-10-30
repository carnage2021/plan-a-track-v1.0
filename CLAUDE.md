# Plan A Track: project guide

Read this first, along with `AGENTS.md`. It gives the shape of the project, how the code fits together, what has been built so far, and the rules to follow when changing it.

## What it is

Plan A Track is a multi-tenant SaaS for catering businesses in India, mostly in Gujarat. Each caterer (a tenant) handles the whole job in it:
- enquiries, quotations and bookings (orders);
- the menu, packages and recipes;
- kitchen, purchase and stock, cutlery, staff;
- billing (GST invoices) and reports.

Client documents (quotation, confirmation, menu card, invoice) can be printed in English, Hindi or Gujarati.

## Stack

| Part | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript |
| Data | Supabase (Postgres, Auth, Storage, row-level security per tenant) |
| State | Zustand stores in `lib/` (`store.ts` is the main one) |
| Styling | Tailwind CSS v4, components in `components/ui` |
| Excel | `read-excel-file` (all sheets), `exceljs` for the example files |
| PDF | `/api/pdf` prints the `/print/[kind]/[id]` page with headless Chrome |

**Next.js 16 differs from older versions.** Check `node_modules/next/dist/docs/` before using a Next API you are unsure of.

## Run it

```bash
npm install
npm run dev                                  # http://localhost:3000
npx next build && npx next start -p 3210 -H 0.0.0.0   # production build, open on the local network
npx tsc --noEmit && npx eslint <files>       # checks before every commit
```

- **`.env.local`** (git-ignored, never committed) holds three settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`: server-only. Never give it a `NEXT_PUBLIC_` prefix.
- **Build quirk:** `next build` sometimes stops once with a security-upgrade notice. Running it again succeeds.

## Folder map

```
app/(app)/        signed-in screens: enquiries, quotations, orders, menu, kitchen, purchase, cutlery,
                  staff, payments, reports, import, settings, calendar, ...
app/booking/      full-screen "booking mode" (client, menu, extras, confirm), used at the client's table
app/print/        printable documents; /api/pdf turns them into PDFs
app/api/          signup, pdf, team, admin, starter-supply, razorpay (Razorpay is switched off)
components/sales/ quotation and booking forms, service cards, per-event charges, documents
components/menu/  dishes, categories (drag and drop, A to Z), packages
lib/store.ts      main store: load, every write, the write queue
lib/db.ts         row mappers (app object <-> table row) and the database feature checks
lib/pricing.ts    all money maths (per plate, packages, event charges, discount, GST)
lib/imports.ts    Excel/CSV import: all sheets, every list's columns and checks
supabase/migrations/  0001 to 0022, run by hand in the Supabase SQL editor, in order
docs/import-examples/ example .xlsx files and a bilingual (English and Gujarati) import guide PDF for caterers
```

## How the code works

- **Writes:** screens never call Supabase directly for core data. They call a store action, which updates state at once and saves in the background through the `write`/`background` queue in `lib/store.ts`.
- **New columns are switched on by a database check.** `lib/db.ts` has a `schema` object of feature flags (`services`, `referrals`, `subcategories`, `contacts`, `charges`, `coordinator`, ...). Each is set when the app first loads, by checking that the column exists. Row mappers send a new column only when its flag is on, so the app keeps working before a migration is run. The store exposes matching flags (`chargesReady`, `contactsReady`, ...) for screens to show "run the 00xx update" hints.
- **Adding a column:**
  1. Write the next migration file (`00NN_name.sql`, safe to run again).
  2. Add the flag and its check in `loadAll`.
  3. Gate the mapper on the flag.
  4. Ask the owner to run the SQL. They run it by hand and reply "db done".
- **Events:** an order or quotation has `functions` (shown to users as services or events). Each one has:
  - a date, start and end time, session, food type ("Food Service Name"), guests and venue;
  - dishes (`itemIds`), with optional per-dish price overrides (`itemPrices`);
  - an optional package;
  - per-event `charges` (staff by role, cutlery by the piece, other).
- **Pricing** (`lib/pricing.ts`):
  - `priceFunction` gives one event's per-plate price, counters, charges and `eventTotal`.
  - `priceQuote` adds the events and whole-booking `extras`, then applies discount, referral credit and GST.
  - Invoices freeze these lines in `lib/billing.ts` `buildSnapshot`.
- **Categories** form a tree (`parentId`). `lib/categories.ts` keeps a module-level copy for `lineage`, `isWithin`, `treeOrder` and the other helpers. A dish fills the deepest matching package rule first.
- **Imports:** `readTable` in `lib/imports.ts` reads every sheet whose header row matches the template. Every list has a `ListSpec` (columns, duplicate check, build). Recipes have their own panel (`components/import/recipe-import.tsx`), which saves in batches.
- **Documents:** `components/sales/quote-document.tsx` draws the quotation, confirmation and menu card. Prices are grouped by date, then event, with a total per event. `lib/doc-i18n.ts` holds the document wording in three languages.

## What has been built

Seven main phases: sales, supply, staff, kitchen, operations, billing, and reports and platform. Then these additions, in order:
- **Calendar:** tithi and Indian festivals.
- **Catering services per event:** food type, session, start and end time.
- **Packages:**
  - courses written as "Starters 2";
  - extra lines (additions);
  - import by food type;
  - no prices shown while picking dishes.
- **Referral codes** with client credit, and per-booking dish price overrides.
- **Raw material quantities** editable per order.
- **Categories:**
  - sub-categories (Main course › Sabji › Paneer sabji) with a step-by-step picker;
  - delete with or without their dishes;
  - drag and drop or arrows to reorder, and Sort A to Z.
- **Fullscreen button** in the top bar.
- **Import:** example files with 5 sample rows each, a bilingual guide, and recipe import.
- **Decimal prices** (₹1.78) everywhere money is typed.
- **Client contact details:** email, alternate number and residential address on enquiries and bookings.
- **Event types:** each caterer's own list, set in Settings or by import.
- **Bookings with many services:**
  - a blank service name falls back to the food type's name or "Service N";
  - a late service moves to the next morning;
  - a service with no menu is flagged before saving.
- **Charges per event (0018):**
  - staff by role, priced from Settings → Service staff rates;
  - cutlery at its rent per piece;
  - other charges;
  - all editable per booking, and shown on the quotation, the WhatsApp text and the invoice.
- **Coordinator (0019):** typed name, phone and email; team members are suggested.
- **Optional menu price;** the labels "Food Service Name" and "Event Name".
- **Settings → Your data → Delete all data** (owner only, type DELETE): `app/api/reset-data` clears the business's records by `tenant_id`; the account, settings, team and numbering stay.
- **PDF downloads** (`components/documents/event-pdf.tsx`): a designed A4 quotation, confirmation or menu card, in full or one PDF per day (`?day=`), with page numbers. On the quotation page, the booking-done screen and Order → Documents.
- **Bills and work orders** (`components/documents/order-docs.tsx`): a per-plate bill and an itemised bill (plain bills, not tax invoices), and a work order PDF for each third-party agency order. Work orders never show the client; delivery is set an hour before the session.
- **The "Staff only" margin box** is removed from the quotation page.
- **Missing details first:** imported lists (cutlery, raw materials, dishes, vendors, workers, clients) show rows with no price, rate or phone first, with an amber tag, then A to Z (`missingFirst` in `lib/utils.ts`).
- **Raw materials in kg and litres only (0020):** g and ml are not offered; imports convert with `baseUnit` in `lib/recipe-import.ts` (500 g becomes 0.5 kg, rates x1000). Quantity columns hold 6 decimal places.
- **Interface polish:** the calendar shows the tithi left and the date right; every `Select` in `components/ui/input.tsx` is searchable (`creatable` lets a new value be typed: event type, staff role); times are picked as 12-hour with AM/PM (`TimeInput`); `components/shell/title-case.tsx` title-cases headings, buttons, labels, tabs and menus as they render (mark user text with `data-no-title-case`).
- **Sample photos (0021):** staff uniforms (the dress, not people), cutlery and decoration, by import ("Sample photos") or Settings. In Step 3 a staff or cutlery line shows the photo with the same name, and "Show photos to client" opens a full-screen gallery (`components/sales/sample-photos.tsx`).
- **One booking flow:** booking mode (`app/booking`) is the only builder. It ends with Confirm booking or Save as quotation. Saved quotations are in Orders → Quotations (`components/sales/quotation-list.tsx`) with Approve, which converts to an order. Enquiry "Create quotation" and quotation Revise open `/booking?enquiry=` / `/booking?revise=`; the old `/quotations` and `/quotations/new` pages redirect. Quotation pages follow the Orders access.
- **Main course priced at booking (0022):** a category ticked "Main course, price at booking" (sub-categories follow, `pricedAtBooking` in `lib/categories.ts`) has dishes with no price. In Step 3 each event built dish by dish asks for its main course rate per plate (`EventFunction.mainRate`); `priceFunction` adds it to `perPlate` (not slab-discounted), so every document, bill and invoice carries it. A package event's price covers the main course. Saving or confirming is blocked until each rate is in. The menu import has a "Main course" Yes/No column.

## Rules for working on it

- **Secrets:** never commit `.env.local` or `docs/private/` (live logins).
- **Testing:**
  - Test in a real browser with throwaway `qa-*@example.com` accounts, and delete them afterwards.
  - Never change real customers' data. When a customer reports a bug, test on a copy of their account.
  - Do not delete the demo accounts.
  - Test scripts (Puppeteer) live in `brag-output/work/`, which is git-ignored.
- **Git:** commit or push only when the owner asks. Commit messages end with a `Co-Authored-By` line.
- **Migrations:** the owner runs them by hand. Never assume a new column exists; gate it on its `schema` flag.
- **Code style:** match the code around it. Plain-English UI text, short comments that say why, and `cn()` for class names.
- **Imports:** an upload must never drop rows silently. Every row either saves or appears with its reason.
- **After any change,** run `npx tsc --noEmit` and lint the changed files. Then rebuild, and test the screen in the browser.

## Known follow-ups

- Event charges can be edited only on the quotation (revise it), not on a confirmed order yet.
- The staff-only margin figure does not count staff wages behind the staff charges.
- Razorpay payments are switched off.
- The Next.js security upgrade (`next upgrade --agent=security`) is waiting for the owner's go-ahead.
