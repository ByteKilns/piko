"use client";

import { createContext, type ReactNode, useContext } from "react";

// What the app shell knows about a demo visitor's household; null for real accounts.
export type DemoState = { timeLeft: string };

const DemoContext = createContext<DemoState | null>(null);

export function DemoProvider({ children, demo }: { children: ReactNode; demo: DemoState | null }) {
  return <DemoContext value={demo}>{children}</DemoContext>;
}

export function useDemo(): DemoState | null {
  return useContext(DemoContext);
}
