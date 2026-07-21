import { useEffect, useMemo, useState } from 'react'
import Dashboard from './components/Dashboard'
import DataModule from './components/DataModule'
import LoginScreen from './components/LoginScreen'
import NotificationCenter from './components/NotificationCenter'
import { modules } from './config/modules'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tracksaas_token'))
  const [user, setUser] = useState(null)
  const [activeModule, setActiveModule] = useState('dashboard')
  const [notifications, setNotifications] = useState([])

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

    setNotifications((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        type,
        duration: type === 'error' ? 7000 : 5000,
      },
    ])
  }

  function dismissNotification(id) {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }

  function handleLogin(nextToken, nextUser) {
    localStorage.setItem('tracksaas_token', nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setNotifications([])
  }

  function logout() {
    localStorage.removeItem('tracksaas_token')
    setToken(null)
    setUser(null)
    setActiveModule('dashboard')
  }

  if (!token) {
    return <LoginScreen apiUrl={API_URL} onLogin={handleLogin} />
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

        <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />

        {activeModule === 'dashboard' ? (
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
