import chromium from "@sparticuz/chromium";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

/*
 * Real PDF files of the documents. A built-in browser opens the document's print page as the person
 * asking (their login cookies are passed along) and saves it as A4. A browser is used rather than a PDF
 * library because Gujarati and Hindi need proper text shaping, which only a browser gets right.
 */

export const maxDuration = 60;

const kinds = ["quote", "menu", "confirmation", "invoice", "credit", "bill", "itemised", "workorder"];
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
  const cookies = (request.headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => {
    const i = c.indexOf("=");
    return { name: c.slice(0, i), value: c.slice(i + 1), domain: host.split(":")[0], path: "/" };
  });
  if (!cookies.some((c) => c.name.startsWith("sb-"))) return Response.json({ error: "Sign in first." }, { status: 401 });

  // On Vercel the packaged Chromium is used; on a computer, the installed Chrome.
  const serverless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const executablePath = serverless ? await chromium.executablePath() : chromePath();
  if (!executablePath) return Response.json({ error: "No browser found to make the PDF. Set CHROME_PATH." }, { status: 500 });
  const browser = await puppeteer.launch({ executablePath, headless: true, args: serverless ? chromium.args : ["--no-sandbox", "--font-render-hinting=none"] });
  try {
    await browser.setCookie(...cookies);
    const page = await browser.newPage();
    const query = new URLSearchParams({ ...(lang ? { lang } : {}), ...(day ? { day } : {}) }).toString();
    await page.goto(`${origin}/print/${kind}/${id}${query ? `?${query}` : ""}`, { waitUntil: "networkidle0", timeout: 45000 });
    await page.waitForFunction(() => !!document.body.dataset.ready, { timeout: 30000 });
    const state = await page.evaluate(() => document.body.dataset.ready);
    if (state === "signedout") return Response.json({ error: "Sign in first." }, { status: 401 });
    if (state !== "1") return Response.json({ error: "Document not found." }, { status: 404 });
    const name = ((await page.title()) || `${kind}-${id.slice(0, 8)}`).replace(/[^\w.-]+/g, "-");
    // Event documents run edge to edge, with the business and page number at the foot of every page.
    const events = ["quote", "menu", "confirmation", "bill", "itemised", "workorder"].includes(kind);
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
