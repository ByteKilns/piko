import type { ReactNode } from "react";

import { DEMO_LOCKED_MESSAGE } from "@/lib/demo-account";

// Greys out a settings section the demo turns off. The server refuses these
// actions anyway (assertNotDemo); this only explains why nothing happens.
export function DemoLocked({ children, locked }: { children: ReactNode; locked: boolean }) {
  if (!locked) return children;

  return (
    <div>
      <fieldset className="opacity-50" disabled>
        {children}
      </fieldset>
      <p className="mt-2 text-[13px] text-n-700">{DEMO_LOCKED_MESSAGE}.</p>
    </div>
  );
}
