import { diffFields } from "@/modules/activity/lib/diff";

export function dateFormatLabel(value: unknown): null | string {
  if (value === "nepali") return "Nepali (BS)";
  if (value === "english") return "English (AD)";
  return null;
}

function onOff(value: unknown): string {
  return value ? "On" : "Off";
}

export function dateFormatChanges(before: string, after: string) {
  return diffFields({ dateFormat: before }, { dateFormat: after }, [
    { format: dateFormatLabel, key: "dateFormat", label: "Date format" },
  ]);
}

export function plannerChanges(before: boolean, after: boolean) {
  return diffFields({ plannerEnabled: before }, { plannerEnabled: after }, [
    { format: onOff, key: "plannerEnabled", label: "AI budget planner" },
  ]);
}
