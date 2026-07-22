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

`POST /auth/login` tiene rate limit configurable por `.env`.

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
  "commercial_identifier": "OEM-WIN11-PRO-001",
  "license_code": "12345-67890-ABCDE-FGHIJ-KLMNO",
  "validity_start_mode": "purchase_date",
  "status": "available",
  "start_date": "2026-07-21",
  "redeem_deadline_date": null,
  "cost": 10,
  "billing_cycle": "annual",
  "currency_code": "PEN",
  "notes": "Licencia individual"
}
```

Reglas:

- `responsible_user_id` representa el custodio inicial de la licencia en inventario, no el usuario que la activa.
- `commercial_identifier` es el ID comercial público. Puede representar OEM, Retail/FPP, contrato, SKU o identificador público del proveedor. Es visible y no activa el software.
- `license_code` es la clave única de activación. Su formato depende del fabricante, no del canal OEM/Retail. Se aceptan formatos como ESET `ABCD-EFGH-IJKL-MNOP-QRST`, Microsoft `12345-67890-ABCDE-FGHIJ-KLMNO`, Kaspersky `ABCDE12345FGHIJ67890` y Adobe antiguo `1111-2222-3333-4444-5555-6666`. Se cifra antes de almacenarse y no debe compartirse.
- `validity_start_mode` define el tipo comercial de vigencia.
- `purchase_date`: compra online/oficial. La vigencia corre desde compra/facturación; si se activa después, queda menos tiempo de uso.
- `first_activation`: física/distribuidor. La vigencia corre desde la primera activación; el periodo completo empieza al activarla.
- Para `purchase_date`, `start_date` es la fecha de compra/facturación y es obligatoria al crear la licencia. `next_renewal_date` se calcula desde esa fecha.
- Para `first_activation`, `start_date` y `next_renewal_date` pueden quedar nulos al crear la licencia; ambos se calculan automáticamente al activar.
- `redeem_deadline_date` es opcional y controla hasta cuándo puede canjearse una licencia antes de la primera activación.
- Las respuestas devuelven `masked_code`, no el código real.
- La disponibilidad se determina por `status`: `available`, `reserved`, `activated`, `expired` o `cancelled`.
- No se agrega un estado de canje. Las reglas se aplican sobre los estados existentes:
- `available` + `first_activation` + `start_date = null`: disponible para activar.
- `available` + `purchase_date` + `start_date` definida: disponible, pero su vigencia ya está corriendo.
- `expired`: vencida por `next_renewal_date` o por `redeem_deadline_date`.
- El backend bloquea reserva/activación si la licencia ya venció por renovación o por límite de canje, aunque todavía no se haya ejecutado el endpoint de expiración.
- Para licencias físicas/distribuidor sin fecha cierta de baja por proveedor, soporte puede marcar manualmente la licencia como `expired` si el proveedor rechaza la activación.
- El listado de licencias prioriza activación por fecha crítica más antigua:
- Online/oficial: usa `next_renewal_date`, porque la vigencia ya corre desde compra/facturación.
- Físicas/distribuidor: usa `redeem_deadline_date`, porque el riesgo es perder la ventana de canje.
- Si no existe fecha crítica, usa la fecha de compra del lote como desempate para que salgan primero las licencias más antiguas.
- Las respuestas incluyen `activation_priority_date` y `activation_priority_reason`.
- `next_renewal_date` lo calcula el backend con `start_date + product_variants.duration_days`.
- Si la variante no tiene `duration_days`, se usa 30 días para ciclo mensual y 365 para ciclo anual.
- Solo se pueden crear, reservar o activar licencias de lotes `confirmed`.
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
- Si `validity_start_mode = first_activation`, el backend toma la fecha actual como `start_date` y calcula `next_renewal_date` desde esa fecha.
- Si `validity_start_mode = purchase_date`, el backend no modifica `start_date` ni `next_renewal_date`; solo registra la activación del equipo/cliente.
- El usuario activador se toma del JWT y se guarda en `license_activations.activated_by`; no se envía desde el formulario.
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

Reglas de alerta:

- Licencias con vigencia corriendo alertan por `next_renewal_date`.
- Licencias no activadas con límite de canje alertan por `redeem_deadline_date`.
- La respuesta incluye `alert_date` como fecha crítica calculada.
- La respuesta incluye `alert_reason`: `vigencia_en_curso` o `limite_de_canje`.

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
- La fecha de renovación se calcula automáticamente y debe ser mayor o igual que `start_date`.
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

```json
{
  "message": "Demasiados intentos de inicio de sesión. Intente nuevamente más tarde"
}
```
