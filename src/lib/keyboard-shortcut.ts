export type ShortcutEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  key: string | undefined;
  metaKey: boolean;
  target: null | { isContentEditable?: boolean; role?: null | string; tagName?: string };
};

const TYPING_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
// Radix Select renders buttons with these roles and uses letter keys for
// type-ahead without calling preventDefault, so they count as typing.
const TYPING_ROLES = new Set(["combobox", "listbox", "option"]);

// "N" opens Add expense from anywhere — but never while someone is typing
// (fields, dropdown type-ahead), holding a modifier (browser shortcuts),
// already inside a dialog or menu, or on the key-less keydown Chrome's
// autofill dispatches.
export function isAddExpenseShortcut(event: ShortcutEvent, overlayOpen: boolean): boolean {
  if (overlayOpen || event.defaultPrevented) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if ((event.key ?? "").toLowerCase() !== "n") return false;
  const { target } = event;
  if (!target) return true;
  if (target.isContentEditable || TYPING_TAGS.has(target.tagName ?? "")) return false;
  return !TYPING_ROLES.has(target.role ?? "");
}
