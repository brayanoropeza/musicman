# AtrilVivo — Teleprompter Karaoke para Músicos

Atril digital y teleprompter karaoke pensado para cantar y tocar tu instrumento al mismo tiempo, sin tener que hacer scroll manual.

## Por qué se veía en blanco si usaste "Deploy from a branch"

Este proyecto usa **React + TypeScript + Vite**. Si en GitHub Pages seleccionas **Source → Deploy from a branch (`main / (root)`)**, GitHub sirve el `index.html` sin compilar y el navegador no puede ejecutar archivos `.tsx`.

### Cómo publicarlo correctamente en GitHub Pages (automático)

1. Sube todo el proyecto (incluida la carpeta `.github/workflows/deploy.yml`) a tu repositorio en GitHub.
2. En GitHub, entra a **Settings → Pages**.
3. En **Build and deployment → Source**, cambia *Deploy from a branch* por **GitHub Actions**.
4. GitHub ejecutará automáticamente el flujo **Publicar AtrilVivo en GitHub Pages** (`npm ci && npm run build`) y publicará la versión compilada.

> **Importante sobre el micrófono y navegadores:**
> - Al pulsar **Empezar (Activar Micrófono)** en el escenario, el navegador pedirá el permiso real del micrófono (requiere `https://` como el de GitHub Pages o `localhost`).
> - En **Chrome / Edge / Safari** puedes usar **Palabras en Vivo** (reconocimiento de palabras) o **Voz DSP**.
> - En **Opera / Firefox** (que bloquean el servicio externo de dictado), se activa automáticamente **Voz DSP** usando el micrófono real para detectar cuándo cantas por encima del rasgueo de tu instrumento.

---

## Despliegue Full-Stack con IA (Render, Railway, Cloud Run o VPS)

Para habilitar la lectura de **PDFs escaneados como imagen** y el modo **IA Ruidoso** con Gemini:

1. Configura la variable de entorno `GEMINI_API_KEY` (consulta `.env.example`).
2. Ejecuta:
   ```bash
   npm install
   npm run build
   npm start
   ```
