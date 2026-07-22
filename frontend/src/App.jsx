import { useEffect, useMemo, useState } from 'react'
import Dashboard from './components/Dashboard'
import DataModule from './components/DataModule'
import LoginScreen from './components/LoginScreen'
import NotificationCenter from './components/NotificationCenter'
import NotificationModule from './components/NotificationModule'
import { modules, rolePermissions } from './config/modules'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const navIconPaths = {
  dashboard: 'M4 11L12 4l8 7v8a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1z',
  licenses: 'M7 4h10l3 3v13H7z M17 4v4h4 M10 11h7 M10 15h5',
  catalog: 'M4 6h16v4H4z M4 14h16v4H4z M7 10v4 M17 10v4',
  products: 'M4 8l8-4 8 4-8 4z M4 8v8l8 4 8-4V8',
  variants: 'M7 5h10v4H7z M5 15h6v4H5z M13 15h6v4h-6z M12 9v4 M8 13h8',
  batches: 'M5 7h14v4H5z M5 13h14v4H5z M8 7v10 M16 7v10',
  customers: 'M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a6 6 0 0 1 12 0 M17 11a3 3 0 1 0 0-6 M15 21a5 5 0 0 1 7-4.5',
  providers: 'M3 20h18 M5 20V8l7-4 7 4v12 M9 20v-6h6v6 M8 10h1 M15 10h1',
  users: 'M8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a6 6 0 0 1 12 0 M17 9a3 3 0 1 0 0-6 M16 21h6',
  roles: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z M9 12l2 2 4-5',
  activations: 'M12 3a9 9 0 1 0 9 9 M12 7v6l4 2 M16 4h5v5',
  expiredLicenses: 'M12 3a9 9 0 1 0 9 9 M12 7v5l3 3 M16 16l4 4 M20 16l-4 4',
  cancelledLicenses: 'M6 6l12 12 M18 6L6 18 M4 4h16v16H4z',
  audit: 'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h4',
}

function NavIcon({ moduleId }) {
  return (
    <span className={`nav-icon nav-icon-${moduleId}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d={navIconPaths[moduleId] || navIconPaths.dashboard} />
      </svg>
    </span>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tracksaas_token'))
  const [user, setUser] = useState(null)
  const [activeModule, setActiveModule] = useState('dashboard')
  const [previousModule, setPreviousModule] = useState('dashboard')
  const [openGroups, setOpenGroups] = useState({ catalog: false })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationHistory, setNotificationHistory] = useState([])

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

  function notify(message, type = 'error') {
    if (!message) return

    const notification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      type,
      createdAt: new Date().toISOString(),
      duration: type === 'error' ? 7000 : type === 'alert' ? 6500 : type === 'success' ? 4500 : 5000,
    }

    setNotifications((current) => [...current, notification])
    setNotificationHistory((current) => [notification, ...current].slice(0, 60))
  }

  function dismissNotification(id) {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }

  function removeNotificationHistory(id) {
    setNotificationHistory((current) => current.filter((notification) => notification.id !== id))
  }

  function clearNotificationHistory() {
    setNotificationHistory([])
  }

  function handleLogin(nextToken, nextUser) {
    localStorage.setItem('tracksaas_token', nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setNotifications([])
    setNotificationHistory([])
  }

  function logout() {
    localStorage.removeItem('tracksaas_token')
    setToken(null)
    setUser(null)
    setActiveModule('dashboard')
    setPreviousModule('dashboard')
    setOpenGroups({})
    setSidebarOpen(false)
  }

  function selectModule(moduleId) {
    if (moduleId === 'notifications' && activeModule !== 'notifications') {
      setPreviousModule(activeModule)
    }
    setActiveModule(moduleId)
    setSidebarOpen(false)
  }

  function closeNotificationsModule() {
    setActiveModule(previousModule || 'dashboard')
  }

  function canReadModule(moduleId) {
    if (moduleId === 'notifications') return true
    if (moduleId === 'dashboard') return rolePermissions[user?.role?.name]?.dashboard?.includes('read')
    if (moduleId === 'expiredLicenses') return rolePermissions[user?.role?.name]?.licenses?.includes('read')
    if (moduleId === 'cancelledLicenses') return rolePermissions[user?.role?.name]?.licenses?.includes('read')
    if (moduleId === 'audit') return rolePermissions[user?.role?.name]?.audit?.includes('read')
    return rolePermissions[user?.role?.name]?.[moduleId]?.includes('read')
  }

  const visibleModules = modules
    .map((module) => {
      if (!module.children?.length) return canReadModule(module.id) ? module : null
      const visibleChildren = module.children.filter((child) => canReadModule(child.id))
      return visibleChildren.length ? { ...module, children: visibleChildren } : null
    })
    .filter(Boolean)

  useEffect(() => {
    if (!user) return
    if (!canReadModule(activeModule)) {
      setActiveModule('dashboard')
    }
  }, [user, activeModule])

  const activeModuleLabel = useMemo(() => {
    for (const module of visibleModules) {
      if (module.id === activeModule) return module.label
      const child = module.children?.find((item) => item.id === activeModule)
      if (child) return child.label
    }
    if (activeModule === 'notifications') {
      return 'Notificaciones'
    }
    return 'Dashboard'
  }, [activeModule, visibleModules])

  if (!token) {
    return <LoginScreen apiUrl={API_URL} onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          Menú
        </button>
        <strong>{activeModuleLabel}</strong>
        <button
          type="button"
          className="mobile-notification-button"
          onClick={() => selectModule('notifications')}
          aria-label="Ver notificaciones"
        >
          Avisos
          {notificationHistory.length > 0 && <span>{notificationHistory.length}</span>}
        </button>
      </header>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">TS</div>
          <div>
            <h1>TrackSaaS</h1>
            <p>Control de licencias</p>
          </div>
          <button
            type="button"
            className="sidebar-close-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            Cerrar
          </button>
        </div>

        <nav className="nav-list" aria-label="Módulos">
          {visibleModules.map((module) => {
            const isGroup = Boolean(module.children?.length)
            const isOpen = openGroups[module.id]
            const hasActiveChild = module.children?.some((child) => child.id === activeModule)

            if (isGroup) {
              return (
                <div key={module.id} className="nav-group">
                  <button
                    type="button"
                    className={hasActiveChild ? 'active' : ''}
                    aria-expanded={Boolean(isOpen)}
                    onClick={() => {
                      setOpenGroups((current) => ({ ...current, [module.id]: !current[module.id] }))
                    }}
                  >
                    <span className="nav-item-label">
                      <NavIcon moduleId={module.id} />
                      <span>{module.label}</span>
                    </span>
                    <span className="nav-chevron">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="nav-sublist">
                      {module.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={activeModule === child.id ? 'active' : ''}
                          onClick={() => selectModule(child.id)}
                        >
                          <span className="nav-item-label">
                            <NavIcon moduleId={child.id} />
                            <span>{child.label}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <button
                key={module.id}
                type="button"
                className={activeModule === module.id ? 'active' : ''}
                onClick={() => {
                  selectModule(module.id)
                }}
              >
                <span className="nav-item-label">
                  <NavIcon moduleId={module.id} />
                  <span>{module.label}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-session">
          <span>Sesión activa</span>
          <strong>{user?.name || 'Usuario'}</strong>
          <p>{user?.role?.name || 'rol'} · {user?.email}</p>
          <button type="button" className="secondary-button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
        <div className="main-toolbar">
          <button
            type="button"
            className={activeModule === 'notifications' ? 'secondary-button active-toolbar-button' : 'secondary-button'}
            onClick={() => selectModule('notifications')}
          >
            Notificaciones
            {notificationHistory.length > 0 && <span>{notificationHistory.length}</span>}
          </button>
        </div>

        {activeModule === 'notifications' ? (
          <NotificationModule
            notifications={notificationHistory}
            onRemove={removeNotificationHistory}
            onClear={clearNotificationHistory}
            onBack={closeNotificationsModule}
          />
        ) : activeModule === 'dashboard' ? (
          <Dashboard api={api} setError={notify} onNavigate={selectModule} />
        ) : (
          <DataModule
            api={api}
            moduleId={activeModule}
            setError={notify}
            user={user}
          />
        )}
      </main>
    </div>
  )
}

export default App
