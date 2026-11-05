"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { PageHeader } from "@/components/shared/blocks";
import { SupplyGate } from "@/components/supply/common";
import { RecipeBook } from "@/components/supply/recipe-book";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";

export default function RecipesPage() {
  const owner = useStore((s) => s.myRole === "owner");
  return (
    <>
      <PageHeader
        title="Recipes"
        subtitle="Every recipe you upload, with its raw materials and what they cost. A recipe for a dish not on your menu waits here until you link it to one."
        action={owner ? <Button variant="primary" asChild><Link href="/import?list=recipes"><Upload strokeWidth={1.75} />Upload recipes</Link></Button> : undefined}
      />
      <SupplyGate>
        <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
          <RecipeBook />
        </React.Suspense>
      </SupplyGate>
    </>
  );
}
