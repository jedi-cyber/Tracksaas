import { useEffect, useState } from 'react'
import Modal from './Modal'
import { LoadingState } from './StateMessage'
import { formatValue, statusClass } from '../utils/formatters'

function LicenseDetailModal({ api, license, setError, onClose }) {
  const [detail, setDetail] = useState(license)
  const [activation, setActivation] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadDetail() {
      setLoading(true)
      try {
        const [licenseBody, activationBody, auditBody] = await Promise.all([
          api.request(`/licenses/${license.id}`),
          api.request(`/activations?licenseUnitId=${license.id}&limit=1`),
          api.request(`/audit-logs?entityName=license_units&entityId=${license.id}&limit=20`),
        ])

        if (ignore) return
        setDetail(licenseBody.data || license)
        setActivation((activationBody.data || [])[0] || null)
        setAuditLogs(auditBody.data || [])
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadDetail()

    return () => {
      ignore = true
    }
  }, [api, license, setError])

  const current = detail || license
  const operationalEvents = buildOperationalEvents(auditLogs, activation, current)
  const importantReason = findImportantReason(auditLogs, current)
  const mainResponsibility = {
    registeredBy: current.created_by_name || findEventUser(auditLogs, 'create'),
    reservedBy: current.reserved_by_name || findEventUser(auditLogs, 'reserve'),
    activatedBy: activation?.activated_by_name || findEventUser(auditLogs, 'activate'),
    expiredBy: findEventUser(auditLogs, 'expire_overdue') || findExpiredBy(auditLogs),
  }

  return (
    <Modal title="Ficha de licencia" eyebrow="Detalle" onClose={onClose} size="large">
      {loading ? (
        <LoadingState message="Cargando ficha e historial operativo." />
      ) : (
        <div className="license-sheet">
          {importantReason && (
            <div className={`important-reason important-reason-${current.status}`}>
              <span>
                {current.status === 'cancelled' ? 'Motivo de cancelación' : 'Motivo de expiración'}
              </span>
              <strong>{importantReason.reason}</strong>
              {(importantReason.userName || importantReason.date) && (
                <p>
                  Registrado por {importantReason.userName || 'Sistema'} · {formatDateTime(importantReason.date)}
                </p>
              )}
            </div>
          )}

          <section>
            <h4>Identificación</h4>
            <div className="detail-grid">
              <DetailItem label="Nombre" value={current.name} />
              <DetailItem label="Estado" value={<span className={statusClass(current.status)}>{formatValue(current.status)}</span>} />
              <DetailItem label="ID comercial público" value={current.commercial_identifier} />
              <DetailItem label="Clave única" value={current.masked_code} />
              <DetailItem label="Producto" value={current.product_name} />
              <DetailItem label="Variante" value={current.variant_name} />
            </div>
          </section>

          <section>
            <h4>Vigencia</h4>
            <div className="detail-grid">
              <DetailItem label="Tipo de compra" value={formatValue(current.validity_start_mode)} />
              <DetailItem label="Fecha de inicio" value={formatDate(current.start_date)} />
              <DetailItem label="Fecha de vencimiento" value={formatDate(current.next_renewal_date || current.expiration_date)} />
              <DetailItem label="Fecha límite de canje" value={formatDate(current.redeem_deadline_date)} />
              <DetailItem label="Prioridad de atención" value={formatDate(current.activation_priority_date)} />
              <DetailItem label="Motivo de prioridad" value={formatValue(current.activation_priority_reason)} />
              <DetailItem label="Costo de adquisición" value={`${current.currency_code || ''} ${current.cost || '0.00'}`.trim()} />
              <DetailItem label="Precio de venta" value={`${current.currency_code || ''} ${current.sale_price || current.cost || '0.00'}`.trim()} />
              <DetailItem label="Margen estimado" value={`${current.currency_code || ''} ${calculateMargin(current)}`.trim()} />
              <DetailItem label="Ciclo" value={formatValue(current.billing_cycle)} />
            </div>
          </section>

          <section>
            <h4>Reserva</h4>
            {current.status === 'reserved' ? (
              <div className="detail-grid">
                <DetailItem label="Reservada para" value={current.reserved_customer_name} />
                <DetailItem label="Reservada por" value={current.reserved_by_name} />
                <DetailItem label="Fecha de reserva" value={formatDateTime(current.reserved_at)} />
                <DetailItem label="Vigencia de reserva" value={formatDate(current.reservation_expires_at)} />
                <DetailItem label="Notas de reserva" value={current.reservation_notes} />
              </div>
            ) : (
              <p className="muted-text">Esta licencia no tiene una reserva activa.</p>
            )}
          </section>

          <section>
            <h4>Activación</h4>
            {activation ? (
              <div className="detail-grid">
                <DetailItem label="Activada por" value={activation.activated_by_name} />
                <DetailItem label="Fecha de activación" value={formatDateTime(activation.activation_date)} />
                <DetailItem label="Cliente" value={activation.customer_name} />
                <DetailItem label="Equipo/dispositivo" value={activation.device_reference} />
                <DetailItem label="Referencia soporte" value={activation.support_reference} />
                <DetailItem label="Notas" value={activation.notes} />
              </div>
            ) : (
              <p className="muted-text">Esta licencia todavía no tiene una activación registrada.</p>
            )}
          </section>

          <section>
            <h4>Inventario</h4>
            <div className="detail-grid">
              <DetailItem label="Lote" value={current.batch_number} />
              <DetailItem label="Proveedor" value={current.provider_name} />
              <DetailItem label="Custodio inicial" value={current.responsible_user_name} />
              <DetailItem label="Registrada por" value={current.created_by_name} />
              <DetailItem label="Fecha de registro" value={formatDateTime(current.create_date)} />
              <DetailItem label="Última modificación" value={formatDateTime(current.write_date)} />
            </div>
          </section>

          <section>
            <h4>Historial operativo</h4>
            <div className="detail-grid">
              <DetailItem label="Registrada por" value={mainResponsibility.registeredBy} />
              <DetailItem label="Reservada por" value={mainResponsibility.reservedBy} />
              <DetailItem label="Activada por" value={mainResponsibility.activatedBy} />
              <DetailItem label="Marcada expirada por" value={mainResponsibility.expiredBy} />
            </div>
            {operationalEvents.length ? (
              <div className="audit-timeline">
                {operationalEvents.map((item) => (
                  <div key={item.id}>
                    <strong>{item.label}</strong>
                    <span>{item.userName || 'Sistema'} · {formatDateTime(item.date)}</span>
                    {item.detail && <p>{item.detail}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text">No hay movimientos operativos recientes para esta licencia.</p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}

function buildOperationalEvents(auditLogs, activation, license) {
  const events = auditLogs.map((item) => {
    const operation = item.new_values?.operation
    const previousStatus = item.old_values?.status || item.old_values?.license?.status
    const nextStatus = item.new_values?.license?.status || item.new_values?.status

    return {
      id: `audit-${item.id}`,
      date: item.created_at,
      userName: item.user_name,
      label: operationLabel(operation, item.action, previousStatus, nextStatus),
      detail: operationDetail(operation, previousStatus, nextStatus, item),
    }
  })

  if (activation && !events.some((item) => item.label === 'Activación registrada')) {
    events.push({
      id: `activation-${activation.id}`,
      date: activation.activation_date,
      userName: activation.activated_by_name,
      label: 'Activación registrada',
      detail: activation.device_reference ? `Equipo/dispositivo: ${activation.device_reference}` : '',
    })
  }

  if (license?.created_by_name && !events.some((item) => item.label === 'Licencia registrada')) {
    events.push({
      id: 'license-created',
      date: license.create_date,
      userName: license.created_by_name,
      label: 'Licencia registrada',
      detail: 'Ingreso inicial al inventario.',
    })
  }

  return events
    .filter((event) => event.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)
}

function operationLabel(operation, action, previousStatus, nextStatus) {
  if (operation === 'reserve') return 'Reserva registrada'
  if (operation === 'release_reservation') return 'Reserva liberada'
  if (operation === 'expire_overdue') return 'Marcada expirada automáticamente'
  if (action === 'activate') return 'Activación registrada'
  if (action === 'create') return 'Licencia registrada'
  if (action === 'cancel' || nextStatus === 'cancelled') return 'Licencia cancelada'
  if (nextStatus === 'expired' && previousStatus !== 'expired') return 'Marcada expirada manualmente'
  if (previousStatus && nextStatus && previousStatus !== nextStatus) {
    return `Cambio de estado: ${formatValue(previousStatus)} a ${formatValue(nextStatus)}`
  }
  return formatValue(action)
}

function operationDetail(operation, previousStatus, nextStatus, item) {
  if (operation === 'reserve') {
    const reservedFor = item.new_values?.reserved_for?.name
    const expiresAt = item.new_values?.reservation_expires_at
    const detail = reservedFor ? `Cliente: ${reservedFor}.` : 'La licencia quedó apartada para un uso futuro.'
    return expiresAt ? `${detail} Vigencia de reserva: ${formatDate(expiresAt)}.` : detail
  }
  if (operation === 'release_reservation') return 'La licencia volvió a estar disponible.'
  if (operation === 'expire_overdue') return 'El sistema la marcó vencida por fecha de renovación/facturación.'
  if (item.new_values?.reason) return `Motivo: ${item.new_values.reason}`
  if (previousStatus && nextStatus && previousStatus !== nextStatus) {
    return `Estado anterior: ${formatValue(previousStatus)}. Estado nuevo: ${formatValue(nextStatus)}.`
  }
  if (item.ip_address) return `IP: ${item.ip_address}`
  return ''
}

function findEventUser(auditLogs, operationOrAction) {
  const row = auditLogs.find((item) => (
    item.action === operationOrAction || item.new_values?.operation === operationOrAction
  ))
  return row?.user_name || ''
}

function findExpiredBy(auditLogs) {
  const row = auditLogs.find((item) => {
    const previousStatus = item.old_values?.status || item.old_values?.license?.status
    const nextStatus = item.new_values?.license?.status || item.new_values?.status
    return nextStatus === 'expired' && previousStatus !== 'expired'
  })

  return row?.user_name || ''
}

function findImportantReason(auditLogs, license) {
  if (!['expired', 'cancelled'].includes(license?.status)) return null

  const reasonRow = auditLogs.find((item) => {
    const operation = item.new_values?.operation
    const previousStatus = item.old_values?.status || item.old_values?.license?.status
    const nextStatus = item.new_values?.license?.status || item.new_values?.status
    const matchesOperation = ['mark_expired', 'expire_overdue', 'cancel'].includes(operation)
    const matchesStatus = nextStatus === license.status && previousStatus !== nextStatus
    return item.new_values?.reason && (matchesOperation || matchesStatus)
  })

  if (reasonRow) {
    return {
      reason: reasonRow.new_values.reason,
      userName: reasonRow.user_name,
      date: reasonRow.created_at,
    }
  }

  const statusRow = auditLogs.find((item) => {
    const operation = item.new_values?.operation
    const previousStatus = item.old_values?.status || item.old_values?.license?.status
    const nextStatus = item.new_values?.license?.status || item.new_values?.status
    return ['mark_expired', 'expire_overdue', 'cancel'].includes(operation)
      || (nextStatus === license.status && previousStatus !== nextStatus)
  })

  if (license.notes) {
    return {
      reason: license.notes,
      userName: statusRow?.user_name,
      date: statusRow?.created_at,
    }
  }

  if (statusRow?.new_values?.reason) {
    return {
      reason: statusRow.new_values.reason,
      userName: statusRow.user_name,
      date: statusRow.created_at,
    }
  }

  return null
}

function DetailItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

function formatDate(value) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function calculateMargin(license) {
  const salePrice = Number(license.sale_price || license.cost || 0)
  const cost = Number(license.cost || 0)
  return (salePrice - cost).toFixed(2)
}

export default LicenseDetailModal
