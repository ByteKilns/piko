import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    // Playwright owns e2e/ — don't let vitest try to run those specs.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
