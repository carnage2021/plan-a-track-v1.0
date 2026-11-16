"use client";

import localFont from "next/font/local";
import * as React from "react";
import { mediaUrl } from "@/lib/db";
import { addressLines, lhTokens, phoneList, type LhBooking, type LhEvent, type LhRow, type LhTokens } from "@/lib/letterhead";
import type { Letterhead } from "@/lib/types";

// The event menu on the caterer's letterhead, as A4 pages of 794 × 1123 px. "designed": a booking cover, then menu
// pages with the header, gold rules, a faint watermark and the maroon footer. "upload": the caterer's own design is
// laid under each page by the PDF route, so these pages are transparent and keep inside its blank space.
// Rows are measured once the fonts are in, then laid on pages greedily; a category never splits across pages.

const serif = localFont({ src: [{ path: "../../app/fonts/cormorant-normal.woff2", weight: "500 600", style: "normal" }, { path: "../../app/fonts/cormorant-italic.woff2", weight: "500 600", style: "italic" }], display: "block" });
const sans = localFont({ src: [{ path: "../../app/fonts/jost-normal.woff2", weight: "400 600", style: "normal" }], display: "block" });

const W = 794;
const H = 1123;
const SIDE = 56;
/** Designed menu pages: the content runs from under the header rule to 30 px above the footer band (79 px). */
const BODY_TOP = 175;
const BODY_BOTTOM = 79 + 30;
const mm = (n: number) => Math.round((n * 96) / 25.4);

type Page =
  | { kind: "cover" }
  | { kind: "menu"; ev: LhEvent; first: boolean; rows: LhRow[]; closing: boolean; details: boolean }
  | { kind: "blank" };

export function LetterheadMenu({ booking, lh, brand, signature, blank, backdrop, guides, onReady }: {
  booking: LhBooking;
  lh: Letterhead;
  brand: string;
  /** The authorised signatory's signature, shown above the line */
  signature?: string;
  /** Only the letterhead, no booking: one empty page */
  blank?: boolean;
  /** Previews only: an uploaded picture design behind each page, and a dashed line round the menu's space */
  backdrop?: string;
  guides?: boolean;
  /** Called once the pages are laid out */
  onReady?: () => void;
}) {
  const t = lhTokens(lh);
  const upload = lh.style === "upload";
  const top = upload ? mm(lh.top) : BODY_TOP;
  const bottom = upload ? mm(lh.bottom) : BODY_BOTTOM;
  const side = upload ? mm(lh.side) : SIDE;
  const capacity = H - top - bottom;
  const measure = React.useRef<HTMLDivElement>(null);
  const layoutKey = JSON.stringify([booking, lh.style, top, bottom, side]);
  // Pages laid out for other settings are dropped, so a change is measured again.
  const [laid, setLaid] = React.useState<{ key: string; pages: Page[] } | null>(null);
  const pages: Page[] | null = blank ? [{ kind: "blank" }] : laid?.key === layoutKey ? laid.pages : null;

  React.useLayoutEffect(() => {
    if (blank) return;
    let live = true;
    // Heights are only right once the document's fonts have loaded.
    void document.fonts.ready.then(() => {
      const box = measure.current;
      if (!live || !box) return;
      const h = (key: string) => (box.querySelector<HTMLElement>(`[data-m="${CSS.escape(key)}"]`)?.offsetHeight ?? 0);
      const out: Page[] = upload ? [] : [{ kind: "cover" }];
      booking.events.forEach((ev, e) => {
        // In an uploaded design the booking's details open the first page, above the first menu.
        const details = upload && e === 0;
        let page: Extract<Page, { kind: "menu" }> = { kind: "menu", ev, first: true, rows: [], closing: false, details };
        let used = h(`first-${ev.id}`) + (details ? h("details") : 0);
        ev.rows.forEach((row) => {
          const rh = h(`row-${ev.id}-${row.key}`);
          if (used + rh > capacity && page.rows.length) {
            out.push(page);
            page = { kind: "menu", ev, first: false, rows: [], closing: false, details: false };
            used = h("cont");
          }
          page.rows.push(row);
          used += rh;
        });
        if (e === booking.events.length - 1) {
          // The thank-you and signature need their room on the last page, or go on one of their own.
          if (used + h("closing") > capacity) {
            out.push(page);
            page = { kind: "menu", ev, first: false, rows: [], closing: true, details: false };
          } else page.closing = true;
        }
        out.push(page);
      });
      if (!booking.events.length) out.push({ kind: "blank" });
      setLaid({ key: layoutKey, pages: out });
    });
    return () => {
      live = false;
    };
    // layoutKey stands for everything that changes the page breaks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, capacity, blank]);

  React.useEffect(() => {
    if (pages) onReady?.();
  }, [pages, onReady]);
  const measuring = !pages;

  const style = { "--lh-serif": serif.style.fontFamily, "--lh-sans": sans.style.fontFamily, fontFamily: "var(--lh-sans)", color: t.ink } as React.CSSProperties;
  const frame = { lh, t, brand, upload, top, bottom, side, backdrop, guides };
  return (
    <div style={style} data-no-title-case className="lh-doc">
      <style>{`@page { size: A4; margin: 0 } .lh-doc * { box-sizing: border-box } .lh-page { break-after: page } .lh-page:last-child { break-after: auto }`}</style>
      {measuring && (
        // Off-screen copies of every block at the page's width, to measure.
        <div ref={measure} data-paging aria-hidden style={{ position: "absolute", left: -10000, top: 0, width: W - side * 2 }}>
          {upload && <div data-m="details"><DetailsBlock booking={booking} t={t} /></div>}
          {booking.events.map((ev) => (
            <React.Fragment key={ev.id}>
              <div data-m={`first-${ev.id}`}><TitleBlock ev={ev} first t={t} /></div>
              {ev.rows.map((r) => <div key={r.key} data-m={`row-${ev.id}-${r.key}`}><MenuRow row={r} t={t} /></div>)}
            </React.Fragment>
          ))}
          <div data-m="cont"><TitleBlock ev={booking.events[0] ?? blankEvent} first={false} t={t} /></div>
          <div data-m="closing"><Closing brand={brand} t={t} signature={signature} /></div>
        </div>
      )}
      {pages?.map((p, i) =>
        p.kind === "cover" ? (
          <Cover key={i} booking={booking} {...frame} />
        ) : (
          <Frame key={i} {...frame}>
            {p.kind === "menu" && (
              <>
                {p.details && <DetailsBlock booking={booking} t={t} />}
                <TitleBlock ev={p.ev} first={p.first} t={t} />
                {p.rows.map((r, j) => <MenuRow key={r.key} row={r} t={t} last={j === p.rows.length - 1} />)}
                {p.closing && <div style={{ marginTop: "auto" }}><Closing brand={brand} t={t} signature={signature} /></div>}
              </>
            )}
          </Frame>
        ),
      )}
    </div>
  );
}

const blankEvent: LhEvent = { id: "x", title: "Menu", eyebrow: "Menu", date: "", session: "", time: "", guests: "", venue: "", rows: [] };

type FrameProps = { lh: Letterhead; t: LhTokens; brand: string; upload: boolean; top: number; bottom: number; side: number; backdrop?: string; guides?: boolean };

/** One A4 page. Designed: strips, header, rule, watermark and footer around the body. Upload: the body alone. */
function Frame({ lh, t, brand, upload, top, bottom, side, backdrop, guides, children }: FrameProps & { children?: React.ReactNode }) {
  const page: React.CSSProperties = { width: W, height: "296.9mm", position: "relative", overflow: "hidden", background: !upload ? "#fff" : backdrop ? `#fff url("${backdrop}") center / 100% 100% no-repeat` : guides ? "#fff" : "transparent" };
  const body: React.CSSProperties = { position: "absolute", top, bottom, left: side, right: side, display: "flex", flexDirection: "column", outline: guides ? "2px dashed #94a3b8" : undefined, outlineOffset: 4 };
  if (upload) return <section className="lh-page" style={page}><div style={body}>{children}</div></section>;
  const phones = phoneList(lh.phones);
  const logo = mediaUrl(lh.logoPath);
  const mark = mediaUrl(lh.markPath);
  return (
    <section className="lh-page" style={page}>
      <Strips t={t} />
      {mark && <img src={mark} alt="" style={{ position: "absolute", left: 217, top: 380, width: 360, height: 402, objectFit: "contain", opacity: 0.045 }} />}
      <header style={{ padding: "26px 56px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        {logo ? <img src={logo} alt={brand} style={{ width: 108, height: 94, objectFit: "contain", objectPosition: "left center" }} /> : <p style={{ font: "600 26px/1.1 var(--lh-serif)", color: t.primary, height: 94, display: "flex", alignItems: "center" }}>{brand}</p>}
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
          {lh.tagline && <i style={{ font: "italic 500 19px/1.2 var(--lh-serif)", color: t.primary }}>{lh.tagline}</i>}
          {phones.length > 0 && <span style={{ fontSize: 12, color: t.inkSoft, letterSpacing: ".02em" }}>{phones.join("  ·  ")}</span>}
          {lh.email && <span style={{ fontSize: 12, color: t.inkSoft }}>{lh.email}</span>}
        </div>
      </header>
      <div style={{ margin: "20px 56px 0" }}>
        <div style={{ height: 1, background: t.rule }} />
        <div style={{ height: 1, marginTop: 3, background: t.primary, opacity: 0.35 }} />
      </div>
      <div style={{ position: "absolute", top, bottom, left: side, right: side, display: "flex", flexDirection: "column" }}>{children}</div>
      <Footer lh={lh} t={t} brand={brand} />
    </section>
  );
}

function Strips({ t }: { t: LhTokens }) {
  return <><div style={{ height: 6, background: t.primary }} /><div style={{ height: 2, background: t.accent }} /></>;
}

function Footer({ lh, t, brand }: { lh: Letterhead; t: LhTokens; brand: string }) {
  const [a, b] = addressLines(lh.address);
  return (
    <footer style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <div style={{ height: 3, background: t.accent }} />
      <div style={{ height: 76, background: t.primary, padding: "0 56px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <span style={{ font: "600 12px/1 var(--lh-sans)", letterSpacing: ".26em", textTransform: "uppercase", color: t.accent, whiteSpace: "nowrap" }}>{brand}</span>
        <address style={{ fontStyle: "normal", fontSize: 12, lineHeight: 1.6, color: t.ivory, textAlign: "right" }}>{a}{b && <><br />{b}</>}</address>
      </div>
    </footer>
  );
}

const label = (t: LhTokens, spacing = ".14em"): React.CSSProperties => ({ font: "600 12px/1.4 var(--lh-sans)", letterSpacing: spacing, textTransform: "uppercase", color: t.label });

/** Page 1 of the designed letterhead: the logo, the party and the booking's details. */
function Cover({ booking, lh, t, brand }: FrameProps & { booking: LhBooking }) {
  const logo = mediaUrl(lh.logoPath);
  const phones = phoneList(lh.phones);
  const cells = detailCells(booking);
  return (
    <section className="lh-page" style={{ width: W, height: "296.9mm", position: "relative", overflow: "hidden", background: "#fff" }}>
      <Strips t={t} />
      <div style={{ paddingTop: 56, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        {logo ? <img src={logo} alt={brand} style={{ width: 230, height: 200, objectFit: "contain" }} /> : <p style={{ font: "600 52px/1.1 var(--lh-serif)", color: t.primary, padding: "60px 0 20px" }}>{brand}</p>}
        {lh.tagline && <i style={{ font: "italic 500 24px/1.2 var(--lh-serif)", color: t.inkSoft, marginTop: 14 }}>{lh.tagline}</i>}
        <Ornament t={t} />
        <p style={{ ...label(t, ".3em"), marginTop: 22 }}>Event booking details</p>
        <h1 style={{ font: "600 44px/1.05 var(--lh-serif)", color: t.primary, margin: "14px 56px 0", maxWidth: W - 112 }}>{booking.party}</h1>
      </div>
      <div style={{ margin: "30px 56px 0", borderTop: `1px solid ${t.rule}`, borderBottom: `1px solid ${t.rule}`, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {cells.map((c, i) => (
          <div key={c.label} style={{ padding: 20, borderLeft: i % 2 ? `1px solid ${t.hairline}` : undefined, borderTop: i > 1 ? `1px solid ${t.hairline}` : undefined }}>
            <p style={label(t)}>{c.label}</p>
            <div style={{ marginTop: 6 }}>{c.body}</div>
          </div>
        ))}
      </div>
      {(phones.length > 0 || lh.email) && (
        <p style={{ position: "absolute", left: 0, right: 0, bottom: 104, display: "flex", justifyContent: "center", alignItems: "center", gap: 18, fontSize: 12, color: t.inkSoft }}>
          {[...phones, lh.email].filter(Boolean).map((x, i) => <React.Fragment key={i}>{i > 0 && <Diamond t={t} />}<span>{x}</span></React.Fragment>)}
        </p>
      )}
      <Footer lh={lh} t={t} brand={brand} />
    </section>
  );
}

const value: React.CSSProperties = { font: "500 16px/1.45 var(--lh-sans)" };
const small: React.CSSProperties = { fontSize: 14, lineHeight: 1.6 };

/** The booking's details in label and value cells; empty ones are left out. */
function detailCells(b: LhBooking) {
  const cells: { label: string; body: React.ReactNode }[] = [];
  if (b.date) cells.push({ label: "Booking date", body: <p style={value}>{b.date}</p> });
  if (b.functions.length) cells.push({ label: b.functions.length > 1 ? "Functions" : "Function", body: b.functions.map((f, i) => <p key={i} style={value}>{f}</p>) });
  if (b.contactName) cells.push({ label: "Contact person", body: <><p style={value}>{b.contactName}</p>{b.contactPhone && <p style={small}>{b.contactPhone}</p>}</> });
  if (b.venue[0]) cells.push({ label: "Venue", body: <><p style={value}>{b.venue[0]}</p>{b.venue[1] && <p style={small}>{b.venue[1]}</p>}</> });
  if (b.emails.length) cells.push({ label: "Email", body: b.emails.map((e) => <p key={e} style={small}>{e}</p>) });
  if (b.residing) cells.push({ label: "Residing address", body: <p style={small}>{b.residing}</p> });
  return cells;
}

/** In an uploaded design: the party and the booking's details at the top of the first page. */
function DetailsBlock({ booking, t }: { booking: LhBooking; t: LhTokens }) {
  const cells = detailCells(booking);
  return (
    <div style={{ paddingBottom: 22 }}>
      <p style={label(t, ".3em")}>Event booking details</p>
      <h1 style={{ font: "600 34px/1.1 var(--lh-serif)", color: t.primary, marginTop: 6 }}>{booking.party}</h1>
      <div style={{ marginTop: 12, borderTop: `1px solid ${t.rule}`, borderBottom: `1px solid ${t.rule}`, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {cells.map((c, i) => (
          <div key={c.label} style={{ padding: "10px 14px", borderLeft: i % 2 ? `1px solid ${t.hairline}` : undefined, borderTop: i > 1 ? `1px solid ${t.hairline}` : undefined }}>
            <p style={label(t)}>{c.label}</p>
            <div style={{ marginTop: 2 }}>{c.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ornament({ t }: { t: LhTokens }) {
  return (
    <div style={{ width: 260, display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
      <span style={{ flex: 1, height: 1, background: t.rule }} />
      <Diamond t={t} />
      <span style={{ flex: 1, height: 1, background: t.rule }} />
    </div>
  );
}

const Diamond = ({ t }: { t: LhTokens }) => <span style={{ width: 7, height: 7, background: t.rule, transform: "rotate(45deg)", display: "inline-block", flexShrink: 0 }} />;

/** "MENU · RECEPTION", "Lunch Menu" and the date; the first page of an event adds its session, time, guests and venue. */
function TitleBlock({ ev, first, t }: { ev: LhEvent; first: boolean; t: LhTokens }) {
  const info = [["Session", ev.session], ["Time", ev.time], ["Guests", ev.guests], ["Venue", ev.venue]].filter(([, v]) => v);
  return (
    <div style={{ paddingBottom: first && info.length ? 14 : 4 }}>
      <p style={label(t, ".3em")}>{first ? ev.eyebrow : "Menu · continued"}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, marginTop: 4 }}>
        <h2 style={{ font: "600 40px/1.05 var(--lh-serif)", color: t.primary }}>{ev.title}</h2>
        {ev.date && <i style={{ font: "italic 500 20px/1 var(--lh-serif)", color: t.inkSoft, whiteSpace: "nowrap" }}>{ev.date}</i>}
      </div>
      {first && info.length > 0 ? (
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: `repeat(${info.length}, 1fr)`, background: t.cream, borderTop: `1px solid ${t.rule}`, borderBottom: `1px solid ${t.rule}` }}>
          {info.map(([k, v], i) => (
            <div key={k} style={{ padding: "10px 14px", borderLeft: i ? `1px solid ${t.divider}` : undefined }}>
              <p style={label(t)}>{k}</p>
              <p style={{ font: "500 16px/1.4 var(--lh-sans)", marginTop: 2 }}>{v}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ height: 1, background: t.rule, marginTop: 14 }} />
      )}
    </div>
  );
}

/** A category: its name on the left; on the right a sub-heading for each sub-category and the dishes in two columns. */
function MenuRow({ row, t, last }: { row: LhRow; t: LhTokens; last?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", columnGap: 20, padding: "11px 0", borderBottom: last ? undefined : `1px solid ${t.hairline}`, breakInside: "avoid" }}>
      <p style={{ ...label(t), paddingTop: 3 }}>{row.label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {row.groups.map((g, i) => (
          <div key={i}>
            {g.sub && <p style={{ font: "italic 600 18px/1.3 var(--lh-serif)", color: t.primary, marginBottom: 2 }}>{g.sub}</p>}
            <div style={{ display: "grid", gridTemplateColumns: row.oneCol ? "1fr" : "repeat(2, 1fr)", gap: "3px 24px", font: "400 14px/1.6 var(--lh-sans)" }}>
              {g.items.map((x, j) => <span key={j}>{x}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The thank-you line and the signature block. */
function Closing({ brand, t, signature }: { brand: string; t: LhTokens; signature?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, paddingTop: 24 }}>
      <div style={{ maxWidth: 380 }}>
        <p style={{ font: "italic 500 26px/1.25 var(--lh-serif)", color: t.primary }}>Thank you for choosing {brand}.</p>
        <p style={{ fontSize: 12, color: t.inkSoft, marginTop: 6 }}>We look forward to serving you and your guests.</p>
      </div>
      <div style={{ width: 210, textAlign: "center" }}>
        {signature && <img src={signature} alt="" style={{ height: 46, maxWidth: 200, objectFit: "contain", margin: "0 auto 4px", display: "block" }} />}
        <div style={{ borderTop: `1px solid ${t.rule}`, paddingTop: 8 }}>
          <p style={label(t, ".16em")}>For {brand}</p>
          <p style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}
