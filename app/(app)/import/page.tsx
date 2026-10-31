"use client";

import { CheckCircle2, Download, FileSpreadsheet, ImagePlus, Undo2, Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, Chip } from "@/components/ui/primitives";
import { RecipeImport, undoRecipeUpload } from "@/components/import/recipe-import";
import { download, lists, readTable, useLeaveGuard, sheetSummary, toCsv, validate, type ListSpec } from "@/lib/imports";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { cn, fmtDate, isoDate, localDay } from "@/lib/utils";

interface Parsed { file: string; records: { r: Record<string, string>; errors: string[]; duplicate: boolean; where: string }[]; unknown: string[]; sheets: string }
interface ImportRow { id: string; list: string; file_name: string; row_count: number; ids: Record<string, string[]>; undone: boolean; created_at: string }

/** Reads every sheet of an .xlsx, or a .csv, into records keyed by the template's column names. */
async function readFile(file: File, spec: ListSpec): Promise<Parsed> {
  const table = await readTable(file, spec.columns.map((c) => c.label));
  const existing = spec.existing();
  const seen = new Set<string>();
  const records = table.rows.map((row, i) => {
    const r = Object.fromEntries(spec.columns.map((c, j) => [c.label, row[j]]));
    const id = spec.identity(r);
    const duplicate = !!id && (existing.has(id) || seen.has(id));
    if (id) seen.add(id);
    return { r, errors: validate(spec, r), duplicate, where: table.where[i] };
  });
  return { file: file.name, records, unknown: table.head.filter((h) => !spec.columns.some((c) => c.label === h)), sheets: sheetSummary(table.sheets) };
}

export default function ImportPage() {
  const reload = useStore((s) => s.reload);
  const [list, setList] = React.useState<ListSpec>(lists[0]);
  /** Recipes have their own panel: they replace whole recipes and can add missing raw materials. */
  const [recipesOpen, setRecipesOpen] = React.useState(false);
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [busy, setBusy] = React.useState(false);
  useLeaveGuard(busy);
  const [history, setHistory] = React.useState<ImportRow[] | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const loadHistory = React.useCallback(() => {
    supabase().from("imports").select("*").order("created_at", { ascending: false }).limit(10).then(({ data, error }) => setHistory(error ? null : (data as ImportRow[])));
  }, []);
  React.useEffect(loadHistory, [loadHistory]);

  const ok = parsed?.records.filter((x) => !x.errors.length && !x.duplicate) ?? [];
  const pickList = (l: ListSpec) => { setList(l); setParsed(null); setRecipesOpen(false); };
  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setParsed(await readFile(file, list));
    } catch (e) {
      toast.error("That file could not be read", { description: e instanceof Error ? e.message : "Save it as .xlsx or .csv and try again." });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const save = async () => {
    if (!parsed || !ok.length) return;
    setBusy(true);
    const sb = supabase();
    const done: Record<string, string[]> = {};
    try {
      for (const step of list.build(ok.map((x) => x.r))) {
        for (const u of step.update ?? []) {
          if (!u.ids.length) continue;
          const { error } = await sb.from(step.table).update(u.values).in("id", u.ids);
          if (error) throw new Error(error.message);
        }
        for (let i = 0; i < step.rows.length; i += 200) {
          const chunk = step.rows.slice(i, i + 200);
          const { error } = await sb.from(step.table).insert(chunk);
          if (error) throw new Error(error.message);
          // Rows without their own id (package choices) go with their parent when an upload is undone.
          if (chunk.every((r) => r.id)) done[step.table] = [...(done[step.table] ?? []), ...chunk.map((r) => r.id as string)];
        }
      }
      await sb.from("imports").insert({ list: list.key, file_name: parsed.file, row_count: ok.length, ids: done });
      toast.success(`${ok.length} ${list.label.toLowerCase()} imported`, { description: "You can undo this upload below." });
      setParsed(null);
    } catch (e) {
      // Take back whatever went in before the failure, so a half import never lingers.
      for (const [table, ids] of Object.entries(done).reverse()) await sb.from(table).delete().in("id", ids);
      toast.error("Nothing was imported", { description: e instanceof Error ? e.message : undefined });
    } finally {
      await reload();
      loadHistory();
      setBusy(false);
    }
  };

  const undo = async (imp: ImportRow) => {
    setBusy(true);
    const sb = supabase();
    try {
      if (imp.list === "recipes") await undoRecipeUpload(imp.ids);
      else for (const [table, ids] of Object.entries(imp.ids).reverse()) {
        const { error } = await sb.from(table).delete().in("id", ids);
        if (error) throw new Error(/foreign key|violates/i.test(error.message) ? "Some of these records are already used in orders or quotations, so they cannot be removed." : error.message);
      }
      await sb.from("imports").update({ undone: true }).eq("id", imp.id);
      toast.success("Upload undone");
    } catch (e) {
      toast.error("Could not undo", { description: e instanceof Error ? e.message : undefined });
    } finally {
      await reload();
      loadHistory();
      setBusy(false);
    }
  };

  const lastLive = history?.find((h) => !h.undone);
  return (
    <>
      <PageHeader title="Import and export" subtitle="Bring your lists in from Excel, check every row before it is saved, and take any list back out." />
      <div className="flex flex-wrap gap-2">
        {lists.map((l) => <Chip key={l.key} active={!recipesOpen && l.key === list.key} onClick={() => pickList(l)}>{l.label}</Chip>)}
        <Chip active={recipesOpen} onClick={() => { setRecipesOpen(true); setParsed(null); }}>Recipes</Chip>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        {recipesOpen ? <RecipeImport onSaved={loadHistory} /> : <Card className="p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-heading text-lg font-semibold">{list.label}</h2><p className="text-sm text-text-muted">Columns: {list.columns.map((c) => c.label + (c.required ? "*" : "")).join(", ")}</p></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => download(`${list.key}-template.csv`, toCsv(list.columns.map((c) => c.label), [list.columns.map((c) => c.example)]))}><FileSpreadsheet strokeWidth={1.75} />Template</Button>
              <Button variant="ghost" onClick={() => { const rows = list.rows(); download(`${list.key}-${isoDate(new Date())}.csv`, toCsv(list.columns.map((c) => c.label), rows.map((r) => list.columns.map((c) => r[c.label] ?? "")))); toast.success(`${rows.length} rows exported`); }}><Download strokeWidth={1.75} />Export</Button>
            </div>
          </div>
          <input ref={input} type="file" accept=".xlsx,.csv" className="sr-only" tabIndex={-1} aria-label="Choose a file" onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]); }} className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center text-text-muted transition-colors hover:border-primary hover:text-primary">
            <Upload className="size-8" strokeWidth={1.5} />
            <span className="font-medium text-text">Drop your Excel or CSV file here, or tap to choose</span>
            <span className="text-xs">Fill in the template. Every sheet with the column names is read; rows already in your list are skipped.</span>
          </button>

          {parsed && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{parsed.file}</span>
                <Badge tone="success">{ok.length} ready</Badge>
                {parsed.records.some((x) => x.errors.length) && <Badge tone="danger">{parsed.records.filter((x) => x.errors.length).length} with problems</Badge>}
                {parsed.records.some((x) => x.duplicate && !x.errors.length) && <Badge>{parsed.records.filter((x) => x.duplicate && !x.errors.length).length} already there</Badge>}
                <Button variant="primary" className="ml-auto" loading={busy} disabled={!ok.length} onClick={save}><CheckCircle2 strokeWidth={1.75} />Import {ok.length} {ok.length === 1 ? "row" : "rows"}</Button>
              </div>
              {parsed.sheets && <p className="rounded-lg bg-surface-muted p-2 text-sm text-text-muted">{parsed.sheets}</p>}
              {!parsed.records.length && <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">No rows were found. Each sheet needs a row with the column names from the template ({list.columns.slice(0, 3).map((c) => c.label).join(", ")} …) and the data below it.</p>}
              {parsed.unknown.length > 0 && <p className="rounded-lg bg-warning/10 p-2 text-sm text-warning">Columns not in the template are ignored: {parsed.unknown.join(", ")}</p>}
              <div className="max-h-[28rem] overflow-auto rounded-xl border">
                <table className="tnum w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-surface-muted text-xs text-text-muted"><tr><th className="px-3 py-2 font-medium">Row</th>{list.columns.slice(0, 5).map((c) => <th key={c.label} className="py-2 pr-3 font-medium">{c.label}</th>)}<th className="py-2 pr-3 font-medium">Check</th></tr></thead>
                  <tbody className="divide-y">
                    {parsed.records.slice(0, 300).map((x, i) => (
                      <tr key={i} className={cn(x.errors.length ? "bg-danger/5" : x.duplicate ? "text-text-muted" : "")}>
                        <td className="whitespace-nowrap px-3 py-1.5 text-text-muted">{x.where}</td>
                        {list.columns.slice(0, 5).map((c) => <td key={c.label} className="max-w-48 truncate py-1.5 pr-3">{x.r[c.label]}</td>)}
                        <td className="py-1.5 pr-3">{x.errors.length ? <span className="text-danger">{x.errors.join("; ")}</span> : x.duplicate ? "Already there, skipped" : <span className="text-success">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.records.length > 300 && <p className="text-xs text-text-muted">Showing the first 300 of {parsed.records.length} rows; all of them are checked.</p>}
            </div>
          )}
        </Card>}

        <div className="space-y-4">
          <Card>
            <CardTitle>Recent uploads</CardTitle>
            {!history ? <p className="px-5 pb-5 text-sm text-text-muted">Upload history appears once the platform update (0010_platform.sql) is in place.</p> : history.length === 0 ? <p className="px-5 pb-5 text-sm text-text-muted">Nothing imported yet.</p> : (
              <ul className="divide-y">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-sm md:px-5">
                    <span className="min-w-0 flex-1"><span className={cn("block truncate font-medium", h.undone && "text-text-muted line-through")}>{h.list === "recipes" ? "Recipes" : lists.find((l) => l.key === h.list)?.label}: {h.row_count}</span><span className="block truncate text-xs text-text-muted">{h.file_name} · {fmtDate(localDay(h.created_at), { day: "numeric", month: "short" })}</span></span>
                    {h.id === lastLive?.id && <Button variant="ghost" loading={busy} onClick={() => undo(h)}><Undo2 strokeWidth={1.75} />Undo</Button>}
                    {h.undone && <Badge>Undone</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <PhotoMatcher />
        </div>
      </div>
    </>
  );
}

/** Drop a folder of dish photos; each file is matched to a dish by its name and uploaded. */
function PhotoMatcher() {
  const items = useStore((s) => s.items);
  const patchItems = useStore((s) => s.patchItems);
  const uploadMedia = useStore((s) => s.uploadMedia);
  const input = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<{ matched: number; unmatched: string[]; done: number } | null>(null);
  const key = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]/g, "");
  const run = async (files: FileList | null) => {
    if (!files?.length) return;
    const byName = new Map(items.map((i) => [key(i.name), i]));
    const pairs = [...files].filter((f) => f.type.startsWith("image/")).map((f) => ({ f, item: byName.get(key(f.name)) }));
    const matched = pairs.filter((p) => p.item);
    setState({ matched: matched.length, unmatched: pairs.filter((p) => !p.item).map((p) => p.f.name), done: 0 });
    let done = 0;
    for (const { f, item } of matched) {
      try {
        const path = await uploadMedia(f, f.name);
        patchItems([item!.id], { photo: path });
        done++;
        setState((s) => (s ? { ...s, done } : s));
      } catch {
        toast.error(`${f.name} was not uploaded`);
      }
    }
    toast.success(`${done} dish photos added`);
    if (input.current) input.current.value = "";
  };
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 font-heading font-semibold"><ImagePlus className="size-5" strokeWidth={1.75} />Dish photos in bulk</p>
      <p className="mt-1 text-sm text-text-muted">Name each photo after its dish, like &quot;Paneer Tikka.jpg&quot;, and choose them all at once.</p>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="Choose dish photos" onChange={(e) => run(e.target.files)} />
      <Button className="mt-3" onClick={() => input.current?.click()}><ImagePlus strokeWidth={1.75} />Choose photos</Button>
      {state && (
        <div className="mt-3 text-sm">
          <p>{state.done} of {state.matched} matched photos uploaded.</p>
          {state.unmatched.length > 0 && <p className="mt-1 text-warning">No dish found for: {state.unmatched.slice(0, 8).join(", ")}{state.unmatched.length > 8 ? ` and ${state.unmatched.length - 8} more` : ""}</p>}
        </div>
      )}
    </Card>
  );
}
