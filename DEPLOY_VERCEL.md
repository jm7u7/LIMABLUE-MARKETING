# Desplegar Limablue Marketing en Vercel (Opción A — estático)

Este repo se publica como **sitio estático de un solo archivo**: `index.html`.
No necesita build ni backend. Vercel sirve `index.html` en la raíz automáticamente.

## Qué se despliega

- **`index.html`** ← esto es lo que ve la gente. Es el build offline + un parche que
  **desactiva el panel de "Cuentas y Contraseñas"** (no se muestra ni se guardan claves).
- `limablue-marketing-offline (4).html` — build original (respaldo, no se usa en producción).
- `limablue-marketing (3).jsx` — código fuente (respaldo).
- `COMO_SUBIR (4).md` — guía anterior de subida a GitHub.

## Limitaciones importantes (leer antes de publicar)

1. **No hay login real.** Cualquiera que abra la URL puede elegir "Gerente" y ver todo.
   No pongas la URL en sitios públicos ni la indexes. Compártela solo con tu equipo.
2. **Los datos son locales por navegador** (`localStorage`). NO se comparten entre
   personas ni dispositivos. Cada quien ve su propia copia. Esto es un tablero
   individual, no colaborativo. (Para datos compartidos se necesita la Opción B: backend.)
3. Por eso se removió el panel de credenciales: no debe haber contraseñas en un
   estático público.

## Paso 1 — Subir a GitHub

En una terminal, dentro de `C:\Mrk APP`:

```bash
git init
git add .
git commit -m "Deploy estatico Limablue Marketing"
git branch -M main
git remote add origin https://github.com/jm7u7/LIMABLUE-MARKETING.git
git push -u origin main
```

Si el repo ya tenía commits y da error al hacer push:

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

> GitHub pedirá tu usuario y un **token** (no la contraseña). Generar en:
> https://github.com/settings/tokens → "Generate new token (classic)" → marca `repo`.
>
> Recomendado: haz el repositorio **privado** (Settings → Danger Zone → Change visibility).

## Paso 2 — Conectar con Vercel

1. Entra a https://vercel.com y regístrate con tu cuenta de GitHub.
2. "Add New..." → "Project" → importa el repo `LIMABLUE-MARKETING`.
3. En la configuración del proyecto:
   - **Framework Preset:** `Other`
   - **Build Command:** (déjalo vacío)
   - **Output Directory:** (déjalo vacío / raíz)
4. "Deploy". En ~1 minuto tendrás una URL tipo `https://limablue-marketing.vercel.app`.

Cada vez que hagas `git push`, Vercel vuelve a desplegar solo.

## Paso 3 — Actualizar en el futuro

```bash
git add .
git commit -m "Cambios"
git push
```

## Si más adelante quieres datos compartidos y login real

Eso es la **Opción B**: convertir el `.jsx` a un proyecto Vite + un backend
(Vercel KV / Supabase) que reemplace `window.storage`, con autenticación por
contraseña o Google. Pídelo cuando estés listo.
