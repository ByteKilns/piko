import type { ReactNode } from "react";

// The split screen the signed-out pages share (Sign in, Try Piko): the brand
// on one side, the page's own content on the other.
export function BrandSplit({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-paper text-ink lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-10 border-b-2 border-rule px-6 py-6 lg:border-r-2 lg:border-b-0 lg:p-12">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-8 place-items-center bg-ink text-base font-extrabold text-paper">
            P
          </span>
          <span className="text-[17px] font-extrabold">Piko</span>
        </div>
        <div className="hidden lg:block">
          <p className="text-[76px] leading-[0.95] font-extrabold tracking-[-0.035em]">Piko</p>
          <p className="mt-5 max-w-[26ch] border-t-2 border-ink pt-4 text-xl leading-snug text-n-800">Plan together, grow together.</p>
        </div>
      </div>

      <div className="flex items-start px-6 py-10 lg:items-center lg:p-12">{children}</div>
    </div>
  );
}
