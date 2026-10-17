"use client";

import { useState } from "react";

import { ChevronLeft } from "lucide-react";

import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light" | "system";
type Calendar = "ad" | "bs";

// The mobile app's Settings screen, demo-safe: the controls work on screen but
// nothing is saved, and there is no real server or account behind them.
export function PhoneSettings({ onBack }: { onBack: () => void }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [calendar, setCalendar] = useState<Calendar>("bs");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b-2 border-ink px-3 py-2.5">
        <Button aria-label="Back" onClick={onBack} size="icon-sm" type="button" variant="ghost">
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-extrabold">Settings</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <h3 className="border-b-2 border-rule pt-5 pb-2 text-[17px] font-extrabold tracking-[-0.01em]">Appearance</h3>
        <div className="pt-3.5">
          <p className="text-[15px] font-semibold">Theme</p>
          <p className="mt-0.5 text-[13px] text-n-600">Light, dark, or the same as the phone.</p>
          <Segmented
            className="mt-2.5"
            label="Theme"
            onChange={setTheme}
            options={[
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
              { label: "System", value: "system" },
            ]}
            value={theme}
          />
        </div>

        <h3 className="border-b-2 border-rule pt-7 pb-2 text-[17px] font-extrabold tracking-[-0.01em]">Dates</h3>
        <div className="pt-3.5">
          <p className="text-[15px] font-semibold">Calendar</p>
          <p className="mt-0.5 text-[13px] text-n-600">How dates show on this phone.</p>
          <Segmented
            className="mt-2.5"
            label="Calendar"
            onChange={setCalendar}
            options={[
              { label: "BS (Nepali)", value: "bs" },
              { label: "AD (English)", value: "ad" },
            ]}
            value={calendar}
          />
        </div>

        <h3 className="border-b-2 border-rule pt-7 pb-2 text-[17px] font-extrabold tracking-[-0.01em]">Server</h3>
        <div className="pt-3.5">
          <p className="text-[15px] font-semibold">Server URL</p>
          <p className="mt-0.5 text-[13px] text-n-600">The Piko website this app talks to.</p>
          <p className="mt-2 border border-n-400 px-3 py-2 text-[13px] text-n-700">https://piko-kn.vercel.app</p>
        </div>

        <h3 className="border-b-2 border-rule pt-7 pb-2 text-[17px] font-extrabold tracking-[-0.01em]">Account</h3>
        <p className="pt-3.5 text-[15px]">
          Signed in as <strong className="font-semibold">Aarav</strong>
        </p>

        <p className="mt-6 text-[13px] text-n-600">
          This is a demo. Nothing you change here is saved. Use <strong className="font-semibold">Exit demo</strong> above to clear it.
        </p>
      </div>
    </div>
  );
}
