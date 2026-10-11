"use client";

import { ArrowLeft, ArrowRight, Eye, FileCheck2, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { MenuSelector } from "@/components/menu/menu-selector";
import { QuoteDocument } from "@/components/sales/quote-document";
import { DetailsForm, SummaryForm, useDraftTotals } from "@/components/sales/quote-forms";
import { Stepper } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { blankDraft, blankFunction, draftIssues, useQuoteDraft } from "@/lib/draft";
import { useCurrentUser, useStore } from "@/lib/store";
import type { QuoteDraft } from "@/lib/types";
import { money } from "@/lib/utils";

const steps = ["Details", "Menu", "Summary"];

function Builder() {
  const router = useRouter();
  const params = useSearchParams();
  const enquiryId = params.get("enquiry") ?? undefined;
  const reviseId = params.get("revise") ?? undefined;
  const tenant = useStore((s) => s.tenant);
  const createQuotation = useStore((s) => s.createQuotation);
  const user = useCurrentUser();

  const fresh = React.useCallback((): QuoteDraft => {
    const s = useStore.getState();
    const quote = s.quotations.find((q) => q.id === reviseId);
    if (quote) {
      const c = s.clients.find((x) => x.id === quote.clientId);
      return { ...blankDraft(), clientId: quote.clientId, clientName: c?.name ?? "", clientPhone: c?.phone ?? "", eventType: quote.eventType, functions: quote.functions, extras: quote.extras, discount: quote.discount, reviseOf: quote.id, enquiryId: quote.enquiryId, step: 1 };
    }
    const enquiry = s.enquiries.find((e) => e.id === enquiryId);
    if (enquiry) {
      const c = s.clients.find((x) => x.id === enquiry.clientId);
      return { ...blankDraft(), clientId: enquiry.clientId, clientName: c?.name ?? "", clientPhone: c?.phone ?? "", eventType: enquiry.eventType, enquiryId, functions: [blankFunction(enquiry.eventType, enquiry.date, enquiry.pax, enquiry.venue)], step: 1 };
    }
    return blankDraft();
  }, [enquiryId, reviseId]);

  const { draft, setDraft, clear, restart, resumed } = useQuoteDraft("builder", fresh, !enquiryId && !reviseId);
  const [activeFn, setActiveFn] = React.useState(draft.functions[0]?.id ?? "");
  const [showErrors, setShowErrors] = React.useState(false);
  const [preview, setPreview] = React.useState<"menu" | "quotation" | null>(null);
  const { totals, needsApproval } = useDraftTotals(draft);
  const issues = draftIssues(draft);
  const revising = useStore((s) => s.quotations.find((q) => q.id === draft.reviseOf));
  const step = draft.step;

  React.useEffect(() => {
    if (resumed) toast("Picked up your saved draft", { action: { label: "Start fresh", onClick: restart } });
    // Shown once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: number) => {
    if (next > 0 && issues.length) {
      setShowErrors(true);
      setDraft({ step: 0 });
      toast.error(issues[0]);
      return;
    }
    setDraft({ step: next });
    window.scrollTo({ top: 0 });
  };

  const [busy, setBusy] = React.useState(false);
  const create = async () => {
    if (issues.length) return go(1);
    const waiting = needsApproval && user.role !== "owner";
    setBusy(true);
    let id: string;
    try {
      id = await createQuotation(draft, waiting ? "pending_approval" : "draft");
    } catch (e) {
      toast.error("The quotation was not saved", { description: e instanceof Error ? e.message : undefined });
      return;
    } finally {
      setBusy(false);
    }
    clear();
    toast.success(waiting ? "Quotation sent to the owner for approval" : "Quotation created", { description: `${draft.clientName} · ${money(totals.grand)}` });
    router.push(`/quotations/${id}`);
  };

  const saveDraft = () => {
    setDraft({});
    toast.success("Draft saved", { description: "Reopen New quotation any time to continue." });
  };

  const doc = { clientName: draft.clientName, clientPhone: draft.clientPhone, eventType: draft.eventType, functions: draft.functions, extras: draft.extras, discount: draft.discount, gstRate: tenant.gstRate, gstInclusive: tenant.gstInclusive, number: revising?.number, version: revising ? revising.version + 1 : undefined };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to quotations"><Link href="/quotations"><ArrowLeft strokeWidth={1.75} /></Link></Button>
        <div className="min-w-48 flex-1">
          <h1 className="truncate font-heading text-2xl font-bold">{revising ? `Revise ${revising.number}` : "New quotation"}</h1>
          <p className="truncate text-sm text-text-muted">{revising ? `This becomes version ${revising.version + 1}; the older version is kept for comparison.` : draft.clientName ? `${draft.clientName} · ${draft.eventType}` : "Autosaves as you go."}</p>
        </div>
        <Stepper steps={steps} current={step} onStep={go} />
      </div>

      {step === 0 && (
        <>
          <DetailsForm draft={draft} setDraft={setDraft} showErrors={showErrors} />
          <div className="mt-6 flex justify-end gap-2">
            <Button size="lg" onClick={saveDraft}><Save strokeWidth={1.75} />Save draft</Button>
            <Button variant="primary" size="lg" onClick={() => go(1)}>Choose the menu<ArrowRight strokeWidth={1.75} /></Button>
          </div>
        </>
      )}

      {step === 1 && (
        <MenuSelector
          functions={draft.functions}
          onChange={(functions) => setDraft({ functions })}
          activeId={activeFn}
          onActive={setActiveFn}
          extras={draft.extras}
          discount={draft.discount}
          clientId={draft.clientId}
          actions={
            <>
              <Button variant="primary" size="lg" onClick={() => go(2)}>Extras and total<ArrowRight strokeWidth={1.75} /></Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={saveDraft}><Save strokeWidth={1.75} />Save draft</Button>
                <Button onClick={() => setPreview("menu")}><Eye strokeWidth={1.75} />Menu card</Button>
              </div>
            </>
          }
        />
      )}

      {step === 2 && (
        <>
          <SummaryForm draft={draft} setDraft={setDraft} />
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button size="lg" variant="ghost" onClick={() => go(1)}><ArrowLeft strokeWidth={1.75} />Back to menu</Button>
            <Button size="lg" onClick={() => setPreview("quotation")}><Eye strokeWidth={1.75} />Preview</Button>
            <Button variant="primary" size="lg" loading={busy} onClick={create}><FileCheck2 strokeWidth={1.75} />{revising ? `Save as version ${revising.version + 1}` : "Create quotation"}</Button>
          </div>
        </>
      )}

      {step === 0 && resumed && (
        <Button variant="ghost" className="mt-4" onClick={restart}><RotateCcw strokeWidth={1.75} />Discard this draft and start fresh</Button>
      )}

      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title={preview === "menu" ? "Menu card preview" : "Quotation preview"} description="This is what the client receives." wide>
        {preview && <QuoteDocument data={doc} variant={preview} />}
      </Sheet>
    </>
  );
}

export default function NewQuotationPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <Builder />
    </React.Suspense>
  );
}
