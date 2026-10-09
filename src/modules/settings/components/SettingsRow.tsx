import type { ReactNode } from "react";

// One settings line: label + description on the left, the control on the
// right, under a 1px rule.
export function SettingsRow({ control, description, label }: { control: ReactNode; description?: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-n-300 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px]">{label}</span>
        {description && <span className="text-[13px] text-n-600">{description}</span>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
