"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Skeleton } from "@/components/ui/primitives";

/** Enquiries are now taken in booking mode and kept in Orders, Enquiries; old links land there. */
export default function EnquiriesPage() {
  const router = useRouter();
  React.useEffect(() => router.replace("/orders?tab=enquiries"), [router]);
  return <Skeleton className="h-96 rounded-xl" />;
}
