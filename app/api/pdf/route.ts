import chromium from "@sparticuz/chromium";
import { existsSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer-core";

/*
 * Real PDF files of the documents. A built-in browser opens the document's print page as the person
 * asking (their login cookies are passed along) and saves it as A4. A browser is used rather than a PDF
 * library because Gujarati and Hindi need proper text shaping, which only a browser gets right.
 */

export const maxDuration = 60;

const kinds = ["quote", "menu", "confirmation", "invoice", "credit", "bill", "itemised", "workorder", "service", "small", "costing", "letterhead"];
const langs = ["en", "hi", "gu"];

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const local = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"];
  return local.find((p) => existsSync(p));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // The address the person actually used (a server bound to 0.0.0.0 reports that, which a browser cannot open).
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const origin = `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${host}`;
  const kind = url.searchParams.get("kind") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const lang = url.searchParams.get("lang") ?? "";
  // A day's document for quotations, confirmations and menu cards.
  const day = url.searchParams.get("day") ?? "";
  if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !["quote", "menu", "confirmation"].includes(kind))) return Response.json({ error: "Unknown day." }, { status: 400 });
  if (!kinds.includes(kind) || !/^[0-9a-f-]{36}$/i.test(id) || (lang && !langs.includes(lang))) return Response.json({ error: "Unknown document." }, { status: 400 });
  // A vendor's work order for extra services is one event (id) and one vendor.
  const vendor = url.searchParams.get("vendor") ?? "";
  if ((kind === "service") !== !!vendor || (vendor && !/^[0-9a-f-]{36}$/i.test(vendor))) return Response.json({ error: "Unknown document." }, { status: 400 });
  // The menu on the letterhead: one event of a booking, or the sample menu or blank letterhead (id is the account's).
  const event = url.searchParams.get("event") ?? "";
  const mode = url.searchParams.get("mode") ?? "";
  if ((event || mode) && (kind !== "letterhead" || (event && !/^[0-9a-f-]{36}$/i.test(event)) || (mode && !["sample", "blank"].includes(mode)))) return Response.json({ error: "Unknown document." }, { status: 400 });
  const cookies = (request.headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => {
    const i = c.indexOf("=");
    return { name: c.slice(0, i), value: c.slice(i + 1), domain: host.split(":")[0], path: "/" };
  });
  if (!cookies.some((c) => c.name.startsWith("sb-"))) return Response.json({ error: "Sign in first." }, { status: 401 });

  // On Vercel the packaged Chromium is used; on a computer, the installed Chrome.
  const serverless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  // A browser that fails to start still answers with the reason, so the person sees more than an empty error.
  try {
    const executablePath = serverless ? await chromium.executablePath() : chromePath();
    if (!executablePath) return Response.json({ error: "No browser found to make the PDF. Set CHROME_PATH." }, { status: 500 });
    browser = await puppeteer.launch({ executablePath, headless: true, args: serverless ? chromium.args : ["--no-sandbox", "--font-render-hinting=none"] });
  } catch (e) {
    console.error("PDF browser did not start", e);
    return Response.json({ error: `The PDF maker could not start: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 500 });
  }
  try {
    await browser.setCookie(...cookies);
    const page = await browser.newPage();
    const query = new URLSearchParams({ ...(lang ? { lang } : {}), ...(day ? { day } : {}), ...(vendor ? { vendor } : {}), ...(event ? { event } : {}), ...(mode ? { mode } : {}) }).toString();
    await page.goto(`${origin}/print/${kind}/${id}${query ? `?${query}` : ""}`, { waitUntil: "networkidle0", timeout: 45000 });
    await page.waitForFunction(() => !!document.body.dataset.ready, { timeout: 30000 });
    const state = await page.evaluate(() => document.body.dataset.ready);
    if (state === "signedout") return Response.json({ error: "Sign in first." }, { status: 401 });
    if (state !== "1") return Response.json({ error: "Document not found." }, { status: 404 });
    if (kind === "letterhead") {
      const name = ((await page.title()) || "Menu").replace(/[^\w.-]+/g, "-");
      // The caterer's own design, when they uploaded one: only a file from this app's storage is fetched.
      const design = await page.evaluate(() => ({ url: document.body.dataset.letterhead ?? "", type: document.body.dataset.letterheadType ?? "" }));
      const own = "/api/local/storage/public/media/";
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, omitBackground: !!design.url, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
      let out: Uint8Array = pdf;
      if (design.url) {
        if (!design.url.startsWith(own)) return Response.json({ error: "The letterhead file is not in this account's storage." }, { status: 400 });
        const res = await fetch(new URL(design.url, origin));
        if (!res.ok) return Response.json({ error: "The letterhead file could not be read. Upload it again in Settings → Documents." }, { status: 502 });
        out = await onLetterhead(pdf, new Uint8Array(await res.arrayBuffer()));
      }
      return new Response(Buffer.from(out), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "private, no-store" } });
    }
    const name = ((await page.title()) || `${kind}-${id.slice(0, 8)}`).replace(/[^\w.-]+/g, "-");
    // Event documents run edge to edge, with the business and page number at the foot of every page.
    const events = ["quote", "menu", "confirmation", "bill", "itemised", "workorder", "service", "costing"].includes(kind);
    const footer = (await page.evaluate(() => document.body.dataset.footer ?? "")).replace(/[<>&"]/g, "");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: events,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;padding:0 10mm;font-size:8px;color:#6b6158;display:flex;justify-content:space-between;font-family:Arial,sans-serif"><span>${footer}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: events ? { top: "8mm", bottom: "14mm", left: "0", right: "0" } : { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });
    return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "The PDF could not be made." }, { status: 500 });
  } finally {
    await browser.close();
  }
}

const A4 = { w: 595.28, h: 841.89 };

/**
 * Lays each page of the menu over the caterer's design: a PDF's first page under the first page and its second page
 * (if it has one) under the rest, or a picture under every page. The design fills the A4 page; one of a different
 * shape is scaled to cover it, centred.
 */
async function onLetterhead(menu: Uint8Array, design: Uint8Array) {
  const out = await PDFDocument.create();
  const pages = await out.embedPdf(menu, [...Array((await PDFDocument.load(menu)).getPageCount()).keys()]);
  const isPdf = design[0] === 0x25 && design[1] === 0x50 && design[2] === 0x44 && design[3] === 0x46;
  const isPng = design[0] === 0x89 && design[1] === 0x50;
  const isJpg = design[0] === 0xff && design[1] === 0xd8;
  type Art = { w: number; h: number; draw: (p: ReturnType<typeof out.addPage>, box: { x: number; y: number; width: number; height: number }) => void };
  let art: Art[];
  if (isPdf) {
    const src = await PDFDocument.load(design, { ignoreEncryption: true });
    const embedded = await out.embedPdf(src, [...Array(Math.min(src.getPageCount(), 2)).keys()]);
    art = embedded.map((e) => ({ w: e.width, h: e.height, draw: (p, box) => p.drawPage(e, box) }));
  } else if (isPng || isJpg) {
    const img = isPng ? await out.embedPng(design) : await out.embedJpg(design);
    art = [{ w: img.width, h: img.height, draw: (p, box) => p.drawImage(img, box) }];
  } else throw new Error("The letterhead must be a PDF, PNG or JPG file.");
  pages.forEach((menuPage, i) => {
    const p = out.addPage([A4.w, A4.h]);
    const a = art[Math.min(i, art.length - 1)];
    // Nearly A4 is stretched to fit exactly; anything else is scaled to cover the page.
    const close = Math.abs(a.w / a.h - A4.w / A4.h) < 0.03;
    const scale = Math.max(A4.w / a.w, A4.h / a.h);
    const width = close ? A4.w : a.w * scale;
    const height = close ? A4.h : a.h * scale;
    a.draw(p, { x: (A4.w - width) / 2, y: (A4.h - height) / 2, width, height });
    p.drawPage(menuPage, { x: 0, y: 0, width: A4.w, height: A4.h });
  });
  return out.save();
}
