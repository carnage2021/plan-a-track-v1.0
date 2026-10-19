import type { Metadata } from "next";

export const metadata: Metadata = { title: "Menu", robots: { index: false } };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
