import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build de la SPA. La carpeta /api son funciones serverless de Vercel (no las toca Vite).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo local, redirige /api al backend de `vercel dev` si lo usas.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
});
