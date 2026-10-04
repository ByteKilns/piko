import type { ActivityChange } from "@/db/schema";

export function ChangeList({ changes }: { changes: ActivityChange[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
      {changes.map((change) => (
        <div className="contents" key={change.field}>
          <dt className="text-muted-foreground">{change.field}</dt>
          <dd className="break-words">
            <span className="line-through opacity-60">{change.from ?? "—"}</span> → {change.to ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
