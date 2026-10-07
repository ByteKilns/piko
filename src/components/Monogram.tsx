import { cn } from "@/lib/utils";

export type MonogramPerson = { name: string; role: "me" | "partner" };

const SIZES = { lg: "size-5.5 text-[11px]", md: "size-5 text-[11px]", sm: "size-4.5 text-[10px]" } as const;

type Props = { className?: string; people: MonogramPerson[]; size?: keyof typeof SIZES };

// Square initial badges: you in ink, your partner in grey. Shared items pass
// both people and the second badge overlaps the first.
export function Monogram({ className, people, size = "md" }: Props) {
  return (
    <span aria-hidden className={cn("flex shrink-0", className)}>
      {people.map((person, i) => (
        <span
          className={cn(
            "grid place-items-center font-semibold text-paper",
            SIZES[size],
            person.role === "me" ? "bg-ink" : "bg-n-600",
            i > 0 && "-ml-1 ring-2 ring-paper",
          )}
          key={`${person.role}-${person.name}`}
        >
          {person.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      ))}
    </span>
  );
}
