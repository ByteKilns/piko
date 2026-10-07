import type { ReactNode } from "react";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// "All expenses ↗"-style link beside section headings.
export function ArrowLink({ children, className, href }: { children: ReactNode; className?: string; href: string }) {
  return (
    <Link className={cn("inline-flex items-center gap-1 text-[13px] font-semibold text-signal-ink hover:text-signal", className)} href={href}>
      {children}
      <ArrowUpRight aria-hidden className="size-[13px]" />
    </Link>
  );
}
