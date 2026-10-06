FROM node:20-bookworm

# ---- CONFIGURAR BACKEND PYTHON ----
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY backend/ /app/backend/
WORKDIR /app/backend
RUN python3 -m venv --system-site-packages venv
RUN pip install --no-cache-dir -r requirements.txt

# ---- CONFIGURAR FRONTEND NEXT.JS ----
COPY dashboard/ /app/dashboard/
WORKDIR /app/dashboard
RUN npm install
RUN npm run build

# ---- PREPARAR DIRECTORIOS COMPARTIDOS ----
WORKDIR /app
RUN mkdir -p /app/backend/.jobs /app/resultados && chmod -R 777 /app/backend/.jobs /app/resultados

# ---- INICIAR ----
WORKDIR /app/dashboard
CMD ["npm", "start"]
