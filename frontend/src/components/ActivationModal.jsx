import { useEffect, useState } from 'react'
import Modal from './Modal'

function ActivationModal({ api, license, setError, onClose, onActivated, user }) {
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    device_reference: '',
    support_reference: '',
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
    setSaving(true)
    setError('')

    try {
      await api.request(`/licenses/${license.id}/activate`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id ? Number(form.customer_id) : null,
        }),
      })
      await onActivated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Activar licencia" eyebrow="Operación" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <p className="guide-text">
          Esta acción activa una licencia ya registrada y quedará auditada con tu usuario como activador.
        </p>
        <div className="form-grid">
          <label>
            Activado por
            <input value={`${user?.name || 'Usuario actual'}${user?.email ? ` · ${user.email}` : ''}`} readOnly aria-readonly="true" />
            <span className="field-help">Este dato lo registra el backend desde tu sesión. No se puede cambiar manualmente.</span>
          </label>

          <label>
            Cliente
            <select value={form.customer_id} onChange={(event) => updateField('customer_id', event.target.value)}>
              <option value="">Sin cliente asignado</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Equipo o dispositivo
            <input value={form.device_reference} onChange={(event) => updateField('device_reference', event.target.value)} />
          </label>

          <label>
            Referencia de soporte
            <input value={form.support_reference} onChange={(event) => updateField('support_reference', event.target.value)} />
          </label>

          <label className="full-span">
            Notas
            <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows="3" />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Activando...' : 'Confirmar activación'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ActivationModal
