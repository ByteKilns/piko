import { expect, test } from "@playwright/test";

// One pass over the whole sidebar, so every route is proven reachable and
// renderable in a single place. Per-feature behaviour lives in its own spec.
const routes = [
  { label: "Home", path: "/dashboard", title: "Dashboard · Piko" },
  { label: "Expenses", path: "/expenses", title: "Expenses · Piko" },
  { label: "Budget", path: "/budget", title: "Budget · Piko" },
  { label: "Recurring", path: "/recurring", title: "Recurring · Piko" },
  { label: "Savings Goals", path: "/savings-goals", title: "Savings Goals · Piko" },
  { label: "Loans", path: "/loans", title: "Loans · Piko" },
  { label: "Dhuku", path: "/dhuku", title: "Dhuku · Piko" },
  { label: "Reports", path: "/reports", title: "Reports · Piko" },
  { label: "Categories", path: "/categories", title: "Categories · Piko" },
  { label: "Notifications", path: "/notifications", title: "Notifications · Piko" },
  { label: "Settings", path: "/settings", title: "Settings · Piko" },
];

test("every sidebar link reaches its page without an error", async ({ page }) => {
  // Dev compiles each route on first hit, so allow time for the full sweep.
  test.setTimeout(120_000);

  await page.goto("/dashboard");
  const sidebar = page.getByRole("complementary");

  for (const route of routes) {
    await sidebar.getByRole("link", { name: route.label }).click();
    await expect(page).toHaveURL((url) => url.pathname === route.path);
    await expect(page).toHaveTitle(route.title);
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
  }
});
