"use client";

import { useTheme } from "next-themes";

import { SectionHeading } from "@/components/SectionHeading";
import { Segmented } from "@/components/Segmented";
import { SettingsRow } from "@/modules/settings/components/SettingsRow";

export function AppearanceSection() {
  const { setTheme, theme } = useTheme();

  return (
    <section>
      <SectionHeading>Appearance</SectionHeading>
      <SettingsRow
        control={
          <Segmented
            hideLabel
            label="Theme"
            onChange={setTheme}
            options={[
              { label: "Light", value: "light" },
              { label: "Dark", value: "dark" },
              { label: "System", value: "system" },
            ]}
            value={(theme ?? "system") as "dark" | "light" | "system"}
          />
        }
        description="Light, dark, or match your device."
        label="Theme"
      />
    </section>
  );
}
