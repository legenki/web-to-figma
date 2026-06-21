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
          // Figma's plugin sandbox (QuickJS) does not support optional chaining
          // (?.) or nullish coalescing (??). Transpile the sandbox bundle down
          // to es2017 so those tokens never reach the engine.
          target: "es2017",
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
