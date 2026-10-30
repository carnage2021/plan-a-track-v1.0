"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Skeleton } from "@/components/ui/primitives";

/** Saved quotations now live in Orders, Quotations; old links land there. */
export default function QuotationsPage() {
  const router = useRouter();
  React.useEffect(() => router.replace("/orders?tab=quotations"), [router]);
  return <Skeleton className="h-96 rounded-xl" />;
}
