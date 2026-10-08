import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9.5 w-full min-w-0 border border-n-400 bg-transparent px-3 text-base text-ink transition-colors md:text-[15px] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-n-500 hover:border-ink focus-visible:border-ink focus-visible:shadow-[inset_0_-2px_0_var(--signal)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-signal-ink",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  )
}

export { Input }
