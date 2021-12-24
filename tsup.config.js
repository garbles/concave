import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  external: ["react"],
  sourcemap: true,
  clean: true,
  dts: true,
  keepNames: true,
});
