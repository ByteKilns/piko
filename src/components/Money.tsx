import { splitAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

type Size = "cell" | "hero" | "lead" | "row";
type Tone = "default" | "muted" | "negative";

const STYLES: Record<Size, { currency: string; decimals: string; integer: string; wrapper: string }> = {
  cell: {
    currency: "text-[13px] font-semibold text-n-600",
    decimals: "-ml-1 text-[15px] text-n-500",
    integer: "text-2xl leading-none font-semibold tracking-[-0.015em]",
    wrapper: "gap-[5px]",
  },
  hero: {
    currency: "text-[22px] font-semibold text-n-600",
    decimals: "-ml-1.5 text-[32px] font-semibold text-n-500",
    integer: "text-[76px] leading-[0.95] font-extrabold tracking-[-0.035em]",
    wrapper: "gap-2",
  },
  lead: {
    currency: "text-base font-semibold text-n-600",
    decimals: "-ml-[5px] text-xl font-semibold text-n-500",
    integer: "text-[40px] leading-none font-extrabold tracking-[-0.025em]",
    wrapper: "gap-1.5",
  },
  row: { currency: "mr-1 font-semibold text-n-600", decimals: "font-normal text-n-500", integer: "font-semibold", wrapper: "" },
};

const TONES: Record<Tone, string> = { default: "", muted: "text-n-600", negative: "text-signal-ink" };

type Props = { className?: string; currency?: boolean; size?: Size; tone?: Tone; value: number };

// An amount set the modernist way: "Rs", grouped rupees, then smaller and
// lighter paisa. `row` inherits its font size from the surrounding text and
// leaves "Rs" off unless asked.
export function Money({ className, currency, size = "row", tone = "default", value }: Props) {
  const { decimals, integer, negative } = splitAmount(value);
  const style = STYLES[size];
  const showCurrency = currency ?? size !== "row";

  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap tabular-nums", style.wrapper, className)}>
      {showCurrency && <span className={style.currency}>Rs</span>}
      <span className={cn(style.integer, TONES[tone])}>
        {negative ? "\u2212" : ""}
        {integer}
      </span>
      <span className={style.decimals}>{decimals}</span>
    </span>
  );
}
