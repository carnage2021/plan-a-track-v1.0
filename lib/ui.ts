"use client";

import * as React from "react";
import { create } from "zustand";

/** Open/closed state for the sheets that can be reached from anywhere (quick add, search). */
interface UiState {
  search: boolean;
  enquiry: { open: boolean; id?: string; date?: string };
  payment: { open: boolean; orderId?: string };
  setSearch: (open: boolean) => void;
  openEnquiry: (id?: string, date?: string) => void;
  closeEnquiry: () => void;
  openPayment: (orderId?: string) => void;
  closePayment: () => void;
}

export const useUi = create<UiState>((set) => ({
  search: false,
  enquiry: { open: false },
  payment: { open: false },
  setSearch: (search) => set({ search }),
  openEnquiry: (id, date) => set({ enquiry: { open: true, id, date } }),
  closeEnquiry: () => set((s) => ({ enquiry: { ...s.enquiry, open: false } })),
  openPayment: (orderId) => set({ payment: { open: true, orderId } }),
  closePayment: () => set((s) => ({ payment: { ...s.payment, open: false } })),
}));

type Theme = "light" | "dark";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readTheme,
    () => "light" as Theme,
  );
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

export function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Documents always print on white, whatever theme the app is in. */
export function printLight() {
  const root = document.documentElement;
  const previous = root.dataset.theme;
  root.dataset.theme = "light";
  window.print();
  root.dataset.theme = previous;
}

/** Prints the open receipt on an 80 mm thermal roll instead of A4. */
export function printThermal() {
  const page = document.createElement("style");
  page.textContent = "@page { size: 80mm auto; margin: 3mm; }";
  document.head.append(page);
  document.documentElement.classList.add("print-thermal");
  printLight();
  document.documentElement.classList.remove("print-thermal");
  page.remove();
}

/** Prints label sheets edge to edge on A4, so each sticker lands on its label. */
export function printLabels() {
  const page = document.createElement("style");
  page.textContent = "@page { size: A4; margin: 0; } .label-page { break-after: page; }";
  document.head.append(page);
  printLight();
  page.remove();
}
