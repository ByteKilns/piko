import { auth } from "@/auth";
import { BrandSplit } from "@/components/BrandSplit";
import { isDemoEmail } from "@/lib/demo-account";

import { DemoStart } from "../components/DemoStart";

type Props = { searchParams: Promise<{ bye?: string; expired?: string }> };

const POINTS = [
  "Add an expense and watch your month update.",
  "See how a budget, savings pot and dhuku fit together.",
  "See both people's money, and what's shared.",
];

// The public way in: anyone with the link can start a private demo.
export async function DemoPage({ searchParams }: Props) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  // A demo session whose household was deleted still counts as signed out here.
  const signedInAsSelf = Boolean(session?.user?.id) && !isDemoEmail(session?.user?.email);
  const notice = params.expired ? "Your demo expired. Start a new one." : params.bye ? "Thanks for trying Piko." : null;

  return (
    <BrandSplit>
      <div className="flex w-full max-w-sm flex-col gap-5.5">
        <h1 className="text-[42px] leading-none font-extrabold tracking-[-0.02em]">Try Piko</h1>
        {notice && (
          <p className="border-l-2 border-signal pl-3 text-[15px] text-ink" role="status">
            {notice}
          </p>
        )}
        <ul className="flex flex-col gap-2.5">
          {POINTS.map((point) => (
            <li className="flex items-baseline gap-2.5 text-[15px] text-n-800" key={point}>
              <span aria-hidden className="size-1.5 shrink-0 translate-y-[-2px] bg-signal" />
              {point}
            </li>
          ))}
        </ul>
        <p className="border-t border-n-300 pt-4 text-sm text-n-700">
          You get a private copy made just for you. Nobody else sees what you enter, and it&apos;s deleted after 24 hours.
        </p>
        <DemoStart signedInAsSelf={signedInAsSelf} />
      </div>
    </BrandSplit>
  );
}
