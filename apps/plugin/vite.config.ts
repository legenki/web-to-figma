import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const target = process.env.PLUGIN_TARGET ?? "ui";

export default defineConfig(
  target === "code"
    ? {
        build: {
          outDir: "dist",
          emptyOutDir: false,
          lib: {
            entry: resolve(import.meta.dirname, "src/code.ts"),
            formats: ["iife"],
            name: "code",
            fileName: () => "code.js",
          },
        },
      }
    : {
        plugins: [react(), viteSingleFile()],
        build: {
          outDir: "dist",
          emptyOutDir: false,
          rollupOptions: { input: resolve(import.meta.dirname, "index.html") },
        },
      }
);
