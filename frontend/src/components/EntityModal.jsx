import { useEffect, useState } from 'react'
import { formConfig as allFormConfig, tableConfig as allTableConfig } from '../config/modules'
import Modal from './Modal'
import { formatValue } from '../utils/formatters'
import { buildPayload, initialFormState, validateForm } from '../utils/forms'
import { LoadingState } from './StateMessage'

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
  const editableFields = formConfig.fields.filter((field) => !shouldHideField(field, row, mode, form))

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
	    const validationError = validateForm(editableFields, form, mode)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')

    try {
	      const payload = buildPayload(editableFields, form, mode)
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
            <LoadingState message="Cargando opciones del formulario." />
          ) : (
            <div className="form-grid">
	              {editableFields.map((field) => {
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
	                    disabled={saving || shouldDisableField(field, row, mode)}
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
  const [showSecret, setShowSecret] = useState(false)
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
        {field.help && <span className="field-help">{field.help}</span>}
      </div>
    )
  }

  if (field.type === 'password') {
    return (
      <label className={className}>
        {field.label}
        <div className="password-field-wrapper">
          <input
            type={showSecret ? 'text' : 'password'}
            value={value || ''}
            required={required}
            min={field.min}
            step={field.step}
            pattern={field.pattern}
            title={field.title}
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
          <button
            type="button"
            className="password-toggle-button"
            disabled={disabled}
            onClick={() => setShowSecret((current) => !current)}
            aria-label={showSecret ? `Ocultar ${field.label}` : `Mostrar ${field.label}`}
            title={showSecret ? 'Ocultar' : 'Mostrar'}
          >
            <span aria-hidden="true">&#128065;</span>
          </button>
        </div>
        {field.help && <span className="field-help">{field.help}</span>}
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
        pattern={field.pattern}
        title={field.title}
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
      {field.help && <span className="field-help">{field.help}</span>}
    </label>
  )
}

function shouldHideField(field, row, mode, form = {}) {
  if (mode === 'edit' && field.hideOnEdit) return true
  if (mode === 'edit' && field.hideOnEditForStatuses?.includes(row?.status)) return true
  if (field.showWhen) {
    return !Object.entries(field.showWhen).every(([key, expected]) => form?.[key] === expected)
  }
  if (mode !== 'edit' || !field.hideOnEditWhen) return false
  return Object.entries(field.hideOnEditWhen).every(([key, expected]) => row?.[key] === expected)
}

function shouldDisableField(field, row, mode) {
  if (mode === 'edit' && field.disabledOnEditForStatuses?.includes(row?.status)) return true
  if (mode !== 'edit' || !field.disabledOnEditWhen) return false
  return Object.entries(field.disabledOnEditWhen).every(([key, expected]) => row?.[key] === expected)
}

export default EntityModal
