import { useEffect } from 'react'

function NotificationCenter({ notifications, onDismiss }) {
  useEffect(() => {
    const timers = notifications.map((notification) =>
      window.setTimeout(() => onDismiss(notification.id), notification.duration || 5000)
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [notifications, onDismiss])

  if (!notifications.length) return null

  return (
    <div className="notification-stack" aria-live="polite" aria-label="Notificaciones">
      {notifications.map((notification) => (
        <section
          key={notification.id}
          className={`notification-card notification-${notification.type || 'info'}`}
          role="status"
        >
          <div>
            <span>{notification.type === 'error' ? 'Atención' : 'Mensaje'}</span>
            <p>{notification.message}</p>
          </div>
          <button
            type="button"
            className="notification-close"
            aria-label="Eliminar notificación"
            onClick={() => onDismiss(notification.id)}
          >
            ×
          </button>
        </section>
      ))}
    </div>
  )
}

export default NotificationCenter
