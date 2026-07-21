export function initialFormState(fields, row, mode, initialValues = {}) {
  return fields.reduce((state, field) => {
    if (field.name === 'password' && mode === 'edit') {
      state[field.name] = ''
      return state
    }

    const rowValue = row?.[field.name] ?? initialValues[field.name]
    if (rowValue !== undefined && rowValue !== null) {
      state[field.name] = normalizeFormValue(field, rowValue)
    } else if (field.defaultValue !== undefined) {
      state[field.name] = field.defaultValue
    } else if (field.type === 'checkbox') {
      state[field.name] = false
    } else {
      state[field.name] = ''
    }

    return state
  }, {})
}

export function buildPayload(fields, form, mode) {
  return fields.reduce((payload, field) => {
    const value = form[field.name]

    if (mode === 'edit' && field.name === 'password' && !value) {
      return payload
    }

    if (!field.required && !field.requiredOnCreate && field.type !== 'checkbox' && value === '') {
      return payload
    }

    if (field.type === 'number' || (field.type === 'select' && field.optionSource)) {
      payload[field.name] = value === '' ? undefined : Number(value)
    } else {
      payload[field.name] = value
    }

    return payload
  }, {})
}

export function validateForm(fields, form, mode) {
  for (const field of fields) {
    const value = form[field.name]
    const required = field.required || (mode === 'create' && field.requiredOnCreate)

    if (required && (value === undefined || value === null || value === '')) {
      return `El campo ${field.label} es obligatorio.`
    }

    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      return `El campo ${field.label} no tiene un correo válido.`
    }

    if (field.minLength && value && String(value).length < field.minLength) {
      return `El campo ${field.label} debe tener al menos ${field.minLength} caracteres.`
    }

    if (field.maxLength && value && String(value).length > field.maxLength) {
      return `El campo ${field.label} no puede superar ${field.maxLength} caracteres.`
    }

    if (field.type === 'number' && value !== '' && value !== undefined && value !== null) {
      const numberValue = Number(value)
      if (!Number.isFinite(numberValue) || (field.min !== undefined && numberValue < field.min)) {
        return `El campo ${field.label} debe ser un número válido.`
      }
    }
  }

  return null
}

function normalizeFormValue(field, value) {
  if (field.type === 'date' && typeof value === 'string') {
    return value.slice(0, 10)
  }

  return value
}
