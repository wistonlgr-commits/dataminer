# ScrapeFlow 🚀

Un sistema de extracción masiva y automatizada de datos de Google Maps, diseñado con una arquitectura anti-detección y un panel de control en Next.js.

## Arquitectura
* **Frontend:** Next.js 15 (App Router), TailwindCSS, Lucide Icons.
* **Backend:** Python 3.11, Playwright Async, Pandas, OpenPyXL, playwright-stealth.
* **Comunicación:** La API de Next.js spawnea procesos secundarios de Python (`child_process.spawn`), los cuales escriben a `stdout` su progreso, el cual es parseado y guardado en archivos `.json` temporales en `backend/.jobs/`.

## Medidas Anti-Bloqueo
* Viewports y User-Agents aleatorios.
* Retrasos aleatorios humanizados (`human_delay`).
* Scroll errático (no lineal).
* Rotación de identidad (nuevo contexto de navegador cada 15-20 negocios).
* Detección automática de CAPTCHAs y reintentos automáticos tras pausas de 60s.

## Despliegue en Servidor (Coolify / Docker)

Este proyecto está optimizado para correr en un VPS usando Coolify y Docker Compose.
El contenedor instala Node.js, Python 3.11 y los binarios de Playwright Chromium en un solo entorno unificado, ya que Next.js necesita llamar a Python mediante subprocesos.

### Instrucciones para Coolify:
1. Crea un nuevo **Docker Compose** resource en Coolify.
2. Vincula este repositorio de GitHub.
3. El archivo `docker-compose.yml` construirá la imagen desde el `Dockerfile`.
4. El puerto expuesto es el `3000`.

### Desarrollo Local
1. Ve a `backend/`, crea el entorno virtual: `python -m venv venv`
2. Instala dependencias: `venv\Scripts\pip install -r requirements.txt` (y `playwright-stealth`)
3. Instala navegadores: `venv\Scripts\playwright install chromium`
4. Ve a `dashboard/` e instala paquetes: `npm install`
5. Ejecuta: `npm run dev`
