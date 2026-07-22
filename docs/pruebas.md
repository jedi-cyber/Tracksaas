# Pruebas y validación

## Prerrequisitos

- PostgreSQL disponible si se ejecutan pruebas locales.
- Dependencias instaladas en `backend/`.
- Variables `JWT_SECRET` y `LICENSE_ENCRYPTION_KEY` definidas para el proceso de test.
- Seed cargado para que existan usuarios y proveedores demo.

## Pruebas backend

Desde `backend/`:

```bash
npm install
npm test
```

El script ejecuta `node test/backend.test.js` con el runner nativo `node:test`. Las pruebas cubren autenticación, permisos, CRUD, paginación, reglas de licencias, reservas, activación, expiración, dashboard y auditoría.

Con Docker:

```bash
docker compose up --build -d
docker compose exec backend npm test
```

## Validación frontend

Desde `frontend/`:

```bash
npm install
npm run build
npm run lint
```

`npm run build` valida la compilación de producción. `npm run lint` puede mostrar diagnósticos React Hooks y configuración existentes en el estado actual del proyecto; deben tratarse separadamente de errores de compilación.

## Smoke test manual

1. Abrir `http://localhost:5173`.
2. Iniciar sesión con el usuario administrador demo.
3. Confirmar que carga el dashboard.
4. Abrir Licencias, Catálogo, Activaciones, Auditoría y Notificaciones.
5. Crear una entidad demo y comprobar su aparición en la tabla.
6. Abrir una ficha de licencia y verificar historial.
7. Reservar, liberar o activar una licencia disponible según el rol.
8. Revisar el cambio en Auditoría.
9. Verificar que una licencia vencida aparece en el semáforo rojo.

## Health checks

```bash
docker compose exec backend wget -qO- http://localhost:3000/api/health
docker compose exec backend wget -qO- http://localhost:3000/api/health/db
```

## Datos de prueba

El seed crea usuarios, roles, proveedores, productos, variantes, clientes, lotes y licencias en estados `available`, `reserved`, `activated`, `expired` y `cancelled`, por lo que permite verificar el flujo principal sin preparar datos manualmente.
