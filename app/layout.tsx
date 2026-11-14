import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// The fonts ship with the app (app/fonts, from Google Fonts): next/font/google fetched them at build time and kept
// failing on Vercel ("queries have exactly one entry"), so every deploy broke. These are variable fonts.
const inter = localFont({ variable: "--font-inter", src: [{ path: "./fonts/inter.woff2", weight: "400 500", style: "normal" }], display: "swap" });
const jakarta = localFont({ variable: "--font-jakarta", src: [{ path: "./fonts/jakarta.woff2", weight: "600 700", style: "normal" }], display: "swap" });
const devanagari = localFont({ variable: "--font-devanagari", src: [{ path: "./fonts/devanagari.woff2", weight: "400 600", style: "normal" }], display: "swap", preload: false });
const gujarati = localFont({ variable: "--font-gujarati", src: [{ path: "./fonts/gujarati.woff2", weight: "400 600", style: "normal" }], display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Catering Manager",
  description: "Enquiries, quotations, orders and events for catering agencies",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Runs before first paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;if(sessionStorage.getItem("splash-seen"))document.documentElement.dataset.splashSeen=""}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${devanagari.variable} ${gujarati.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
