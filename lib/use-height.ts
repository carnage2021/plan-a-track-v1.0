"use client";

import * as React from "react";

/** An element's height, kept up to date as it changes (a header that wraps onto two lines on a phone). */
export function useHeight<T extends HTMLElement>(fallback: number) {
  const ref = React.useRef<T>(null);
  const [height, setHeight] = React.useState(fallback);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}
