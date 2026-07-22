import { useState } from 'react'

function LoginScreen({ apiUrl, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
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
	            <div className="password-field-wrapper">
	              <input
	                type={showPassword ? 'text' : 'password'}
	                value={password}
	                onChange={(event) => setPassword(event.target.value)}
	                autoComplete="current-password"
	                placeholder="Contraseña"
	                required
	              />
	              <button
	                type="button"
	                className="password-toggle-button"
	                onClick={() => setShowPassword((current) => !current)}
	                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
	                title={showPassword ? 'Ocultar' : 'Mostrar'}
	              >
	                <span aria-hidden="true">&#128065;</span>
	              </button>
	            </div>
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

export default LoginScreen
