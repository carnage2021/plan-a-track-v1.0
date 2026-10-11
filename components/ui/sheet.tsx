"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider panel for previews and detail views */
  wide?: boolean;
}

/** Side sheet on desktop, bottom sheet on mobile. Closes with Esc, the close button or a tap outside. */
export function Sheet({ open, onOpenChange, title, description, children, footer, wide }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade bg-text/40 dark:bg-bg/70 print:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-sheet focus:outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] animate-sheet-up rounded-t-2xl",
            "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:animate-sheet-right md:rounded-none md:rounded-l-2xl",
            wide ? "md:max-w-2xl" : "md:max-w-md",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
          <div className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-3 md:px-6 md:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="font-heading text-lg font-semibold">{title}</Dialog.Title>
              {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
            </div>
            <Dialog.Close className="-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-muted" aria-label="Close">
              <X className="size-5" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6">{children}</div>
          {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-surface px-4 py-3 md:px-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Centred dialog, used only where the plan asks for a real confirmation or a short prompt. */
export function Modal({ open, onOpenChange, title, description, children, footer }: Omit<SheetProps, "wide">) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade bg-text/40 dark:bg-bg/70 print:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-fade rounded-2xl bg-surface p-6 shadow-sheet focus:outline-none"
        >
          <Dialog.Title className="font-heading text-lg font-semibold">{title}</Dialog.Title>
          {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
