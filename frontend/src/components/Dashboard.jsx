import { useEffect, useState } from 'react'
import DataTable from './DataTable'
import { formatValue, statusClass } from '../utils/formatters'

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
      setError(`Licencias expiradas: ${body.data.expiredCount}`, 'info')
      const next = await api.request('/dashboard/overview')
      setOverview(next.data)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <section className="content-block">Cargando dashboard...</section>
  if (!overview) return <section className="content-block">Sin datos disponibles.</section>

  const status = overview.licensesByStatus || {}
  const inventory = overview.inventory || {}
  const alerts = overview.alerts || {}
  const financial = overview.financial || {}
  const totalLicenses = Number(inventory.licenses || 0)
  const available = Number(status.available || 0)
  const reserved = Number(status.reserved || 0)
  const activated = Number(status.activated || 0)
  const expired = Number(status.expired || 0)
  const cancelled = Number(status.cancelled || 0)
  const operationalRisk = Number(alerts.red || 0) + Number(alerts.yellow || 0)
  const activationRate = totalLicenses ? Math.round((activated / totalLicenses) * 100) : 0
  const pendingActivation = available + reserved
  const inactiveLicenses = expired + cancelled
  const cleanInventory = totalLicenses ? Math.max(totalLicenses - inactiveLicenses, 0) : 0

  return (
    <section className="dashboard-grid">
      <div className="dashboard-hero wide">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h2>Resumen general del inventario de licencias</h2>
          <p>
            {cleanInventory} licencias operativas de {totalLicenses} registradas.
            {' '}{pendingActivation} están pendientes de activación y {operationalRisk} requieren seguimiento.
          </p>
        </div>
        <div className="dashboard-hero-kpis">
          <div>
            <span>Margen estimado</span>
            <strong>{formatMoney(financial.estimated_margin)}</strong>
          </div>
          <div>
            <span>Inventario disponible</span>
            <strong>{formatMoney(financial.available_inventory_value)}</strong>
          </div>
        </div>
      </div>

      <div className="metric metric-primary">
        <span>Licencias por activar</span>
        <strong>{pendingActivation}</strong>
        <small>Disponibles y reservadas</small>
      </div>
      <div className="metric">
        <span>Licencias en uso</span>
        <strong>{activated}</strong>
        <small>{activationRate}% del inventario</small>
      </div>
      <div className={`metric ${operationalRisk ? 'metric-warning' : ''}`}>
        <span>Riesgo operativo</span>
        <strong>{operationalRisk}</strong>
        <small>Rojas y amarillas</small>
      </div>
      <div className={`metric ${expired ? 'metric-danger' : ''}`}>
        <span>Licencias vencidas</span>
        <strong>{expired}</strong>
        <small>Requieren revisión</small>
      </div>

      <div className="content-block half">
        <div className="section-header">
          <div>
            <span className="eyebrow">Finanzas</span>
            <h3>Resumen financiero</h3>
          </div>
        </div>
        <div className="finance-summary">
          <div className="finance-highlight">
            <span>Ingresos por licencias activadas</span>
            <strong>{formatMoney(financial.activated_revenue)}</strong>
          </div>
          <div className="finance-highlight">
            <span>Margen estimado</span>
            <strong>{formatMoney(financial.estimated_margin)}</strong>
          </div>
        </div>
        <div className="summary-list">
          <div>
            <span>Costo de licencias vendidas</span>
            <strong>{formatMoney(financial.sold_license_cost)}</strong>
          </div>
          <div>
            <span>Valor del inventario disponible</span>
            <strong>{formatMoney(financial.available_inventory_value)}</strong>
          </div>
          <div>
            <span>Costo mensual equivalente</span>
            <strong>{formatMoney(financial.monthly_equivalent_cost)}</strong>
          </div>
          <div>
            <span>Proyección anual de costos</span>
            <strong>{formatMoney(financial.annual_cost_projection)}</strong>
          </div>
        </div>
      </div>

      <div className="content-block half">
        <div className="section-header">
          <div>
            <span className="eyebrow">Inventario</span>
            <h3>Catálogo registrado</h3>
          </div>
        </div>
        <div className="summary-list compact">
          <div><span>Productos</span><strong>{inventory.products}</strong></div>
          <div><span>Variantes</span><strong>{inventory.variants}</strong></div>
          <div><span>Lotes</span><strong>{inventory.batches}</strong></div>
          <div><span>Proveedores</span><strong>{inventory.providers}</strong></div>
          <div><span>Clientes</span><strong>{inventory.customers}</strong></div>
          <div><span>Licencias</span><strong>{inventory.licenses}</strong></div>
        </div>
      </div>

      <div className="content-block half">
        <div className="section-header">
          <div>
            <span className="eyebrow">Alertas</span>
            <h3>Semáforo operativo</h3>
          </div>
          <button type="button" onClick={expireOverdue}>
            Expirar vencidas
          </button>
        </div>
        <div className="alert-summary">
          <div className="status status-red"><span>Vencidas</span><strong>{alerts.red}</strong></div>
          <div className="status status-yellow"><span>Próximas</span><strong>{alerts.yellow}</strong></div>
          <div className="status status-green"><span>Estables</span><strong>{alerts.green}</strong></div>
        </div>
      </div>

      <div className="content-block half">
        <div className="section-header">
          <div>
            <span className="eyebrow">Resumen</span>
            <h3>Lectura rápida</h3>
          </div>
        </div>
        <div className="insight-list">
          <p>{pendingActivation} licencias todavía pueden pasar a activación.</p>
          <p>{reserved} licencias están reservadas y deben cerrarse o liberarse.</p>
          <p>{operationalRisk} alertas requieren seguimiento por vencimiento o canje.</p>
          <p>{inactiveLicenses} licencias están fuera de operación por vencimiento o cancelación.</p>
        </div>
      </div>

      <div className="content-block wide">
        <div className="section-header">
          <div>
            <span className="eyebrow">Estados</span>
            <h3>Licencias por estado</h3>
          </div>
        </div>
        <div className="status-grid">
          {Object.entries(status).map(([statusKey, total]) => (
            <div key={statusKey} className={statusClass(statusKey)}>
              <span>{formatValue(statusKey)}</span>
              <strong>{total}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="content-block wide">
        <div className="section-header">
          <div>
            <span className="eyebrow">Alertas operativas</span>
            <h3>Alertas a 30 días</h3>
          </div>
        </div>
        <DataTable
          rows={overview.upcomingRenewals}
          columns={[
            ['name', 'Licencia'],
            ['commercial_identifier', 'ID comercial público'],
            ['status', 'Estado'],
            ['alert_reason', 'Motivo'],
            ['alert_date', 'Fecha crítica'],
            ['days_remaining', 'Días'],
            ['alert_color', 'Alerta'],
          ]}
        />
      </div>
    </section>
  )
}

function formatMoney(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`
}

export default Dashboard
