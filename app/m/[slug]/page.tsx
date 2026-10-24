"use client";

import { useParams, useSearchParams } from "next/navigation";
import * as React from "react";
import { CataloguePage, Loading, NotFound, usePublic, type Catalogue, type PublicReferral } from "@/components/public/menu-view";

function Page() {
  const { slug } = useParams<{ slug: string }>();
  const ref = useSearchParams().get("ref") ?? "";
  const { data, loading } = usePublic<Catalogue>("public_catalogue", { p_slug: slug });
  // A link shared by a client (?ref=RAJESH25) shows their offer; an unknown code shows the plain menu.
  const referral = usePublic<PublicReferral>("public_referral", { p_slug: slug, p_code: ref });
  if (loading || (ref && referral.loading)) return <Loading />;
  if (!data) return <NotFound what="menu" />;
  return <CataloguePage data={data} referral={ref ? referral.data : null} />;
}

/** The caterer's public catalogue: dishes and packages, prices if they chose to show them. */
export default function PublicMenu() {
  return (
    <React.Suspense fallback={<Loading />}>
      <Page />
    </React.Suspense>
  );
}
