"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { SectionHeading } from "@/components/SectionHeading";
import { Segmented } from "@/components/Segmented";
import type { DateFormat } from "@/lib/date-format-cookie";
import { setDateFormatAction } from "@/modules/settings/api/settings.actions";
import { SettingsRow } from "@/modules/settings/components/SettingsRow";

export function DateFormatSection({ initialFormat }: { initialFormat: DateFormat }) {
  const [format, setFormat] = useState<DateFormat>(initialFormat);
  const [, startTransition] = useTransition();

  function handleChange(value: DateFormat) {
    setFormat(value);
    startTransition(async () => {
      try {
        await setDateFormatAction(value);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save date format");
      }
    });
  }

  return (
    <section>
      <SectionHeading>Dates</SectionHeading>
      <SettingsRow
        control={
          <Segmented
            hideLabel
            label="Date format"
            onChange={handleChange}
            options={[
              { label: "BS", value: "nepali" },
              { label: "AD", value: "english" },
            ]}
            value={format}
          />
        }
        description="Bikram Sambat (e.g. 15 Bhadra 2083) or Gregorian (15 August 2026)."
        label="Date format"
      />
    </section>
  );
}
