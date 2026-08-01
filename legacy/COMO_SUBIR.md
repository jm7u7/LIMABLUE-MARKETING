# Cómo subir esto a github.com/jm7u7/LIMABLUE-MARKETING

## Opción simple (sin terminal)
1. Entra a https://github.com/jm7u7/LIMABLUE-MARKETING
2. Botón "Add file" → "Upload files"
3. Arrastra limablue-marketing.jsx y limablue-marketing-offline.html
4. Escribe un mensaje como "Actualización" y clic en "Commit changes"

## Opción con terminal
Dentro de la carpeta con estos archivos:
```bash
git init
git add .
git commit -m "Actualización Limablue Marketing"
git remote add origin https://github.com/jm7u7/LIMABLUE-MARKETING.git
git branch -M main
git pull origin main --allow-unrelated-histories
git push -u origin main
```
Te pedirá usuario + un TOKEN de acceso personal (no tu contraseña normal) como contraseña.
Generar token: https://github.com/settings/tokens → "Generate new token (classic)" → marca "repo" → "Generate token".

## Recordatorio
Esto es solo el respaldo del código. Para usarlo con tu equipo (datos compartidos), publica el .jsx desde Claude — no desde GitHub.
