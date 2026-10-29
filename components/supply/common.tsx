"use client";

import { DatabaseZap, PackagePlus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { stockBy } from "@/lib/supply";
import { useSupply } from "@/lib/supply-store";
import { cn } from "@/lib/utils";

/** Decimal number field for quantities and rates. Empty shows as blank, not 0. */
export function Num({ value, onChange, className, ...rest }: { value: number; onChange: (v: number) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = React.useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      // Rounded for show, so 6.3 − 6 reads 0.3 and not 0.30000000000000027.
      value={text ?? (value ? String(Math.round(value * 10000) / 10000) : "")}
      placeholder="0"
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.]/g, "");
        setText(next);
        onChange(Number(next) || 0);
      }}
      onBlur={() => setText(null)}
      className={cn("tnum h-11 w-full rounded-lg border bg-surface-muted/60 px-2 text-right text-sm placeholder:text-text-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 md:h-9", className)}
      {...rest}
    />
  );
}

export function useStock(storeId?: string) {
  const movements = useSupply((s) => s.movements);
  return React.useMemo(() => stockBy(movements, storeId), [movements, storeId]);
}

export function StarterButton({ label = "Load starter data" }: { label?: string }) {
  const loadStarter = useSupply((s) => s.loadStarter);
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="primary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await loadStarter();
          toast.success("Starter ingredients, recipes, vendors and crockery added");
        } catch (e) {
          toast.error("Starter data was not loaded", { description: e instanceof Error ? e.message : undefined });
        } finally {
          setBusy(false);
        }
      }}
    >
      <PackagePlus strokeWidth={1.75} />{label}
    </Button>
  );
}

/**
 * Wraps every supply screen. Explains what is missing when the phase 3 tables have not been
 * created yet, and offers the starter data to an owner whose account has no ingredients.
 */
export function SupplyGate({ children }: { children: React.ReactNode }) {
  const ready = useSupply((s) => s.ready);
  const empty = useSupply((s) => s.ingredients.length === 0 && s.vendors.length === 0 && s.assets.length === 0);
  const owner = useStore((s) => s.myRole === "owner");
  const [byHand, setByHand] = React.useState(false);
  if (!ready)
    return <EmptyState icon={DatabaseZap} title="One database step is pending" help="Run supabase/migrations/0003_supply.sql in the Supabase SQL editor, then reload this page. It creates the tables for stock, vendors and cutlery." />;
  if (empty && !byHand)
    return (
      <EmptyState
        icon={PackagePlus}
        title="Nothing set up for supply yet"
        help={owner ? "Start with ready ingredients, recipes for the starter menu, a few vendors and the usual crockery. Everything can be edited afterwards." : "Ask the owner to load the starter data, or add ingredients, vendors and crockery by hand."}
        action={<div className="flex flex-wrap justify-center gap-2">{owner && <StarterButton />}<Button variant="ghost" onClick={() => setByHand(true)}>Set up by hand</Button></div>}
      />
    );
  return <>{children}</>;
}
