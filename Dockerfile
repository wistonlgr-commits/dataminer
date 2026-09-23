FROM node:20-bookworm

# Instalar Python 3 y dependencias del sistema requeridas por Playwright
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# ---- CONFIGURAR BACKEND PYTHON ----
COPY backend/ /app/backend/
WORKDIR /app/backend
# Crear entorno virtual con pip incluido
RUN python3 -m venv --system-site-packages venv
ENV PATH="/app/backend/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt
# Instalar binarios de chromium
RUN playwright install chromium

# ---- CONFIGURAR FRONTEND NEXT.JS ----
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# Exponer el puerto de Next.js
EXPOSE 3000

# Asegurar que las carpetas de datos existan y tengan permisos
WORKDIR /app
RUN mkdir -p /app/backend/.jobs /app/resultados && chmod -R 777 /app/backend/.jobs /app/resultados

# Iniciar la aplicación
WORKDIR /app/dashboard
CMD ["npm", "start"]
