"use client";

/* eslint-disable @next/next/no-img-element -- photos come from links the caterer imports, any host */
import { ChevronLeft, ChevronRight, Images, Plus, Trash2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useCurrentUser, useStore } from "@/lib/store";
import type { SamplePhoto } from "@/lib/types";
import { cn } from "@/lib/utils";

export const photoKinds: { id: SamplePhoto["kind"]; label: string }[] = [
  { id: "staff", label: "Staff uniforms" },
  { id: "cutlery", label: "Cutlery" },
  { id: "decor", label: "Decoration" },
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The first photo for a staff role or cutlery item, matched by name. */
export function usePhotoFor(kind: SamplePhoto["kind"], name: string) {
  return useStore((s) => s.samplePhotos.find((p) => p.kind === kind && same(p.name, name)));
}

/** A small photo beside a charge line; tapping it opens the gallery at that photo. */
export function PhotoThumb({ photo, onOpen }: { photo?: SamplePhoto; onOpen: (p: SamplePhoto) => void }) {
  if (!photo) return null;
  return (
    <button type="button" onClick={() => onOpen(photo)} aria-label={`Show photo of ${photo.name}`} className="size-9 shrink-0 overflow-hidden rounded-lg border bg-surface-muted hover:ring-2 hover:ring-primary/40">
      <img src={photo.photoUrl} alt="" className="size-full object-cover" loading="lazy" />
    </button>
  );
}

/**
 * Full-screen gallery to show the client: staff uniforms, cutlery and decoration setups, each as large photos
 * with their names and notes. Tapping a photo shows it on its own with next and previous.
 */
export function SamplePhotoGallery({ open, onOpenChange, start }: { open: boolean; onOpenChange: (o: boolean) => void; start?: SamplePhoto }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        {/* Mounted afresh each time it opens, so it starts at the photo it was opened on. */}
        {open && <GalleryBody start={start} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GalleryBody({ start }: { start?: SamplePhoto }) {
  const photos = useStore((s) => s.samplePhotos);
  const kinds = photoKinds.filter((k) => photos.some((p) => p.kind === k.id));
  const [kind, setKind] = React.useState<SamplePhoto["kind"]>(start?.kind ?? kinds[0]?.id ?? "staff");
  const [big, setBig] = React.useState<SamplePhoto | null>(start ?? null);
  const list = photos.filter((p) => p.kind === kind);
  const at = big ? list.findIndex((p) => p.id === big.id) : -1;
  const step = (by: number) => list.length && setBig(list[(at + by + list.length) % list.length]);

  return (
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-bg outline-none" onKeyDown={(e) => { if (big && e.key === "ArrowRight") step(1); if (big && e.key === "ArrowLeft") step(-1); }}>
          <div className="flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-3 md:px-6">
            <Dialog.Title className="font-heading text-lg font-semibold">Sample photos</Dialog.Title>
            <Dialog.Description className="sr-only">Staff uniforms, cutlery and decoration setups to show the client.</Dialog.Description>
            <div role="tablist" className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => { setKind(k.id); setBig(null); }} className={cn("h-9 rounded-full px-4 text-sm font-medium", kind === k.id ? "bg-primary text-primary-fg" : "bg-surface-muted text-text-muted hover:text-text")}>
                  {k.label} <span className="opacity-70">{photos.filter((p) => p.kind === k.id).length}</span>
                </button>
              ))}
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" className="ml-auto" aria-label="Close photos"><X strokeWidth={1.75} /></Button></Dialog.Close>
          </div>

          {big ? (
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 md:p-8">
              <img src={big.photoUrl} alt={big.name} className="min-h-0 max-w-full flex-1 rounded-2xl object-contain shadow-xl" />
              <div className="text-center">
                <p className="font-heading text-xl font-semibold">{big.name}</p>
                {big.note && <p className="text-sm text-text-muted">{big.note}</p>}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setBig(null)}>All {photoKinds.find((k) => k.id === kind)?.label.toLowerCase()}</Button>
                {list.length > 1 && <Button variant="ghost" size="icon" aria-label="Previous photo" onClick={() => step(-1)}><ChevronLeft strokeWidth={1.75} /></Button>}
                {list.length > 1 && <Button variant="ghost" size="icon" aria-label="Next photo" onClick={() => step(1)}><ChevronRight strokeWidth={1.75} /></Button>}
              </div>
            </div>
          ) : (
            <div className="grid flex-1 auto-rows-max grid-cols-2 gap-4 overflow-y-auto p-4 md:grid-cols-3 md:p-6 xl:grid-cols-4">
              {list.map((p) => (
                <button key={p.id} type="button" onClick={() => setBig(p)} className="overflow-hidden rounded-2xl border bg-surface text-left shadow-card transition-shadow hover:shadow-lg">
                  <img src={p.photoUrl} alt={p.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  <span className="block p-3" data-no-title-case><span className="block font-heading text-base font-semibold">{p.name}</span>{p.note && <span className="block text-xs text-text-muted">{p.note}</span>}</span>
                </button>
              ))}
              {list.length === 0 && <p className="col-span-full py-16 text-center text-sm text-text-muted">No photos yet. Add them in Settings or with the Sample photos import.</p>}
            </div>
          )}
        </Dialog.Content>
  );
}

/** The button that opens the gallery, shown only once there are photos. */
export function ShowPhotosButton({ onClick }: { onClick: () => void }) {
  const count = useStore((s) => s.samplePhotos.length);
  if (!count) return null;
  return <Button onClick={onClick}><Images strokeWidth={1.75} />Show photos to client</Button>;
}

/** Settings: the caterer's sample photos by type, with add and delete. */
export function SamplePhotosForm() {
  const ready = useStore((s) => s.samplePhotosReady);
  const photos = useStore((s) => s.samplePhotos);
  const add = useStore((s) => s.addSamplePhoto);
  const remove = useStore((s) => s.removeSamplePhoto);
  const isOwner = useCurrentUser().role === "owner";
  const [form, setForm] = React.useState<Omit<SamplePhoto, "id">>({ kind: "staff", name: "", photoUrl: "", note: "" });
  const [viewing, setViewing] = React.useState<SamplePhoto | undefined>();
  if (!ready) return <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">Run supabase/migrations/0021_sample_photos.sql in the Supabase SQL editor, then reload, to add sample photos.</p>;
  const valid = form.name.trim() && /^https?:\/\/\S+$/i.test(form.photoUrl.trim());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">Sample photos</h2>
        <p className="text-sm text-text-muted">Photos to show the client while choosing extras: staff uniforms (the dress, not the people), cutlery and decoration. A uniform photo named like a staff role, or a cutlery photo named like a cutlery item, shows beside that line. Import many at once from Import, Sample photos.</p>
      </div>
      {photoKinds.map((k) => {
        const list = photos.filter((p) => p.kind === k.id);
        return (
          <section key={k.id}>
            <h3 className="mb-2 text-sm font-medium text-text-muted">{k.label} · {list.length}</h3>
            {list.length === 0 ? <p className="text-xs text-text-muted">None yet.</p> : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((p) => (
                  <li key={p.id} className="overflow-hidden rounded-xl border bg-surface">
                    <button type="button" onClick={() => setViewing(p)} className="block w-full"><img src={p.photoUrl} alt={p.name} className="aspect-[4/3] w-full object-cover" loading="lazy" /></button>
                    <div className="flex items-start gap-1 p-2">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span>{p.note && <span className="block truncate text-xs text-text-muted">{p.note}</span>}</span>
                      {isOwner && <Button variant="ghost" size="icon" aria-label={`Delete photo ${p.name}`} onClick={() => remove(p.id)}><Trash2 strokeWidth={1.75} /></Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {isOwner && (
        <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!valid) return; add({ ...form, name: form.name.trim(), photoUrl: form.photoUrl.trim() }); setForm({ ...form, name: "", photoUrl: "", note: "" }); }}>
          <Field label="Type"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SamplePhoto["kind"] })}>{photoKinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === "staff" ? "Waiter" : form.kind === "cutlery" ? "Dinner plate" : "Mandap stage"} /></Field>
          <Field label="Photo link" className="sm:col-span-2"><Input value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Note"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional" /></Field>
          <div className="flex items-end"><Button type="submit" variant="primary" disabled={!valid}><Plus strokeWidth={1.75} />Add photo</Button></div>
        </form>
      )}
      <SamplePhotoGallery open={!!viewing} onOpenChange={(o) => !o && setViewing(undefined)} start={viewing} />
    </div>
  );
}
