import { ToneIcon } from "@/components/ToneIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import { getCategoryIcon, getCategoryTone } from "@/modules/categories/lib/category-icons";
import { formatNPR } from "@/modules/dashboard/lib/format";

export type TopExpense = { amount: number; categoryName: string; date: string; groupName: string; id: string; note: null | string };

type Props = { dateFormat: DateFormat; expenses: TopExpense[] };

export function TopExpensesCard({ dateFormat, expenses }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Largest expenses</CardTitle>
        <p className="text-sm text-muted-foreground">The biggest single spends this month</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {expenses.length === 0 && <p className="text-sm text-muted-foreground">No expenses this month yet.</p>}
        {expenses.map((e) => (
          <div className="flex items-center gap-3" key={e.id}>
            <ToneIcon className="h-8 w-8 shrink-0" icon={getCategoryIcon(e.groupName)} tone={getCategoryTone(e.groupName)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.note || e.categoryName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatShortDate(e.date, dateFormat)}
                {e.note && ` · ${e.categoryName}`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium whitespace-nowrap">{formatNPR(e.amount)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
