import type { Metadata } from "next";

export const metadata: Metadata = { title: "Document", robots: { index: false } };

/** A bare page: no app shell, white background, printed in the light theme. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div data-theme="light" className="min-h-dvh bg-white">{children}</div>;
}
