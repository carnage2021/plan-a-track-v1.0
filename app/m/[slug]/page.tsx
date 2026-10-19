"use client";

import { useParams } from "next/navigation";
import * as React from "react";
import { CataloguePage, Loading, NotFound, usePublic, type Catalogue } from "@/components/public/menu-view";

function Page() {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading } = usePublic<Catalogue>("public_catalogue", { p_slug: slug });
  if (loading) return <Loading />;
  if (!data) return <NotFound what="menu" />;
  return <CataloguePage data={data} />;
}

/** The caterer's public catalogue: dishes and packages, prices if they chose to show them. */
export default function PublicMenu() {
  return (
    <React.Suspense fallback={<Loading />}>
      <Page />
    </React.Suspense>
  );
}
