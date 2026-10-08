import { Car, Fuel, Landmark, ShoppingBasket, Smartphone, Tag, Users, Utensils, Wifi } from "lucide-react";
import { describe, expect, it } from "vitest";

import { guessCategoryIcon } from "./guess-category-icon";

describe("guessCategoryIcon", () => {
  it("recognises common category names", () => {
    expect(guessCategoryIcon("Lunch", "Food")).toBe(Utensils);
    expect(guessCategoryIcon("Groceries", "Household")).toBe(ShoppingBasket);
    expect(guessCategoryIcon("Petrol", "Transportation")).toBe(Fuel);
    expect(guessCategoryIcon("Mobile/Telephone", "Personal")).toBe(Smartphone);
    expect(guessCategoryIcon("Internet", "Household")).toBe(Wifi);
    expect(guessCategoryIcon("Personal Loan", "Financial")).toBe(Landmark);
  });

  it("falls back to the category group's icon", () => {
    expect(guessCategoryIcon("Ride share", "Transportation")).toBe(Car);
    expect(guessCategoryIcon("Grandma", "Family")).toBe(Users);
  });

  it("uses a tag when neither the name nor the group is recognised", () => {
    expect(guessCategoryIcon("Miscellaneous", "Other")).toBe(Tag);
    expect(guessCategoryIcon("Something", "Unknown group")).toBe(Tag);
  });
});
