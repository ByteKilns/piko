"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import dynamic from "next/dynamic";

// Its own chunk, so real accounts never download the tours (or driver.js).
const DemoTour = dynamic(() => import("../tour/DemoTour").then((m) => m.DemoTour), { ssr: false });

// What the app shell knows about a demo visitor's household; null for real accounts.
export type DemoState = { timeLeft: string };

type DemoContextValue = DemoState & {
  phoneOpen: boolean;
  // Runs this page's tour again ("Tour this page").
  requestTour: () => void;
  setPhoneOpen: (open: boolean) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children, demo }: { children: ReactNode; demo: DemoState | null }) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [tourRequest, setTourRequest] = useState(0);
  const value = demo ? { ...demo, phoneOpen, requestTour: () => setTourRequest((n) => n + 1), setPhoneOpen } : null;

  return (
    <DemoContext value={value}>
      {children}
      {demo && <DemoTour request={tourRequest} />}
    </DemoContext>
  );
}

export function useDemo(): DemoContextValue | null {
  return useContext(DemoContext);
}
