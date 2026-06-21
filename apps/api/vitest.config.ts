import { fileURLToPath } from "node:url";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrationsPath = fileURLToPath(new URL("./migrations", import.meta.url));
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          // Run all tests in a single Worker so DO ids/alarms are addressable.
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            // Test-only binding consumed by the migrations setup file.
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
