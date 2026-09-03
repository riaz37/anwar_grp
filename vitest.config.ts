import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Integration tests hit the real dev Postgres (docker compose) and
    // run one at a time to avoid cross-test data races on shared tables.
    fileParallelism: false,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      // See test/stubs/server-only.ts — "server-only" only exists as a
      // real resolvable package inside Next's webpack bundler, not under
      // plain Node/Vitest.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
