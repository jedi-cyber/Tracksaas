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
  const [formMode, setFormMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const permissions = rolePermissions[user?.role?.name]?.[moduleId] || []
  const canCreate = permissions.includes('create')
  const canUpdate = permissions.includes('update')
  const canDelete = permissions.includes('delete')
  const canCreateLicense = moduleId === 'licenses' && permissions.includes('create')

  async function load() {
    if (!config) return
    setLoading(true)
    try {
      const body = await api.request(`${config.path}?limit=25`)
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
            <button type="button" onClick={() => setShowLicenseWizard(true)}>
              Nueva licencia
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
          onClose={() => setShowLicenseWizard(false)}
          onCreated={async () => {
            setShowLicenseWizard(false)
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
          setError={setError}
          onClose={() => {
            setFormMode(null)
            setSelectedRow(null)
          }}
          onSaved={async () => {
            setFormMode(null)
            setSelectedRow(null)
            await load()
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
                  {(canDelete || (moduleId === 'licenses' && permissions.includes('delete'))) && (
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
}

export default DataModule
