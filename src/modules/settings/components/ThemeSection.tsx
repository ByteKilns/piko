"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MODES = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Monitor, label: "System", value: "system" },
] as const;

export function ThemeSection() {
  const { setTheme, theme } = useTheme();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Theme</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm font-medium text-foreground">Appearance</p>
        <div className="flex gap-2">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const active = (theme ?? "system") === mode.value;
            return (
              <button
                className={`flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-sm ${
                  active ? "border-ink bg-ink font-semibold text-paper" : "border-n-400 text-n-700"
                }`}
                key={mode.value}
                onClick={() => setTheme(mode.value)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
