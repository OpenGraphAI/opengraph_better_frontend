import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    rollupOptions: {
      input: {
        home: resolve(process.cwd(), "index.html"),
        docs: resolve(process.cwd(), "docs/index.html"),
      },
    },
  },
});
