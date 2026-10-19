"use client";

import { DropdownMenu as Menu, Switch as RSwitch, Tabs as RTabs } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-surface shadow-card", className)} {...props} />;
}

export function CardTitle({ className, children, action }: { className?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 pt-4 md:px-5", className)}>
      <h2 className="font-heading text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function Switch({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string }) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative h-6 w-10 shrink-0 rounded-full bg-border transition-colors duration-150 data-[state=checked]:bg-success"
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow-card transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </RSwitch.Root>
  );
}

/** A switch with its label shown beside it; Switch alone only names itself for screen readers. */
export function ToggleRow({ checked, onCheckedChange, label, help }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-sm font-medium">{label}</p>{help && <p className="text-xs text-text-muted">{help}</p>}</div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} label={label} />
    </div>
  );
}

export const Tabs = RTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RTabs.List>) {
  return <RTabs.List className={cn("no-scrollbar flex gap-1 overflow-x-auto border-b", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-text-muted transition-colors duration-150 hover:text-text data-[state=active]:border-primary data-[state=active]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof RTabs.Content>) {
  return <RTabs.Content className={cn("pt-4 focus:outline-none", className)} {...props} />;
}

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-48 animate-pop rounded-xl border bg-surface p-1 shadow-sheet", className)}
        {...props}
      />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        "flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2 text-sm outline-none data-[highlighted]:bg-surface-muted [&_svg]:size-5 [&_svg]:text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-2 pb-1 pt-2 text-xs font-medium text-text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px bg-border" />;
}

/** Filter chip: full radius, soft primary tint when active (G4 page pattern). */
export function Chip({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-150 [&_svg]:size-4",
        active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text-muted hover:text-text",
        className,
      )}
      {...props}
    />
  );
}
