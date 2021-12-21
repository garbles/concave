import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    external: ["react"],
    sourcemap: true,
    clean: true,
    dts: true,
    keepNames: true,
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    external: ["react"],
    sourcemap: true,
    keepNames: true,
  },
]);
