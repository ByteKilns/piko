import type { ActivityChange } from "@/db/schema";

export function ChangeList({ changes }: { changes: ActivityChange[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-surface px-3 py-2 text-sm">
      {changes.map((change) => (
        <div className="contents" key={change.field}>
          <dt className="text-n-600">{change.field}</dt>
          <dd className="break-words">
            <span className="line-through opacity-60">{change.from ?? "—"}</span> → {change.to ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
