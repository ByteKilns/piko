import { Fragment } from "react";

import Link from "next/link";

import { Money } from "@/components/Money";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import type { RecentGroup, RecentRow } from "@/modules/expenses/lib/recent-groups";

const ROW = "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-n-300 py-2.5 text-ink";

function RowContent({ row }: { row: RecentRow }) {
  return (
    <>
      <CategoryIcon groupName={row.categoryGroupName} icon={row.categoryIcon} name={row.categoryName} />
      <span className="flex min-w-0 items-baseline gap-2.5">
        <span className="text-[15px]">{row.categoryName}</span>
        {row.note && <span className="truncate text-[13px] text-n-600">{row.note}</span>}
      </span>
      <span className="text-[15px]">
        <Money value={row.amount} />
      </span>
    </>
  );
}

// Expenses grouped by day under a day heading with its total. Home and the
// demo's on-screen phone both show this list; rows link to `rowHref` if given.
export function RecentExpensesList({ groups, rowHref }: { groups: RecentGroup[]; rowHref?: string }) {
  return groups.map((group) => (
    <Fragment key={group.key}>
      <div className="flex items-baseline justify-between border-b border-rule pt-3.5 pb-2">
        <span className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold">{group.label}</span>
          <span className="text-[13px] text-n-600">{group.sub}</span>
        </span>
        <span className="text-sm font-semibold">
          <Money value={group.total} />
        </span>
      </div>
      {group.rows.map((row) =>
        rowHref ? (
          <Link className={`${ROW} no-underline hover:bg-ink/4`} href={rowHref} key={row.id}>
            <RowContent row={row} />
          </Link>
        ) : (
          <div className={ROW} key={row.id}>
            <RowContent row={row} />
          </div>
        ),
      )}
    </Fragment>
  ));
}
