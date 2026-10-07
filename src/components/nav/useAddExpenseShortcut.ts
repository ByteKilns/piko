import { useEffect } from "react";

import { isAddExpenseShortcut } from "@/lib/keyboard-shortcut";

export function useAddExpenseShortcut(onTrigger: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const overlayOpen = document.querySelector('[role="dialog"], [role="menu"]') !== null;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const shortcut = {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        key: event.key,
        metaKey: event.metaKey,
        target,
      };
      if (!isAddExpenseShortcut(shortcut, overlayOpen)) return;
      event.preventDefault();
      onTrigger();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}
