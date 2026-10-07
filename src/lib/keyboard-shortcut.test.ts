import { describe, expect, it } from "vitest";

import { isAddExpenseShortcut, type ShortcutEvent } from "./keyboard-shortcut";

function press(overrides: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { altKey: false, ctrlKey: false, defaultPrevented: false, key: "n", metaKey: false, target: { tagName: "BODY" }, ...overrides };
}

describe("isAddExpenseShortcut", () => {
  it("fires on n or N with nothing focused", () => {
    expect(isAddExpenseShortcut(press(), false)).toBe(true);
    expect(isAddExpenseShortcut(press({ key: "N" }), false)).toBe(true);
    expect(isAddExpenseShortcut(press({ target: null }), false)).toBe(true);
  });

  it("ignores other keys", () => {
    expect(isAddExpenseShortcut(press({ key: "m" }), false)).toBe(false);
  });

  it("ignores keydowns without a key (Chrome autofill sends these)", () => {
    expect(isAddExpenseShortcut(press({ key: undefined }), false)).toBe(false);
  });

  it("never fires while typing", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isAddExpenseShortcut(press({ target: { tagName } }), false)).toBe(false);
    }
    expect(isAddExpenseShortcut(press({ target: { isContentEditable: true, tagName: "DIV" } }), false)).toBe(false);
  });

  it("leaves browser and OS shortcuts alone", () => {
    expect(isAddExpenseShortcut(press({ ctrlKey: true }), false)).toBe(false);
    expect(isAddExpenseShortcut(press({ metaKey: true }), false)).toBe(false);
    expect(isAddExpenseShortcut(press({ altKey: true }), false)).toBe(false);
  });

  it("does nothing while a dialog or menu is open, or when already handled", () => {
    expect(isAddExpenseShortcut(press(), true)).toBe(false);
    expect(isAddExpenseShortcut(press({ defaultPrevented: true }), false)).toBe(false);
  });
});
