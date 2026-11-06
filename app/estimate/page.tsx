"use client";

import { ArrowLeft, ArrowRight, CalendarCheck, Calculator, Save, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CostingTab } from "@/components/billing/order-costing";
import { MenuSelector } from "@/components/menu/menu-selector";
import { DetailsForm, SummaryForm, useDraftTotals } from "@/components/sales/quote-forms";
import { Stepper } from "@/components/shared/blocks";
import { BrandMark } from "@/components/settings/tenant-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Skeleton } from "@/components/ui/primitives";
import { blankDraft, namedServices } from "@/lib/draft";
import { asOrder, useEstimates } from "@/lib/estimates";
import { priceFunction } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import { SupplyGate } from "@/components/supply/common";
import type { QuoteDraft } from "@/lib/types";
import { money, num, uid } from "@/lib/utils";

const steps = ["Events and guests", "Menu", "Extras", "Calculation"];

/**
 * Cost Calculator: the menu and extras of a booking, worked out for the bill, the costing and the profit, without a
 * client and without booking anything. A calculation can be saved, opened again, and turned into a booking.
 */
function Editor({ initial, id: savedId }: { initial: { name: string; draft: QuoteDraft }; id?: string }) {
  const router = useRouter();
  const tenant = useStore((s) => s.tenant);
  const items = useStore((s) => s.items);
  const packages = useStore((s) => s.packages);
  const { ready: canSave, save } = useEstimates();
  const [id, setId] = React.useState(savedId);
  const [name, setName] = React.useState(initial.name);
  const [draft, setDraftState] = React.useState<QuoteDraft>(initial.draft);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const setDraft = React.useCallback((patch: Partial<QuoteDraft> | ((d: QuoteDraft) => Partial<QuoteDraft>)) => {
    setDirty(true);
    setDraftState((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);
  const [activeFn, setActiveFn] = React.useState(draft.functions[0]?.id ?? "");
  const [showErrors, setShowErrors] = React.useState(false);
  const { totals } = useDraftTotals(draft);
  const step = draft.step;
  // Only guests are needed to price a menu; the date and venue can stay empty.
  const issues = draft.functions.flatMap((f, i) => (f.pax > 0 ? [] : [`Enter guests for ${f.name.trim() || `Service ${i + 1}`}`]));
  const noMainRate = draft.functions.filter((f) => { const p = priceFunction(f, items, packages, tenant.slabs); return p.needsMainRate && !p.mainRate; }).map((f) => f.name);
  const order = React.useMemo(() => asOrder(id ?? "calculation", draft), [id, draft]);

  const go = (next: number) => {
    if (next > 0 && issues.length) {
      setShowErrors(true);
      setDraftState((d) => ({ ...d, step: 0 }));
      return toast.error(issues[0]);
    }
    if (next > 2 && noMainRate.length) toast.message(`No main course rate yet for ${noMainRate.join(", ")}`, { description: "The calculation leaves it out until the rate is typed in Extras." });
    setDraftState((d) => ({ ...d, step: next, functions: namedServices(d.functions) }));
    window.scrollTo({ top: 0 });
  };

  const store = async () => {
    if (!canSave) return toast.error("Saving needs the 0028 database update", { description: "Ask the owner to run it. The calculation itself works without it." });
    setBusy(true);
    try {
      const saved = await save({ id, name: name.trim() || defaultName(draft), draft: { ...draft, functions: namedServices(draft.functions) } });
      if (!id) {
        setId(saved);
        // The address carries the calculation from now on, without reloading the page.
        window.history.replaceState(null, "", `/estimate?id=${saved}`);
      }
      if (!name.trim()) setName(defaultName(draft));
      setDirty(false);
      toast.success("Calculation saved", { description: "It is in the Cost Calculator list." });
      return saved;
    } catch (e) {
      toast.error("The calculation was not saved", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  const book = async () => {
    const saved = canSave ? (dirty || !id ? await store() : id) : undefined;
    if (canSave && !saved) return;
    if (!saved) return toast.error("Save the calculation first", { description: "Saving needs the 0028 database update." });
    router.push(`/booking?estimate=${saved}`);
  };

  return (
    <div className="min-h-dvh" style={{ "--brand": tenant.brandColor } as React.CSSProperties}>
      <header className="sticky top-0 z-30">
        <div className="flex h-14 items-center gap-3 bg-brand px-4 text-brand-fg md:px-6">
          <BrandMark className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate font-heading text-base font-semibold"><Calculator className="size-4" strokeWidth={2} />Cost Calculator</p>
            <p className="truncate text-xs opacity-80">Not a booking: work out the bill, costs and profit of a menu</p>
          </div>
          <p className="tnum text-right max-sm:hidden"><span className="block text-xs opacity-80">Bill with GST</span><span className="font-heading text-base font-semibold">{money(totals.grand)}</span></p>
          <Link href="/calculator" aria-label="Close the calculator" title="Close" className="grid size-9 place-items-center rounded-lg hover:bg-brand-fg/15"><X className="size-5" strokeWidth={1.75} /></Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-2 md:px-6">
          <Stepper steps={steps} current={step} onStep={go} />
          <span className="flex-1" />
          <Input aria-label="Name of this calculation" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} placeholder={defaultName(draft)} className="!h-9 w-64" data-no-title-case />
          <Button loading={busy} onClick={store}><Save strokeWidth={1.75} />{id && !dirty ? "Saved" : "Save"}</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-4 md:px-6 md:pt-6">
        {step === 0 && (
          <div className="mx-auto max-w-4xl">
            <h1 className="font-heading text-2xl font-bold md:text-3xl">Events and guests</h1>
            <p className="mb-4 text-sm text-text-muted">Only the guests are needed for each service; add a date and venue if you know them.</p>
            <DetailsForm noClient draft={draft} setDraft={setDraft} showErrors={showErrors} />
            <div className="mt-6 flex justify-end"><Button variant="primary" size="lg" onClick={() => go(1)}>Choose the menu<ArrowRight strokeWidth={1.75} /></Button></div>
          </div>
        )}
        {step === 1 && (
          <MenuSelector
            booking
            top={124}
            functions={draft.functions}
            onChange={(functions) => setDraft({ functions })}
            activeId={activeFn}
            onActive={setActiveFn}
            extras={draft.extras}
            discount={draft.discount}
            actions={<Button variant="primary" size="lg" onClick={() => go(2)}>Extras<ArrowRight strokeWidth={1.75} /></Button>}
          />
        )}
        {step === 2 && (
          <div className="mx-auto max-w-5xl">
            <h1 className="mb-4 font-heading text-2xl font-bold md:text-3xl">Extras</h1>
            <SummaryForm draft={draft} setDraft={setDraft} />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button size="lg" variant="ghost" onClick={() => go(1)}><ArrowLeft strokeWidth={1.75} />Back to menu</Button>
              <Button variant="primary" size="lg" onClick={() => go(3)}>See the calculation<ArrowRight strokeWidth={1.75} /></Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="mx-auto max-w-6xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-heading text-2xl font-bold md:text-3xl">Calculation</h1>
                <p className="tnum text-sm text-text-muted">{draft.functions.length} {draft.functions.length === 1 ? "service" : "services"} · {num(totals.pax)} guests · bill {money(totals.subtotal)} before discount, {money(totals.grand)} with GST</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" variant="ghost" onClick={() => go(2)}><ArrowLeft strokeWidth={1.75} />Back to extras</Button>
                <Button size="lg" loading={busy} onClick={store}><Save strokeWidth={1.75} />Save calculation</Button>
                <Button size="lg" variant="primary" onClick={book}><CalendarCheck strokeWidth={1.75} />Make a booking from this</Button>
              </div>
            </div>
            <Card className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
              {[["Food", totals.food], ["Extras", totals.extras], ["Discount", -totals.discount], [`GST ${tenant.gstRate}%`, totals.gst], ["Bill with GST", totals.grand]].map(([label, v]) => (
                <div key={label as string}><p className="text-xs text-text-muted">{label}</p><p className="tnum font-heading text-lg font-semibold">{money(v as number)}</p></div>
              ))}
            </Card>
            <SupplyGate><CostingTab order={order} estimate /></SupplyGate>
          </div>
        )}
      </main>
    </div>
  );
}

/** "Wedding · 450 guests" until it is named. */
const defaultName = (d: QuoteDraft) => `${d.eventType || "Event"} · ${d.functions.reduce((s, f) => s + (f.pax || 0), 0)} guests`;

function Loader() {
  const params = useSearchParams();
  const id = params.get("id") ?? undefined;
  const { loaded, list, load } = useEstimates();
  React.useEffect(() => { if (!loaded) void load(); }, [loaded, load]);
  if (id && !loaded) return <div className="p-6"><Skeleton className="h-14 rounded-xl" /><Skeleton className="mt-6 h-96 rounded-xl" /></div>;
  const found = id ? list.find((e) => e.id === id) : undefined;
  if (id && !found) return <div className="p-6 text-sm text-text-muted">That calculation was not found. <Link className="text-primary hover:underline" href="/calculator">Back to the Cost Calculator</Link></div>;
  const initial = found ? { name: found.name, draft: { ...found.draft, step: 1 } } : { name: "", draft: { ...blankDraft(), functions: blankDraft().functions.map((f) => ({ ...f, id: uid(), date: "" })) } };
  return <Editor key={id ?? "new"} id={found?.id} initial={initial} />;
}

export default function EstimatePage() {
  const router = useRouter();
  const hydrated = useStore((s) => s.hydrated);
  const signedIn = useStore((s) => s.signedIn);
  React.useEffect(() => {
    if (hydrated && !signedIn) router.replace("/login");
  }, [hydrated, signedIn, router]);
  const loading = <div className="p-6"><Skeleton className="h-14 rounded-xl" /><Skeleton className="mt-6 h-96 rounded-xl" /></div>;
  if (!hydrated || !signedIn) return loading;
  return <React.Suspense fallback={loading}><Loader /></React.Suspense>;
}
