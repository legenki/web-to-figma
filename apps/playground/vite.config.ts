import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tanstackStart({
      // dom-to-figma needs the real browser (`window.getComputedStyle`,
      // `crypto.subtle`, `<canvas>`). Running routes through SSR would either
      // fail at import time or render placeholders; SPA mode skips both the
      // server execution of beforeLoad/loader and SSR of the route component.
      spa: { enabled: true },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
