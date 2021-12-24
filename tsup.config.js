import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/create-lens.ts", "src/react.ts"],
  format: ["cjs", "esm"],
  external: ["react"],
  sourcemap: true,
  clean: true,
  dts: true,
  keepNames: true,
});
