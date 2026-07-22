import { useState } from 'react'
import Modal from './Modal'

function ReasonModal({ title, description, confirmLabel, danger, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const canSubmit = reason.trim().length >= 5

  async function submit(event) {
    event.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} eyebrow="Motivo requerido" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {description && <p className="guide-text">{description}</p>}
        <label>
          Motivo
          <textarea
            value={reason}
            maxLength="500"
            rows="4"
            placeholder="Ejemplo: proveedor rechazó la clave"
            onChange={(event) => setReason(event.target.value)}
            required
          />
          <span className="field-help">Mínimo 5 caracteres. Este texto quedará en auditoría.</span>
        </label>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={danger ? 'danger-button' : ''} disabled={!canSubmit || saving}>
            {saving ? 'Guardando...' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ReasonModal
