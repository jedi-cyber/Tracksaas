import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const modules = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'licenses', label: 'Licencias' },
  { id: 'batches', label: 'Lotes' },
  { id: 'products', label: 'Productos' },
  { id: 'variants', label: 'Variantes' },
  { id: 'customers', label: 'Clientes' },
  { id: 'providers', label: 'Proveedores' },
  { id: 'activations', label: 'Activaciones' },
  { id: 'audit', label: 'Auditoría' },
]

const tableConfig = {
  licenses: {
    path: '/licenses',
    title: 'Licencias',
    columns: [
      ['name', 'Nombre'],
      ['masked_code', 'Código'],
      ['status', 'Estado'],
      ['next_renewal_date', 'Renovación'],
      ['cost', 'Costo'],
      ['responsible_user_name', 'Responsable'],
    ],
  },
  batches: {
    path: '/batches',
    title: 'Lotes',
    columns: [
      ['batch_number', 'Lote'],
      ['product_name', 'Producto'],
      ['variant_name', 'Variante'],
      ['provider_name', 'Proveedor'],
      ['quantity', 'Cantidad'],
      ['status', 'Estado'],
    ],
  },
  products: {
    path: '/products',
    title: 'Productos',
    columns: [
      ['name', 'Nombre'],
      ['description', 'Descripción'],
      ['active', 'Activo'],
    ],
  },
  variants: {
    path: '/variants',
    title: 'Variantes',
    columns: [
      ['product_name', 'Producto'],
      ['name', 'Variante'],
      ['default_code', 'Código'],
      ['billing_cycle', 'Ciclo'],
      ['default_cost', 'Costo'],
    ],
  },
  customers: {
    path: '/customers',
    title: 'Clientes',
    columns: [
      ['name', 'Nombre'],
      ['tax_id', 'Documento'],
      ['email', 'Correo'],
      ['phone', 'Teléfono'],
      ['active', 'Activo'],
    ],
  },
  providers: {
    path: '/providers',
    title: 'Proveedores',
    columns: [
      ['name', 'Nombre'],
      ['contact_name', 'Contacto'],
      ['email', 'Correo'],
      ['phone', 'Teléfono'],
      ['active', 'Activo'],
    ],
  },
  activations: {
    path: '/activations',
    title: 'Activaciones',
    columns: [
      ['license_name', 'Licencia'],
      ['masked_code', 'Código'],
      ['customer_name', 'Cliente'],
      ['activated_by_name', 'Activó'],
      ['activation_date', 'Fecha'],
      ['device_reference', 'Dispositivo'],
    ],
  },
  audit: {
    path: '/audit-logs',
    title: 'Auditoría',
    columns: [
      ['entity_name', 'Entidad'],
      ['entity_id', 'ID'],
      ['action', 'Acción'],
      ['user_name', 'Usuario'],
      ['ip_address', 'IP'],
      ['created_at', 'Fecha'],
    ],
  },
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString()
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  return value
}

function statusClass(status) {
  return `status status-${String(status || 'default').toLowerCase()}`
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tracksaas_token'))
  const [user, setUser] = useState(null)
  const [activeModule, setActiveModule] = useState('dashboard')
  const [error, setError] = useState('')

  const api = useMemo(() => {
    async function request(path, options = {}) {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      const text = await response.text()
      const body = text ? JSON.parse(text) : null

      if (!response.ok) {
        throw new Error(body?.message || 'No se pudo completar la solicitud')
      }

      return body
    }

    return { request }
  }, [token])

  useEffect(() => {
    if (!token) return

    api
      .request('/auth/me')
      .then((body) => setUser(body.user))
      .catch(() => {
        localStorage.removeItem('tracksaas_token')
        setToken(null)
        setUser(null)
      })
  }, [api, token])

  function handleLogin(nextToken, nextUser) {
    localStorage.setItem('tracksaas_token', nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setError('')
  }

  function logout() {
    localStorage.removeItem('tracksaas_token')
    setToken(null)
    setUser(null)
    setActiveModule('dashboard')
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">TS</div>
          <div>
            <h1>TrackSaaS</h1>
            <p>Control de licencias</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Módulos">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              className={activeModule === module.id ? 'active' : ''}
              onClick={() => {
                setActiveModule(module.id)
                setError('')
              }}
            >
              {module.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">Sesión activa</span>
            <h2>{user?.name || 'Usuario'}</h2>
            <p>{user?.role?.name || 'rol'} · {user?.email}</p>
          </div>
          <button type="button" className="secondary-button" onClick={logout}>
            Cerrar sesión
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        {activeModule === 'dashboard' ? (
          <Dashboard api={api} setError={setError} />
        ) : (
          <DataModule
            api={api}
            moduleId={activeModule}
            setError={setError}
          />
        )}
      </main>
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('admin@tracksaas.local')
  const [password, setPassword] = useState('Admin123*')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.message || 'Credenciales inválidas')
      }

      onLogin(body.token, body.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-copy">
          <span className="eyebrow">TrackSaaS</span>
          <h1>Gestión de licencias de software</h1>
          <p>
            Ingresa al panel operativo para revisar disponibilidad,
            renovaciones, activaciones, auditoría y alertas.
          </p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}

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
      const body = await api.request('/licenses/expire-overdue', {
        method: 'POST',
      })
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

function DataModule({ api, moduleId, setError }) {
  const config = tableConfig[moduleId]
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!config) return
    setLoading(true)
    try {
      const body = await api.request(`${config.path}?limit=25`)
      setRows(body.data || [])
      setPagination(body.pagination || null)
    } catch (err) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [config?.path])

  async function licenseAction(id, action) {
    const path = action === 'cancel' ? `/licenses/${id}` : `/licenses/${id}/${action}`
    const method = action === 'cancel' ? 'DELETE' : 'POST'

    try {
      await api.request(path, { method, body: action === 'activate' ? '{}' : undefined })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!config) return null

  return (
    <section className="content-block">
      <div className="section-header">
        <div>
          <span className="eyebrow">Módulo</span>
          <h3>{config.title}</h3>
          {pagination && <p>{pagination.total} registros encontrados</p>}
        </div>
        <button type="button" className="secondary-button" onClick={load}>
          Actualizar
        </button>
      </div>

      {loading ? (
        <p>Cargando registros...</p>
      ) : (
        <DataTable
          rows={rows}
          columns={config.columns}
          actions={
            moduleId === 'licenses'
              ? (row) => (
                  <div className="row-actions">
                    <button type="button" onClick={() => licenseAction(row.id, 'reserve')}>
                      Reservar
                    </button>
                    <button type="button" onClick={() => licenseAction(row.id, 'release-reservation')}>
                      Liberar
                    </button>
                    <button type="button" onClick={() => licenseAction(row.id, 'activate')}>
                      Activar
                    </button>
                    <button type="button" onClick={() => licenseAction(row.id, 'cancel')}>
                      Cancelar
                    </button>
                  </div>
                )
              : null
          }
        />
      )}
    </section>
  )
}

function DataTable({ rows, columns, actions }) {
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
            <tr key={row.id}>
              {columns.map(([key]) => (
                <td key={key}>
                  {key === 'status' || key === 'alert_color' ? (
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

export default App
