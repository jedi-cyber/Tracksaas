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
  { id: 'users', label: 'Usuarios' },
  { id: 'roles', label: 'Roles' },
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
  users: {
    path: '/users',
    title: 'Usuarios',
    columns: [
      ['name', 'Nombre'],
      ['email', 'Correo'],
      ['role_name', 'Rol'],
      ['active', 'Activo'],
      ['last_login_at', 'Último ingreso'],
    ],
  },
  roles: {
    path: '/roles',
    title: 'Roles',
    columns: [
      ['name', 'Nombre'],
      ['description', 'Descripción'],
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

const formConfig = {
  licenses: {
    options: [
      { name: 'batch_id', path: '/batches?limit=100', labelKey: 'batch_number', secondaryKey: 'variant_name' },
      { name: 'responsible_user_id', path: '/users?limit=100', labelKey: 'name', secondaryKey: 'email' },
    ],
    fields: [
      { name: 'batch_id', label: 'Lote', type: 'select', required: true, optionSource: 'batch_id' },
      { name: 'responsible_user_id', label: 'Responsable', type: 'select', required: true, optionSource: 'responsible_user_id' },
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'license_code', label: 'Nuevo código real', type: 'password', maxLength: 500 },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        staticOptions: [
          { value: 'available', label: 'Disponible' },
          { value: 'reserved', label: 'Reservada' },
          { value: 'expired', label: 'Vencida' },
          { value: 'cancelled', label: 'Cancelada' },
        ],
      },
      { name: 'start_date', label: 'Fecha de inicio', type: 'date', required: true },
      { name: 'next_renewal_date', label: 'Próxima renovación', type: 'date', required: true },
      { name: 'expiration_date', label: 'Fecha de vencimiento', type: 'date' },
      { name: 'cost', label: 'Costo', type: 'number', min: 0, step: '0.01', required: true },
      {
        name: 'billing_cycle',
        label: 'Ciclo',
        type: 'select',
        required: true,
        staticOptions: [
          { value: 'monthly', label: 'Mensual' },
          { value: 'annual', label: 'Anual' },
        ],
      },
      { name: 'currency_code', label: 'Moneda', maxLength: 3, defaultValue: 'PEN', transform: 'uppercase' },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  products: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  variants: {
    options: [
      { name: 'product_id', path: '/products?limit=100', labelKey: 'name' },
    ],
    fields: [
      { name: 'product_id', label: 'Producto', type: 'select', required: true, optionSource: 'product_id' },
      { name: 'name', label: 'Variante', required: true, maxLength: 180 },
      { name: 'default_code', label: 'Código interno', maxLength: 100 },
      {
        name: 'billing_cycle',
        label: 'Ciclo',
        type: 'select',
        required: true,
        staticOptions: [
          { value: 'monthly', label: 'Mensual' },
          { value: 'annual', label: 'Anual' },
        ],
        defaultValue: 'annual',
      },
      { name: 'duration_days', label: 'Duración en días', type: 'number', min: 1 },
      { name: 'default_cost', label: 'Costo por defecto', type: 'number', min: 0, step: '0.01', defaultValue: 0 },
      { name: 'currency_code', label: 'Moneda', maxLength: 3, defaultValue: 'PEN', transform: 'uppercase' },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  batches: {
    options: [
      { name: 'variant_id', path: '/variants?limit=100', labelKey: 'name', secondaryKey: 'product_name' },
      { name: 'provider_id', path: '/providers?limit=100', labelKey: 'name' },
    ],
    fields: [
      { name: 'variant_id', label: 'Variante', type: 'select', required: true, optionSource: 'variant_id' },
      { name: 'provider_id', label: 'Proveedor', type: 'select', required: true, optionSource: 'provider_id' },
      { name: 'batch_number', label: 'Número de lote', required: true, maxLength: 100 },
      { name: 'purchase_date', label: 'Fecha de compra', type: 'date', required: true },
      { name: 'quantity', label: 'Cantidad', type: 'number', min: 1, required: true },
      { name: 'unit_cost', label: 'Costo unitario', type: 'number', min: 0, step: '0.01', required: true },
      { name: 'currency_code', label: 'Moneda', maxLength: 3, defaultValue: 'PEN', transform: 'uppercase' },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        defaultValue: 'draft',
        staticOptions: [
          { value: 'draft', label: 'Borrador' },
          { value: 'confirmed', label: 'Confirmado' },
          { value: 'cancelled', label: 'Cancelado' },
        ],
      },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  providers: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'tax_id', label: 'Documento fiscal', maxLength: 30 },
      { name: 'contact_name', label: 'Contacto', maxLength: 150 },
      { name: 'email', label: 'Correo', type: 'email', maxLength: 255 },
      { name: 'phone', label: 'Teléfono', maxLength: 40 },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  customers: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'tax_id', label: 'Documento', maxLength: 30 },
      { name: 'email', label: 'Correo', type: 'email', maxLength: 255 },
      { name: 'phone', label: 'Teléfono', maxLength: 40 },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  users: {
    options: [
      { name: 'role_id', path: '/roles?limit=100', labelKey: 'name' },
    ],
    fields: [
      { name: 'role_id', label: 'Rol', type: 'select', required: true, optionSource: 'role_id' },
      { name: 'name', label: 'Nombre', required: true, maxLength: 150 },
      { name: 'email', label: 'Correo', type: 'email', required: true, maxLength: 255 },
      { name: 'password', label: 'Contraseña', type: 'password', requiredOnCreate: true, minLength: 8, maxLength: 128 },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  roles: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 80 },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 1000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
}

const rolePermissions = {
  administrator: {
    products: ['create', 'update', 'delete'],
    variants: ['create', 'update', 'delete'],
    batches: ['create', 'update', 'delete'],
    providers: ['create', 'update', 'delete'],
    customers: ['create', 'update', 'delete'],
    users: ['create', 'update', 'delete'],
    roles: ['create', 'update', 'delete'],
    licenses: ['create', 'update', 'delete', 'activate', 'reserve'],
  },
  license_user: {
    batches: ['create', 'update'],
    customers: ['create', 'update'],
    licenses: ['create', 'update', 'activate', 'reserve'],
  },
  viewer: {},
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
            user={user}
          />
        )}
      </main>
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
              placeholder="correo@empresa.com"
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
              placeholder="Contraseña"
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

function DataModule({ api, moduleId, setError, user }) {
  const config = tableConfig[moduleId]
  const entityForm = formConfig[moduleId]
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLicenseWizard, setShowLicenseWizard] = useState(false)
  const [formMode, setFormMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const permissions = rolePermissions[user?.role?.name]?.[moduleId] || []
  const canCreate = permissions.includes('create')
  const canUpdate = permissions.includes('update')
  const canDelete = permissions.includes('delete')
  const canCreateLicense =
    moduleId === 'licenses' &&
    permissions.includes('create')

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
    setFormMode(null)
    setSelectedRow(null)
    setShowLicenseWizard(false)
    load()
  }, [config?.path])

  async function licenseAction(id, action) {
    const path = action === 'cancel' ? `/licenses/${id}` : `/licenses/${id}/${action}`
    const method = action === 'cancel' ? 'DELETE' : 'POST'

    try {
      if (action === 'cancel' && !window.confirm('¿Confirmas cancelar esta licencia?')) {
        return
      }
      await api.request(path, { method, body: action === 'activate' ? '{}' : undefined })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function openCreateForm() {
    setSelectedRow(null)
    setFormMode('create')
    setShowLicenseWizard(false)
  }

  function openEditForm(row) {
    setSelectedRow(row)
    setFormMode('edit')
    setShowLicenseWizard(false)
  }

  function openDetail(row) {
    setSelectedRow(row)
    setFormMode('detail')
    setShowLicenseWizard(false)
  }

  async function removeRow(row) {
    const verb = moduleId === 'batches' || moduleId === 'licenses' ? 'cancelar' : 'desactivar'
    if (!window.confirm(`¿Confirmas ${verb} este registro?`)) {
      return
    }

    try {
      await api.request(`${config.path}/${row.id}`, { method: 'DELETE' })
      setFormMode(null)
      setSelectedRow(null)
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
        <div className="header-actions">
          {entityForm && canCreate && moduleId !== 'licenses' && (
            <button type="button" onClick={openCreateForm}>
              Nuevo
            </button>
          )}
          {canCreateLicense && (
            <button
              type="button"
              onClick={() => setShowLicenseWizard((current) => !current)}
            >
              {showLicenseWizard ? 'Cerrar wizard' : 'Nueva licencia'}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={load}>
            Actualizar
          </button>
        </div>
      </div>

      {showLicenseWizard && (
        <LicenseWizard
          api={api}
          setError={setError}
          onCancel={() => setShowLicenseWizard(false)}
          onCreated={async () => {
            setShowLicenseWizard(false)
            await load()
          }}
        />
      )}

      {entityForm && formMode && (
        <EntityPanel
          api={api}
          config={config}
          formConfig={entityForm}
          mode={formMode}
          row={selectedRow}
          setError={setError}
          onCancel={() => {
            setFormMode(null)
            setSelectedRow(null)
          }}
          onSaved={async () => {
            setFormMode(null)
            setSelectedRow(null)
            await load()
          }}
        />
      )}

      {loading ? (
        <p>Cargando registros...</p>
      ) : (
        <DataTable
          rows={rows}
          columns={config.columns}
          actions={
            (entityForm || moduleId === 'licenses')
              ? (row) => (
                <div className="row-actions">
                  <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
                    Ver
                  </button>
                  {entityForm && canUpdate && (
                    <button type="button" onClick={() => openEditForm(row)}>
                      Editar
                    </button>
                  )}
                  {moduleId === 'licenses' && permissions.includes('reserve') && (
                    <>
                      <button type="button" onClick={() => licenseAction(row.id, 'reserve')}>
                        Reservar
                      </button>
                      <button type="button" onClick={() => licenseAction(row.id, 'release-reservation')}>
                        Liberar
                      </button>
                    </>
                  )}
                  {moduleId === 'licenses' && permissions.includes('activate') && (
                    <button type="button" onClick={() => licenseAction(row.id, 'activate')}>
                      Activar
                    </button>
                  )}
                  {(canDelete || (moduleId === 'licenses' && permissions.includes('delete'))) && (
                    <button type="button" className="danger-button" onClick={() => removeRow(row)}>
                      {moduleId === 'batches' || moduleId === 'licenses' ? 'Cancelar' : 'Desactivar'}
                    </button>
                  )}
                </div>
              )
              : null
          }
        />
      )}
    </section>
  )
}

function EntityPanel({ api, config, formConfig, mode, row, setError, onCancel, onSaved }) {
  const [form, setForm] = useState(() => initialFormState(formConfig.fields, row, mode))
  const [options, setOptions] = useState({})
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const isDetail = mode === 'detail'
  const title = mode === 'create' ? `Nuevo: ${config.title}` : mode === 'edit' ? `Editar: ${config.title}` : `Detalle: ${config.title}`

  useEffect(() => {
    setForm(initialFormState(formConfig.fields, row, mode))
  }, [formConfig, row, mode])

  useEffect(() => {
    const optionSources = formConfig.options || []
    if (!optionSources.length) return

    setLoadingOptions(true)
    Promise.all(optionSources.map((source) => api.request(source.path)))
      .then((responses) => {
        const nextOptions = {}
        optionSources.forEach((source, index) => {
          nextOptions[source.name] = responses[index].data || []
        })
        setOptions(nextOptions)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOptions(false))
  }, [api, formConfig.options, setError])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validateForm() {
    for (const field of formConfig.fields) {
      const value = form[field.name]
      const required = field.required || (mode === 'create' && field.requiredOnCreate)

      if (required && (value === undefined || value === null || value === '')) {
        return `El campo ${field.label} es obligatorio.`
      }

      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        return `El campo ${field.label} no tiene un correo válido.`
      }

      if (field.minLength && value && String(value).length < field.minLength) {
        return `El campo ${field.label} debe tener al menos ${field.minLength} caracteres.`
      }

      if (field.maxLength && value && String(value).length > field.maxLength) {
        return `El campo ${field.label} no puede superar ${field.maxLength} caracteres.`
      }

      if (field.type === 'number' && value !== '' && value !== undefined && value !== null) {
        const numberValue = Number(value)
        if (!Number.isFinite(numberValue) || (field.min !== undefined && numberValue < field.min)) {
          return `El campo ${field.label} debe ser un número válido.`
        }
      }
    }

    if (form.start_date && form.next_renewal_date && new Date(form.next_renewal_date) < new Date(form.start_date)) {
      return 'La próxima renovación no puede ser menor que la fecha de inicio.'
    }

    return null
  }

  async function submit(event) {
    event.preventDefault()
    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = buildPayload(formConfig.fields, form, mode)
      await api.request(mode === 'create' ? config.path : `${config.path}/${row.id}`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="entity-panel" onSubmit={submit}>
      <div className="section-header">
        <div>
          <span className="eyebrow">{isDetail ? 'Consulta' : 'Formulario'}</span>
          <h3>{title}</h3>
        </div>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cerrar
        </button>
      </div>

      {isDetail ? (
        <div className="detail-grid">
          {Object.entries(row || {}).map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{formatValue(value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <>
          {loadingOptions ? (
            <p>Cargando opciones...</p>
          ) : (
            <div className="form-grid">
              {formConfig.fields.map((field) => (
                <FieldControl
                  key={field.name}
                  field={field}
                  value={form[field.name]}
                  options={options[field.optionSource] || []}
                  disabled={saving}
                  mode={mode}
                  onChange={(value) => updateField(field.name, value)}
                />
              ))}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || loadingOptions}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}

function FieldControl({ field, value, options, disabled, mode, onChange }) {
  const className = field.full ? 'full-span' : ''
  const required = field.required || (mode === 'create' && field.requiredOnCreate)

  if (field.type === 'checkbox') {
    return (
      <label className={`checkbox-field ${className}`}>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    )
  }

  if (field.type === 'textarea') {
    return (
      <label className={className}>
        {field.label}
        <textarea
          value={value || ''}
          maxLength={field.maxLength}
          disabled={disabled}
          rows="3"
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    )
  }

  if (field.type === 'select') {
    const choices = field.staticOptions || options.map((item) => ({
      value: item.id,
      label: field.secondaryKey
        ? `${item[field.labelKey]} · ${item[field.secondaryKey] || ''}`
        : item[field.labelKey],
    }))

    return (
      <label className={className}>
        {field.label}
        <select
          value={value || ''}
          required={required}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Seleccionar</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className={className}>
      {field.label}
      <input
        type={field.type || 'text'}
        value={value || ''}
        required={required}
        min={field.min}
        step={field.step}
        maxLength={field.maxLength}
        disabled={disabled}
        placeholder={field.requiredOnCreate && mode === 'edit' ? 'Dejar vacío para conservar' : ''}
        onChange={(event) => {
          const nextValue = field.transform === 'uppercase'
            ? event.target.value.toUpperCase()
            : event.target.value
          onChange(nextValue)
        }}
      />
    </label>
  )
}

function initialFormState(fields, row, mode) {
  return fields.reduce((state, field) => {
    if (field.name === 'password' && mode === 'edit') {
      state[field.name] = ''
      return state
    }

    const rowValue = row?.[field.name]
    if (rowValue !== undefined && rowValue !== null) {
      state[field.name] = normalizeFormValue(field, rowValue)
    } else if (field.defaultValue !== undefined) {
      state[field.name] = field.defaultValue
    } else if (field.type === 'checkbox') {
      state[field.name] = false
    } else {
      state[field.name] = ''
    }

    return state
  }, {})
}

function normalizeFormValue(field, value) {
  if (field.type === 'date' && typeof value === 'string') {
    return value.slice(0, 10)
  }

  return value
}

function buildPayload(fields, form, mode) {
  return fields.reduce((payload, field) => {
    const value = form[field.name]

    if (mode === 'edit' && field.name === 'password' && !value) {
      return payload
    }

    if (!field.required && !field.requiredOnCreate && field.type !== 'checkbox' && value === '') {
      return payload
    }

    if (field.type === 'number' || (field.type === 'select' && field.optionSource)) {
      payload[field.name] = value === '' ? undefined : Number(value)
    } else {
      payload[field.name] = value
    }

    return payload
  }, {})
}

function LicenseWizard({ api, setError, onCancel, onCreated }) {
  const today = new Date().toISOString().slice(0, 10)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [batches, setBatches] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    batch_id: '',
    responsible_user_id: '',
    name: '',
    license_code: '',
    start_date: today,
    next_renewal_date: '',
    cost: '',
    billing_cycle: 'annual',
    currency_code: 'PEN',
    notes: '',
  })

  useEffect(() => {
    setLoadingOptions(true)
    Promise.all([
      api.request('/batches?limit=100'),
      api.request('/users?limit=100'),
    ])
      .then(([batchBody, userBody]) => {
        setBatches(batchBody.data || [])
        setUsers(userBody.data || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOptions(false))
  }, [api, setError])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validateStep() {
    if (step === 1) {
      return form.batch_id && form.responsible_user_id && form.name && form.license_code
    }

    return form.start_date && form.next_renewal_date && form.cost && form.billing_cycle
  }

  function nextStep() {
    if (!validateStep()) {
      setError('Completa los campos obligatorios antes de continuar.')
      return
    }

    setError('')
    setStep((current) => Math.min(current + 1, 3))
  }

  async function submit(event) {
    event.preventDefault()
    if (!validateStep()) {
      setError('Completa los campos obligatorios antes de guardar.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await api.request('/licenses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          batch_id: Number(form.batch_id),
          responsible_user_id: Number(form.responsible_user_id),
          cost: Number(form.cost),
        }),
      })
      await onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedBatch = batches.find((batch) => String(batch.id) === String(form.batch_id))
  const selectedUser = users.find((item) => String(item.id) === String(form.responsible_user_id))

  return (
    <form className="wizard-panel" onSubmit={submit}>
      <div className="wizard-steps" aria-label="Pasos del registro de licencia">
        {['Datos', 'Vigencia', 'Revisión'].map((label, index) => (
          <button
            key={label}
            type="button"
            className={step === index + 1 ? 'active' : ''}
            onClick={() => setStep(index + 1)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {loadingOptions ? (
        <p>Cargando opciones...</p>
      ) : (
        <>
          {step === 1 && (
            <div className="wizard-grid">
              <label>
                Lote
                <select
                  value={form.batch_id}
                  onChange={(event) => updateField('batch_id', event.target.value)}
                  required
                >
                  <option value="">Seleccionar lote</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} · {batch.variant_name || batch.product_name || 'sin variante'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Responsable
                <select
                  value={form.responsible_user_id}
                  onChange={(event) => updateField('responsible_user_id', event.target.value)}
                  required
                >
                  <option value="">Seleccionar responsable</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.email}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nombre de licencia
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Ej. Microsoft 365 Empresa - 001"
                  required
                />
              </label>

              <label>
                Código real
                <input
                  value={form.license_code}
                  onChange={(event) => updateField('license_code', event.target.value)}
                  placeholder="Clave de licencia"
                  required
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-grid">
              <label>
                Fecha de inicio
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) => updateField('start_date', event.target.value)}
                  required
                />
              </label>

              <label>
                Próxima renovación
                <input
                  type="date"
                  value={form.next_renewal_date}
                  onChange={(event) => updateField('next_renewal_date', event.target.value)}
                  required
                />
              </label>

              <label>
                Costo
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(event) => updateField('cost', event.target.value)}
                  required
                />
              </label>

              <label>
                Ciclo de cobro
                <select
                  value={form.billing_cycle}
                  onChange={(event) => updateField('billing_cycle', event.target.value)}
                  required
                >
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                </select>
              </label>

              <label>
                Moneda
                <input
                  value={form.currency_code}
                  onChange={(event) => updateField('currency_code', event.target.value.toUpperCase())}
                  maxLength="3"
                  required
                />
              </label>

              <label className="full-span">
                Notas
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows="3"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="review-list">
              <p><strong>Lote:</strong> {selectedBatch?.batch_number || '-'}</p>
              <p><strong>Responsable:</strong> {selectedUser?.name || '-'}</p>
              <p><strong>Licencia:</strong> {form.name || '-'}</p>
              <p><strong>Inicio:</strong> {form.start_date || '-'}</p>
              <p><strong>Renovación:</strong> {form.next_renewal_date || '-'}</p>
              <p><strong>Costo:</strong> {form.currency_code} {form.cost || '0'}</p>
              <p><strong>Ciclo:</strong> {form.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}</p>
            </div>
          )}
        </>
      )}

      <div className="wizard-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
        {step > 1 && (
          <button type="button" className="secondary-button" onClick={() => setStep(step - 1)}>
            Anterior
          </button>
        )}
        {step < 3 ? (
          <button type="button" onClick={nextStep} disabled={loadingOptions}>
            Siguiente
          </button>
        ) : (
          <button type="submit" disabled={saving || loadingOptions}>
            {saving ? 'Guardando...' : 'Guardar licencia'}
          </button>
        )}
      </div>
    </form>
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
