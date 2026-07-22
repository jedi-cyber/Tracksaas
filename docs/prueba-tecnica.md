# TrackSaaS - Documentación de Prueba Técnica

## Resumen

TrackSaaS es un sistema web para gestionar licencias de software. El backend permite controlar productos, variantes, proveedores, clientes, lotes de compra, licencias individuales, activaciones, reservas, vencimientos, dashboard, alertas y auditoría.

El sistema usa una base de datos PostgreSQL propia. No depende de una base Odoo ni usa claves foráneas hacia Odoo. Solo adopta algunas convenciones de diseño inspiradas en Odoo, como:

- `name`
- `active`
- `create_uid`
- `write_uid`
- `create_date`
- `write_date`

## Tecnologías

- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Autenticación: JWT
- Seguridad de licencias: cifrado simétrico AES-256-GCM y hash SHA-256
- Tests: `node:test`
- Frontend previsto: React + Vite
- Despliegue previsto: Docker y docker-compose

## Estructura Relevante

```text
backend/
  src/
    app.js
    server.js
    config/
    controllers/
    middlewares/
    routes/
    services/
    utils/
  test/
    backend.test.js

database/
  schema.sql
  seed.sql

docs/
  api.md
  prueba-tecnica.md
```

## Base de Datos

El esquema define las siguientes entidades:

- `roles`
- `users`
- `providers`
- `products`
- `product_variants`
- `customers`
- `license_batches`
- `license_units`
- `license_activations`
- `audit_logs`

También define vistas para dashboard:

- `vw_license_alerts`
- `vw_financial_dashboard`

## Datos Semilla

`database/seed.sql` crea:

- Roles:
  - `administrator`
  - `license_user`
  - `viewer`
- Usuario administrador:
  - Email: `admin@tracksaas.local`
  - Password temporal: `Admin123*`
- Proveedores de ejemplo.
- Productos y variantes iniciales.

## Variables de Entorno

Ejemplo en `backend/.env.example`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=tracksaas_db
DB_USER=postgres
DB_PASSWORD=change_me

JWT_SECRET=change_this_development_secret
JWT_EXPIRES_IN=8h

LICENSE_ENCRYPTION_KEY=change_this_license_encryption_key

CORS_ORIGIN=http://localhost:5173
JSON_BODY_LIMIT=100kb
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=5
```

`JWT_SECRET` y `LICENSE_ENCRYPTION_KEY` deben generarse como cadenas aleatorias largas y no deben subirse al repositorio.

En producción, el backend valida que ambas claves existan, no sean placeholders, tengan al menos 32 caracteres y sean diferentes.

Ejemplo para generar una clave:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Funcionalidades Implementadas en Backend

### Autenticación

- Login con JWT.
- Endpoint de usuario autenticado.
- Validación de token en rutas protegidas.

Endpoints:

```http
POST /api/auth/login
GET  /api/auth/me
```

### CRUD

Implementado para:

- Roles
- Usuarios
- Proveedores
- Clientes
- Productos
- Variantes
- Lotes
- Licencias

Todos los CRUD están protegidos por JWT y permisos por rol.

### Permisos por Rol

Roles implementados:

- `administrator`
- `license_user`
- `viewer`

Resumen:

- `administrator`: acceso completo.
- `license_user`: operación de licencias, lotes, clientes, activaciones, reservas y expiración.
- `viewer`: lectura operativa y dashboard.

### Identificadores de Licencia

El sistema diferencia dos códigos:

- `commercial_identifier`: ID comercial público. Identifica familia, producto, contrato, SKU o canal comercial como OEM o Retail/FPP. Es multiproveedor y puede adaptarse a Windows, Kaspersky, ESET u otros productos. Puede mostrarse en operación porque no activa el producto.
- `license_code`: clave única de activación. Su formato depende del fabricante, no del canal OEM/Retail. Acepta formatos como ESET 20 caracteres en bloques de 4, Microsoft 25 caracteres en bloques de 5, Kaspersky 20 caracteres corridos y Adobe antiguo 24 números en bloques de 4. Es confidencial, activa un puesto/equipo y no debe compartirse.
- `validity_start_mode`: define el tipo comercial de vigencia.
- `purchase_date`: compra online/oficial. La vigencia corre desde compra/facturación aunque todavía no se haya instalado o activado en un equipo.
- `first_activation`: física/distribuidor. La vigencia corre desde la primera activación y conserva el periodo completo hasta ese momento.
- Para `purchase_date`, `start_date` representa la fecha de compra/facturación y `next_renewal_date` se calcula inmediatamente.
- Para `first_activation`, `start_date` y `next_renewal_date` pueden quedar vacías hasta la activación.
- `redeem_deadline_date` permite registrar el límite de canje antes de la primera activación.
- `cost` representa el costo de adquisición de la licencia; `sale_price` representa el precio de venta usado para ingresos y margen estimado.
- No se crea un estado adicional para canje. Se usan los estados existentes:
- `available` + `first_activation` + `start_date` vacía indica una licencia disponible para activar.
- `available` + `purchase_date` + `start_date` definida indica una licencia disponible, pero con vigencia ya corriendo.
- `expired` cubre vencimiento por `next_renewal_date` o expiración manual confirmada por soporte.
- La reserva y activación se bloquean si la licencia ya está vencida por renovación o si superó el límite de canje.
- El límite de canje de licencias físicas no se marca automáticamente como `expired`; debe confirmarlo soporte cuando el proveedor rechaza la clave.
- Si una licencia física/distribuidor no tiene fecha cierta de baja y el proveedor rechaza la activación, soporte puede marcarla manualmente como `expired`.
- El backend prioriza la activación de licencias antiguas o en riesgo:
- Para licencias online/oficiales, ordena por `next_renewal_date`.
- Para licencias físicas/distribuidor, ordena por `redeem_deadline_date`.
- Si no hay fecha crítica, usa la fecha de compra del lote como respaldo.
- La clave única se cifra en `license_code_encrypted`.
- La clave única se hashea en `license_code_hash` para evitar duplicados.
- La clave única se expone solo como `masked_code` en respuestas.
- El estado de disponibilidad se consulta con `status`: disponible, reservada, activada, vencida o cancelada.

El backend no devuelve la clave única real ni la clave cifrada.

### Regla de Cantidad de Lote

Si un lote tiene:

```text
quantity = 20
```

el backend impide crear una licencia número 21 para ese lote.

La validación se ejecuta dentro de una transacción y bloquea el lote con `FOR UPDATE`, para evitar sobreasignación por solicitudes concurrentes.

### Activación de Licencias

La activación no se hace por `PUT`. Tiene endpoint dedicado:

```http
POST /api/licenses/:id/activate
```

Reglas:

- Solo se activan licencias `available` o `reserved`.
- Una licencia solo puede activarse una vez.
- Para `first_activation`, la fecha actual se guarda como `start_date` y la renovación se calcula desde esa fecha.
- Para `purchase_date`, la activación no modifica `start_date` ni `next_renewal_date`; solo registra el equipo/cliente.
- Se crea registro en `license_activations`.
- Se actualiza `license_units.status = 'activated'`.
- Se registra auditoría.

### Reserva de Licencias

Endpoints:

```http
POST /api/licenses/:id/reserve
POST /api/licenses/:id/release-reservation
```

Reglas:

- Solo se reservan licencias `available`.
- Solo se liberan licencias `reserved`.
- Se registra auditoría.

### Cancelación sin Pérdida de Datos

Para lotes y licencias, `DELETE` no desactiva el registro.

Comportamiento:

```text
status = cancelled
active = true
```

Esto conserva visibilidad y trazabilidad.

### Expiración Manual

Endpoint:

```http
POST /api/licenses/expire-overdue
```

Reglas:

- Marca como `expired` licencias de compra/facturación con `next_renewal_date < CURRENT_DATE`.
- Aplica a estados `available`, `reserved` y `activated`.
- Guarda `expiration_date`.
- Registra auditoría por licencia afectada.

### Dashboard y Alertas

Endpoints:

```http
GET /api/dashboard/overview
GET /api/dashboard/financial
GET /api/dashboard/status-summary
GET /api/dashboard/inventory-summary
GET /api/dashboard/alert-summary
GET /api/dashboard/alerts
GET /api/dashboard/renewals
```

Indicadores comerciales:

- Ingresos por licencias activadas.
- Costo de licencias vendidas.
- Margen estimado.
- Valor del inventario disponible.
- Costo mensual equivalente.
- Proyección anual de costos.

Alertas:

- Verde: más de 30 días.
- Amarillo: 30 días o menos.
- Rojo: vencida.
- Licencias con vigencia corriendo: alerta por `next_renewal_date`.
- Licencias no activadas con límite de canje: alerta por `redeem_deadline_date`.
- La API expone `alert_date` y `alert_reason` para distinguir renovación de límite de canje.

### Activaciones Consultables

Endpoints de lectura:

```http
GET /api/activations
GET /api/activations/:id
GET /api/activations/by-license/:licenseUnitId
```

Las activaciones no se crean desde `/api/activations`; se crean desde el endpoint de activación de licencia.

### Auditoría

Endpoints de lectura:

```http
GET /api/audit-logs
GET /api/audit-logs/:id
```

Se registran eventos importantes:

- Creación.
- Actualización.
- Cancelación.
- Activación.
- Reserva.
- Liberación de reserva.
- Expiración.

## Validaciones Implementadas

El backend valida:

- Campos obligatorios.
- IDs positivos.
- Fechas reales en formato `YYYY-MM-DD`.
- Orden de fechas.
- Montos no negativos.
- Cantidades positivas.
- Estados permitidos.
- Ciclos de facturación permitidos.
- Monedas ISO de 3 letras.
- Emails válidos.
- Booleanos reales.
- Permisos por rol.

## Tests Automatizados

Se agregó una suite con `node:test`.

Archivo:

```text
backend/test/backend.test.js
```

Ejecutar:

```bash
cd backend
npm test
```

Casos cubiertos:

- Login JWT.
- Perfil autenticado.
- CRUD básico.
- Activación única.
- Cifrado, hash y enmascarado.
- Dashboard.
- Permisos por rol.

Resultado esperado:

```text
tests 6
pass 6
fail 0
```

Los tests usan datos con prefijo `TEST-AUTO-*` y limpian la base al finalizar.

## Cómo Ejecutar el Backend

1. Crear base de datos PostgreSQL:

```text
tracksaas_db
```

2. Ejecutar scripts:

```bash
psql -d tracksaas_db -f database/schema.sql
psql -d tracksaas_db -f database/seed.sql
```

3. Configurar variables:

```bash
cp backend/.env.example backend/.env
```

4. Instalar dependencias:

```bash
cd backend
npm install
```

5. Ejecutar:

```bash
npm run dev
```

o:

```bash
npm start
```

## Alcance Actual

Incluido:

- Backend REST completo para las entidades principales.
- Seguridad JWT.
- Permisos por rol.
- Cifrado de códigos.
- Auditoría.
- Dashboard.
- Alertas.
- Activación, reserva, cancelación y expiración.
- Tests backend.
- Documentación API.
- Docker Compose general con PostgreSQL, backend y frontend.
- Frontend React integrado con login, dashboard y módulos operativos.
- Seguridad adicional: rate limit, CORS por entorno, límite JSON y validación de secretos.

Pendiente o siguiente etapa:

- Swagger/OpenAPI formal.
- Scheduler automático para expiración, si se requiere.

## Notas de Diseño

La activación, reserva y expiración se implementan como operaciones dedicadas porque tienen reglas de negocio y efectos secundarios. No deben tratarse como simples cambios manuales de estado vía `PUT`.

El diseño evita pérdida de datos usando:

- Estados de negocio (`cancelled`, `expired`).
- Auditoría.
- Cifrado del código real.
- Enmascarado para la interfaz.
- Baja lógica solo donde corresponde.

## Seguridad Adicional

El backend incluye:

- Rate limit en `POST /api/auth/login`.
- CORS configurable por `.env`.
- Límite de tamaño JSON configurable.
- Ocultamiento de errores internos cuando `NODE_ENV=production`.
- Validación de `JWT_SECRET` y `LICENSE_ENCRYPTION_KEY` en producción.
