export default function Loading() {
  return (
    <div aria-label="Loading" className="flex min-h-screen items-center justify-center bg-paper" role="status">
      <span className="grid size-10 animate-pulse place-items-center bg-ink text-lg font-extrabold text-paper">P</span>
    </div>
  );
}
