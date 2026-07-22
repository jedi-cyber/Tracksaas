function StateMessage({ type = 'empty', title, message }) {
  return (
    <div className={`state-message state-message-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'loading' && <span className="loading-spinner" aria-hidden="true" />}
      <div>
        <strong>{title}</strong>
        {message && <p>{message}</p>}
      </div>
    </div>
  )
}

export function LoadingState({ message = 'Cargando información...' }) {
  return <StateMessage type="loading" title="Cargando" message={message} />
}

export function EmptyState({ message = 'No hay registros para mostrar.' }) {
  return <StateMessage type="empty" title="Sin resultados" message={message} />
}

export function ErrorState({ message = 'No se pudo cargar la información.' }) {
  return <StateMessage type="error" title="Error" message={message} />
}

export default StateMessage
