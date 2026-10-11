"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CalendarDays, FileText, MessagesSquare, MoreVertical, PencilLine, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { leadSourceLabel } from "@/components/sales/enquiry-sheet";
import { Badge, StatusBadge, statusToneOf } from "@/components/shared/badges";
import { Avatar, EmptyState, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Chip, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import type { Enquiry, EnquiryStage } from "@/lib/types";
import { useUi } from "@/lib/ui";
import { cn, daysFromToday, fmtDate, money, num, relativeDay } from "@/lib/utils";

const stages: EnquiryStage[] = ["new", "contacted", "quoted", "followup", "booked", "lost"];
const lostReasons = ["Budget too low", "Chose another caterer", "Date not available", "Event cancelled", "No response"];
const dot: Record<string, string> = { info: "bg-info", warning: "bg-warning", success: "bg-success", danger: "bg-danger", neutral: "bg-text-muted", primary: "bg-primary", gold: "bg-accent-gold" };

function LeadCard({ enquiry, onMove, dragging }: { enquiry: Enquiry; onMove: (stage: EnquiryStage) => void; dragging?: boolean }) {
  const t = useTranslations("status");
  const router = useRouter();
  const client = useStore((s) => s.clients.find((c) => c.id === enquiry.clientId));
  const owner = useStore((s) => s.users.find((u) => u.id === enquiry.assignedTo));
  const openEnquiry = useUi((s) => s.openEnquiry);
  const follow = enquiry.followUpAt && !["booked", "lost"].includes(enquiry.stage) ? daysFromToday(enquiry.followUpAt) : null;

  return (
    <article className={cn("rounded-xl border bg-surface p-3 shadow-card", dragging && "rotate-1 shadow-sheet")}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => openEnquiry(enquiry.id)} className="min-w-0 text-left">
          <h3 className="truncate font-heading text-base font-semibold">{client?.name}</h3>
          <p className="truncate text-xs text-text-muted">{enquiry.eventType} · {leadSourceLabel(enquiry.source)}</p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-1.5 -mt-1.5" aria-label={`Actions for ${client?.name}`}><MoreVertical strokeWidth={1.75} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => openEnquiry(enquiry.id)}><PencilLine strokeWidth={1.75} />Edit enquiry</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push(`/quotations/new?enquiry=${enquiry.id}`)}><FileText strokeWidth={1.75} />Create quotation</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {stages.filter((s) => s !== enquiry.stage).map((s) => <DropdownMenuItem key={s} onSelect={() => onMove(s)}><span className={cn("mx-1.5 size-2 rounded-full", dot[statusToneOf(s)])} />{t(s)}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <dl className="tnum mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
        <div className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" strokeWidth={1.75} /><dt className="sr-only">Event date</dt><dd>{fmtDate(enquiry.date, { day: "numeric", month: "short" })}</dd></div>
        <div className="inline-flex items-center gap-1"><Users className="size-3.5" strokeWidth={1.75} /><dt className="sr-only">Guests</dt><dd>{num(enquiry.pax)}</dd></div>
        {enquiry.budgetPerPlate > 0 && <div><dt className="sr-only">Budget</dt><dd>{money(enquiry.budgetPerPlate)} per plate</dd></div>}
      </dl>
      {enquiry.notes && <p className="mt-2 line-clamp-2 text-xs text-text-muted">{enquiry.notes}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        {enquiry.stage === "lost" ? <Badge tone="danger">{enquiry.lostReason}</Badge> : follow !== null ? <Badge tone={follow < 0 ? "danger" : follow === 0 ? "warning" : "neutral"}>{follow < 0 ? "Follow-up missed" : `Follow up ${relativeDay(enquiry.followUpAt!).toLowerCase()}`}</Badge> : <span />}
        {owner && <Avatar name={owner.name} className="size-7" />}
      </div>
    </article>
  );
}

function DraggableLead({ enquiry, onMove }: { enquiry: Enquiry; onMove: (stage: EnquiryStage) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: enquiry.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} role="listitem" className={cn("touch-none", isDragging && "opacity-30")}>
      <LeadCard enquiry={enquiry} onMove={onMove} />
    </div>
  );
}

function Column({ stage, enquiries, onMove }: { stage: EnquiryStage; enquiries: Enquiry[]; onMove: (id: string, stage: EnquiryStage) => void }) {
  const t = useTranslations("status");
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-2xl border-2 border-dashed border-transparent bg-surface-muted p-2 transition-colors duration-150", isOver && "border-primary bg-primary-soft")}>
      <h2 className="flex items-center gap-2 px-2 py-2 text-sm font-semibold">
        <span className={cn("size-2 rounded-full", dot[statusToneOf(stage)])} aria-hidden />{t(stage)}
        <span className="tnum ml-auto rounded-full bg-surface px-2 text-xs font-medium text-text-muted">{enquiries.length}</span>
      </h2>
      <div className="flex min-h-24 flex-1 flex-col gap-2" role="list">
        {enquiries.map((e) => <DraggableLead key={e.id} enquiry={e} onMove={(s) => onMove(e.id, s)} />)}
        {enquiries.length === 0 && <p className="grid flex-1 place-items-center rounded-xl text-xs text-text-muted">Drop a lead here</p>}
      </div>
    </section>
  );
}

export default function EnquiriesPage() {
  const t = useTranslations("status");
  const enquiries = useStore((s) => s.enquiries);
  const users = useStore((s) => s.users);
  const moveEnquiry = useStore((s) => s.moveEnquiry);
  const openEnquiry = useUi((s) => s.openEnquiry);
  const [person, setPerson] = React.useState("");
  const [mobileStage, setMobileStage] = React.useState<EnquiryStage>("new");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [losing, setLosing] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState(lostReasons[0]);
  const [reasonNote, setReasonNote] = React.useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const shown = enquiries.filter((e) => !person || e.assignedTo === person);
  const dragged = enquiries.find((e) => e.id === dragId);

  const move = (id: string, stage: EnquiryStage) => {
    const enquiry = enquiries.find((e) => e.id === id);
    if (!enquiry || enquiry.stage === stage) return;
    // A lead cannot be closed as lost without a reason.
    if (stage === "lost") return setLosing(id);
    const before = enquiry.stage;
    moveEnquiry(id, stage);
    toast(`Moved to ${t(stage)}`, { action: { label: "Undo", onClick: () => moveEnquiry(id, before, enquiry.lostReason) } });
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (e.over) move(String(e.active.id), e.over.id as EnquiryStage);
  };

  return (
    <>
      <PageHeader title="Enquiries" subtitle="Drag a lead to the next stage, or use the menu on each card." action={<Button variant="primary" onClick={() => openEnquiry()}><Plus strokeWidth={2} /><span className="max-sm:hidden">New enquiry</span></Button>}>
        <Select aria-label="Salesperson" value={person} onChange={(e) => setPerson(e.target.value)} className="!h-9 w-auto shrink-0 rounded-full bg-surface">
          <option value="">Everyone</option>
          {users.filter((u) => !u.invited && (u.role === "sales" || u.role === "owner")).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <span className="contents md:hidden">
          {stages.map((s) => <Chip key={s} active={mobileStage === s} onClick={() => setMobileStage(s)}>{t(s)}<span className="tnum text-xs">{shown.filter((e) => e.stage === s).length}</span></Chip>)}
        </span>
      </PageHeader>

      {enquiries.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No enquiries yet" help="Add the first lead from a phone call, WhatsApp message or walk-in." action={<Button variant="primary" onClick={() => openEnquiry()}>New enquiry</Button>} />
      ) : (
        <>
          <div className="hidden md:block">
            <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
              <div className="relative -mx-6 flex gap-3 overflow-x-auto px-6 pb-4">
                {stages.map((s) => <Column key={s} stage={s} enquiries={shown.filter((e) => e.stage === s)} onMove={move} />)}
              </div>
              <DragOverlay dropAnimation={null}>{dragged && <div className="w-[272px]"><LeadCard enquiry={dragged} onMove={() => {}} dragging /></div>}</DragOverlay>
            </DndContext>
          </div>
          <div className="space-y-3 md:hidden">
            <div className="flex items-center gap-2"><StatusBadge status={mobileStage} /><span className="tnum text-xs text-text-muted">{shown.filter((e) => e.stage === mobileStage).length} leads</span></div>
            {shown.filter((e) => e.stage === mobileStage).map((e) => <LeadCard key={e.id} enquiry={e} onMove={(s) => move(e.id, s)} />)}
            {shown.filter((e) => e.stage === mobileStage).length === 0 && <p className="rounded-xl border border-dashed py-10 text-center text-sm text-text-muted">No leads at this stage.</p>}
          </div>
        </>
      )}

      <Modal
        open={!!losing}
        onOpenChange={(o) => !o && setLosing(null)}
        title="Why was this lead lost?"
        description="The reason feeds the sales report, so it is required."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLosing(null)}>Keep lead open</Button>
            <Button variant="primary" onClick={() => { if (losing) moveEnquiry(losing, "lost", reasonNote.trim() || reason); setLosing(null); setReasonNote(""); toast("Lead marked as lost"); }}>Mark as lost</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{lostReasons.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="More detail (optional)"><Textarea value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="Went with a caterer quoting ₹50 less per plate" /></Field>
        </div>
      </Modal>
    </>
  );
}
