"use client";

import { Building2, CreditCard, DatabaseBackup, FileText, Globe, Hash, History, Landmark, Palette, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { AccessForm, ActivityForm, DataForm } from "@/components/settings/access-forms";
import { PlanBillingForm } from "@/components/shell/platform-ui";
import { DocumentsForm, PublicMenuForm } from "@/components/settings/doc-forms";
import { BrandForm, BusinessForm, NumberingForm, RulesForm, TaxBankForm, TeamForm } from "@/components/settings/tenant-forms";
import { PageHeader } from "@/components/shared/blocks";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";

const sections = [
  { id: "business", label: "Business", icon: Building2, Form: BusinessForm },
  { id: "brand", label: "Brand", icon: Palette, Form: BrandForm },
  { id: "tax", label: "GST and bank", icon: Landmark, Form: TaxBankForm },
  { id: "numbering", label: "Numbering and terms", icon: Hash, Form: NumberingForm },
  { id: "documents", label: "Documents", icon: FileText, Form: DocumentsForm },
  { id: "public", label: "Public menu", icon: Globe, Form: PublicMenuForm },
  { id: "rules", label: "Pricing rules", icon: SlidersHorizontal, Form: RulesForm },
  { id: "team", label: "Team", icon: Users, Form: TeamForm },
  { id: "access", label: "Roles and access", icon: ShieldCheck, Form: AccessForm },
  { id: "activity", label: "Activity", icon: History, Form: ActivityForm },
  { id: "data", label: "Your data", icon: DatabaseBackup, Form: DataForm },
  { id: "plan", label: "Plan and billing", icon: CreditCard, Form: PlanBillingForm },
];

function SettingsTabs() {
  const tab = useSearchParams().get("tab");
  return (
    <>
      <PageHeader title="Settings" subtitle="Changes save as you type." />
      <Tabs defaultValue={sections.some((s) => s.id === tab) ? tab! : "business"}>
        <TabsList>
          {sections.map((s) => (
            <TabsTrigger key={s.id} value={s.id}><s.icon className="size-5" strokeWidth={1.75} />{s.label}</TabsTrigger>
          ))}
        </TabsList>
        {sections.map((s) => (
          <TabsContent key={s.id} value={s.id}>
            <Card className="max-w-3xl p-4 md:p-6"><s.Form /></Card>
          </TabsContent>
        ))}
      </Tabs>

    </>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense fallback={null}>
      <SettingsTabs />
    </React.Suspense>
  );
}
