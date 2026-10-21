"use client";

import { ArrowLeft, QrCode, ScanLine } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { useLabelText } from "@/components/labels/label-sheet";
import { Badge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { codeFrom, statusLabel, useLabels, type StockLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { useSupply } from "@/lib/supply-store";
import { fmtDate, localDay } from "@/lib/utils";

interface Scan { id: string; action: string; qty: number; at: string; scanned_by: string | null }
const actionText: Record<string, string> = { load: "Loaded to an event", return: "Came back", receive: "Received into store", issue: "Issued to the kitchen", count: "Counted", lost: "Marked lost" };

function Label() {
  const { code } = useParams<{ code: string }>();
  const find = useLabels((s) => s.find);
  const ready = useLabels((s) => s.ready);
  const users = useStore((s) => s.users);
  const challans = useSupply((s) => s.challans);
  const text = useLabelText();
  const [label, setLabel] = React.useState<StockLabel | null | undefined>(undefined);
  const [scans, setScans] = React.useState<Scan[]>([]);
  React.useEffect(() => {
    if (!ready) return;
    find(codeFrom(code)).then((l) => {
      setLabel(l ?? null);
      if (l) supabase().from("label_scans").select("id,action,qty,at,scanned_by").eq("label_id", l.id).order("at", { ascending: false }).limit(30).then(({ data }) => setScans((data as Scan[]) ?? []));
    });
  }, [code, find, ready]);
  if (label === undefined) return <Skeleton className="h-64" />;
  if (!label) return <EmptyState icon={QrCode} title="Label not found" help="This code is not one of your labels. It may belong to another business, or the label was made on an account you are not signed in to." action={<Button variant="primary" asChild><Link href="/scan">Scan</Link></Button>} />;
  const t = text(label);
  const challan = challans.find((c) => c.id === label.challanId);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Button variant="ghost" className="-ml-2" asChild><Link href="/labels"><ArrowLeft strokeWidth={1.75} />All labels</Link></Button>
      <Card className="p-5">
        <p className="font-mono text-sm font-semibold text-text-muted">{label.code}</p>
        <h1 className="mt-1 font-heading text-2xl font-bold">{t.name}</h1>
        <p className="text-text-muted">{t.size}{label.note && ` · ${label.note}`}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={label.status === "in_store" ? "success" : label.status === "out" ? "primary" : label.status === "lost" ? "danger" : "neutral"}>{statusLabel[label.status]}</Badge>
          {challan && <span className="text-sm text-text-muted">on challan {challan.number}</span>}
        </div>
        <Button variant="primary" className="mt-4" asChild><Link href="/scan"><ScanLine strokeWidth={1.75} />Scan labels</Link></Button>
      </Card>
      <Card>
        <p className="px-5 pt-4 font-heading font-semibold">History</p>
        <ul className="mt-2 divide-y">
          {scans.map((s) => <li key={s.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm"><span>{actionText[s.action] ?? s.action}<span className="block text-xs text-text-muted">{users.find((u) => u.id === s.scanned_by)?.name ?? ""}</span></span><span className="tnum shrink-0 text-xs text-text-muted">{fmtDate(localDay(s.at), { day: "numeric", month: "short" })} {new Date(s.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></li>)}
          {!scans.length && <li className="px-5 py-4 text-sm text-text-muted">No scans yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

/** Opened when a label's QR is scanned with any phone camera. */
export default function LabelPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-64" />}>
      <Label />
    </React.Suspense>
  );
}
