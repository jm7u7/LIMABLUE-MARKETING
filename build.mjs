// Build estático para Vercel: copia el index.html (app compilada) a dist/.
// Las funciones /api las despliega Vercel por convención (carpeta api/), sin Vite.
import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync("dist", { recursive: true });
copyFileSync("index.html", "dist/index.html");
console.log("build: dist/index.html listo");
