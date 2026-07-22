import { useEffect, useState } from 'react'
import ActivationModal from './ActivationModal'
import ConfirmModal from './ConfirmModal'
import DataTable from './DataTable'
import EntityModal from './EntityModal'
import LicenseDetailModal from './LicenseDetailModal'
import LicenseWizard from './LicenseWizard'
import ReasonModal from './ReasonModal'
import ReservationModal from './ReservationModal'
import { EmptyState, LoadingState } from './StateMessage'
import { formConfig, rolePermissions, tableConfig } from '../config/modules'
import { formatValue } from '../utils/formatters'

const EMPTY_FILTERS = {
  productId: '',
  providerId: '',
  status: '',
  responsibleUserId: '',
  due: '',
}

const DEFAULT_PAGE_SIZE = 10

function DataModule({ api, moduleId, setError, user }) {
  const config = tableConfig[moduleId]
  const isLicenseModule = ['licenses', 'expiredLicenses'].includes(moduleId)
  const isLicenseDetailModule = ['licenses', 'activations', 'expiredLicenses'].includes(moduleId)
  const hasOperationalFilters = ['licenses', 'activations', 'expiredLicenses'].includes(moduleId)
  const entityForm = formConfig[moduleId] || (isLicenseModule ? formConfig.licenses : null)
	  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [filterOptions, setFilterOptions] = useState({ products: [], providers: [], users: [] })
  const [showLicenseWizard, setShowLicenseWizard] = useState(false)
  const [licenseWizardInitialValues, setLicenseWizardInitialValues] = useState({})
  const [formMode, setFormMode] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null)
  const [activationRow, setActivationRow] = useState(null)
  const [reservationRow, setReservationRow] = useState(null)
  const [guidedModal, setGuidedModal] = useState(null)
  const [reasonAction, setReasonAction] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const permissions = rolePermissions[user?.role?.name]?.[moduleId] || (isLicenseModule ? rolePermissions[user?.role?.name]?.licenses : []) || []
  const licensePermissions = rolePermissions[user?.role?.name]?.licenses || []
  const canCreate = permissions.includes('create')
  const canUpdate = permissions.includes('update')
  const canDelete = permissions.includes('delete')
  const canRead = permissions.includes('read')
  const canExpire = permissions.includes('expire')
  const canUpdateLicense = licensePermissions.includes('update')
  const canCreateLicense = moduleId === 'licenses' && permissions.includes('create')

  async function loadFilterOptions() {
    if (!hasOperationalFilters) return

    try {
      const [productsBody, providersBody, usersBody] = await Promise.all([
        api.request('/products?limit=100'),
        api.request('/providers?limit=100'),
        api.request('/users?limit=100'),
      ])
      setFilterOptions({
        products: productsBody.data || [],
        providers: providersBody.data || [],
        users: usersBody.data || [],
      })
    } catch (err) {
      setError(err.message)
    }
  }

  function buildFilterQuery(nextFilters = filters) {
    const params = new URLSearchParams()
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (!value) return
      params.set(key, value)
    })
    const query = params.toString()
    return query ? `&${query}` : ''
  }

  async function load(searchOverride, filtersOverride, pageOverride, pageSizeOverride) {
    if (!config) return
    setLoading(true)
	    try {
	      const limit = pageSizeOverride || pageSize
      const nextPage = pageOverride || page
	      const effectiveSearch = typeof searchOverride === 'string' ? searchOverride : searchTerm
      const normalizedSearch = String(effectiveSearch || '').trim()
	      const searchQuery = normalizedSearch ? `&search=${encodeURIComponent(normalizedSearch)}` : ''
      const fixedQuery = config.fixedQuery ? `&${config.fixedQuery}` : ''
      const filterQuery = hasOperationalFilters ? buildFilterQuery(filtersOverride || filters) : ''
      const statusQuery = moduleId === 'licenses' && !(filtersOverride || filters).status
        ? '&statuses=available,reserved'
        : ''
	      const body = await api.request(`${config.path}?page=${nextPage}&limit=${limit}&includeInactive=true${fixedQuery}${statusQuery}${filterQuery}${searchQuery}`)
	      const nextRows = body.data || []
      setRows(nextRows)
      setPagination(body.pagination || null)
      setPage(body.pagination?.page || nextPage)
      setPageSize(body.pagination?.limit || limit)
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
    setActivationRow(null)
    setReservationRow(null)
    setGuidedModal(null)
    setReasonAction(null)
    setConfirmAction(null)
    setSearchTerm('')
    setFilters(EMPTY_FILTERS)
    setPage(1)
    setPageSize(DEFAULT_PAGE_SIZE)
    loadFilterOptions()
    load('', EMPTY_FILTERS, 1, DEFAULT_PAGE_SIZE)
  }, [config?.path, moduleId])

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setSearchTerm('')
    setPage(1)
    load('', EMPTY_FILTERS, 1)
  }

  function applyFilters() {
    setPage(1)
    load(undefined, filters, 1)
  }

  function searchCurrentModule() {
    setPage(1)
    load(undefined, filters, 1)
  }

  function changePage(nextPage) {
    if (!pagination) return
    const boundedPage = Math.min(Math.max(nextPage, 1), Math.max(pagination.totalPages || 1, 1))
    load(undefined, filters, boundedPage)
  }

  function changePageSize(nextSize) {
    const normalizedSize = Number(nextSize) || DEFAULT_PAGE_SIZE
    setPageSize(normalizedSize)
    setPage(1)
    load(undefined, filters, 1, normalizedSize)
  }

  async function licenseAction(id, action) {
    if (action === 'mark-expired') {
      setReasonAction({
        title: 'Marcar licencia como expirada',
        description: 'Usa esta acción cuando soporte confirma que el proveedor rechazó la clave o que ya no puede activarse.',
        confirmLabel: 'Marcar expirada',
        danger: true,
        onConfirm: async (reason) => {
          await api.request(`/licenses/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'expired',
              expiration_date: new Date().toISOString().slice(0, 10),
              reason,
              notes: reason,
            }),
          })
          setReasonAction(null)
          await load()
          setError('Licencia marcada como expirada.', 'success')
        },
      })
      return
    }

    if (action === 'cancel') {
      setReasonAction({
        title: 'Cancelar licencia',
        description: 'Indica por qué se cancela la licencia. Esto evita dudas de responsabilidad en auditoría.',
        confirmLabel: 'Cancelar licencia',
        danger: true,
        onConfirm: async (reason) => {
          await api.request(`/licenses/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ reason, notes: reason }),
          })
          setReasonAction(null)
          await load()
          setError('Licencia cancelada.', 'success')
        },
      })
      return
    }

    try {
      const path = `/licenses/${id}/${action}`
      await api.request(path, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitReasonAction(reason) {
    if (!reasonAction?.onConfirm) return

      try {
        await reasonAction.onConfirm(reason)
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

  async function openLicenseEditForm(row) {
    try {
      const licenseId = row.license_unit_id || row.id
      const body = await api.request(`/licenses/${licenseId}`)
      setSelectedRow(body.data)
      setFormMode('license-edit')
      setShowLicenseWizard(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function openDetail(row) {
    setSelectedRow(row)
    setFormMode('detail')
    setShowLicenseWizard(false)
  }

  async function executeRemoveRow(row) {
    try {
      await api.request(`${config.path}/${row.id}`, { method: 'DELETE' })
      setFormMode(null)
      setSelectedRow(null)
      setConfirmAction(null)
      await load()
      setError(`${moduleId === 'batches' ? 'Registro cancelado' : 'Registro desactivado'}.`, 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  function removeRow(row) {
    const verb = moduleId === 'batches' || moduleId === 'licenses' ? 'cancelar' : 'desactivar'
    const title = moduleId === 'batches' ? 'Cancelar lote' : 'Desactivar registro'
    const label = moduleId === 'batches' ? 'Cancelar lote' : 'Desactivar'

    setConfirmAction({
      title,
      confirmLabel: label,
      danger: true,
      description: `Confirma si deseas ${verb} este registro. La acción no elimina físicamente la información; se conserva para auditoría e historial.`,
      onConfirm: () => executeRemoveRow(row),
    })
  }

  async function executeReactivateRow(row) {
    const payload = moduleId === 'batches'
      ? { active: true, status: 'draft' }
      : moduleId === 'licenses'
        ? { active: true, status: 'available' }
        : { active: true }

    try {
      await api.request(`${config.path}/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setConfirmAction(null)
      await load()
      setError('Registro reactivado.', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  function reactivateRow(row) {
    setConfirmAction({
      title: 'Reactivar registro',
      confirmLabel: 'Reactivar',
      danger: false,
      description: 'Confirma si deseas volver a activar este registro para que pueda usarse nuevamente.',
      onConfirm: () => executeReactivateRow(row),
    })
  }

  function isInactiveRow(row) {
    return row.active === false || row.status === 'cancelled'
  }

  function renderLicenseActions(row) {
    if (row.status === 'available') {
      return (
        <>
          {canRead && (
            <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
              Ver ficha
            </button>
          )}
          {canUpdate && (
            <button type="button" onClick={() => openEditForm(row)}>
              Editar
            </button>
          )}
          {permissions.includes('reserve') && (
            <button type="button" onClick={() => setReservationRow(row)}>
              Reservar
            </button>
          )}
          {permissions.includes('activate') && (
            <button type="button" onClick={() => setActivationRow(row)}>
              Activar ahora
            </button>
          )}
          {canExpire && (
            <button type="button" className="danger-button" onClick={() => licenseAction(row.id, 'mark-expired')}>
              Marcar expirada
            </button>
          )}
          {canDelete && (
            <button type="button" className="danger-button" onClick={() => licenseAction(row.id, 'cancel')}>
              Cancelar
            </button>
          )}
        </>
      )
    }

    if (row.status === 'reserved') {
      return (
        <>
          {canRead && (
            <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
              Ver ficha
            </button>
          )}
          {canUpdate && (
            <button type="button" onClick={() => openEditForm(row)}>
              Editar
            </button>
          )}
          {permissions.includes('reserve') && (
            <button type="button" onClick={() => licenseAction(row.id, 'release-reservation')}>
              Liberar reserva
            </button>
          )}
          {permissions.includes('activate') && (
            <button type="button" onClick={() => setActivationRow(row)}>
              Activar ahora
            </button>
          )}
          {canExpire && (
            <button type="button" className="danger-button" onClick={() => licenseAction(row.id, 'mark-expired')}>
              Marcar expirada
            </button>
          )}
          {canDelete && (
            <button type="button" className="danger-button" onClick={() => licenseAction(row.id, 'cancel')}>
              Cancelar
            </button>
          )}
        </>
      )
    }

    if (row.status === 'activated') {
      return (
        <>
          {canRead && (
            <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
              Ver activación
            </button>
          )}
          {canUpdate && (
            <button type="button" onClick={() => openEditForm(row)}>
              Editar datos
            </button>
          )}
        </>
      )
    }

    if (row.status === 'expired') {
      return (
        <>
          {canRead && (
            <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
              Ver motivo
            </button>
          )}
          {canUpdate && (
            <button type="button" onClick={() => openEditForm(row)}>
              Editar datos
            </button>
          )}
        </>
      )
    }

    if (row.status === 'cancelled') {
      return canUpdate ? (
        <button type="button" onClick={() => reactivateRow(row)}>
          Reactivar
        </button>
      ) : null
    }

    return (
      canRead ? (
        <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
          Ver ficha
        </button>
      ) : null
    )
  }

  function renderGenericActions(row) {
    return (
      <>
        {canRead && (
          <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
            Ver
          </button>
        )}
        {entityForm && canUpdate && (
          <button type="button" onClick={() => openEditForm(row)}>
            Editar
          </button>
        )}
        {canUpdate && isInactiveRow(row) && (
          <button type="button" onClick={() => reactivateRow(row)}>
            Reactivar
          </button>
        )}
        {canDelete && !isInactiveRow(row) && (
          <button type="button" className="danger-button" onClick={() => removeRow(row)}>
            {moduleId === 'batches' ? 'Cancelar' : 'Desactivar'}
          </button>
        )}
      </>
    )
  }

  function renderActivationActions(row) {
    return (
      <>
        {permissions.includes('read') && (
          <button type="button" className="secondary-button" onClick={() => openDetail(row)}>
            Ver activación
          </button>
        )}
        {canUpdateLicense && (
          <button type="button" onClick={() => openLicenseEditForm(row)}>
            Editar datos
          </button>
        )}
      </>
    )
  }

  function renderModuleSummary() {
    if (moduleId !== 'activations' || loading) return null

    const expiringSoon = rows.filter((row) => Number(row.days_remaining) >= 0 && Number(row.days_remaining) <= 30).length
    const expired = rows.filter((row) => Number(row.days_remaining) < 0).length
    const healthy = rows.filter((row) => Number(row.days_remaining) > 30).length

    return (
      <div className="module-summary">
        <div>
          <span>Activadas</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Por vencer</span>
          <strong>{expiringSoon}</strong>
        </div>
        <div>
          <span>Vencidas</span>
          <strong>{expired}</strong>
        </div>
        <div>
          <span>Sin riesgo</span>
          <strong>{healthy}</strong>
        </div>
      </div>
    )
  }

  function renderOperationalFilters() {
    if (!hasOperationalFilters) return null

    const statusOptions = moduleId === 'licenses'
      ? ['available', 'reserved']
      : moduleId === 'expiredLicenses'
        ? []
        : ['activated', 'expired']

    return (
      <div className="operational-filters" aria-label="Filtros operativos">
        <label>
          Producto
          <select value={filters.productId} onChange={(event) => updateFilter('productId', event.target.value)}>
            <option value="">Todos</option>
            {filterOptions.products.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        <label>
          Proveedor
          <select value={filters.providerId} onChange={(event) => updateFilter('providerId', event.target.value)}>
            <option value="">Todos</option>
            {filterOptions.providers.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        {statusOptions.length > 0 && (
          <label>
            Estado
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{formatValue(status)}</option>
              ))}
            </select>
          </label>
        )}

        <label>
          Responsable
          <select value={filters.responsibleUserId} onChange={(event) => updateFilter('responsibleUserId', event.target.value)}>
            <option value="">Todos</option>
            {filterOptions.users.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        <label>
          Vencimiento
          <select value={filters.due} onChange={(event) => updateFilter('due', event.target.value)}>
            <option value="">Todos</option>
            <option value="overdue">Vencidas</option>
            <option value="next30">Próximos 30 días</option>
            <option value="over30">Más de 30 días</option>
            <option value="no_date">Sin fecha</option>
          </select>
        </label>

        <div className="filter-actions">
          <button type="button" onClick={applyFilters}>
            Aplicar filtros
          </button>
          <button type="button" className="secondary-button" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </div>
    )
  }

  if (!config) return null
  if (!canRead) {
    return (
      <section className="content-block">
        <EmptyState message="No tienes permisos para ver este módulo." />
      </section>
    )
  }

  function renderPagination() {
    if (!pagination) return null

    const totalPages = Math.max(pagination.totalPages || 1, 1)
    const firstItem = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1
    const lastItem = Math.min(pagination.page * pagination.limit, pagination.total)

    return (
      <div className="pagination-bar" aria-label="Paginación">
        <div>
          <strong>{firstItem}-{lastItem}</strong>
          <span> de {pagination.total} registros</span>
        </div>

        <label>
          Por página
          <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>

        <div className="pagination-actions">
          <button type="button" className="secondary-button" disabled={pagination.page <= 1} onClick={() => changePage(1)}>
            Primero
          </button>
          <button type="button" className="secondary-button" disabled={pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}>
            Anterior
          </button>
          <span>Página {pagination.page} de {totalPages}</span>
          <button type="button" className="secondary-button" disabled={pagination.page >= totalPages} onClick={() => changePage(pagination.page + 1)}>
            Siguiente
          </button>
          <button type="button" className="secondary-button" disabled={pagination.page >= totalPages} onClick={() => changePage(totalPages)}>
            Último
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="content-block">
      <div className="section-header">
        <div>
          <span className="eyebrow">Módulo</span>
          <h3>{config.title}</h3>
          {pagination && (
            <p>{pagination.total} registros encontrados</p>
          )}
        </div>
        <div className="header-actions">
	          {['licenses', 'activations', 'expiredLicenses'].includes(moduleId) && (
            <input
              className="module-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') searchCurrentModule()
              }}
	              placeholder={moduleId === 'activations' ? 'Buscar activada...' : 'Buscar licencia...'}
            />
          )}
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
              Registrar licencia
            </button>
          )}
          <button type="button" className="secondary-button" onClick={searchCurrentModule}>
            {searchTerm.trim() ? 'Buscar' : 'Actualizar'}
          </button>
        </div>
      </div>

      {renderOperationalFilters()}

      {renderModuleSummary()}

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

      {activationRow && (
        <ActivationModal
          api={api}
          license={activationRow}
          setError={setError}
          user={user}
          onClose={() => setActivationRow(null)}
          onActivated={async () => {
            setActivationRow(null)
            await load()
          }}
        />
      )}

      {reservationRow && (
        <ReservationModal
          api={api}
          license={reservationRow}
          setError={setError}
          user={user}
          onClose={() => setReservationRow(null)}
          onReserved={async () => {
            setReservationRow(null)
            await load()
            setError('Licencia reservada.', 'success')
          }}
        />
      )}

      {reasonAction && (
        <ReasonModal
          title={reasonAction.title}
          description={reasonAction.description}
          confirmLabel={reasonAction.confirmLabel}
          danger={reasonAction.danger}
          onClose={() => setReasonAction(null)}
          onConfirm={submitReasonAction}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.onConfirm}
        />
      )}

      {isLicenseDetailModule && formMode === 'detail' && selectedRow && (
        <LicenseDetailModal
          api={api}
          license={moduleId === 'activations' ? { ...selectedRow, id: selectedRow.license_unit_id } : selectedRow}
          setError={setError}
          onClose={() => {
            setFormMode(null)
            setSelectedRow(null)
          }}
        />
      )}

      {entityForm && formMode && !(isLicenseDetailModule && formMode === 'detail') && (
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

      {formMode === 'license-edit' && selectedRow && (
        <EntityModal
          api={api}
          config={tableConfig.licenses}
          formConfig={formConfig.licenses}
          mode="edit"
          row={selectedRow}
          guideText="Edita datos administrativos de la licencia. La activación, cancelación y expiración se realizan desde acciones guiadas."
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
        <LoadingState message="Buscando registros del módulo." />
      ) : (
        <>
          <DataTable
            moduleId={moduleId}
            rows={rows}
            columns={config.columns}
	            actions={
	              entityForm || ['licenses', 'activations', 'expiredLicenses'].includes(moduleId)
	                ? (row) => (
	                  <div className="row-actions">
	                    {isLicenseModule
	                      ? renderLicenseActions(row)
	                      : moduleId === 'activations'
	                        ? renderActivationActions(row)
	                        : renderGenericActions(row)}
	                  </div>
	                )
	                : null
	            }
          />
          {renderPagination()}
        </>
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
