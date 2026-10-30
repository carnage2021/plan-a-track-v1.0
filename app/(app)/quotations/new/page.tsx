"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Skeleton } from "@/components/ui/primitives";

/** Quotations are built in booking mode, which ends with Save as quotation or Confirm booking; old links land there. */
function ToBooking() {
  const router = useRouter();
  const params = useSearchParams().toString();
  React.useEffect(() => router.replace(`/booking${params ? `?${params}` : ""}`), [router, params]);
  return <Skeleton className="h-96 rounded-xl" />;
}

export default function NewQuotationPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ToBooking />
    </React.Suspense>
  );
}
