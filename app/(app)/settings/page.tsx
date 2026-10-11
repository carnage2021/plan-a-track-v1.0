"use client";

import { Building2, Hash, Landmark, Palette, SlidersHorizontal, Users } from "lucide-react";
import { BrandForm, BusinessForm, NumberingForm, RulesForm, TaxBankForm, TeamForm } from "@/components/settings/tenant-forms";
import { PageHeader } from "@/components/shared/blocks";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";

const sections = [
  { id: "business", label: "Business", icon: Building2, Form: BusinessForm },
  { id: "brand", label: "Brand", icon: Palette, Form: BrandForm },
  { id: "tax", label: "GST and bank", icon: Landmark, Form: TaxBankForm },
  { id: "numbering", label: "Numbering and terms", icon: Hash, Form: NumberingForm },
  { id: "rules", label: "Pricing rules", icon: SlidersHorizontal, Form: RulesForm },
  { id: "team", label: "Team", icon: Users, Form: TeamForm },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Changes save as you type." />
      <Tabs defaultValue="business">
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
