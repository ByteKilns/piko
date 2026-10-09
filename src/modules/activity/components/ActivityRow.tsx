import { cn } from "@/lib/utils";

import type { ActivityListEntry } from "../api/activity";
import { describeActivity, sourceBadge } from "../lib/activity-format";
import { formatKathmanduTime } from "../lib/activity-time";
import { isRevertible, revertModes } from "../lib/revert/plan";
import { ChangeList } from "./ChangeList";
import { RevertButton } from "./RevertButton";

type Props = { entry: ActivityListEntry; realMemberId: string };

export function ActivityRow({ entry, realMemberId }: Props) {
  const changes = entry.changes ?? [];
  const badge = sourceBadge(entry.source);
  const sentence = describeActivity(entry.action, entry.entityType, entry.revertOfId !== null);

  return (
    <li className="grid grid-cols-[44px_22px_minmax(0,1fr)_auto] items-start gap-3 border-b border-n-300 px-2 py-3">
      <time className="pt-0.5 text-[13px] text-n-600 tabular-nums" dateTime={entry.createdAt.toISOString()}>
        {formatKathmanduTime(entry.createdAt)}
      </time>
      <span
        aria-hidden
        className={cn(
          "grid size-5.5 place-items-center text-[11px] font-semibold text-paper",
          entry.actorMemberId === realMemberId ? "bg-ink" : "bg-n-600",
        )}
      >
        {entry.actorName.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[15px]">
          <span className="font-semibold">{entry.actorName}</span> {sentence}
        </p>
        <p className="text-[13px] break-words text-n-700">{entry.summary}</p>
        {changes.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium text-n-700 select-none">Show changes ({changes.length})</summary>
            <div className="mt-2">
              <ChangeList changes={changes} />
            </div>
          </details>
        )}
      </div>
      <div className="flex items-center gap-2">
        {badge && <span className="text-xs whitespace-nowrap text-n-600">{badge === "via mobile" ? "mobile" : badge}</span>}
        {isRevertible(entry) && (
          <RevertButton
            description={`${entry.actorName} ${sentence} · ${entry.summary} · ${formatKathmanduTime(entry.createdAt)}`}
            entryId={entry.id}
            modes={revertModes(entry.action)}
          />
        )}
      </div>
    </li>
  );
}
