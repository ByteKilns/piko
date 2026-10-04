import { HandCoins, List, type LucideIcon, PiggyBank, Receipt, Repeat, Settings, Users, Wallet } from "lucide-react";

import { type Tone, ToneIcon } from "@/components/ToneIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ActivityAction, ActivityLog } from "@/db/schema";

import { describeActivity } from "../lib/activity-format";
import { formatKathmanduTime } from "../lib/activity-time";
import { type ActivitySection, sectionForEntityType } from "../lib/sections";

const SECTION_ICONS: Record<ActivitySection, LucideIcon> = {
  budget: Wallet,
  categories: List,
  dhuku: Users,
  expenses: Receipt,
  loans: HandCoins,
  recurring: Repeat,
  savings: PiggyBank,
  settings: Settings,
};

const ACTION_TONES: Record<ActivityAction, Tone> = {
  archived: "blue",
  completed: "blue",
  created: "green",
  deleted: "pink",
  paid: "green",
  paused: "blue",
  restored: "blue",
  resumed: "blue",
  updated: "amber",
};

type Props = { actorImage: null | string; entry: ActivityLog };

export function ActivityRow({ actorImage, entry }: Props) {
  const changes = entry.changes ?? [];

  return (
    <li className="flex gap-3 px-4 py-3">
      <ToneIcon icon={SECTION_ICONS[sectionForEntityType(entry.entityType)]} tone={ACTION_TONES[entry.action]} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Avatar className="h-5 w-5">
            {actorImage && <AvatarImage alt="" src={actorImage} />}
            <AvatarFallback className="text-[10px]">{entry.actorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="text-sm">
            <span className="font-medium">{entry.actorName}</span> {describeActivity(entry.action, entry.entityType)}
          </p>
          {entry.source === "mobile" && (
            <Badge className="text-[10px]" variant="outline">
              via mobile
            </Badge>
          )}
          <time className="ml-auto text-xs text-muted-foreground" dateTime={entry.createdAt.toISOString()}>
            {formatKathmanduTime(entry.createdAt)}
          </time>
        </div>
        <p className="text-sm break-words text-muted-foreground">{entry.summary}</p>
        {changes.length > 0 && (
          <details className="group text-sm">
            <summary className="cursor-pointer text-xs font-medium text-primary select-none">
              Show changes ({changes.length})
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2">
              {changes.map((change) => (
                <div className="contents" key={change.field}>
                  <dt className="text-muted-foreground">{change.field}</dt>
                  <dd className="break-words">
                    <span className="line-through opacity-60">{change.from ?? "—"}</span> → {change.to ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}
