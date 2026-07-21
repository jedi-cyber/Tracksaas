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
- Frontend se expone en el puerto de Vite.

## Puertos

```text
PostgreSQL: 5432
Backend:    3000
Frontend:   5173
```

URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3000/api
Health:   http://localhost:3000/api/health
DB check: http://localhost:3000/api/health/db
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

Ejecutar tests backend dentro del contenedor:

```bash
docker compose exec backend npm test
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
- El frontend usa `VITE_API_URL=http://localhost:3000/api`.
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

### Puerto ocupado

Si algún puerto está en uso, cambiar el mapeo en `docker-compose.yml`.

Ejemplo:

```yaml
ports:
  - "3001:3000"
```
