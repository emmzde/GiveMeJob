import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const host = process.env.TAURI_DEV_HOST;
const m2BrowserBenchmarkPlugin: Plugin = {
  name: "givemejob-m2-browser-benchmark",
  transformIndexHtml() {
    if (process.env.GIVEMEJOB_M2_BROWSER_BENCHMARK !== "1") return [];
    return [
      {
        tag: "script",
        attrs: { type: "module" },
        children: readFileSync(
          new URL("./src/test/m2BrowserMock.js", import.meta.url),
          "utf8",
        ),
        injectTo: "head-prepend",
      },
    ];
  },
};

export default defineConfig({
  plugins: [m2BrowserBenchmarkPlugin, react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "oxc",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
