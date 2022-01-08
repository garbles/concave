import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  external: ["react"],
  sourcemap: true,
  clean: true,
  dts: true,
  keepNames: true,
  target: "es2020",
});
