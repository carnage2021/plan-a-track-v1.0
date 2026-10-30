import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-border bg-surface-muted/60 px-3 text-sm text-text placeholder:text-text-muted transition-colors duration-150 hover:border-text-muted/40 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11 md:h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-20 py-2", className)} {...props} />;
}

type Opt = { value: string; label: string; disabled?: boolean; group?: string };

/** Plain text of an option's children ("Waiter · ₹600" from mixed nodes). */
function textOf(n: React.ReactNode): string {
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(n)) return textOf(n.props.children);
  return "";
}

/** The <option>s inside a Select, through fragments, arrays and <optgroup>s. */
function readOptions(children: React.ReactNode, group?: string, out: Opt[] = []): Opt[] {
  React.Children.forEach(children, (c) => {
    if (!React.isValidElement<{ value?: unknown; children?: React.ReactNode; disabled?: boolean; label?: string }>(c)) return;
    if (c.type === "option") {
      const label = textOf(c.props.children);
      out.push({ value: String(c.props.value ?? label), label, disabled: c.props.disabled, group });
    } else if (c.type === "optgroup") readOptions(c.props.children, c.props.label, out);
    else if (c.type === React.Fragment) readOptions(c.props.children, group, out);
  });
  return out;
}

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * A dropdown you can type into: the list filters as you type (Gujarati and Hindi too), arrow keys and Enter pick.
 * Same props as a native <select>, so every screen keeps working; a hidden native select carries the value for
 * forms. With `creatable`, a value not in the list can be typed in (event types, staff roles); fixed lists stay
 * pick-only.
 */
export function Select({ className, children, value, defaultValue, onChange, disabled, creatable, id, "aria-label": ariaLabel, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { creatable?: boolean }) {
  const options = readOptions(children);
  const current = String(value ?? defaultValue ?? "");
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const searchable = options.length > 5 || !!creatable;
  const q = fold(query.trim());
  const shown = q ? options.filter((o) => fold(o.label).includes(q) || fold(o.value).includes(q)) : options;
  const canCreate = !!creatable && !!query.trim() && !options.some((o) => fold(o.label) === q);
  const choices: Opt[] = [...shown.filter((o) => !o.disabled), ...(canCreate ? [{ value: query.trim(), label: `Use "${query.trim()}"` }] : [])];

  const pick = (v: string) => {
    onChange?.({ target: { value: v, name: rest.name ?? "" }, currentTarget: { value: v } } as unknown as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };
  const openList = (o: boolean) => {
    setOpen(o);
    setQuery("");
    setActive(Math.max(0, options.filter((x) => !x.disabled).findIndex((x) => x.value === current)));
  };
  React.useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(choices.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (choices[active]) pick(choices[active].value); }
  };
  const shownLabel = selected?.label ?? (creatable && current ? current : options[0]?.label ?? "");
  let lastGroup: string | undefined;

  return (
    <>
      <Popover.Root open={open} onOpenChange={openList}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            id={id}
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            onKeyDown={(e) => {
              // Typing on the closed field opens it with that letter already in the search.
              if (!open && searchable && e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openList(true); setQuery(e.key); }
            }}
            className={cn(field, "flex h-11 items-center justify-between gap-2 text-left md:h-9", className)}
          >
            <span className={cn("min-w-0 truncate", !current && "text-text-muted")}>{shownLabel}</span>
            <ChevronDown className="size-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            collisionPadding={8}
            onKeyDown={onKey}
            onOpenAutoFocus={(e) => { if (!searchable) { e.preventDefault(); listRef.current?.focus(); } }}
            className="z-[70] flex max-h-[min(22rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-56 flex-col overflow-hidden rounded-xl border bg-surface shadow-xl"
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b px-3">
                <Search className="size-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden />
                <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} placeholder={creatable ? "Search or type a new one" : "Search"} aria-label={`Search ${ariaLabel ?? "options"}`} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted" />
              </div>
            )}
            <div ref={listRef} role="listbox" tabIndex={-1} className="overflow-y-auto p-1 outline-none">
              {choices.length === 0 && <p className="px-3 py-2 text-sm text-text-muted">Nothing matches</p>}
              {choices.map((o, i) => {
                const head = o.group && o.group !== lastGroup ? o.group : null;
                lastGroup = o.group;
                return (
                  <React.Fragment key={`${o.value}-${i}`}>
                    {head && <p className="px-3 pb-1 pt-2 text-xs font-medium text-text-muted">{head}</p>}
                    <button type="button" role="option" aria-selected={o.value === current} data-index={i} onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm", i === active && "bg-surface-muted", o.value === current && "font-medium text-primary")}>
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.value === current && <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden />}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* The real value, for forms and anything reading the field directly. */}
      <select aria-hidden tabIndex={-1} className="sr-only" value={current} onChange={onChange} disabled={disabled} {...rest}>
        {children}
        {creatable && current && !selected && <option value={current}>{current}</option>}
      </select>
    </>
  );
}

/**
 * A time in 12-hour form (hour, minutes, AM/PM), kept as "HH:MM" like a native time field.
 * `optional` adds an empty choice for times that may be left blank.
 */
export function TimeInput({ value, onChange, optional, label, className }: { value: string; onChange: (v: string) => void; optional?: boolean; label?: string; className?: string }) {
  const parts = value ? value.split(":").map(Number) : [];
  const has = parts.length >= 2 && !Number.isNaN(parts[0]);
  const h24 = has ? parts[0] : 0, m = has ? parts[1] : 0;
  const h12 = h24 % 12 || 12;
  const pm = has ? h24 >= 12 : true;
  const set = (h: number, min: number, isPm: boolean) => onChange(`${String((h % 12) + (isPm ? 12 : 0)).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), ...(has ? [m] : [])])].sort((a, b) => a - b);
  const small = "h-11 rounded-lg border border-border bg-surface-muted/60 px-2 text-sm text-text focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-9";
  return (
    <span className={cn("flex items-center gap-1", className)} role="group" aria-label={label}>
      <select aria-label={`${label ?? "Time"} hour`} className={cn(small, "tnum w-16")} value={has ? h12 : ""} onChange={(e) => (e.target.value ? set(Number(e.target.value), m, pm) : onChange(""))}>
        {(optional || !has) && <option value="">--</option>}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-text-muted">:</span>
      <select aria-label={`${label ?? "Time"} minutes`} className={cn(small, "tnum w-16")} value={has ? m : ""} disabled={!has} onChange={(e) => set(h12, Number(e.target.value), pm)}>
        {!has && <option value="">--</option>}
        {minutes.map((x) => <option key={x} value={x}>{String(x).padStart(2, "0")}</option>)}
      </select>
      <span className="flex rounded-lg border p-0.5" role="radiogroup" aria-label={`${label ?? "Time"} AM or PM`}>
        {(["AM", "PM"] as const).map((x) => (
          <button key={x} type="button" role="radio" aria-checked={has && pm === (x === "PM")} disabled={!has} onClick={() => set(h12, m, x === "PM")} className={cn("h-9 rounded-md px-2 text-xs font-semibold md:h-7", has && pm === (x === "PM") ? "bg-primary text-primary-fg" : "text-text-muted")}>{x}</button>
        ))}
      </span>
    </span>
  );
}

/** Label above the field, with optional inline error (G4 forms). */
export function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}
