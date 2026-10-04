import { HandCoins, List, type LucideIcon, PiggyBank, Receipt, Repeat, Settings, Users, Wallet } from "lucide-react";

import { type Tone, ToneIcon } from "@/components/ToneIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ActivityAction } from "@/db/schema";

import type { ActivityListEntry } from "../api/activity";
import { describeActivity, sourceBadge } from "../lib/activity-format";
import { formatKathmanduTime } from "../lib/activity-time";
import { isRevertible, revertModes } from "../lib/revert/plan";
import { type ActivitySection, sectionForEntityType } from "../lib/sections";
import { ChangeList } from "./ChangeList";
import { RevertButton } from "./RevertButton";

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

type Props = { actorImage: null | string; entry: ActivityListEntry };

export function ActivityRow({ actorImage, entry }: Props) {
  const changes = entry.changes ?? [];
  const badge = sourceBadge(entry.source);
  const sentence = describeActivity(entry.action, entry.entityType, entry.revertOfId !== null);

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
            <span className="font-medium">{entry.actorName}</span> {sentence}
          </p>
          {badge && (
            <Badge className="text-[10px]" variant="outline">
              {badge}
            </Badge>
          )}
          <time className="ml-auto text-xs text-muted-foreground" dateTime={entry.createdAt.toISOString()}>
            {formatKathmanduTime(entry.createdAt)}
          </time>
        </div>
        <p className="text-sm break-words text-muted-foreground">{entry.summary}</p>
        {isRevertible(entry) && (
          <RevertButton
            description={`${entry.actorName} ${sentence} · ${entry.summary} · ${formatKathmanduTime(entry.createdAt)}`}
            entryId={entry.id}
            modes={revertModes(entry.action)}
          />
        )}
        {changes.length > 0 && (
          <details className="group text-sm">
            <summary className="cursor-pointer text-xs font-medium text-primary select-none">
              Show changes ({changes.length})
            </summary>
            <div className="mt-2">
              <ChangeList changes={changes} />
            </div>
          </details>
        )}
      </div>
    </li>
  );
}
