import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const backendBaseUrl =
  process.env.VITE_API_URL?.replace(/\/api$/, "") ?? "http://localhost:4000";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react() as any],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendBaseUrl,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
