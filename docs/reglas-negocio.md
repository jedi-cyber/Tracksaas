# Reglas de negocio

## Inventario y lotes

- Solo los lotes `confirmed` permiten registrar licencias.
- La cantidad registrada no puede superar `license_batches.quantity`.
- Un lote cancelado conserva sus datos para auditoría.
- Variantes y proveedores deben existir y estar relacionados correctamente.

## Licencias

Estados permitidos:

- `available`: disponible para reservar o activar.
- `reserved`: reservada para una operación o cliente.
- `activated`: activación registrada.
- `expired`: vencida o marcada como expirada.
- `cancelled`: cancelada y conservada históricamente.

Reglas principales:

- `responsible_user_id` es el custodio inicial.
- El código real se cifra; la API entrega `masked_code`.
- `commercial_identifier` es público y no activa el software.
- Un estado `activated` solo se obtiene mediante el endpoint de activación.
- El borrado de una licencia cambia `status` a `cancelled` y no elimina físicamente la fila.

## Vigencia

### Compra online/oficial

Con `validity_start_mode = purchase_date`, `start_date` es obligatoria y representa la compra/facturación. `next_renewal_date` se calcula como:

```text
start_date + duration_days de la variante
```

Si la variante no define duración, se usan 30 días para mensual y 365 para anual.

### Física/distribuidor

Con `validity_start_mode = first_activation`, la licencia puede crearse sin `start_date` ni renovación. La activación asigna la fecha actual y calcula la renovación.

`redeem_deadline_date` controla la ventana de canje, pero no cambia automáticamente el estado a `expired`.

## Reservas y activaciones

- Solo se reserva una licencia `available`.
- Liberar una reserva devuelve el estado a `available`.
- Solo se activan licencias `available` o `reserved`.
- Una licencia solo puede tener una activación.
- El usuario activador se toma del JWT, nunca del body del formulario.
- La activación crea `license_activations` y auditoría.

## Expiración

`POST /licenses/expire-overdue` marca `expired` las licencias activas con `next_renewal_date < CURRENT_DATE`. Aplica a `available`, `reserved` y `activated` y registra auditoría.

## Auditoría

Las operaciones sensibles registran entidad, ID, acción, usuario, fecha, IP y cambios anteriores/nuevos. La interfaz expone la auditoría en modo lectura.

## Semáforo

- `green`: más de 30 días.
- `yellow`: 30 días o menos.
- `red`: fecha vencida o licencia `expired`.

La fecha crítica prioriza renovación para vigencia en curso y límite de canje para licencias físicas aún no activadas.
