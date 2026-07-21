import { useEffect, useState } from 'react'
import { formConfig as allFormConfig, tableConfig as allTableConfig } from '../config/modules'
import Modal from './Modal'
import { formatValue } from '../utils/formatters'
import { buildPayload, initialFormState, validateForm } from '../utils/forms'

function EntityModal({
  api,
  config,
  formConfig,
  mode,
  row,
  setError,
  onClose,
  onSaved,
  relatedActions = {},
  initialValues,
  guideText,
}) {
  const safeInitialValues = initialValues || {}
  const initialValuesKey = JSON.stringify(safeInitialValues)
  const [form, setForm] = useState(() => initialFormState(formConfig.fields, row, mode, safeInitialValues))
  const [options, setOptions] = useState({})
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [relatedModal, setRelatedModal] = useState(null)
  const isDetail = mode === 'detail'
  const title = mode === 'create' ? `Nuevo: ${config.title}` : mode === 'edit' ? `Editar: ${config.title}` : `Detalle: ${config.title}`

  useEffect(() => {
    setForm(initialFormState(formConfig.fields, row, mode, safeInitialValues))
  }, [formConfig, row, mode, initialValuesKey])

  async function loadOptions() {
    const optionSources = formConfig.options || []
    if (!optionSources.length || isDetail) return

    setLoadingOptions(true)
    return Promise.all(optionSources.map((source) => api.request(source.path)))
      .then((responses) => {
        const nextOptions = {}
        optionSources.forEach((source, index) => {
          nextOptions[source.name] = responses[index].data || []
        })
        setOptions(nextOptions)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOptions(false))
  }

  useEffect(() => {
    loadOptions()
  }, [api, formConfig.options, isDetail, setError])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const validationError = validateForm(formConfig.fields, form, mode)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = buildPayload(formConfig.fields, form, mode)
      const body = await api.request(mode === 'create' ? config.path : `${config.path}/${row.id}`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      await onSaved(body?.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} eyebrow={isDetail ? 'Consulta' : 'Formulario'} onClose={onClose} size="large">
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
        <form className="entity-form" onSubmit={submit}>
          {guideText && <p className="guide-text">{guideText}</p>}
          {loadingOptions ? (
            <p>Cargando opciones...</p>
          ) : (
            <div className="form-grid">
              {formConfig.fields.map((field) => {
                const optionConfig = (formConfig.options || []).find(
                  (source) => source.name === field.optionSource
                )

                const generatedAction = optionConfig?.createModule
                  ? {
                    label: optionConfig.createLabel || 'Crear nuevo',
                    onClick: () => setRelatedModal({
                      fieldName: field.name,
                      moduleId: optionConfig.createModule,
                    }),
                  }
                  : null

                return (
                  <FieldControl
                    key={field.name}
                    field={field}
                    value={form[field.name]}
                    optionConfig={optionConfig}
                    options={options[field.optionSource] || []}
                    relatedAction={relatedActions[field.name] || generatedAction}
                    disabled={saving}
                    mode={mode}
                    onChange={(value) => updateField(field.name, value)}
                  />
                )
              })}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || loadingOptions}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {relatedModal && (
        <EntityModal
          api={api}
          config={allTableConfig[relatedModal.moduleId]}
          formConfig={allFormConfig[relatedModal.moduleId]}
          mode="create"
          row={null}
          setError={setError}
          initialValues={relatedModal.initialValues || {}}
          guideText={allFormConfig[relatedModal.moduleId]?.guideText}
          onClose={() => setRelatedModal(null)}
          onSaved={async (createdRow) => {
            setRelatedModal(null)
            await loadOptions()
            if (createdRow?.id) {
              updateField(relatedModal.fieldName, String(createdRow.id))
            }
          }}
        />
      )}
    </Modal>
  )
}

function FieldControl({ field, value, optionConfig, options, relatedAction, disabled, mode, onChange }) {
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
      label: optionConfig?.secondaryKey
        ? `${item[optionConfig.labelKey] || 'Sin nombre'} · ${item[optionConfig.secondaryKey] || ''}`
        : item[optionConfig?.labelKey] || 'Sin nombre',
    }))

    return (
      <div className={`select-field ${className}`}>
        <div className="field-heading">
          <span>{field.label}</span>
          {relatedAction && (
            <button type="button" className="secondary-button inline-create-button" onClick={relatedAction.onClick}>
              {relatedAction.label}
            </button>
          )}
        </div>
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
        {relatedAction && (
          <span className="field-help">Si no existe, créalo sin salir de este formulario.</span>
        )}
      </div>
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

export default EntityModal
