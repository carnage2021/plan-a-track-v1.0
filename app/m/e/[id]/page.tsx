"use client";

import { useParams } from "next/navigation";
import * as React from "react";
import { EventMenuPage, Loading, NotFound, usePublic, type EventMenu } from "@/components/public/menu-view";

function Page() {
  const { id } = useParams<{ id: string }>();
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const { data, loading } = usePublic<EventMenu>("public_event_menu", { p_function: valid ? id : "00000000-0000-0000-0000-000000000000" });
  if (loading) return <Loading />;
  if (!data) return <NotFound what="table menu" />;
  return <EventMenuPage data={data} />;
}

/** The table menu guests open from the QR on their table: the function's dishes, with no prices. */
export default function TableMenu() {
  return (
    <React.Suspense fallback={<Loading />}>
      <Page />
    </React.Suspense>
  );
}
