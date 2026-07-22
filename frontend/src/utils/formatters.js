export function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const labels = {
    available: 'Disponible para activar',
    reserved: 'Reservada para cliente',
    activated: 'Activada',
    expired: 'Vencida',
    cancelled: 'Cancelada',
    draft: 'Borrador',
    confirmed: 'Confirmado',
    monthly: 'Mensual',
    annual: 'Anual',
    purchase_date: 'Online/oficial: desde compra',
    first_activation: 'Física/distribuidor: desde activación',
    vigencia_en_curso: 'Vigencia en curso',
    limite_de_canje: 'Límite de canje',
    compra_mas_antigua: 'Compra más antigua',
    sin_fecha_critica: 'Sin fecha crítica',
    create: 'Creación',
    update: 'Actualización',
    delete: 'Eliminación',
    activate: 'Activación',
    cancel: 'Cancelación',
    mark_expired: 'Marcada expirada',
    reserve: 'Reserva',
    release_reservation: 'Reserva liberada',
    expire_overdue: 'Expiración automática',
  }
  if (labels[value]) return labels[value]
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString()
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return value
}

export function statusClass(status) {
  return `status status-${String(status || 'default').toLowerCase()}`
}
