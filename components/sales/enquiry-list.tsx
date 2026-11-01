"use client";

import { ArrowRight, MessagesSquare, MoreHorizontal, Presentation, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Card, Chip, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import type { Enquiry, EnquiryStage } from "@/lib/types";
import { cn, daysFromToday, fmtDate, num, relativeDay } from "@/lib/utils";

/**
 * Enquiries are taken in booking mode's first step: a new one opens booking mode (on a date, from the calendar), and
 * an existing one continues its booking there.
 */
export function useOpenEnquiry() {
  const router = useRouter();
  return React.useCallback((id?: string, date?: string) => router.push(id ? `/booking?enquiry=${id}` : date ? `/booking?date=${date}` : "/booking"), [router]);
}

const lostReasons = ["Budget too low", "Chose another caterer", "Date not available", "Event cancelled", "No response"];
/** Still to be quoted or booked; quoted, booked and lost ones show with "Show all". */
const open: EnquiryStage[] = ["new", "contacted", "followup"];

const dates = (e: Enquiry) => {
  const start = e.services?.map((s) => s.date).filter(Boolean).sort()[0] ?? e.date;
  const end = e.endDate && e.endDate > start ? e.endDate : start;
  return `${fmtDate(start, { day: "numeric", month: "short" })}${end > start ? ` to ${fmtDate(end, { day: "numeric", month: "short" })}` : ""}`;
};
const guests = (e: Enquiry) => Math.max(e.pax || 0, ...(e.services ?? []).map((s) => s.pax || 0));

/**
 * Enquiries saved from booking mode's first step. Continue booking opens booking mode with the client and services
 * filled in; once a quotation or booking is made from it, it leaves the open list.
 */
export function EnquiryList({ clientId }: { clientId?: string | null }) {
  const { enquiries, clients } = useStore();
  const moveEnquiry = useStore((s) => s.moveEnquiry);
  const deleteEnquiry = useStore((s) => s.deleteEnquiry);
  const [all, setAll] = React.useState(false);
  const [losing, setLosing] = React.useState<Enquiry | null>(null);
  const [reason, setReason] = React.useState(lostReasons[0]);
  const [note, setNote] = React.useState("");
  const [deleting, setDeleting] = React.useState<Enquiry | null>(null);

  const mine = enquiries.filter((e) => !clientId || e.clientId === clientId);
  const rows = mine
    .filter((e) => all || open.includes(e.stage))
    .map((e) => ({ e, client: clients.find((c) => c.id === e.clientId) }))
    // Follow-ups due first, then the soonest events.
    .sort((a, b) => (a.e.followUpAt ?? "9999").localeCompare(b.e.followUpAt ?? "9999") || a.e.date.localeCompare(b.e.date));
  const closed = mine.length - mine.filter((e) => open.includes(e.stage)).length;

  const followUp = (e: Enquiry) =>
    e.followUpAt && open.includes(e.stage) ? <span className={cn("tnum", daysFromToday(e.followUpAt) < 0 ? "font-medium text-danger" : daysFromToday(e.followUpAt) === 0 ? "font-medium text-warning" : "text-text-muted")}>{relativeDay(e.followUpAt)}</span> : <span className="text-text-muted">-</span>;
  const actions = (e: Enquiry) => (
    <div className="flex items-center justify-end gap-1">
      {e.stage !== "booked" && <Button variant="primary" asChild><Link href={`/booking?enquiry=${e.id}`}>Continue booking<ArrowRight strokeWidth={1.75} /></Link></Button>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More for ${clients.find((c) => c.id === e.clientId)?.name ?? "enquiry"}`}><MoreHorizontal strokeWidth={1.75} /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {e.stage !== "lost" && e.stage !== "booked" && <DropdownMenuItem onSelect={() => setLosing(e)}><XCircle strokeWidth={1.75} />Mark lost</DropdownMenuItem>}
          {e.stage === "lost" && <DropdownMenuItem onSelect={() => { moveEnquiry(e.id, "new"); toast("Enquiry opened again"); }}><MessagesSquare strokeWidth={1.75} />Open again</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setDeleting(e)} className="text-danger"><Trash2 strokeWidth={1.75} />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      {(closed > 0 || all) && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Chip active={!all} onClick={() => setAll(false)}>Open {mine.length - closed}</Chip>
          <Chip active={all} onClick={() => setAll(true)}>Show all {mine.length}</Chip>
        </div>
      )}
      {!rows.length ? (
        <EmptyState icon={MessagesSquare} title={all ? "No enquiries yet" : "No open enquiries"} help="In booking mode, fill in the client and event, then choose Save as enquiry. It waits here until you continue the booking." action={<Button variant="primary" asChild><Link href="/booking"><Presentation strokeWidth={1.75} />New booking</Link></Button>} />
      ) : (
        <>
          <Card className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-text-muted">
                <tr>{["Client", "Event", "Dates", "Guests", "Follow-up", "Status", ""].map((h, i) => <th key={h || i} className={`px-4 py-3 font-medium ${i === 3 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ e, client }) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3"><span className="font-medium" data-no-title-case>{client?.name}</span><span className="tnum block text-xs text-text-muted">{client?.phone}</span></td>
                    <td className="px-4 py-3">{e.eventType}{e.services && e.services.length > 1 && <span className="block text-xs text-text-muted">{e.services.length} services</span>}</td>
                    <td className="tnum px-4 py-3 text-text-muted">{dates(e)}</td>
                    <td className="tnum px-4 py-3 text-right">{num(guests(e))}</td>
                    <td className="px-4 py-3">{followUp(e)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.stage} />{e.stage === "lost" && e.lostReason && <span className="block max-w-40 truncate text-xs text-text-muted">{e.lostReason}</span>}</td>
                    <td className="px-4 py-2">{actions(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <ul className="space-y-3 md:hidden">
            {rows.map(({ e, client }) => (
              <li key={e.id} className="rounded-xl border bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-heading text-base font-semibold" data-no-title-case>{client?.name}</p>
                    <p className="tnum truncate text-xs text-text-muted">{client?.phone} · {e.eventType}</p>
                  </div>
                  <StatusBadge status={e.stage} />
                </div>
                <p className="tnum mt-2 text-sm text-text-muted">{dates(e)} · {num(guests(e))} guests</p>
                {e.followUpAt && open.includes(e.stage) && <p className="mt-1 text-xs">Follow up: {followUp(e)}</p>}
                <div className="mt-3">{actions(e)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={!!losing}
        onOpenChange={(o) => !o && setLosing(null)}
        title="Why was this enquiry lost?"
        description="The reason feeds the sales report."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLosing(null)}>Keep it open</Button>
            <Button variant="primary" onClick={() => { if (losing) moveEnquiry(losing.id, "lost", note.trim() || reason); setLosing(null); setNote(""); toast("Enquiry marked as lost"); }}>Mark lost</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{lostReasons.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="More detail (optional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Went with a caterer quoting ₹50 less per plate" /></Field>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this enquiry?"
        description="It is removed for good. The client stays in Clients, and any quotation made from it is kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="primary" onClick={() => { if (deleting) deleteEnquiry(deleting.id); setDeleting(null); toast("Enquiry deleted"); }}><Trash2 strokeWidth={1.75} />Delete</Button>
          </>
        }
      >
        <p className="text-sm">{clients.find((c) => c.id === deleting?.clientId)?.name} · {deleting?.eventType} · {deleting ? dates(deleting) : ""}</p>
      </Modal>
    </>
  );
}
