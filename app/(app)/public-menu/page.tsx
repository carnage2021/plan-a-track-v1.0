"use client";

import { PageHeader } from "@/components/shared/blocks";
import { PublicMenuForm } from "@/components/settings/doc-forms";
import { Card } from "@/components/ui/primitives";

/** The caterer's public menu: its link and QR code, and the dishes suggested for each package. */
export default function PublicMenuPage() {
  return (
    <>
      <PageHeader title="Public menu" subtitle="A menu page anyone can open from a link or QR code: your dishes, packages and suggested dishes, with an Enquire on WhatsApp button." />
      <Card className="max-w-5xl p-4 md:p-6"><PublicMenuForm /></Card>
    </>
  );
}
