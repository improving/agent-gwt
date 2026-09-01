import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: "src/index.ts",
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    outDir: "lib",
    platform: "node",
    root: "src",
  },
  lint: {
    ignorePatterns: ["lib/**", "coverage/**"],
    overrides: [
      {
        files: ["**/*.spec.ts"],
        rules: {
          "unicorn/no-thenable": "off",
        },
      },
    ],
  },
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
    },
  },
});
