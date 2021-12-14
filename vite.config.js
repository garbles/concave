const path = require("path");
const { defineConfig } = require("vite");
const typescript = require("@rollup/plugin-typescript");

module.exports = defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Concave",
      fileName: (format) => `concave.${format}.js`,
    },
    rollupOptions: {
      external: ["react"],
      output: {
        sourcemap: true,
        globals: {
          react: "React",
        },
      },
      plugins: [typescript()],
    },
  },
});
