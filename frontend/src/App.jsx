import { useEffect, useMemo, useState } from 'react'
import Dashboard from './components/Dashboard'
import DataModule from './components/DataModule'
import LoginScreen from './components/LoginScreen'
import NotificationCenter from './components/NotificationCenter'
import NotificationModule from './components/NotificationModule'
import { modules, rolePermissions } from './config/modules'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

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
                    <span>{module.label}</span>
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
                          {child.label}
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
                {module.label}
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
          <Dashboard api={api} setError={notify} />
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
