"use client";

import { Hammer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/nav";

function Planned() {
  const t = useTranslations();
  const pathname = usePathname();
  const item = navItems.find((n) => n.phase && pathname.startsWith(n.href));
  return (
    <>
      <PageHeader title={item ? t(`nav.${item.key}`) : "Page not found"} />
      <EmptyState
        icon={item?.icon ?? Hammer}
        title={item ? t("common.comingSoon", { phase: item.phase ?? 0 }) : "There is nothing at this address"}
        help={item ? t("common.comingSoonHelp") : "The link may be old, or the page may have moved."}
        action={<Button variant="primary" asChild><Link href="/">{t("common.goHome")}</Link></Button>}
      />
    </>
  );
}

/** Placeholder for sidebar modules that belong to later phases. */
export default function PlannedPage() {
  return (
    <Suspense>
      <Planned />
    </Suspense>
  );
}
