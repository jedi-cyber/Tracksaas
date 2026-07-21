export const modules = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'licenses', label: 'Licencias' },
  { id: 'batches', label: 'Lotes' },
  { id: 'products', label: 'Productos' },
  { id: 'variants', label: 'Variantes' },
  { id: 'customers', label: 'Clientes' },
  { id: 'providers', label: 'Proveedores' },
  { id: 'users', label: 'Usuarios' },
  { id: 'roles', label: 'Roles' },
  { id: 'activations', label: 'Activaciones' },
  { id: 'audit', label: 'Auditoría' },
]

export const tableConfig = {
  licenses: {
    path: '/licenses',
    title: 'Licencias',
    columns: [
      ['name', 'Nombre'],
      ['masked_code', 'Código'],
      ['status', 'Estado'],
      ['next_renewal_date', 'Renovación'],
      ['cost', 'Costo'],
      ['responsible_user_name', 'Responsable'],
    ],
  },
  batches: {
    path: '/batches',
    title: 'Lotes',
    columns: [
      ['batch_number', 'Lote'],
      ['product_name', 'Producto'],
      ['variant_name', 'Variante'],
      ['provider_name', 'Proveedor'],
      ['quantity', 'Cantidad'],
      ['status', 'Estado'],
    ],
  },
  products: {
    path: '/products',
    title: 'Productos',
    columns: [
      ['name', 'Nombre'],
      ['description', 'Descripción'],
      ['active', 'Activo'],
    ],
  },
  variants: {
    path: '/variants',
    title: 'Variantes',
    columns: [
      ['product_name', 'Producto'],
      ['name', 'Variante'],
      ['default_code', 'Código'],
      ['billing_cycle', 'Ciclo'],
      ['default_cost', 'Costo'],
    ],
  },
  customers: {
    path: '/customers',
    title: 'Clientes',
    columns: [
      ['name', 'Nombre'],
      ['tax_id', 'Documento'],
      ['email', 'Correo'],
      ['phone', 'Teléfono'],
      ['active', 'Activo'],
    ],
  },
  providers: {
    path: '/providers',
    title: 'Proveedores',
    columns: [
      ['name', 'Nombre'],
      ['contact_name', 'Contacto'],
      ['email', 'Correo'],
      ['phone', 'Teléfono'],
      ['active', 'Activo'],
    ],
  },
  users: {
    path: '/users',
    title: 'Usuarios',
    columns: [
      ['name', 'Nombre'],
      ['email', 'Correo'],
      ['role_name', 'Rol'],
      ['active', 'Activo'],
      ['last_login_at', 'Último ingreso'],
    ],
  },
  roles: {
    path: '/roles',
    title: 'Roles',
    columns: [
      ['name', 'Nombre'],
      ['description', 'Descripción'],
      ['active', 'Activo'],
    ],
  },
  activations: {
    path: '/activations',
    title: 'Activaciones',
    columns: [
      ['license_name', 'Licencia'],
      ['masked_code', 'Código'],
      ['customer_name', 'Cliente'],
      ['activated_by_name', 'Activó'],
      ['activation_date', 'Fecha'],
      ['device_reference', 'Dispositivo'],
    ],
  },
  audit: {
    path: '/audit-logs',
    title: 'Auditoría',
    columns: [
      ['entity_name', 'Entidad'],
      ['entity_id', 'ID'],
      ['action', 'Acción'],
      ['user_name', 'Usuario'],
      ['ip_address', 'IP'],
      ['created_at', 'Fecha'],
    ],
  },
}

export const formConfig = {
  licenses: {
    options: [
      { name: 'batch_id', path: '/batches?limit=100', labelKey: 'batch_number', secondaryKey: 'variant_name' },
      { name: 'responsible_user_id', path: '/users?limit=100', labelKey: 'name', secondaryKey: 'email' },
    ],
    fields: [
      { name: 'batch_id', label: 'Lote', type: 'select', required: true, optionSource: 'batch_id' },
      { name: 'responsible_user_id', label: 'Responsable', type: 'select', required: true, optionSource: 'responsible_user_id' },
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'license_code', label: 'Nuevo código real', type: 'password', maxLength: 500 },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        staticOptions: [
          { value: 'available', label: 'Disponible' },
          { value: 'reserved', label: 'Reservada' },
          { value: 'expired', label: 'Vencida' },
          { value: 'cancelled', label: 'Cancelada' },
        ],
      },
      { name: 'start_date', label: 'Fecha de inicio', type: 'date', required: true },
      { name: 'next_renewal_date', label: 'Próxima renovación', type: 'date', required: true },
      { name: 'expiration_date', label: 'Fecha de vencimiento', type: 'date' },
      { name: 'cost', label: 'Costo', type: 'number', min: 0, step: '0.01', required: true },
      {
        name: 'billing_cycle',
        label: 'Ciclo',
        type: 'select',
        required: true,
        staticOptions: [
          { value: 'monthly', label: 'Mensual' },
          { value: 'annual', label: 'Anual' },
        ],
      },
      { name: 'currency_code', label: 'Moneda', maxLength: 3, defaultValue: 'PEN', transform: 'uppercase' },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  products: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  variants: {
    options: [{ name: 'product_id', path: '/products?limit=100', labelKey: 'name' }],
    fields: [
      { name: 'product_id', label: 'Producto', type: 'select', required: true, optionSource: 'product_id' },
      { name: 'name', label: 'Variante', required: true, maxLength: 180 },
      { name: 'default_code', label: 'Código interno', maxLength: 100 },
      {
        name: 'billing_cycle',
        label: 'Ciclo',
        type: 'select',
        required: true,
        staticOptions: [
          { value: 'monthly', label: 'Mensual' },
          { value: 'annual', label: 'Anual' },
        ],
        defaultValue: 'annual',
      },
      { name: 'duration_days', label: 'Duración en días', type: 'number', min: 1 },
      { name: 'default_cost', label: 'Costo por defecto', type: 'number', min: 0, step: '0.01', defaultValue: 0 },
      { name: 'currency_code', label: 'Moneda', maxLength: 3, defaultValue: 'PEN', transform: 'uppercase' },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  batches: {
    options: [
      { name: 'variant_id', path: '/variants?limit=100', labelKey: 'name', secondaryKey: 'product_name' },
      { name: 'provider_id', path: '/providers?limit=100', labelKey: 'name' },
    ],
    fields: [
      { name: 'variant_id', label: 'Variante', type: 'select', required: true, optionSource: 'variant_id' },
      { name: 'provider_id', label: 'Proveedor', type: 'select', required: true, optionSource: 'provider_id' },
      { name: 'batch_number', label: 'Número de lote', required: true, maxLength: 100 },
      { name: 'purchase_date', label: 'Fecha de compra', type: 'date', required: true },
      { name: 'quantity', label: 'Cantidad', type: 'number', min: 1, required: true },
      { name: 'unit_cost', label: 'Costo unitario', type: 'number', min: 0, step: '0.01', required: true },
      { name: 'currency_code', label: 'Moneda', maxLength: 3, defaultValue: 'PEN', transform: 'uppercase' },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        defaultValue: 'draft',
        staticOptions: [
          { value: 'draft', label: 'Borrador' },
          { value: 'confirmed', label: 'Confirmado' },
          { value: 'cancelled', label: 'Cancelado' },
        ],
      },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  providers: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'tax_id', label: 'Documento fiscal', maxLength: 30 },
      { name: 'contact_name', label: 'Contacto', maxLength: 150 },
      { name: 'email', label: 'Correo', type: 'email', maxLength: 255 },
      { name: 'phone', label: 'Teléfono', maxLength: 40 },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  customers: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 180 },
      { name: 'tax_id', label: 'Documento', maxLength: 30 },
      { name: 'email', label: 'Correo', type: 'email', maxLength: 255 },
      { name: 'phone', label: 'Teléfono', maxLength: 40 },
      { name: 'notes', label: 'Notas', type: 'textarea', maxLength: 2000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  users: {
    options: [{ name: 'role_id', path: '/roles?limit=100', labelKey: 'name' }],
    fields: [
      { name: 'role_id', label: 'Rol', type: 'select', required: true, optionSource: 'role_id' },
      { name: 'name', label: 'Nombre', required: true, maxLength: 150 },
      { name: 'email', label: 'Correo', type: 'email', required: true, maxLength: 255 },
      { name: 'password', label: 'Contraseña', type: 'password', requiredOnCreate: true, minLength: 8, maxLength: 128 },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
  roles: {
    fields: [
      { name: 'name', label: 'Nombre', required: true, maxLength: 80 },
      { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 1000, full: true },
      { name: 'active', label: 'Activo', type: 'checkbox', defaultValue: true },
    ],
  },
}

export const rolePermissions = {
  administrator: {
    products: ['create', 'update', 'delete'],
    variants: ['create', 'update', 'delete'],
    batches: ['create', 'update', 'delete'],
    providers: ['create', 'update', 'delete'],
    customers: ['create', 'update', 'delete'],
    users: ['create', 'update', 'delete'],
    roles: ['create', 'update', 'delete'],
    licenses: ['create', 'update', 'delete', 'activate', 'reserve'],
  },
  license_user: {
    batches: ['create', 'update'],
    customers: ['create', 'update'],
    licenses: ['create', 'update', 'activate', 'reserve'],
  },
  viewer: {},
}
