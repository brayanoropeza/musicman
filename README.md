# AtrilVivo — Teleprompter Karaoke para Músicos

Atril digital y teleprompter karaoke pensado para cantar y tocar tu instrumento al mismo tiempo, sin tener que hacer scroll manual.

## Cómo publicarlo en GitHub Pages (y quitar "Cargando AtrilVivo...")

Si cambiaste **Source** a **GitHub Actions** y la página sigue mostrando *"Cargando AtrilVivo..."* o *"Last deployed ... by pages build and deployment"*, es porque **aún no se ha ejecutado el workflow de compilación**:

1. Verifica que exista el archivo `.github/workflows/deploy.yml` en tu repositorio de GitHub:
   - Si subiste los archivos arrastrándolos en la web de GitHub, GitHub suele omitir la carpeta oculta `.github`.
   - Para solucionarlo rápido: en **Settings → Pages → Source: GitHub Actions**, haz clic en **"create your own"** (o entra a la pestaña **Actions → New workflow → set up a workflow yourself**), nómbralo `deploy.yml` y pega el contenido de `.github/workflows/deploy.yml`.
2. Si el archivo `.github/workflows/deploy.yml` ya está en tu repositorio, ve a la pestaña **Actions → Publicar AtrilVivo en GitHub Pages → Run workflow** (o haz un nuevo commit/push a `main`).
3. Cuando termine el círculo verde en **Actions**, recarga tu URL de GitHub Pages (`Ctrl + F5` / recarga forzada) y ya cargará la aplicación compilada con el botón **Empezar (Activar Micrófono)**.

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
