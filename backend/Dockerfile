# ── Stage 1: instalar dependencias de producción ──────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./
# Instala solo dependencias de producción (excluye devDependencies)
RUN npm ci --omit=dev

# ── Stage 2: imagen final mínima ───────────────────────────────────────────────
FROM node:24-alpine AS runner

# Crea usuario sin privilegios para ejecutar la app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copia solo las dependencias de producción ya instaladas
COPY --from=deps /app/node_modules ./node_modules

# Copia el código fuente (sin tests ni archivos de desarrollo)
COPY src ./src
COPY package.json ./

# Cambia la propiedad al usuario sin privilegios
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "src/server.js"]
