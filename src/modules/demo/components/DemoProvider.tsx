"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

// What the app shell knows about a demo visitor's household; null for real accounts.
export type DemoState = { timeLeft: string };

type DemoContextValue = DemoState & { phoneOpen: boolean; setPhoneOpen: (open: boolean) => void };

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children, demo }: { children: ReactNode; demo: DemoState | null }) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  return <DemoContext value={demo ? { ...demo, phoneOpen, setPhoneOpen } : null}>{children}</DemoContext>;
}

export function useDemo(): DemoContextValue | null {
  return useContext(DemoContext);
}
