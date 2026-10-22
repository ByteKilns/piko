import { expect, type Page, test } from "@playwright/test";

import { SIGNED_OUT } from "./support/demo";
import { gotoRoute } from "./support/nav";

// Every page has to fit a phone, a tablet, a laptop and a big monitor (and
// six-figure amounts, which the e2e seed is too small to show): nothing may
// make the page scroll sideways, no table cell may spill into the next one
// (each table has its own phone layout, see RowColumns in Rows.tsx), and on a
// wide screen the capped content column sits centred beside the sidebar.
const WIDTHS = [320, 360, 390, 480, 560, 600, 640, 700, 768, 820, 900, 1024, 1440, 1920, 2560];
const APP_PAGES = [
  "/dashboard",
  "/expenses",
  "/budget",
  "/reports",
  "/savings",
  "/recurring",
  "/loans",
  "/dhuku",
  "/categories",
  "/activity",
  "/notifications",
  "/settings",
];

// What doesn't fit at the current width: how far the page scrolls sideways,
// and table cells whose content runs past their edge into the next cell.
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const spilled: string[] = [];
    for (const row of document.querySelectorAll('[data-slot="row"]')) {
      for (const cell of row.children) {
        const box = cell.getBoundingClientRect();
        if (box.width === 0) continue;
        // A clipped cell (truncate, overflow hidden) is fitting on purpose.
        if (getComputedStyle(cell).overflowX !== "visible") continue;
        if (cell.scrollWidth > cell.clientWidth + 1) spilled.push((cell.textContent ?? "").trim().slice(0, 40));
      }
    }
    // Space left and right of the content column, inside <main>'s padding:
    // equal when centred beside the sidebar.
    const main = document.querySelector("main");
    const column = main?.querySelector(":scope > div[class*='@container']");
    let offCentre = 0;
    if (main && column) {
      const inner = main.getBoundingClientRect();
      const style = getComputedStyle(main);
      const box = column.getBoundingClientRect();
      const left = box.left - (inner.left + parseFloat(style.paddingLeft));
      const right = inner.right - parseFloat(style.paddingRight) - box.right;
      offCentre = Math.round(Math.abs(left - right));
    }
    return { offCentre, sideways: doc.scrollWidth - doc.clientWidth, spilled };
  });
}

async function expectFits(page: Page, path: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    // Let the layout settle (the sidebar switches to its rail below 1024px).
    await page.waitForTimeout(300);
    const problems = await layoutProblems(page);
    expect(problems, `${path} at ${width}px`).toEqual({ offCentre: 0, sideways: 0, spilled: [] });
  }
}

test.describe("responsive layout", () => {
  for (const path of APP_PAGES) {
    test(`${path} fits phones, tablets and small laptops`, async ({ page }) => {
      await gotoRoute(page, path);
      await expectFits(page, path);
    });
  }

  test.describe("signed out", () => {
    test.use({ storageState: SIGNED_OUT });

    for (const path of ["/login", "/demo"]) {
      test(`${path} fits phones, tablets and small laptops`, async ({ page }) => {
        await page.goto(path);
        await expectFits(page, path);
      });
    }
  });
});
