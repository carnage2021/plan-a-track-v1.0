import {
  CalendarDays,
  Check,
  ChefHat,
  ClipboardList,
  FileText,
  Languages,
  MessagesSquare,
  Moon,
  PartyPopper,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Users,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthButtons, CountUp, Reveal, Splash, WordCycle } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

// The product name is still an open decision in the plan; change it here and it changes everywhere on this page.
const PRODUCT = "Plan A Track";

export const metadata: Metadata = {
  title: `${PRODUCT} · Catering management software`,
  description: "The management platform for catering agencies: enquiries, photo-led menus, quotations, orders, raw material, cutlery and staff in one place.",
};

const dishes = ["paneer-tikka", "veg-biryani", "gulab-jamun", "masala-dosa", "rasmalai", "paneer-butter-masala", "jalebi", "pav-bhaji", "undhiyu", "dhokla", "kaju-katli", "pani-puri"];

const chain: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: MessagesSquare, title: "Enquiry", text: "Every lead on one board, with follow-ups that do not get missed." },
  { icon: FileText, title: "Quotation", text: "Built from photos, priced per plate, sent on WhatsApp." },
  { icon: ClipboardList, title: "Order", text: "Functions, guests and payments tracked from the advance onward." },
  { icon: ShoppingBasket, title: "Raw material", text: "Recipes scaled to the guests, less what is already in the store." },
  { icon: Users, title: "Crew", text: "Tasks with a worker, a time and a price for each function." },
  { icon: PartyPopper, title: "Event", text: "Cutlery out and back, agencies delivered, everyone paid." },
];

const features: { eyebrow: string; title: string; text: string; points: string[]; image: string; alt: string; crop?: boolean }[] = [
  {
    eyebrow: "Booking mode",
    title: "Build the menu with the client beside you.",
    text: "Open a full-screen, photo-led menu on a laptop, tablet or TV. Tap dishes onto the plate and the per-plate price and total update as the client chooses. Cost and margin stay on your side of the screen.",
    points: ["Packages with choose-any rules", "Compare two packages side by side", "Quotation, order and advance in one sitting"],
    image: "/landing/booking.png",
    alt: "Booking mode: a photo grid of dishes with a live plate summary",
  },
  {
    eyebrow: "Quotations and orders",
    title: "A branded quotation in minutes, a confirmed order in one tap.",
    text: "Every quotation carries your logo and colour, keeps its versions, and shows what changed between them. When the client says yes, it becomes an order with nothing retyped.",
    points: ["Guest-count slabs, discount limits and GST handled", "Multi-function weddings in a single order", "Receipts ready to send the moment a payment is recorded"],
    image: "/landing/quote.png",
    alt: "A branded quotation with the menu grouped by category and the total",
  },
  {
    eyebrow: "Purchase, stock and cutlery",
    title: "Know what to buy before the vendor calls you.",
    text: "Recipes scale to the guest count with a wastage buffer. The purchase list is what the events need, minus your stock, split by the cheapest vendor. Crockery is counted out and counted back in.",
    points: ["Kitchen indent by store section", "Goods received flags short, excess and rate changes", "Breakage valued and charged to the order"],
    image: "/landing/purchase.png",
    alt: "The purchase list: ingredients needed, in stock, to buy and the vendor for each",
    crop: true,
  },
  {
    eyebrow: "Staff and tasks",
    title: "See who is doing what, and what it costs.",
    text: "Plan the crew from the guest count, give every task a worker and a price, and mark attendance at the venue. Payouts and monthly salaries come out of the same record.",
    points: ["Warnings for leave and double booking", "Payout sheet per worker and per contractor", "Monthly payroll with a salary slip"],
    image: "/landing/workers.png",
    alt: "The worker list with roles, skills and rates",
    crop: true,
  },
];

const extras: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: CalendarDays, title: "Calendar with kitchen load", text: "A capacity bar on every date, so sales never promises a day that is already full." },
  { icon: UtensilsCrossed, title: "Menu master with photos", text: "Veg, Jain and non-veg marks, seasonal items, bulk price changes and an on / off switch." },
  { icon: ChefHat, title: "Third-party food", text: "Outsourced dishes go to their agency with your rate against the client's, so the margin is visible." },
  { icon: Wine, title: "Cutlery and equipment", text: "Rules like 1.2 plates per guest work out each challan, across overlapping events." },
  { icon: SlidersHorizontal, title: "Roles for the whole team", text: "Owner, sales, operations, kitchen, store and accounts each see only what they need." },
  { icon: ShieldCheck, title: "Your data, kept apart", text: "Every caterer's records are isolated in the database, not just hidden in the app." },
  { icon: Languages, title: "English, Hindi, Gujarati", text: "Switch language from any screen. More of the app is translated with every release." },
  { icon: Moon, title: "Light and dark", text: "A warm, calm interface that works on a phone at the venue and a desktop in the office." },
];

function Shot({ src, alt, crop, priority }: { src: string; alt: string; crop?: boolean; priority?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-surface shadow-sheet">
      <div className="flex items-center gap-1.5 border-b bg-surface-muted px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" /><span className="size-2.5 rounded-full bg-border" />
      </div>
      <div className="overflow-hidden">
        {/* Screens captured with the sidebar are shifted so the content, not the navigation, fills the frame. */}
        <Image src={src} alt={alt} width={1440} height={900} priority={priority} sizes="(max-width: 1024px) 100vw, 720px" className={cn("h-auto w-full", crop && "ml-[-20%] w-[120%] max-w-none")} />
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div className="overflow-x-clip">
      <Splash name={PRODUCT} tagline="Catering management software" />
      <div aria-hidden className="scroll-progress fixed inset-x-0 top-0 z-40 h-1 bg-primary" style={{ transform: "scaleX(0)" }} />
      <header className="sticky top-0 z-30 border-b bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 md:px-6">
          <Link href="/welcome" className="flex items-center gap-2.5 font-heading text-lg font-bold">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm text-primary-fg">PT</span>{PRODUCT}
          </Link>
          <nav className="ml-4 hidden items-center gap-6 text-sm text-text-muted md:flex" aria-label="Sections">
            <a href="#how" className="hover:text-text">How it works</a>
            <a href="#features" className="hover:text-text">Features</a>
            <a href="#more" className="hover:text-text">Everything else</a>
          </nav>
          <AuthButtons className="ml-auto [&>a:last-child]:max-sm:hidden" />
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-4 pb-16 pt-12 md:px-6 md:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden">
            <div className="animate-blob absolute -left-24 top-10 size-[420px] rounded-full bg-primary/15 blur-3xl" />
            <div className="animate-blob absolute -right-20 top-40 size-[380px] rounded-full bg-accent-gold/20 blur-3xl [animation-delay:-6s]" />
          </div>
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"><span className="size-1.5 rounded-full bg-primary" />Catering management software</p>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3rem]">Run every <WordCycle className="grid text-primary" words={["wedding", "sangeet", "reception", "corporate lunch", "birthday"]} />from one calm screen.</h1>
            <p className="mt-5 max-w-xl text-lg text-text-muted">{PRODUCT} is the management platform for catering agencies. Enquiries, photo-led menus, quotations, orders, raw material, cutlery and staff, all from the same order.</p>
            <AuthButtons size="lg" className="mt-8 flex-wrap" />
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
              {["Starter menu with recipes included", "Works on phone, tablet and desktop", "English, Hindi and Gujarati"].map((t) => <li key={t} className="flex items-center gap-2"><Check className="size-4 text-success" strokeWidth={2.25} />{t}</li>)}
            </ul>
          </div>
          <div className="relative animate-rise [animation-delay:150ms]">
            <div className="hero-tilt"><Shot src="/landing/booking.png" alt="Booking mode in Plan A Track" priority /></div>
            <div className="animate-float-a absolute -left-3 top-[18%] hidden w-52 rounded-2xl border bg-surface p-2 shadow-sheet sm:block lg:-left-10">
              <Image src="/dishes/paneer-butter-masala.jpg" alt="" width={400} height={300} className="aspect-[4/3] w-full rounded-xl object-cover" />
              <p className="mt-2 px-1 font-heading text-sm font-semibold">Paneer Butter Masala</p>
              <p className="flex items-center justify-between px-1 pb-1 text-xs text-text-muted">₹75 per plate<span className="grid size-5 place-items-center rounded-full bg-primary text-primary-fg"><Check className="size-3" strokeWidth={3} /></span></p>
            </div>
            <div className="animate-float-b absolute -bottom-6 right-3 rounded-2xl border bg-surface px-5 py-4 shadow-sheet lg:-right-6">
              <p className="text-xs text-text-muted">Gold package, per plate</p>
              <p className="font-heading text-3xl font-bold"><CountUp to={650} prefix="₹" /></p>
              <p className="tnum text-xs text-success">200 guests · <CountUp to={136500} prefix="₹" /> with GST</p>
            </div>
            <div className="animate-float-a absolute -top-5 right-8 hidden items-center gap-2.5 rounded-full border bg-surface py-2 pl-2 pr-4 shadow-sheet [animation-delay:-3s] md:flex">
              <span className="grid size-8 place-items-center rounded-full bg-success/15 text-success"><Check className="size-4" strokeWidth={3} /></span>
              <span className="text-sm"><span className="block font-medium leading-tight">Booking confirmed</span><span className="tnum block text-xs text-text-muted">Advance received</span></span>
            </div>
          </div>
        </section>

        {/* Dish photo marquee */}
        <div className="space-y-4 border-y bg-surface-muted/60 py-6" aria-hidden>
          {[dishes, [...dishes].reverse()].map((row, r) => (
            <div key={r} className="marquee-row">
              <div className={cn("flex w-max gap-4", r ? "animate-marquee-reverse" : "animate-marquee")}>
                {[...row, ...row].map((d, i) => (
                  <Image key={i} src={`/dishes/${d}.jpg`} alt="" width={320} height={240} className="h-24 w-36 rounded-2xl object-cover transition-transform duration-300 hover:scale-105 md:h-32 md:w-48" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* The chain */}
        <section id="how" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-20 md:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">How it works</p>
            <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">One chain. Nothing typed twice.</h2>
            <p className="mt-4 text-lg text-text-muted">The menu and guest count you agree with the client drive everything after it: what to buy, what to outsource, what to carry, and who works the event.</p>
          </Reveal>
          <div aria-hidden className="draw-line mt-10 h-1 rounded-full bg-gradient-to-r from-primary via-accent-gold to-success" />
          <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chain.map((s, i) => (
              <li key={s.title}>
                <Reveal from="scale" delay={i * 90} className="h-full rounded-2xl border bg-surface p-5 shadow-card transition-shadow duration-300 hover:shadow-sheet">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><s.icon className="size-5" strokeWidth={1.75} /></span>
                    <span className="tnum text-xs font-medium text-accent-gold">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-heading text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-text-muted">{s.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        {/* Feature blocks */}
        <section id="features" className="scroll-mt-20 bg-surface-muted/50 py-20">
          <div className="mx-auto max-w-[1200px] space-y-24 px-4 md:px-6">
            {features.map((f, i) => (
              <div key={f.title} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <Reveal from={i % 2 ? "right" : "left"} className={cn(i % 2 === 1 && "lg:order-2")}>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{f.eyebrow}</p>
                  <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">{f.title}</h2>
                  <p className="mt-4 text-base text-text-muted">{f.text}</p>
                  <ul className="mt-6 space-y-2.5">
                    {f.points.map((p) => <li key={p} className="flex items-start gap-3 text-sm"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/10 text-success"><Check className="size-3" strokeWidth={3} /></span>{p}</li>)}
                  </ul>
                </Reveal>
                <Reveal from="scale" delay={150}><div className="parallax transition-transform duration-500 hover:-translate-y-1"><Shot src={f.image} alt={f.alt} crop={f.crop} /></div></Reveal>
              </div>
            ))}
          </div>
        </section>

        {/* Numbers that are true of the product itself */}
        <section className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 px-4 py-16 md:px-6 lg:grid-cols-4">
          {[[58, "dishes in the starter menu"], [6, "staff roles with their own screens"], [7, "kinds of vendor, from kirana to transport"], [3, "languages on day one"]].map(([n, label], i) => (
            <Reveal key={label} delay={i * 80} className="rounded-2xl border bg-surface p-6 text-center shadow-card">
              <p className="font-heading text-5xl font-bold text-primary"><CountUp to={Number(n)} /></p>
              <p className="mt-2 text-sm text-text-muted">{label}</p>
            </Reveal>
          ))}
        </section>

        {/* Everything else */}
        <section id="more" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 pb-20 md:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Everything else</p>
            <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">The details a caterer actually asks for.</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {extras.map((e, i) => (
              <Reveal key={e.title} delay={(i % 4) * 70} className="rounded-2xl border bg-surface p-5 transition-shadow duration-200 hover:shadow-card">
                <e.icon className="size-6 text-accent-gold" strokeWidth={1.75} />
                <h3 className="mt-4 font-heading text-base font-semibold">{e.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted">{e.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Closing band: always dark, whatever the visitor's theme */}
        <section data-theme="dark" className="relative overflow-hidden bg-bg text-text">
          <div aria-hidden className="animate-blob pointer-events-none absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />
          <Reveal from="scale" className="relative mx-auto flex max-w-[1200px] flex-col items-center px-4 py-24 text-center md:px-6">
            <h2 className="max-w-2xl font-heading text-3xl font-bold sm:text-5xl">From the first enquiry to the last plate back in the store.</h2>
            <p className="mt-5 max-w-xl text-lg text-text-muted">Create an account, start with the sample menu and orders, and try a full booking in a few minutes.</p>
            <AuthButtons size="lg" className="mt-8 flex-wrap justify-center" />
          </Reveal>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-text-muted md:px-6">
          <p className="flex items-center gap-2 font-heading font-semibold text-text"><span className="grid size-7 place-items-center rounded-md bg-primary text-xs text-primary-fg">PT</span>{PRODUCT}</p>
          <p>Catering management software for agencies in India.</p>
          <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
