// Placeholder shaped like a redesigned page — title, month line, headline
// figures, rows — so moving between pages doesn't flash a spinner.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse" role="status">
      <div className="h-10.5 w-56 bg-n-200" />
      <div className="mt-3 h-4 w-40 bg-n-200" />
      <div className="mt-6.5 grid grid-cols-3 border-t-2 border-b border-t-ink border-b-rule @min-[780px]:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-full flex flex-col gap-3 border-b border-n-300 pt-4.5 pb-5 @min-[780px]:col-span-1 @min-[780px]:border-b-0 @min-[780px]:pr-7">
          <div className="h-3 w-24 bg-n-200" />
          <div className="h-10 w-48 bg-n-200" />
        </div>
        {[0, 1, 2].map((cell) => (
          <div className="flex flex-col gap-3 px-5 pt-4.5 pb-5" key={cell}>
            <div className="h-3 w-16 bg-n-200" />
            <div className="mt-3 h-6 w-24 bg-n-200" />
          </div>
        ))}
      </div>
      <div className="mt-9">
        {Array.from({ length: 6 }, (_, row) => (
          <div className="flex items-center gap-4 border-b border-n-300 px-2 py-3.5" key={row}>
            <div className="size-7 bg-n-200" />
            <div className="h-4 flex-1 bg-n-200" />
            <div className="h-4 w-20 bg-n-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
