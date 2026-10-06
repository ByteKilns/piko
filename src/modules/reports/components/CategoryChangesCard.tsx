import { TrendingDown, TrendingUp } from "lucide-react";

import { ToneIcon } from "@/components/ToneIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/modules/categories/lib/category-icons";
import { formatNPR } from "@/modules/dashboard/lib/format";
import type { CategoryChange } from "@/modules/reports/lib/reports-stats";

type Props = { changes: CategoryChange[]; previousLabel: string };

// Spending going up is the one to notice, so increases read as destructive
// and decreases as positive.
export function CategoryChangesCard({ changes, previousLabel }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Biggest changes</CardTitle>
        <p className="text-sm text-muted-foreground">Compared with {previousLabel}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {changes.length === 0 && <p className="text-sm text-muted-foreground">Spending matched last month.</p>}
        {changes.map((c) => {
          const up = c.delta > 0;
          const Icon = up ? TrendingUp : TrendingDown;
          return (
            <div className="flex items-center gap-3" key={c.categoryId}>
              <ToneIcon className="h-8 w-8 shrink-0" icon={getCategoryIcon(c.groupName)} tone={c.tone} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNPR(c.previous)} → {formatNPR(c.current)}
                </p>
              </div>
              <div className={cn("flex shrink-0 items-center gap-1 text-sm font-medium", up ? "text-destructive" : "text-green-700 dark:text-green-400")}>
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {up ? "+" : "−"}
                  {formatNPR(Math.abs(c.delta))}
                  {c.pct !== null && <span className="ml-1 text-xs font-normal">({c.pct > 0 ? "+" : ""}{c.pct}%)</span>}
                  {c.pct === null && <span className="ml-1 text-xs font-normal">(new)</span>}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
