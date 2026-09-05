import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, "../..");

export default defineConfig({
  root: rootDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 4200,
    fs: {
      allow: [workspaceRoot],
    },
    proxy: {
      "/graphql": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
      "/api/stream": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        // SSE must not be buffered; long-lived stream.
        timeout: 0,
        proxyTimeout: 0,
      },
      "/api/exports": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: "hidden",
  },
  optimizeDeps: {
    exclude: ["@repo/ui", "@repo/shared"],
  },
});
