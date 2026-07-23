# TrackSaaS - Docker

Guía para levantar TrackSaaS con Docker Compose.

## Servicios

El proyecto usa un `docker-compose.yml` general en la raíz con tres servicios:

```text
postgres
backend
frontend
```

No se usa un único contenedor para todo el sistema. Cada componente corre separado para mantener responsabilidades claras:

- PostgreSQL mantiene su propio volumen persistente.
- Backend se conecta a PostgreSQL por red interna de Docker.
- Backend no se publica al host; queda disponible solo para otros contenedores.
- Frontend se expone en el puerto de Vite y es la única URL que deben usar los usuarios.

## Puertos

```text
PostgreSQL: 5432
Backend:    3000 interno, no publicado al host
Frontend:   5173
```

URLs:

```text
Frontend: http://localhost:5173
```

Para usuarios finales, la URL de trabajo es:

```text
http://localhost:5173
```

El frontend consume la API mediante `/api`. En Docker, Vite proxyea esas solicitudes hacia `http://backend:3000`, por lo que el usuario no necesita navegar manualmente al backend.

Desde el navegador no se debe abrir `http://localhost:3000`, porque el backend no está expuesto fuera de Docker. Para revisar la API, usar el contenedor:

```bash
docker compose exec backend wget -qO- http://localhost:3000/api/health
docker compose exec backend wget -qO- http://localhost:3000/api/health/db
```

## Archivos Usados

```text
docker-compose.yml
backend/Dockerfile
backend/.dockerignore
frontend/Dockerfile
frontend/.dockerignore
database/schema.sql
database/seed.sql
```

## Inicialización de PostgreSQL

El servicio `postgres` monta:

```text
database/schema.sql -> /docker-entrypoint-initdb.d/01-schema.sql
database/seed.sql   -> /docker-entrypoint-initdb.d/02-seed.sql
```

PostgreSQL ejecuta esos archivos automáticamente solo cuando el volumen se crea por primera vez.

Si el volumen `postgres_data` ya existe, los scripts no vuelven a ejecutarse.

## Levantar el Proyecto

Desde la raíz del proyecto:

```bash
docker compose up --build
```

En segundo plano:

```bash
docker compose up --build -d
```

Ver estado:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f
```

Logs de un servicio específico:

```bash
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f frontend
```

## Detener el Proyecto

```bash
docker compose down
```

Esto detiene contenedores, pero conserva el volumen de PostgreSQL.

## Reiniciar Base de Datos desde Cero

Para borrar el volumen y volver a ejecutar `schema.sql` y `seed.sql`:

```bash
docker compose down -v
docker compose up --build
```

Usar `-v` elimina los datos persistidos de PostgreSQL.

## Variables de Entorno

El `docker-compose.yml` define variables para desarrollo:

```env
NODE_ENV=development
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=tracksaas_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=dev_jwt_secret_replace_for_production_64_chars_minimum
JWT_EXPIRES_IN=8h
LICENSE_ENCRYPTION_KEY=dev_license_secret_replace_for_production_64_chars_minimum
CORS_ORIGIN=http://localhost:5173
JSON_BODY_LIMIT=100kb
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=5
```

Para producción, reemplazar obligatoriamente:

```env
JWT_SECRET
LICENSE_ENCRYPTION_KEY
DB_PASSWORD
```

`JWT_SECRET` y `LICENSE_ENCRYPTION_KEY` deben:

- Ser claves reales, no placeholders.
- Tener al menos 32 caracteres.
- Ser diferentes entre sí.
- No subirse a Git.

Generar clave:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Credenciales Semilla

El seed crea:

```text
Email:    admin@tracksaas.local
Password: Admin123*
```

Estas credenciales son solo para desarrollo/prueba.

## Comandos Útiles

Entrar al contenedor backend:

```bash
docker compose exec backend sh
```

Entrar a PostgreSQL:

```bash
docker compose exec postgres psql -U postgres -d tracksaas_db
```

Reconstruir solo backend:

```bash
docker compose build backend
docker compose up -d backend
```

Reconstruir solo frontend:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Notas Técnicas

- `depends_on` espera a que PostgreSQL pase el `healthcheck` antes de iniciar backend.
- El backend usa `DB_HOST=postgres`, que es el nombre del servicio dentro de la red Docker.
- El frontend usa `VITE_API_URL=/api`.
- Vite usa `VITE_API_PROXY_TARGET=http://backend:3000` para reenviar las llamadas al backend dentro de Docker.
- El frontend corre en modo desarrollo con Vite y `--host 0.0.0.0`.
- PostgreSQL conserva datos en el volumen `postgres_data`.

## Problemas Comunes

### Los cambios de schema.sql no aparecen

Los scripts de `/docker-entrypoint-initdb.d/` solo corren al crear el volumen.

Solución:

```bash
docker compose down -v
docker compose up --build
```

### Backend no conecta a PostgreSQL

Revisar:

```bash
docker compose ps
docker compose logs postgres
docker compose logs backend
```

Confirmar que `DB_HOST=postgres`.

### Puerto 3000 ocupado

El backend no publica el puerto `3000` al host. Si aparece un error con `0.0.0.0:3000`, confirmar que `docker-compose.yml` tenga:

```yaml
expose:
  - "3000"
```

No debe tener:

```yaml
ports:
  - "3000:3000"
```

### Puerto 5173 ocupado

Si el frontend no inicia porque `5173` está ocupado, detener el Vite local que esté corriendo o cambiar temporalmente el puerto publicado:

```yaml
ports:
  - "5174:5173"
```

En ese caso la URL sería `http://localhost:5174`.
