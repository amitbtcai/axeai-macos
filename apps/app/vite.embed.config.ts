import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import { sharedViteConfig } from "./vite.config";

const appDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  mergeConfig(sharedViteConfig, {
    base: "/remote-client/",
    build: {
      emptyOutDir: true,
      outDir: "dist-embed",
      rolldownOptions: {
        input: resolve(appDir, "embed.html"),
      },
    },
  }),
);
