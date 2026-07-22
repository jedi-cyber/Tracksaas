import { useEffect, useState } from 'react'
import { formConfig, tableConfig } from '../config/modules'
import EntityModal from './EntityModal'
import Modal from './Modal'

const COMMERCIAL_IDENTIFIER_PATTERN = '[A-Za-z0-9][A-Za-z0-9._/#: +()\\-]{1,179}'
const LICENSE_CODE_PATTERN = '([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}|[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}|[A-Za-z0-9]{20}|[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4})'

function LicenseWizard({ api, setError, onClose, onCreated, initialValues = {} }) {
  const today = new Date().toISOString().slice(0, 10)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showLicenseCode, setShowLicenseCode] = useState(false)
  const [batches, setBatches] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    batch_id: initialValues.batch_id ? String(initialValues.batch_id) : '',
    responsible_user_id: '',
    name: '',
    commercial_identifier: '',
    license_code: '',
    validity_start_mode: 'purchase_date',
    start_date: today,
    redeem_deadline_date: '',
	    cost: '',
    sale_price: '',
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
    if (field === 'validity_start_mode') {
      setForm((current) => ({
        ...current,
        validity_start_mode: value,
        start_date: value === 'first_activation' ? '' : current.start_date || today,
        redeem_deadline_date: value === 'purchase_date' ? '' : current.redeem_deadline_date,
      }))
      return
    }

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

    return (form.validity_start_mode === 'first_activation' || form.start_date) && form.cost && form.billing_cycle
  }

  const selectedBatch = batches.find((batch) => String(batch.id) === String(form.batch_id))
  const selectedUser = users.find((item) => String(item.id) === String(form.responsible_user_id))
  const registerableBatches = batches.filter((batch) => {
    if (String(batch.id) === String(form.batch_id)) return true
    return batch.active !== false && batch.status === 'confirmed' && Number(batch.available_to_register) > 0
  })

  function getRenewalDurationDays() {
    return Number(selectedBatch?.variant_duration_days) || (form.billing_cycle === 'monthly' ? 30 : 365)
  }

  function calculateRenewalDate() {
    if (form.validity_start_mode === 'first_activation' || !form.start_date) return ''
    const date = new Date(`${form.start_date}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + getRenewalDurationDays())
    return date.toISOString().slice(0, 10)
  }

  function formatDate(value) {
    if (!value) return '-'
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  function formatDuration(batch) {
    const days = Number(batch?.variant_duration_days)
    if (days === 365) return '1 año'
    if (days === 30) return '1 mes'
    if (days > 0) return `${days} días`
    if (batch?.variant_billing_cycle === 'monthly') return '1 mes'
    if (batch?.variant_billing_cycle === 'annual') return '1 año'
    return 'vigencia según variante'
  }

  function formatBatchOption(batch) {
    const product = batch.product_name || 'Producto sin nombre'
    const variant = batch.variant_name ? ` ${batch.variant_name}` : ''
    const provider = batch.provider_name || 'Proveedor sin nombre'
    const available = Number(batch.available_to_register)
    const registered = Number(batch.registered_licenses) || 0
    const quantity = Number(batch.quantity) || 0
    const availability = Number.isFinite(available)
      ? `${available} disponibles para registrar`
      : `${registered}/${quantity} registradas`

    return `${product}${variant} · ${formatDuration(batch)} · ${provider} · ${availability} (${registered}/${quantity})`
  }

  function nextStep() {
    if (!validateStep()) {
      setError('Completa los campos obligatorios antes de continuar.')
      return
    }

    if (step === 1) {
      const commercialRegex = new RegExp(`^${COMMERCIAL_IDENTIFIER_PATTERN}$`, 'i')
      const licenseCodeRegex = new RegExp(`^${LICENSE_CODE_PATTERN}$`, 'i')

      if (!commercialRegex.test(form.commercial_identifier.trim())) {
        setError('El ID comercial público debe tener entre 2 y 180 caracteres. Puede ser OEM, Retail/FPP, contrato, SKU o ID público del proveedor.')
        return
      }

      if (!licenseCodeRegex.test(form.license_code.trim())) {
        setError('La clave única debe usar un formato válido del proveedor: ESET 5x4, Microsoft 5x5, Kaspersky 20 caracteres o Adobe 6x4 numérico.')
        return
      }
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
      const isFirstActivation = form.validity_start_mode === 'first_activation'
      await api.request('/licenses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          start_date: isFirstActivation ? '' : form.start_date,
          redeem_deadline_date: isFirstActivation ? form.redeem_deadline_date : '',
          batch_id: Number(form.batch_id),
          responsible_user_id: Number(form.responsible_user_id),
	          cost: Number(form.cost),
          sale_price: form.sale_price === '' ? Number(form.cost) : Number(form.sale_price),
	          next_renewal_date: isFirstActivation ? '' : calculateRenewalDate(),
        }),
      })
      await onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renewalDate = calculateRenewalDate()

  return (
    <Modal title="Registrar licencia" eyebrow="Wizard" onClose={onClose} size="large">
      <form className="wizard-panel" onSubmit={submit}>
        <p className="guide-text">
          Este formulario registra la licencia en inventario. La activación real se hace después desde la acción Activar ahora.
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
	                    {registerableBatches.map((batch) => (
	                      <option key={batch.id} value={batch.id}>
	                        {formatBatchOption(batch)}
	                      </option>
	                    ))}
	                  </select>
	                  <span className="field-help">Solo se muestran lotes confirmados y con cupo disponible. Si no existe, créalo sin salir de este formulario.</span>
	                </div>

	                <label>
	                  Custodio inicial
	                  <select value={form.responsible_user_id} onChange={(event) => updateField('responsible_user_id', event.target.value)} required>
	                    <option value="">Seleccionar custodio</option>
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
                  ID comercial público
                  <input
                    value={form.commercial_identifier}
                    onChange={(event) => updateField('commercial_identifier', event.target.value.toUpperCase())}
                    placeholder="OEM-WIN11-PRO-001, FPP-KAV-2026 o contrato/SKU"
                    pattern={COMMERCIAL_IDENTIFIER_PATTERN}
                    title="Puede ser un ID OEM, Retail/FPP, contrato, SKU o identificador público del proveedor."
                    required
                  />
                  <span className="field-help">Identifica familia, producto, contrato, SKU o canal comercial. Es visible y no activa el software.</span>
                </label>

	                <label>
	                  Clave única de activación
	                  <div className="password-field-wrapper">
	                    <input
	                      type={showLicenseCode ? 'text' : 'password'}
	                      value={form.license_code}
	                      onChange={(event) => updateField('license_code', event.target.value.toUpperCase())}
	                      placeholder="ESET 5x4, Microsoft 5x5, Kaspersky 20, Adobe 6x4"
	                      pattern={LICENSE_CODE_PATTERN}
	                      title="Formatos válidos: ESET 5 bloques de 4, Microsoft 5 bloques de 5, Kaspersky 20 caracteres corridos, Adobe 6 bloques numéricos de 4."
	                      required
	                    />
	                    <button
	                      type="button"
	                      className="password-toggle-button"
	                      onClick={() => setShowLicenseCode((current) => !current)}
	                      aria-label={showLicenseCode ? 'Ocultar clave única' : 'Mostrar clave única'}
	                      title={showLicenseCode ? 'Ocultar' : 'Mostrar'}
	                    >
	                      <span aria-hidden="true">&#128065;</span>
	                    </button>
	                  </div>
	                  <span className="field-help">Depende del fabricante. Es confidencial, se cifra en base de datos y solo se muestra enmascarada.</span>
	                </label>
              </div>
            )}

            {step === 2 && (
              <div className="wizard-grid">
	                <label>
		                  Modo de inicio de vigencia
	                  <select value={form.validity_start_mode} onChange={(event) => updateField('validity_start_mode', event.target.value)} required>
	                    <option value="purchase_date">Compra online/oficial: vence desde la compra</option>
	                    <option value="first_activation">Física/distribuidor: vence desde la primera activación</option>
	                  </select>
	                  <span className="field-help">
	                    {form.validity_start_mode === 'purchase_date'
	                      ? 'Ejemplo: tienda oficial. Si se activa después de 3 meses, queda menos tiempo de uso.'
	                      : 'Ejemplo: caja física o distribuidor. El periodo completo empieza al activarla.'}
	                  </span>
		                </label>

	                <label>
		                  Fecha de compra/facturación
	                  <input
	                    type="date"
	                    value={form.start_date}
	                    onChange={(event) => updateField('start_date', event.target.value)}
	                    required={form.validity_start_mode === 'purchase_date'}
	                    disabled={form.validity_start_mode === 'first_activation'}
	                  />
	                  {form.validity_start_mode === 'first_activation' && (
		                    <span className="field-help">No aplica. Se calculará automáticamente al activar la licencia.</span>
	                  )}
	                </label>

		                {form.validity_start_mode === 'purchase_date' && (
		                  <label>
		                    Fecha de vencimiento
		                    <input
		                      value={formatDate(renewalDate)}
		                      readOnly
		                      aria-readonly="true"
		                    />
		                    <span className="field-help">Automática: fecha de compra/facturación + {getRenewalDurationDays()} días.</span>
		                  </label>
		                )}

		                {form.validity_start_mode === 'first_activation' && (
		                  <label>
		                    Fecha límite de canje
		                    <input type="date" value={form.redeem_deadline_date} onChange={(event) => updateField('redeem_deadline_date', event.target.value)} />
		                    <span className="field-help">Opcional. Controla hasta cuándo puede activarse por primera vez.</span>
		                  </label>
		                )}
	
		                <label>
		                  Costo de adquisición
	                  <input type="number" min="0" step="0.01" value={form.cost} onChange={(event) => updateField('cost', event.target.value)} required />
	                </label>

	                <label>
	                  Precio de venta
	                  <input type="number" min="0" step="0.01" value={form.sale_price} onChange={(event) => updateField('sale_price', event.target.value)} placeholder="Si queda vacío, usa el costo" />
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
	                <p><strong>Lote:</strong> {selectedBatch ? formatBatchOption(selectedBatch) : '-'}</p>
                <p><strong>Custodio inicial:</strong> {selectedUser?.name || '-'}</p>
                <p><strong>Licencia:</strong> {form.name || '-'}</p>
                <p><strong>ID comercial público:</strong> {form.commercial_identifier || '-'}</p>
                <p><strong>Clave única:</strong> se guardará cifrada y enmascarada</p>
                <p><strong>Inicio:</strong> {form.validity_start_mode === 'first_activation' ? 'Se asignará al activar' : form.start_date || '-'}</p>
                <p><strong>Modo de vigencia:</strong> {form.validity_start_mode === 'first_activation' ? 'Física/distribuidor: desde primera activación' : 'Online/oficial: desde compra'}</p>
                {form.validity_start_mode === 'purchase_date' ? (
                  <p><strong>Fecha de vencimiento:</strong> {formatDate(renewalDate)} automática</p>
                ) : (
                  <p><strong>Fecha límite de canje:</strong> {formatDate(form.redeem_deadline_date)}</p>
                )}
	                <p><strong>Costo:</strong> {form.currency_code} {form.cost || '0'}</p>
	                <p><strong>Precio de venta:</strong> {form.currency_code} {form.sale_price || form.cost || '0'}</p>
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
