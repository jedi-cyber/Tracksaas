import { useState } from 'react'
import Modal from './Modal'

function ConfirmModal({ title, description, confirmLabel, danger, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await onConfirm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} eyebrow="Confirmación" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        {description && <p className="guide-text">{description}</p>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={danger ? 'danger-button' : ''} disabled={saving}>
            {saving ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ConfirmModal
