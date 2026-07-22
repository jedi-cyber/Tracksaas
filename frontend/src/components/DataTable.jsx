import { formatValue, statusClass } from '../utils/formatters'

function DataTable({ rows, columns, actions, moduleId }) {
  if (!rows?.length) {
    return <div className="empty-state">No hay registros para mostrar.</div>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(([, label]) => (
              <th key={label}>{label}</th>
            ))}
            {actions && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.active === false || row.status === 'cancelled' ? 'inactive-row' : ''}
            >
              {columns.map(([key]) => (
                <td key={key}>
                  {moduleId === 'roles' && key === 'active' ? (
                    <span className={`state-dot ${row[key] ? 'state-dot-active' : 'state-dot-inactive'}`} title={row[key] ? 'Activado' : 'Desactivado'} aria-label={row[key] ? 'Activado' : 'Desactivado'} />
                  ) : key === 'status' || key === 'alert_color' ? (
                    <span className={statusClass(row[key])}>{formatValue(row[key])}</span>
                  ) : (
                    formatValue(row[key])
                  )}
                </td>
              ))}
              {actions && <td>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
