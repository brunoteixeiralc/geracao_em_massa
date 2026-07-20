import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/workflow/**/*.ts",
        "src/bot/**/*.ts",
        "src/renderer/**/*.ts",
        "src/security/**/*.ts",
        "src/server/**/*.ts",
        "src/db/**/*.ts"
      ],
      exclude: ["src/index.ts", "src/db/migrate.ts"]
    }
  }
});
