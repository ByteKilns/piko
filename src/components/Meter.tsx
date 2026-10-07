import { meterWidths } from "@/lib/meter";
import { cn } from "@/lib/utils";

type Segment = { tone: "ink" | "partner" | "shared"; value: number };

const SEGMENT_TONES: Record<Segment["tone"], string> = { ink: "bg-ink", partner: "bg-n-600", shared: "bg-n-300" };

type Props = { className?: string; label?: string; ratio?: number; segments?: Segment[] };

// 4px bar. With `ratio` it is a progress meter (ink up to 100%, red for the
// overspend beyond it); with `segments` it is a stacked share bar (you /
// partner / shared). Pass `label` when the bar carries meaning on its own.
export function Meter({ className, label, ratio = 0, segments }: Props) {
  const a11y = label ? { "aria-label": label, role: "img" } : { "aria-hidden": true };

  if (segments) {
    return (
      <span className={cn("flex h-1 gap-0.5", className)} {...a11y}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment, i) => (
            <span className={SEGMENT_TONES[segment.tone]} key={`${segment.tone}-${i}`} style={{ flex: `${segment.value} 1 0` }} />
          ))}
      </span>
    );
  }

  const { fill, over } = meterWidths(ratio);
  return (
    <span className={cn("flex h-1 bg-n-200", className)} {...a11y}>
      <span className="bg-ink" style={{ width: `${fill}%` }} />
      <span className="bg-signal" style={{ width: `${over}%` }} />
    </span>
  );
}
