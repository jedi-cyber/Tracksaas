import { useEffect, useState } from 'react'
import Modal from './Modal'

function ReservationModal({ api, license, setError, onClose, onReserved, user }) {
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    reservation_expires_at: '',
    notes: '',
  })

  useEffect(() => {
    api
      .request('/customers?limit=100')
      .then((body) => setCustomers(body.data || []))
      .catch((err) => setError(err.message))
  }, [api, setError])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()

    if (!form.customer_id) {
      setError('Selecciona el cliente para quien se reservará la licencia.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await api.request(`/licenses/${license.id}/reserve`, {
        method: 'POST',
        body: JSON.stringify({
          customer_id: Number(form.customer_id),
          reservation_expires_at: form.reservation_expires_at || null,
          notes: form.notes || null,
        }),
      })
      await onReserved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Reservar licencia" eyebrow="Operación" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="guide-text">
          La reserva bloquea esta licencia para un cliente sin activarla. La activación se hará después y quedará auditada aparte.
        </p>

        <div className="form-grid">
          <label>
            Reservada por
            <input value={`${user?.name || 'Usuario actual'}${user?.email ? ` · ${user.email}` : ''}`} readOnly aria-readonly="true" />
            <span className="field-help">Este dato lo registra el backend desde tu sesión.</span>
          </label>

          <label>
            Cliente
            <select value={form.customer_id} onChange={(event) => updateField('customer_id', event.target.value)} required>
              <option value="">Seleccionar cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vigencia de reserva
            <input
              type="date"
              value={form.reservation_expires_at}
              onChange={(event) => updateField('reservation_expires_at', event.target.value)}
            />
            <span className="field-help">Opcional. Sirve para saber hasta cuándo se aparta la licencia para ese cliente.</span>
          </label>

          <label className="full-span">
            Notas de reserva
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows="3" />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Reservando...' : 'Confirmar reserva'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ReservationModal
