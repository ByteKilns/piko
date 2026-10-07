import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = { action?: ReactNode; body: ReactNode; className?: string; size?: "lg" | "md"; title: string };

// Every "nothing here yet" or error message: a bold line, one sentence, one action.
export function EmptyState({ action, body, className, size = "md", title }: Props) {
  return (
    <div className={cn("flex flex-col items-start", size === "md" ? "gap-2.5 py-5.5" : "gap-3.5 py-6", className)}>
      {size === "lg" ? (
        <h2 className="max-w-[18ch] text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em] text-balance">{title}</h2>
      ) : (
        <h3 className="text-[17px] font-semibold">{title}</h3>
      )}
      <p className={cn("max-w-[46ch] leading-[1.55] text-pretty", size === "md" ? "text-sm text-n-700" : "text-[15px] text-n-800")}>{body}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
