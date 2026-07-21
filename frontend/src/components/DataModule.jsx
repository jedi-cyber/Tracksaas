import { useEffect, useState } from 'react'
import DataTable from './DataTable'
import EntityModal from './EntityModal'
import LicenseWizard from './LicenseWizard'
import { formConfig, rolePermissions, tableConfig } from '../config/modules'

function DataModule({ api, moduleId, setError, user }) {
  const config = tableConfig[moduleId]
  const entityForm = formConfig[moduleId]
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLicenseWizard, setShowLicenseWizard] = useState(false)
  const [licenseWizardInitialValues, setLicenseWizardInitialValues] = useState({})
  const [formMode, setFormMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [guidedModal, setGuidedModal] = useState(null)
  const permissions = rolePermissions[user?.role?.name]?.[moduleId] || []
  const canCreate = permissions.includes('create')
  const canUpdate = permissions.includes('update')
  const canDelete = permissions.includes('delete')
  const canCreateLicense = moduleId === 'licenses' && permissions.includes('create')

  async function load() {
    if (!config) return
    setLoading(true)
    try {
      const body = await api.request(`${config.path}?limit=25&includeInactive=true`)
      setRows(body.data || [])
      setPagination(body.pagination || null)
    } catch (err) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFormMode(null)
    setSelectedRow(null)
    setShowLicenseWizard(false)
    setLicenseWizardInitialValues({})
    setGuidedModal(null)
    load()
  }, [config?.path])

  async function licenseAction(id, action) {
    const path = action === 'cancel' ? `/licenses/${id}` : `/licenses/${id}/${action}`
    const method = action === 'cancel' ? 'DELETE' : 'POST'

    try {
      if (action === 'cancel' && !window.confirm('¿Confirmas cancelar esta licencia?')) {
        return
      }
      await api.request(path, { method, body: action === 'activate' ? '{}' : undefined })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function openCreateForm() {
    setSelectedRow(null)
    setFormMode('create')
    setShowLicenseWizard(false)
    setGuidedModal(null)
  }

  function openEditForm(row) {
    setSelectedRow(row)
    setFormMode('edit')
    setShowLicenseWizard(false)
  }

  function openDetail(row) {
    setSelectedRow(row)
    setFormMode('detail')
    setShowLicenseWizard(false)
  }

  async function removeRow(row) {
    const verb = moduleId === 'batches' || moduleId === 'licenses' ? 'cancelar' : 'desactivar'
    if (!window.confirm(`¿Confirmas ${verb} este registro?`)) {
      return
    }

    try {
      await api.request(`${config.path}/${row.id}`, { method: 'DELETE' })
      setFormMode(null)
      setSelectedRow(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function reactivateRow(row) {
    const payload = moduleId === 'batches'
      ? { active: true, status: 'draft' }
      : moduleId === 'licenses'
        ? { active: true, status: 'available' }
        : { active: true }

    if (!window.confirm('¿Confirmas reactivar este registro?')) {
      return
    }

    try {
      await api.request(`${config.path}/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  function isInactiveRow(row) {
    return row.active === false || row.status === 'cancelled'
  }

  if (!config) return null

  return (
    <section className="content-block">
      <div className="section-header">
        <div>
          <span className="eyebrow">Módulo</span>
          <h3>{config.title}</h3>
          {pagination && <p>{pagination.total} registros encontrados</p>}
        </div>
        <div className="header-actions">
          {entityForm && canCreate && moduleId !== 'licenses' && (
            <button type="button" onClick={openCreateForm}>
              Nuevo
            </button>
          )}
          {canCreateLicense && (
            <button
              type="button"
              onClick={() => {
                setLicenseWizardInitialValues({})
                setShowLicenseWizard(true)
              }}
            >
              Nueva Activación
            </button>
          )}
          <button type="button" className="secondary-button" onClick={load}>
            Actualizar
          </button>
        </div>
      </div>

      {showLicenseWizard && (
        <LicenseWizard
          api={api}
          setError={setError}
          initialValues={licenseWizardInitialValues}
          onClose={() => setShowLicenseWizard(false)}
          onCreated={async () => {
            setShowLicenseWizard(false)
            setLicenseWizardInitialValues({})
            await load()
          }}
        />
      )}

      {entityForm && formMode && (
        <EntityModal
          api={api}
          config={config}
          formConfig={entityForm}
          mode={formMode}
          row={selectedRow}
          guideText={entityForm.guideText}
          setError={setError}
          onClose={() => {
            setFormMode(null)
            setSelectedRow(null)
          }}
          onSaved={async (createdRow) => {
            setFormMode(null)
            setSelectedRow(null)
            if (formMode === 'create' && ['products', 'variants', 'batches'].includes(moduleId)) {
              await handleGuidedSave(moduleId, createdRow)
            } else {
              await load()
            }
          }}
        />
      )}

      {guidedModal && (
        <EntityModal
          api={api}
          config={tableConfig[guidedModal.moduleId]}
          formConfig={formConfig[guidedModal.moduleId]}
          mode="create"
          row={null}
          initialValues={guidedModal.initialValues}
          guideText={guidedModal.guideText || formConfig[guidedModal.moduleId]?.guideText}
          setError={setError}
          onClose={() => setGuidedModal(null)}
          onSaved={async (createdRow) => {
            await handleGuidedSave(guidedModal.moduleId, createdRow)
          }}
        />
      )}

      {loading ? (
        <p>Cargando registros...</p>
      ) : (
        <DataTable
          rows={rows}
          columns={config.columns}
          actions={
            entityForm || moduleId === 'licenses'
              ? (row) => (
                <div className="row-actions">
                  <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
                    Ver
                  </button>
                  {entityForm && canUpdate && (
                    <button type="button" onClick={() => openEditForm(row)}>
                      Editar
                    </button>
                  )}
                  {moduleId === 'licenses' && permissions.includes('reserve') && (
                    <>
                      <button type="button" onClick={() => licenseAction(row.id, 'reserve')}>
                        Reservar
                      </button>
                      <button type="button" onClick={() => licenseAction(row.id, 'release-reservation')}>
                        Liberar
                      </button>
                    </>
                  )}
                  {moduleId === 'licenses' && permissions.includes('activate') && (
                    <button type="button" onClick={() => licenseAction(row.id, 'activate')}>
                      Activar
                    </button>
                  )}
                  {canUpdate && isInactiveRow(row) && (
                    <button type="button" onClick={() => reactivateRow(row)}>
                      Reactivar
                    </button>
                  )}
                  {(canDelete || (moduleId === 'licenses' && permissions.includes('delete'))) && !isInactiveRow(row) && (
                    <button type="button" className="danger-button" onClick={() => removeRow(row)}>
                      {moduleId === 'batches' || moduleId === 'licenses' ? 'Cancelar' : 'Desactivar'}
                    </button>
                  )}
                </div>
              )
              : null
          }
        />
      )}
    </section>
  )

  async function handleGuidedSave(createdModuleId, createdRow) {
    setGuidedModal(null)
    await load()

    if (createdModuleId === 'products' && createdRow?.id) {
      setGuidedModal({
        moduleId: 'variants',
        initialValues: { product_id: createdRow.id },
        guideText: 'Producto creado. Ahora registra la variante ligada a ese producto.',
      })
      return
    }

    if (createdModuleId === 'variants' && createdRow?.id) {
      setGuidedModal({
        moduleId: 'batches',
        initialValues: { variant_id: createdRow.id },
        guideText: 'Variante creada. Ahora registra el lote ligado a esa variante.',
      })
      return
    }

    if (createdModuleId === 'batches' && createdRow?.id) {
      setLicenseWizardInitialValues({ batch_id: createdRow.id })
      setShowLicenseWizard(true)
    }
  }
}

export default DataModule
