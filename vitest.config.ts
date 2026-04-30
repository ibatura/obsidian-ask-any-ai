import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Redirect all "obsidian" imports to a lightweight mock
      obsidian: new URL("./__mocks__/obsidian.ts", import.meta.url).pathname,
    },
  },
});
