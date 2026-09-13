import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(process.cwd(), "activity"),
  base: "/",
  build: {
    outDir: resolve(process.cwd(), "public"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020"
  }
});
