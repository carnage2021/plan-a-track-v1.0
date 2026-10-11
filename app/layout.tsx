import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Sans_Gujarati, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["600", "700"] });
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600"],
  preload: false,
});
const gujarati = Noto_Sans_Gujarati({
  variable: "--font-gujarati",
  subsets: ["gujarati"],
  weight: ["400", "500", "600"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Catering Manager",
  description: "Enquiries, quotations, orders and events for catering agencies",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Runs before first paint so the saved theme never flashes.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

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
