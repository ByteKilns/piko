import { describe, expect, it } from "vitest";

import { noteCategoryTable, noteWords } from "./note-words";

const categories = [
  { id: "groceries", name: "Groceries" },
  { id: "lunch", name: "Lunch" },
  { id: "dates", name: "Dates" },
  { id: "shopping", name: "Shopping" },
  { id: "petrol", name: "Petrol" },
  { id: "other-personal", name: "Other Personal" },
  { id: "personal", name: "Personal" },
];

describe("noteWords", () => {
  it("lowercases and splits on anything that isn't a letter or digit", () => {
    expect(noteWords("Groceries, BANANA & apples")).toEqual(["groceries", "banana", "apples"]);
  });

  it("drops filler words, one-letter words and bare numbers", () => {
    expect(noteWords("T shirt from Basemark for 1500")).toEqual(["shirt", "basemark"]);
    expect(noteWords("momo ko lagi")).toEqual(["momo"]);
  });

  it("keeps words in any script", () => {
    expect(noteWords("केरा र स्याउ")).toEqual(["केरा", "स्याउ"]);
  });
});

describe("noteCategoryTable", () => {
  it("maps each word to the category it was written under", () => {
    const table = noteCategoryTable([{ categoryId: "groceries", note: "banana and apples" }], categories);
    expect(table.banana).toBe("groceries");
    expect(table.apples).toBe("groceries");
  });

  it("follows the last five uses, so a recent change of habit wins", () => {
    // Newest first: lately momo is filed under Lunch, before that under Dates.
    const samples = [
      ...Array.from({ length: 3 }, () => ({ categoryId: "lunch", note: "momo" })),
      ...Array.from({ length: 6 }, () => ({ categoryId: "dates", note: "momo" })),
    ];
    expect(noteCategoryTable(samples, categories).momo).toBe("lunch");
  });

  it("gives a tie to the most recent use", () => {
    const samples = [
      { categoryId: "dates", note: "momo" },
      { categoryId: "lunch", note: "momo" },
    ];
    expect(noteCategoryTable(samples, categories).momo).toBe("dates");
  });

  it("counts a word once per expense", () => {
    const samples = [
      { categoryId: "shopping", note: "shirt shirt shirt" },
      { categoryId: "shopping", note: "shirt" },
      { categoryId: "groceries", note: "shirt" },
      { categoryId: "groceries", note: "shirt" },
    ];
    // 2 uses each, so the newest (Shopping) wins rather than the repeated word.
    expect(noteCategoryTable(samples, categories).shirt).toBe("shopping");
  });

  it("skips expenses whose category isn't active any more", () => {
    const samples = [
      { categoryId: "parents", note: "medicine" },
      { categoryId: "groceries", note: "medicine" },
    ];
    expect(noteCategoryTable(samples, categories).medicine).toBe("groceries");
  });

  it("fills gaps with words found in exactly one category's name", () => {
    const table = noteCategoryTable([], categories);
    expect(table.petrol).toBe("petrol");
    expect(table.groceries).toBe("groceries");
    expect(table.other).toBe("other-personal");
    // "personal" is in two names, so it says nothing.
    expect(table.personal).toBeUndefined();
  });

  it("lets what was written in notes beat a category's name", () => {
    const table = noteCategoryTable([{ categoryId: "groceries", note: "petrol station snacks" }], categories);
    expect(table.petrol).toBe("groceries");
  });

  it("handles words that are also object property names", () => {
    expect(Object.hasOwn(noteCategoryTable([], categories), "constructor")).toBe(false);
    const table = noteCategoryTable([{ categoryId: "shopping", note: "constructor set" }], categories);
    expect(Object.hasOwn(table, "constructor")).toBe(true);
    expect(table["constructor"]).toBe("shopping");
  });
});
