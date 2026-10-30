"use client";

import * as React from "react";

// Title Case for the interface's own words: headings, buttons, form labels, tabs, menus and table headings.
// "Add a staff role" shows as "Add a Staff Role". Sentences, help text, toasts and what people type (and pick from
// lists) are left as written. Applied to the page as it renders, so every screen follows without per-string edits.

const TARGETS = "h1, h2, h3, h4, h5, button, [role=tab], [role=menuitem], nav a, label > span:first-child, th, legend, [data-title-case]";
const SKIP = "input, textarea, select, option, [role=option], [role=listbox], [contenteditable=true], [data-no-title-case], .sr-only, kbd, code";
const UNITS = new Set(["kg", "g", "gm", "l", "ltr", "ml", "pcs", "pc", "nos", "km", "cm", "mm", "x"]);
const SMALL = new Set(["a", "an", "the", "and", "or", "nor", "but", "of", "in", "on", "at", "to", "for", "by", "with", "per", "from", "as", "vs", "via", "into", "than", "up"]);

/** Capitalises each word's first letter except small joining words; never lowercases anything. */
export function titleCase(text: string) {
  let first = true;
  return text.replace(/\S+/g, (token, at: number) => {
    const wasFirst = first;
    first = false;
    // Emails, links and units after a number ("3.5 kg", "20 pcs") stay as they are.
    if (/[@/]|\.\w/.test(token)) return token;
    if (/\d\s*$/.test(text.slice(0, at)) && UNITS.has(token.toLowerCase().replace(/[^a-z]/g, ""))) return token;
    const m = token.match(/^([("'“‘]*)(\p{Ll})(.*)$/u);
    if (!m) return token;
    if (!wasFirst && SMALL.has(token.toLowerCase().replace(/[^a-z]/g, ""))) return token;
    return m[1] + m[2].toUpperCase() + m[3];
  });
}

function fixText(node: Text) {
  const el = node.parentElement;
  if (!el || !el.closest(TARGETS) || el.closest(SKIP)) return;
  const before = node.nodeValue ?? "";
  if (!/\p{Ll}/u.test(before)) return;
  const after = titleCase(before);
  if (after !== before) node.nodeValue = after;
}

function fixTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return fixText(root as Text);
  if (!(root instanceof Element)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) fixText(n as Text);
}

export function TitleCase() {
  React.useEffect(() => {
    fixTree(document.body);
    let queued: Node[] = [];
    let frame = 0;
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") queued.push(r.target);
        else r.addedNodes.forEach((n) => queued.push(n));
      }
      if (!frame) frame = requestAnimationFrame(() => {
        const batch = queued;
        queued = [];
        frame = 0;
        batch.forEach(fixTree);
      });
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
