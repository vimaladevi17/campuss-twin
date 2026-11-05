import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1100, // the map chunk (MapLibre + deck.gl) is lazy-loaded, only when the map is opened
    rollupOptions: { output: { manualChunks: (id) => (id.includes("maplibre-gl") ? "maplibre" : id.includes("@deck.gl") || id.includes("@luma.gl") || id.includes("@math.gl") ? "deckgl" : undefined) } },
  },
  test: { include: ["src/**/*.test.{js,jsx}"], environment: "jsdom", globals: true, setupFiles: "./src/test/setup.js", css: false },
});
