import { expect, test } from "@playwright/test";

// One pass over the whole sidebar, so every route is proven reachable and
// renderable in a single place. Per-feature behaviour lives in its own spec.
const routes = [
  { label: "Home", path: "/dashboard" },
  { label: "Expenses", path: "/expenses" },
  { label: "Budget", path: "/budget" },
  { label: "Recurring", path: "/recurring" },
  { label: "Savings Goals", path: "/savings-goals" },
  { label: "Loans", path: "/loans" },
  { label: "Dhuku", path: "/dhuku" },
  { label: "Reports", path: "/reports" },
  { label: "Categories", path: "/categories" },
  { label: "Notifications", path: "/notifications" },
  { label: "Settings", path: "/settings" },
];

test("every sidebar link reaches its page without an error", async ({ page }) => {
  // Dev compiles each route on first hit, so allow time for the full sweep.
  test.setTimeout(120_000);

  await page.goto("/dashboard");
  const sidebar = page.getByRole("complementary");

  for (const route of routes) {
    await sidebar.getByRole("link", { name: route.label }).click();
    await expect(page).toHaveURL((url) => url.pathname === route.path);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});
