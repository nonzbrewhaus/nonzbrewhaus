"use client";

import { useSyncExternalStore } from "react";
import { addLine, removeOne, type CartLine } from "./booking";

// Basket + chosen slot, kept in the browser between the separate pages (localStorage).
export type CartState = { lines: CartLine[]; slot: { pickupAt: string; label: string } | null };

const KEY = "nz-cart-v1";
const EMPTY: CartState = { lines: [], slot: null };
let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && Array.isArray(saved.lines)) state = { lines: saved.lines, slot: saved.slot ?? null };
  } catch {
    // corrupt storage: start with an empty basket
  }
}

function set(next: CartState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // private mode / quota: basket still works for this page view
  }
  listeners.forEach((l) => l());
}

export const cart = {
  add: (line: Omit<CartLine, "key" | "qty">) => (load(), set({ ...state, lines: addLine(state.lines, line) })),
  removeOne: (key: string) => {
    load();
    const lines = removeOne(state.lines, key);
    set({ lines, slot: lines.length ? state.slot : null });
  },
  /** Replace lines after re-checking them against the live menu. */
  replaceLines: (lines: CartLine[]) => (load(), set({ ...state, lines })),
  setSlot: (slot: CartState["slot"]) => (load(), set({ ...state, slot })),
  clear: () => set(EMPTY),
};

export function useCart(): CartState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (load(), state),
    () => EMPTY,
  );
}
