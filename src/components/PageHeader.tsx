import type { ReactNode } from "react";

import { MonthNav } from "@/components/MonthNav";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";

type Props = {
  actions?: ReactNode;
  className?: string;
  meta?: ReactNode;
  monthNav?: MonthNavModel;
  subtitle?: ReactNode;
  title: string;
};

// Page title row: 42px title, then either the month switcher (+ a short meta
// line such as "12 days left in the month") or a one-line subtitle, with the
// page's actions bottom-aligned on the right.
export function PageHeader({ actions, className, meta, monthNav, subtitle, title }: Props) {
  return (
    <header className={cn("mb-6.5 flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="flex flex-col gap-3">
        <h1 className="text-[34px] leading-none font-extrabold tracking-[-0.02em] md:text-[42px]">{title}</h1>
        {monthNav ? (
          <div className="flex flex-wrap items-center gap-x-2.5">
            <MonthNav nav={monthNav} />
            {meta && <span className="text-[13px] text-n-600">{meta}</span>}
          </div>
        ) : (
          subtitle && <p className="text-[15px] leading-7.5 text-n-700">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
