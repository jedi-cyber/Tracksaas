# TrackSaaS API Backend

Referencia de endpoints REST del backend TrackSaaS.

## Base URL

```text
http://localhost:3000/api
```

## Autenticación

El backend usa JWT por encabezado `Authorization`.

```http
Authorization: Bearer <token>
```

### Login

```http
POST /auth/login
```

Body:

```json
{
  "email": "admin@tracksaas.local",
  "password": "Admin123*"
}
```

Respuesta:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "name": "Administrador TrackSaaS",
    "email": "admin@tracksaas.local",
    "role": {
      "id": 1,
      "name": "administrator"
    }
  }
}
```

### Usuario autenticado

```http
GET /auth/me
```

## Permisos

| Recurso | administrator | license_user | viewer |
|---|---:|---:|---:|
| Activaciones | leer | leer | leer |
| Auditoría | leer | sin acceso | sin acceso |
| Roles | CRUD | leer | sin acceso |
| Usuarios | CRUD | leer | sin acceso |
| Proveedores | CRUD | leer | leer |
| Clientes | CRUD | crear/leer/editar | leer |
| Productos | CRUD | leer | leer |
| Variantes | CRUD | leer | leer |
| Lotes | CRUD | crear/leer/editar | leer |
| Licencias | CRUD + activar + reservar + expirar | crear/leer/editar + activar + reservar + expirar | leer |
| Dashboard | leer | leer | leer |

## Convenciones

Los listados usan paginación:

```http
GET /resource?page=1&limit=20
```

Formato:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Los `DELETE` son lógicos. En recursos con estado de negocio `cancelled`, se marca `status = "cancelled"` sin desactivar el registro. En recursos sin estado `cancelled`, se usa `active = false`.

## Health

```http
GET /health
GET /health/db
```

## Roles

```http
GET    /roles
POST   /roles
GET    /roles/:id
PUT    /roles/:id
DELETE /roles/:id
```

Body:

```json
{
  "name": "license_user",
  "description": "Operador de licencias",
  "active": true
}
```

## Usuarios

```http
GET    /users
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
```

Body de creación:

```json
{
  "role_id": 2,
  "name": "Usuario Licencias",
  "email": "licencias@tracksaas.local",
  "password": "Password123*",
  "active": true
}
```

`password_hash` nunca se devuelve en respuestas.

## Proveedores

```http
GET    /providers
POST   /providers
GET    /providers/:id
PUT    /providers/:id
DELETE /providers/:id
```

Body:

```json
{
  "name": "Microsoft",
  "tax_id": "00000000000",
  "contact_name": "Ventas",
  "email": "ventas@example.com",
  "phone": "+51 999 999 999",
  "notes": "Proveedor de ejemplo",
  "active": true
}
```

## Clientes

```http
GET    /customers
POST   /customers
GET    /customers/:id
PUT    /customers/:id
DELETE /customers/:id
```

Body:

```json
{
  "name": "Cliente Final SAC",
  "tax_id": "20123456789",
  "email": "contacto@cliente.com",
  "phone": "+51 999 999 999",
  "notes": "Cliente de prueba",
  "active": true
}
```

## Productos

```http
GET    /products
POST   /products
GET    /products/:id
PUT    /products/:id
DELETE /products/:id
```

Body:

```json
{
  "name": "Microsoft 365",
  "description": "Suite de productividad",
  "active": true
}
```

## Variantes

```http
GET    /variants
POST   /variants
GET    /variants/:id
PUT    /variants/:id
DELETE /variants/:id
```

Filtros:

```http
GET /variants?productId=1&search=business
```

Body:

```json
{
  "product_id": 1,
  "name": "Microsoft 365 Business Basic",
  "default_code": "M365-BASIC",
  "billing_cycle": "monthly",
  "duration_days": 30,
  "default_cost": 20,
  "currency_code": "PEN",
  "active": true
}
```

## Lotes

```http
GET    /batches
POST   /batches
GET    /batches/:id
PUT    /batches/:id
DELETE /batches/:id
```

Filtros:

```http
GET /batches?status=confirmed&variantId=1&providerId=1
```

Body:

```json
{
  "variant_id": 1,
  "provider_id": 1,
  "batch_number": "LOT-2026-001",
  "purchase_date": "2026-07-21",
  "quantity": 20,
  "unit_cost": 10,
  "currency_code": "PEN",
  "status": "confirmed",
  "notes": "Compra inicial"
}
```

`DELETE /batches/:id` marca `status = "cancelled"` y mantiene `active = true`.

## Licencias

```http
GET    /licenses
POST   /licenses
GET    /licenses/:id
PUT    /licenses/:id
DELETE /licenses/:id
```

Filtros:

```http
GET /licenses?status=available&batchId=1&responsibleUserId=1
```

Body de creación:

```json
{
  "batch_id": 1,
  "responsible_user_id": 1,
  "name": "Licencia ESET 001",
  "license_code": "AAAA-BBBB-CCCC-DDDD",
  "status": "available",
  "start_date": "2026-07-21",
  "next_renewal_date": "2027-07-21",
  "cost": 10,
  "billing_cycle": "annual",
  "currency_code": "PEN",
  "notes": "Licencia individual"
}
```

Reglas:

- `license_code` se cifra antes de almacenarse.
- Las respuestas devuelven `masked_code`, no el código real.
- No se puede crear más licencias que `license_batches.quantity`.
- `DELETE /licenses/:id` marca `status = "cancelled"` y mantiene `active = true`.
- El estado `activated` no debe asignarse con `PUT`; se usa el endpoint dedicado.

### Activar Licencia

```http
POST /licenses/:id/activate
```

Body:

```json
{
  "customer_id": 1,
  "device_reference": "PC-VENTAS-01",
  "support_reference": "TICKET-2026-001",
  "notes": "Activación inicial"
}
```

Reglas:

- Solo se activan licencias `available` o `reserved`.
- Una licencia solo puede activarse una vez.
- La operación crea registro en `license_activations`.
- Registra auditoría.

### Reservar Licencia

```http
POST /licenses/:id/reserve
```

Body:

```json
{
  "responsible_user_id": 1,
  "notes": "Reservada para cliente"
}
```

Reglas:

- Solo se reservan licencias `available`.
- Cambia `status` a `reserved`.

### Liberar Reserva

```http
POST /licenses/:id/release-reservation
```

Body:

```json
{
  "notes": "Reserva liberada"
}
```

Reglas:

- Solo se liberan licencias `reserved`.
- Cambia `status` a `available`.

### Expirar Licencias Vencidas

```http
POST /licenses/expire-overdue
```

Reglas:

- Marca como `expired` licencias activas con `next_renewal_date < CURRENT_DATE`.
- Aplica a estados `available`, `reserved` y `activated`.
- Registra auditoría por licencia afectada.

## Activaciones

Endpoints de solo lectura. Las activaciones se crean desde `/licenses/:id/activate`.

```http
GET /activations
GET /activations/:id
GET /activations/by-license/:licenseUnitId
```

Filtros:

```http
GET /activations?licenseUnitId=1
GET /activations?customerId=1
GET /activations?activatedBy=1
GET /activations?dateFrom=2026-07-01&dateTo=2026-07-21
GET /activations?search=PC-VENTAS
```

## Dashboard

```http
GET /dashboard/overview
GET /dashboard/financial
GET /dashboard/status-summary
GET /dashboard/inventory-summary
GET /dashboard/alert-summary
GET /dashboard/alerts
GET /dashboard/renewals
```

Alertas:

```http
GET /dashboard/alerts?color=yellow&page=1&limit=20
GET /dashboard/alerts?status=activated
GET /dashboard/alerts?responsibleUserId=1
```

Renovaciones:

```http
GET /dashboard/renewals?days=30&limit=10
```

Colores:

- `green`: más de 30 días.
- `yellow`: 30 días o menos.
- `red`: vencida.

## Auditoría

Endpoints de solo lectura.

```http
GET /audit-logs
GET /audit-logs/:id
```

Filtros:

```http
GET /audit-logs?userId=1
GET /audit-logs?entityName=license_units
GET /audit-logs?entityName=license_units&entityId=10
GET /audit-logs?action=activate
GET /audit-logs?dateFrom=2026-07-01&dateTo=2026-07-21
GET /audit-logs?search=products
```

## Validaciones

El backend valida:

- Campos obligatorios.
- IDs como enteros positivos.
- Montos no negativos.
- Cantidades positivas.
- Fechas reales en formato `YYYY-MM-DD`.
- `next_renewal_date >= start_date`.
- Monedas ISO de tres letras en mayúsculas.
- Emails válidos.
- Estados permitidos.
- Permisos por rol.

## Errores Comunes

```json
{
  "message": "Token JWT requerido"
}
```

```json
{
  "message": "No tiene permisos para realizar esta acción"
}
```

```json
{
  "message": "El lote ya alcanzó la cantidad máxima de licencias"
}
```
