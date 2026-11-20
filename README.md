# AtrilVivo — Teleprompter Karaoke para Músicos

Atril digital y teleprompter karaoke pensado para cantar y tocar tu instrumento al mismo tiempo, sin tener que hacer scroll manual.

## Funciones principales

- **Importar PDFs en el navegador o con IA**: Arrastra PDFs de LaCuerda, Ultimate Guitar o cancioneros personales. Funciona incluso en hosting estático (GitHub Pages) mediante lectura local de PDFs.
- **Tablaturas y letras con acordes**: Soporta texto copiado de cualquier aplicación con acordes encima de la letra, tablaturas ASCII (`e|---0---|`), o bloques combinados de notas + letra.
- **Conversión de escala vocal y cifrado**: Transporta de `-6` a `+6` semitonos (incluyendo trastes de tablatura y sugerencia automática de Capo), cambia entre **C D E** y **Do Re Mi**, y visualiza la **Guía de Escala** activa (notas y acordes del tono).
- **Seguimiento por micrófono con filtro de instrumento**: Separa las frecuencias graves del rasgueo/piano (`Web Audio API`) y avanza la letra automáticamente mientras cantas.

---

## Publicar en GitHub Pages (1 clic / automático)

El repositorio incluye el flujo automático `.github/workflows/deploy.yml` y rutas relativas configuradas en `vite.config.ts` (`base: './'`).

1. Sube este proyecto a tu repositorio en GitHub (rama `main` o `master`).
2. En GitHub, entra a **Settings → Pages**.
3. En **Build and deployment → Source**, elige **GitHub Actions**.
4. GitHub compilará `dist/` y publicará la página automáticamente en unos segundos (puedes relanzarlo en **Actions → Publicar AtrilVivo en GitHub Pages → Run workflow**).

> **Nota en GitHub Pages:** La lectura de PDFs con texto seleccionable, el pegado de tablaturas/letras, el combinador local, la transposición de escalas, el cambio de cifrado y el seguimiento de voz en vivo funcionan 100% en el navegador sin servidor adicional.

---

## Despliegue Full-Stack con IA (Render, Railway, Cloud Run o VPS)

Si además quieres habilitar la lectura de **PDFs escaneados como imagen** y el modo **Ambiente Ruidoso (IA)** usando Gemini:

1. Configura la variable de entorno `GEMINI_API_KEY` en tu plataforma (consulta `.env.example`).
2. Ejecuta:
   ```bash
   npm install
   npm run build
   npm start
   ```
3. El servidor Express (`server.ts`) sirve tanto los endpoints `/api/*` como la aplicación compilada en `dist/`.
