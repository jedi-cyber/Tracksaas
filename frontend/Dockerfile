# ── Stage 1: instalar dependencias ────────────────────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ── Stage 2: compilar el bundle de producción ─────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Reutiliza node_modules de la etapa anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables necesarias en build-time para que Vite las incruste en el bundle
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ── Stage 3: servidor estático de producción (Nginx) ──────────────────────────
FROM nginx:1.27-alpine AS runner

# Elimina la configuración por defecto de Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Configuración personalizada: sirve el bundle y redirige /api al backend
COPY nginx.conf /etc/nginx/conf.d/tracksaas.conf

# Copia el bundle compilado
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
