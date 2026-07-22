import { useEffect, useRef, useState } from 'react'
import { formatValue, statusClass } from '../utils/formatters'

function DataTable({ rows, columns, actions, moduleId }) {
  const [openMenuId, setOpenMenuId] = useState(null)
  const [menuPosition, setMenuPosition] = useState(null)
  const menuContentRef = useRef(null)

  useEffect(() => {
    function closeMenu(event) {
      if (menuContentRef.current?.contains(event.target)) return
      setOpenMenuId(null)
      setMenuPosition(null)
    }

    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

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
	              {actions && (
	                <td className="actions-cell">
	                  <div className="actions-menu" onClick={(event) => event.stopPropagation()}>
	                    <button
	                      type="button"
	                      className="secondary-button actions-menu-trigger"
	                      onClick={(event) => {
	                        if (openMenuId === row.id) {
	                          setOpenMenuId(null)
	                          setMenuPosition(null)
	                          return
	                        }
	                        const rect = event.currentTarget.getBoundingClientRect()
	                        setOpenMenuId(row.id)
	                        setMenuPosition({
	                          top: rect.bottom + 6,
	                          right: window.innerWidth - rect.right,
	                        })
	                      }}
	                    >
	                      Acciones
	                    </button>
	                  </div>
	                </td>
	              )}
            </tr>
          ))}
        </tbody>
	      </table>
	      {openMenuId !== null && menuPosition && (
	        <div
	          ref={menuContentRef}
	          className="actions-menu-panel floating-actions-menu"
	          style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
	          onClick={() => {
	            setOpenMenuId(null)
	            setMenuPosition(null)
	          }}
	        >
	          {actions(rows.find((row) => row.id === openMenuId))}
	        </div>
	      )}
	    </div>
	  )
}

export default DataTable
