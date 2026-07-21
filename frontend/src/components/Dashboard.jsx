import { useEffect, useState } from 'react'
import DataTable from './DataTable'
import { statusClass } from '../utils/formatters'

function Dashboard({ api, setError }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .request('/dashboard/overview')
      .then((body) => setOverview(body.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [api, setError])

  async function expireOverdue() {
    try {
      const body = await api.request('/licenses/expire-overdue', { method: 'POST' })
      setError(`Licencias expiradas: ${body.data.expiredCount}`)
      const next = await api.request('/dashboard/overview')
      setOverview(next.data)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <section className="content-block">Cargando dashboard...</section>
  if (!overview) return <section className="content-block">Sin datos disponibles.</section>

  return (
    <section className="dashboard-grid">
      <div className="metric">
        <span>Gasto mensual</span>
        <strong>S/ {overview.financial.monthly_expense}</strong>
      </div>
      <div className="metric">
        <span>Proyección anual</span>
        <strong>S/ {overview.financial.annual_projection}</strong>
      </div>
      <div className="metric">
        <span>Licencias activas</span>
        <strong>{overview.inventory.licenses}</strong>
      </div>
      <div className="metric">
        <span>Alertas rojas</span>
        <strong>{overview.alerts.red}</strong>
      </div>

      <div className="content-block wide">
        <div className="section-header">
          <div>
            <span className="eyebrow">Estados</span>
            <h3>Licencias por estado</h3>
          </div>
          <button type="button" onClick={expireOverdue}>
            Expirar vencidas
          </button>
        </div>
        <div className="status-grid">
          {Object.entries(overview.licensesByStatus).map(([status, total]) => (
            <div key={status} className={statusClass(status)}>
              <span>{status}</span>
              <strong>{total}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="content-block wide">
        <div className="section-header">
          <div>
            <span className="eyebrow">Próximas renovaciones</span>
            <h3>Alertas a 30 días</h3>
          </div>
        </div>
        <DataTable
          rows={overview.upcomingRenewals}
          columns={[
            ['name', 'Licencia'],
            ['status', 'Estado'],
            ['next_renewal_date', 'Renovación'],
            ['days_remaining', 'Días'],
            ['alert_color', 'Alerta'],
          ]}
        />
      </div>
    </section>
  )
}

export default Dashboard
