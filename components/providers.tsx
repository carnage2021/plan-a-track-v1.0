"use client";

import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { Toaster } from "sonner";
import { TitleCase } from "@/components/shell/title-case";
import { useStore } from "@/lib/store";
import { useMediaQuery, useTheme } from "@/lib/ui";
import en from "@/messages/en.json";
import gu from "@/messages/gu.json";
import hi from "@/messages/hi.json";

const messages = { en, hi, gu };

export function Providers({ children }: { children: React.ReactNode }) {
  const locale = useStore((s) => s.locale);
  const desktop = useMediaQuery("(min-width: 768px)");
  const { theme } = useTheme();

  React.useEffect(() => {
    // Preferences come back from the browser first, then the session and data from Supabase.
    void Promise.resolve(useStore.persist.rehydrate()).then(() => useStore.getState().init());
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Kolkata">
      {children}
      <TitleCase />
      <Toaster
        theme={theme}
        position={desktop ? "bottom-right" : "bottom-center"}
        duration={5000}
        offset={desktop ? 24 : 88}
        mobileOffset={88}
        style={
          {
            "--normal-bg": "var(--surface)",
            "--normal-text": "var(--text)",
            "--normal-border": "var(--border)",
            "--border-radius": "12px",
            fontFamily: "var(--font-sans)",
          } as React.CSSProperties
        }
      />
    </NextIntlClientProvider>
  );
}
