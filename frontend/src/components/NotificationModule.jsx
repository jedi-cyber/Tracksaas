import { EmptyState } from './StateMessage'

const TYPE_LABELS = {
  error: 'Error',
  alert: 'Alerta operativa',
  success: 'Operación exitosa',
  info: 'Mensaje',
}

function NotificationModule({ notifications, onRemove, onClear, onBack }) {
  return (
    <section className="content-block">
      <div className="section-header">
        <div>
          <h3>Notificaciones</h3>
          <p>{notifications.length} registros recientes</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={onBack}>
            Volver
          </button>
          <button type="button" className="secondary-button" onClick={onClear} disabled={!notifications.length}>
            Limpiar historial
          </button>
        </div>
      </div>

      {!notifications.length ? (
        <EmptyState message="No hay notificaciones registradas." />
      ) : (
        <div className="notification-history">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`notification-history-item notification-history-${notification.type || 'info'}`}
            >
              <div>
                <span>{TYPE_LABELS[notification.type] || TYPE_LABELS.info}</span>
                <strong>{notification.message}</strong>
                <p>{formatDateTime(notification.createdAt)}</p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onRemove(notification.id)}
              >
                Eliminar
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export default NotificationModule
