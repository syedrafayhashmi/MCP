import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendBaseUrl =
  process.env.VITE_API_URL?.replace(/\/api$/, "") ?? "http://localhost:4000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendBaseUrl,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
        cookiePathRewrite: "/",
      },
    },
  },
});
