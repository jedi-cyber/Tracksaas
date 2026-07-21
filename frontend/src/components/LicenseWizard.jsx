import { useEffect, useState } from 'react'
import { formConfig, tableConfig } from '../config/modules'
import EntityModal from './EntityModal'
import Modal from './Modal'

function LicenseWizard({ api, setError, onClose, onCreated, initialValues = {} }) {
  const today = new Date().toISOString().slice(0, 10)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batches, setBatches] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    batch_id: initialValues.batch_id ? String(initialValues.batch_id) : '',
    responsible_user_id: '',
    name: '',
    commercial_identifier: '',
    license_code: '',
    start_date: today,
    cost: '',
    billing_cycle: 'annual',
    currency_code: 'PEN',
    notes: '',
  })

  useEffect(() => {
    if (initialValues.batch_id) {
      setForm((current) => ({ ...current, batch_id: String(initialValues.batch_id) }))
    }
  }, [initialValues.batch_id])

  async function loadOptions() {
    setLoadingOptions(true)
    return Promise.all([api.request('/batches?limit=100'), api.request('/users?limit=100')])
      .then(([batchBody, userBody]) => {
        setBatches(batchBody.data || [])
        setUsers(userBody.data || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOptions(false))
  }

  useEffect(() => {
    loadOptions()
  }, [api, setError])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validateStep() {
    if (step === 1) {
      return (
        form.batch_id &&
        form.responsible_user_id &&
        form.name &&
        form.commercial_identifier &&
        form.license_code
      )
    }

    return form.start_date && form.cost && form.billing_cycle
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
    <Modal title="Nueva Activación" eyebrow="Wizard" onClose={onClose} size="large">
      <form className="wizard-panel" onSubmit={submit}>
        <p className="guide-text">
          La licencia se crea al final del flujo. La próxima renovación se calcula automáticamente desde la fecha de inicio y la duración de la variante.
        </p>
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
                <div className="select-field">
                  <div className="field-heading">
                    <span>Lote</span>
                    <button type="button" className="secondary-button inline-create-button" onClick={() => setShowBatchModal(true)}>
                      Crear lote
                    </button>
                  </div>
                  <select value={form.batch_id} onChange={(event) => updateField('batch_id', event.target.value)} required>
                    <option value="">Seleccionar lote</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batch_number || 'Sin número'} · {batch.variant_name || batch.product_name || 'sin variante'}
                      </option>
                    ))}
                  </select>
                  <span className="field-help">Si no existe, créalo sin salir de este formulario.</span>
                </div>

                <label>
                  Responsable
                  <select value={form.responsible_user_id} onChange={(event) => updateField('responsible_user_id', event.target.value)} required>
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
                  <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                </label>

                <label>
                  Identificador comercial
                  <input
                    value={form.commercial_identifier}
                    onChange={(event) => updateField('commercial_identifier', event.target.value)}
                    required
                  />
                </label>

                <label>
                  Código único real
                  <input value={form.license_code} onChange={(event) => updateField('license_code', event.target.value)} required />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-grid">
                <label>
                  Fecha de inicio
                  <input type="date" value={form.start_date} onChange={(event) => updateField('start_date', event.target.value)} required />
                </label>

                <label>
                  Costo
                  <input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => updateField('cost', event.target.value)} required />
                </label>

                <label>
                  Ciclo de cobro
                  <select value={form.billing_cycle} onChange={(event) => updateField('billing_cycle', event.target.value)} required>
                    <option value="monthly">Mensual</option>
                    <option value="annual">Anual</option>
                  </select>
                </label>

                <label>
                  Moneda
                  <input value={form.currency_code} onChange={(event) => updateField('currency_code', event.target.value.toUpperCase())} maxLength="3" required />
                </label>

                <label className="full-span">
                  Notas
                  <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows="3" />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="review-list">
                <p><strong>Lote:</strong> {selectedBatch?.batch_number || '-'}</p>
                <p><strong>Responsable:</strong> {selectedUser?.name || '-'}</p>
                <p><strong>Licencia:</strong> {form.name || '-'}</p>
                <p><strong>Identificador comercial:</strong> {form.commercial_identifier || '-'}</p>
                <p><strong>Inicio:</strong> {form.start_date || '-'}</p>
                <p><strong>Renovación:</strong> automática según la variante</p>
                <p><strong>Costo:</strong> {form.currency_code} {form.cost || '0'}</p>
                <p><strong>Ciclo:</strong> {form.billing_cycle === 'monthly' ? 'Mensual' : 'Anual'}</p>
              </div>
            )}
          </>
        )}

        <div className="wizard-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
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

      {showBatchModal && (
        <EntityModal
          api={api}
          config={tableConfig.batches}
          formConfig={formConfig.batches}
          mode="create"
          row={null}
          setError={setError}
          onClose={() => setShowBatchModal(false)}
          onSaved={async () => {
            setShowBatchModal(false)
            await loadOptions()
          }}
        />
      )}
    </Modal>
  )
}

export default LicenseWizard
