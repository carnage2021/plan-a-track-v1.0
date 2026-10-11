"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { BrandForm, BusinessForm, NumberingForm, TaxBankForm, TeamForm } from "@/components/settings/tenant-forms";
import { Stepper } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";

const steps = [
  { label: "Business", title: "Tell us about your business", help: "This appears on every quotation, receipt and invoice.", Form: BusinessForm },
  { label: "Brand", title: "Add your logo and colour", help: "Clients see your brand, not ours.", Form: BrandForm },
  { label: "GST and bank", title: "GST and bank details", help: "Used for tax calculation and for collecting payments.", Form: TaxBankForm },
  { label: "Numbering", title: "Document numbers and terms", help: "Numbers restart every financial year.", Form: NumberingForm },
  { label: "Team", title: "Invite your team", help: "Each person only sees what their role needs. You can add more later.", Form: TeamForm },
];

export default function SetupPage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const signedIn = useStore((s) => s.signedIn);
  const name = useStore((s) => s.tenant.name);
  const completeSetup = useStore((s) => s.completeSetup);
  const [step, setStep] = React.useState(0);
  const current = steps[step];
  const last = step === steps.length - 1;

  React.useEffect(() => {
    if (hydrated && !signedIn) router.replace("/login");
  }, [hydrated, signedIn, router]);

  const finish = () => {
    completeSetup();
    router.replace("/");
  };

  if (!hydrated) return <div className="mx-auto max-w-3xl p-6"><Skeleton className="h-10 w-64" /><Skeleton className="mt-6 h-96 rounded-xl" /></div>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-24 pt-6 md:px-6 md:pt-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">Step {step + 1} of {steps.length}</p>
        <Button variant="ghost" onClick={finish}>Skip, use the demo data</Button>
      </div>
      <div className="mt-4"><Stepper steps={steps.map((s) => s.label)} current={step} onStep={setStep} /></div>

      <h1 className="mt-8 font-heading text-2xl font-bold md:text-3xl">{current.title}</h1>
      <p className="mt-1 text-sm text-text-muted">{current.help}</p>
      <Card className="mt-6 p-4 md:p-6"><current.Form /></Card>

      <div className="fixed inset-x-0 bottom-0 border-t bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Button variant="ghost" size="lg" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft strokeWidth={1.75} />Back</Button>
          <Button variant="primary" size="lg" disabled={!name.trim()} onClick={last ? finish : () => setStep(step + 1)}>
            {last ? "Finish setup" : "Save and continue"}
            {last ? <Check strokeWidth={2} /> : <ArrowRight strokeWidth={1.75} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
