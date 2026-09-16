import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves this repo under /zingo/. Only the dev server uses the root.
  base: command === "serve" && !isPreview ? "/" : "/zingo/",
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
}));
