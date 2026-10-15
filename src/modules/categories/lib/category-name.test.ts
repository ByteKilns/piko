import { describe, expect, it } from "vitest";

import { categoryNameClash } from "./category-name";

const categories = [
  { archived: false, id: "c1", name: "Books" },
  { archived: false, id: "c2", name: "Dining Out" },
  { archived: true, id: "c3", name: "Parents" },
];

describe("categoryNameClash", () => {
  it("allows a name nobody has", () => {
    expect(categoryNameClash("Groceries", categories)).toBeNull();
  });

  it("blocks a name an active category has, ignoring capitals and spaces", () => {
    expect(categoryNameClash("  books ", categories)).toBe("You already have a category called Books.");
    expect(categoryNameClash("dining   out", categories)).toBe("You already have a category called Dining Out.");
  });

  it("points to the archived category instead of making a second one", () => {
    expect(categoryNameClash("parents", categories)).toBe("Parents is archived. Restore it from the Archived tab instead.");
  });

  it("lets a category keep its own name when it is renamed", () => {
    expect(categoryNameClash("BOOKS", categories, "c1")).toBeNull();
  });

  it("names the active one when an archived category has the same name", () => {
    const withArchivedTwin = [{ archived: true, id: "c9", name: "Books" }, ...categories];
    expect(categoryNameClash("Books", withArchivedTwin)).toBe("You already have a category called Books.");
  });

  it("doesn't treat a near spelling as the same name", () => {
    expect(categoryNameClash("Book", categories)).toBeNull();
  });
});
