import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

type SettingsSnapshot = { dateFormat?: string; plannerEnabled?: boolean };

export function dateFormatLabel(value: unknown): null | string {
  if (value === "nepali") return "Nepali (BS)";
  if (value === "english") return "English (AD)";
  return null;
}

function onOff(value: unknown): string {
  return value ? "On" : "Off";
}

export function settingsFields(): FieldSpec<SettingsSnapshot>[] {
  return [
    { format: dateFormatLabel, key: "dateFormat", label: "Date format" },
    // The AI budget planner toggle was removed; kept so older activity entries
    // that changed it still render.
    { format: (value) => (value === undefined || value === null ? null : onOff(value)), key: "plannerEnabled", label: "AI budget planner" },
  ];
}

const settingSpecs = (key: keyof SettingsSnapshot) => settingsFields().filter((s) => s.key === key);

export function dateFormatChanges(before: string, after: string) {
  return diffFields<SettingsSnapshot>({ dateFormat: before }, { dateFormat: after }, settingSpecs("dateFormat"));
}
