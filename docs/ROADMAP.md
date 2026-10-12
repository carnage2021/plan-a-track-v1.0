# Roadmap

The project plan PDF stays the base specification. This file tracks the phase split, what is
built, and features added to the plan after it was written.

Last updated: 11 Oct 2026.

## Phases

| Phase | Scope | Plan sections | Status |
| --- | --- | --- | --- |
| 1. Foundation | Design system, app shell, login, setup wizard, dashboard, settings, schema | G, A2 | Built on demo data |
| 2. Sales | Menu master, packages, enquiries, quotation builder, orders, calendar, booking mode | B1 to B5 | Built on demo data |
| 3. Supply | Recipes, stock, vendors, third-party food, cutlery | C | Built and tested against the database |
| 4A. Staff | Workers, priced tasks, attendance, payouts, monthly payroll, chef per dish | D1, D2 | Built and tested against the database |
| 4B. Operations | Kitchen production, dispatch and transport, on-site event screen | D3 to D5 | Planned |
| 5. Payments, documents and public menus | Schedules, invoices, PDFs, Razorpay, QR and public menu pages | E | Planned |
| 6. Reports, messaging and access | Reports, WhatsApp, email and SMS, permissions | F | Planned |
| 7. Platform | Super admin, subscription billing, Excel import, AI add-ons | A1, A3, F4 | Planned |

Before phase 3 starts: connect Supabase (project URL and anon key), run the two migrations,
replace the stand-in login with real OTP, and move data out of the browser store.

## Added to the plan on 11 Oct 2026

These came from a comparison with a competing product. None of them is built yet.

### New features

| # | Feature | What we add | Phase |
| --- | --- | --- | --- |
| 1 | QR code table menu | One QR per event or per function. Opens a read-only, photo-led menu page with veg / Jain marks and the caterer's branding. Printable as table tents and standees. No login, no ordering. | 5 |
| 2 | Public menu link | A general catalogue link showing all dishes and packages, with a toggle to show or hide prices and an "Enquire on WhatsApp" button. Separate from the per-order menu card we already share. | 5 |
| 3 | Monthly salary payroll | Fixed monthly salary staff alongside task and event payouts. Attendance calendar with present, paid leave and unpaid leave. Allowances, deductions, bonus, overtime, advance recovery and a monthly salary slip. | 4 |
| 4a | Document language per order | A language picker per document on each order, so the raw material list can go to a supplier in one language and the menu to the client in another. Languages beyond English, Hindi and Gujarati: Marathi, Tamil, Kannada, Malayalam, Bengali, Punjabi to start. | 5 |
| 4b | Time zone per account | A time zone setting on the caterer's account, used for event times, reminders and scheduled messages. | 1 (small addition, picked up with the Supabase hookup) |
| 5 | Birthday and anniversary greetings | Birthday and anniversary fields on the client profile; greetings sent automatically each year, in addition to festival greetings. | 2 for the client fields, 6 for the sending |
| 6 | Caterer's own email and SMS | A settings page for the caterer's own SMTP sender and a choice of SMS provider (Twilio, MSG91, Vonage), so messages go out in their name. | 6 |
| 7 | Add-on billing for our SaaS | In the super admin plan builder: add-on modules bought separately (accounts, messaging, mobile app), a charge per extra user above the included seats, and a first-year price different from the renewal price. Actual prices are still parked. | 7 |

### More detail on things already in the plan

| Area | Detail to add | Phase |
| --- | --- | --- |
| Counter name plates | A repeat count per dish: how many plates to print for each. | 5 |
| Chef per dish | Assign a named chef to a single dish, with their rate, in addition to assigning by kitchen section. Cost rolls into the event's labour cost. | 4 |
| Vendor types | Add PRO / hospitality agency (guest handling) to the vendor types. | 3 |
| Purchase and crockery lists | Agency, delivery date, time and place per line. | 3 |
| Bulk messages | Delivery status per recipient: sent, delivered, failed. | 6 |
| Menu document designs | A gallery of five or six ready themes in the template editor. | 5 |
| Cash flow report | A proper cash flow view (money in, money out, running balance by period), beyond the cash and bank summary. | 6 |

## What each phase now contains

**Phase 3, supply.** Plan section C, plus the PRO / hospitality vendor type and per-line
delivery agency, date, time and place on purchase and crockery lists.

**Phase 4, staff and operations.** Plan section D, plus monthly salary payroll with a leave
calendar and salary slips, and chef-per-dish assignment.

**Phase 5, payments, documents and public menus.** Plan section E, plus the QR table menu,
the public catalogue link, document language per order with the extra languages, the name
plate repeat count, and the menu design gallery.

**Phase 6, reports, messaging and access.** Plan sections F1 to F3, plus birthday and
anniversary greetings, the caterer's own email and SMS setup, per-recipient delivery status,
and the cash flow report.

**Phase 7, platform.** Plan sections A1, A3 and F4, plus add-on modules, per-extra-user
charges and first-year versus renewal pricing in the plan builder.

## Still open inside phases 1 and 2

- WhatsApp sending through the API and client approve-by-link (buttons open WhatsApp with a ready message today)
- Server-side PDFs (documents print from the browser today)
- Scannable UPI QR for an exact amount
- Hindi and Gujarati beyond navigation, statuses, login and dashboard headings
- Recurring orders, per-client price lists, client profile page (with the new birthday and anniversary fields), calendar day view, drag-to-reorder in the plate summary, more than one photo per dish
- Time zone setting (4b above)
