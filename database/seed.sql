-- TrackSaaS - Datos iniciales y demo
-- Ejecutar después de schema.sql sobre la base tracksaas_db.
-- PostgreSQL 15+

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. Roles
-- =========================================================
INSERT INTO roles (name, description, active)
VALUES
    ('administrator', 'Acceso total a configuración, usuarios, catálogo, licencias, activaciones, auditoría y reportes.', TRUE),
    ('license_user', 'Puede operar catálogo, lotes, licencias, reservas y activaciones.', TRUE),
    ('viewer', 'Acceso de consulta al dashboard, licencias, activaciones y reportes.', TRUE)
ON CONFLICT (name) DO UPDATE
SET
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 2. Usuarios demo
-- =========================================================
-- Credenciales de desarrollo:
-- admin@tracksaas.local / Admin123*
-- licencias@tracksaas.local / Licencias123*
-- consulta@tracksaas.local / Consulta123*
INSERT INTO users (role_id, name, email, password_hash, active)
SELECT r.id, data.name, data.email, crypt(data.password, gen_salt('bf', 12)), TRUE
FROM (
    VALUES
        ('administrator', 'Administrador TrackSaaS', 'admin@tracksaas.local', 'Admin123*'),
        ('license_user', 'Operador de Licencias', 'licencias@tracksaas.local', 'Licencias123*'),
        ('viewer', 'Usuario de Consulta', 'consulta@tracksaas.local', 'Consulta123*')
) AS data(role_name, name, email, password)
JOIN roles r ON r.name = data.role_name
ON CONFLICT (email) DO UPDATE
SET
    role_id = EXCLUDED.role_id,
    name = EXCLUDED.name,
    active = TRUE,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 3. Proveedores
-- =========================================================
INSERT INTO providers (name, contact_name, email, phone, notes, create_uid, write_uid, active)
SELECT data.name, data.contact_name, data.email, data.phone, data.notes, admin.id, admin.id, TRUE
FROM (
    VALUES
        ('ESET', 'Canal comercial ESET', 'ventas@eset.example', '+51 900 100 001', 'Licencias de seguridad ESET para canales retail y distribuidores.'),
        ('Microsoft', 'Canal Microsoft CSP', 'ventas@microsoft.example', '+51 900 100 002', 'Suscripciones Microsoft 365, Windows y Office.'),
        ('Adobe', 'Distribución Adobe', 'ventas@adobe.example', '+51 900 100 003', 'Suscripciones Creative Cloud y licencias comerciales.'),
        ('Kaspersky', 'Canal Kaspersky', 'ventas@kaspersky.example', '+51 900 100 004', 'Licencias antivirus y protección endpoint.')
) AS data(name, contact_name, email, phone, notes)
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
ON CONFLICT (name) DO UPDATE
SET
    contact_name = EXCLUDED.contact_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    notes = EXCLUDED.notes,
    active = TRUE,
    write_uid = EXCLUDED.write_uid,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 4. Productos
-- =========================================================
INSERT INTO products (name, description, create_uid, write_uid, active)
SELECT data.name, data.description, admin.id, admin.id, TRUE
FROM (
    VALUES
        ('ESET HOME Security', 'Soluciones ESET HOME Security para equipos personales y pequeñas empresas.'),
        ('Microsoft 365', 'Suscripciones Microsoft 365 para productividad y colaboración.'),
        ('Adobe Creative Cloud', 'Licencias Adobe Creative Cloud para diseño, edición y contenido.'),
        ('Kaspersky Standard', 'Licencias Kaspersky para protección de dispositivos.'),
        ('Windows 11', 'Licencias Microsoft Windows 11 para equipos nuevos o regularización.')
) AS data(name, description)
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
ON CONFLICT (name) DO UPDATE
SET
    description = EXCLUDED.description,
    active = TRUE,
    write_uid = EXCLUDED.write_uid,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 5. Variantes
-- =========================================================
INSERT INTO product_variants (
    product_id,
    name,
    default_code,
    billing_cycle,
    duration_days,
    default_cost,
    currency_code,
    create_uid,
    write_uid,
    active
)
SELECT
    p.id,
    data.variant_name,
    data.default_code,
    data.billing_cycle,
    data.duration_days,
    data.default_cost,
    'PEN',
    admin.id,
    admin.id,
    TRUE
FROM (
    VALUES
        ('ESET HOME Security', 'Essential 1 año', 'ESET-ESS-1Y', 'annual', 365, 70.00::NUMERIC),
        ('ESET HOME Security', 'Premium 1 año', 'ESET-PRE-1Y', 'annual', 365, 95.00::NUMERIC),
        ('Microsoft 365', 'Business Basic mensual', 'M365-BASIC-M', 'monthly', 30, 23.00::NUMERIC),
        ('Microsoft 365', 'Business Standard anual', 'M365-STD-1Y', 'annual', 365, 330.00::NUMERIC),
        ('Adobe Creative Cloud', 'Todas las apps anual', 'ADOBE-CC-1Y', 'annual', 365, 1400.00::NUMERIC),
        ('Kaspersky Standard', 'Standard 1 año', 'KASP-STD-1Y', 'annual', 365, 60.00::NUMERIC),
        ('Windows 11', 'Pro Retail', 'WIN11-PRO-RTL', 'annual', 365, 420.00::NUMERIC)
) AS data(product_name, variant_name, default_code, billing_cycle, duration_days, default_cost)
JOIN products p ON p.name = data.product_name
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
ON CONFLICT (product_id, name) DO UPDATE
SET
    default_code = EXCLUDED.default_code,
    billing_cycle = EXCLUDED.billing_cycle,
    duration_days = EXCLUDED.duration_days,
    default_cost = EXCLUDED.default_cost,
    currency_code = EXCLUDED.currency_code,
    active = TRUE,
    write_uid = EXCLUDED.write_uid,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 6. Clientes demo
-- =========================================================
INSERT INTO customers (name, tax_id, email, phone, notes, create_uid, write_uid, active)
SELECT data.name, data.tax_id, data.email, data.phone, data.notes, admin.id, admin.id, TRUE
FROM (
    VALUES
        ('Inversiones Lima SAC', '20600010001', 'soporte@inversioneslima.example', '+51 910 000 101', 'Cliente corporativo demo.'),
        ('Estudio Creativo Norte', '20600010002', 'admin@creativonorte.example', '+51 910 000 102', 'Cliente de diseño y marketing.'),
        ('Servicios Integrales Andinos', '20600010003', 'ti@andinos.example', '+51 910 000 103', 'Cliente para licencias de productividad.'),
        ('Cliente Mostrador Demo', NULL, 'cliente.demo@example', '+51 910 000 104', 'Cliente retail de demostración.')
) AS data(name, tax_id, email, phone, notes)
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
WHERE NOT EXISTS (
    SELECT 1 FROM customers c WHERE c.name = data.name
);

-- =========================================================
-- 7. Lotes confirmados
-- =========================================================
INSERT INTO license_batches (
    variant_id,
    provider_id,
    batch_number,
    purchase_date,
    quantity,
    unit_cost,
    currency_code,
    status,
    notes,
    active,
    create_uid,
    write_uid
)
SELECT
    pv.id,
    pr.id,
    data.batch_number,
    data.purchase_date,
    data.quantity,
    data.unit_cost,
    'PEN',
    'confirmed',
    data.notes,
    TRUE,
    admin.id,
    admin.id
FROM (
    VALUES
        ('ESET HOME Security', 'Premium 1 año', 'LOT-ESET-PRE-2026-001', CURRENT_DATE - 20, 20, 95.00::NUMERIC, 'Lote físico de ESET Premium para venta retail.'),
        ('ESET HOME Security', 'Essential 1 año', 'LOT-ESET-ESS-2026-001', CURRENT_DATE - 120, 15, 70.00::NUMERIC, 'Lote físico de ESET Essential con una cancelación demo.'),
        ('Microsoft 365', 'Business Basic mensual', 'LOT-M365-BASIC-2026-001', CURRENT_DATE - 10, 25, 23.00::NUMERIC, 'Lote digital por facturación CSP.'),
        ('Adobe Creative Cloud', 'Todas las apps anual', 'LOT-ADOBE-CC-2025-001', CURRENT_DATE - 350, 8, 1400.00::NUMERIC, 'Lote anual con una licencia próxima a vencer.'),
        ('Kaspersky Standard', 'Standard 1 año', 'LOT-KASP-STD-2025-001', CURRENT_DATE - 410, 10, 60.00::NUMERIC, 'Lote antiguo usado para mostrar licencias vencidas.'),
        ('Windows 11', 'Pro Retail', 'LOT-WIN11-PRO-2026-001', CURRENT_DATE - 45, 12, 420.00::NUMERIC, 'Lote retail reservado para cliente.')
) AS data(product_name, variant_name, batch_number, purchase_date, quantity, unit_cost, notes)
JOIN products p ON p.name = data.product_name
JOIN product_variants pv ON pv.product_id = p.id AND pv.name = data.variant_name
JOIN providers pr ON pr.name = CASE
    WHEN data.product_name IN ('Microsoft 365', 'Windows 11') THEN 'Microsoft'
    WHEN data.product_name = 'Adobe Creative Cloud' THEN 'Adobe'
    WHEN data.product_name = 'Kaspersky Standard' THEN 'Kaspersky'
    ELSE 'ESET'
END
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
ON CONFLICT (batch_number) DO UPDATE
SET
    variant_id = EXCLUDED.variant_id,
    provider_id = EXCLUDED.provider_id,
    purchase_date = EXCLUDED.purchase_date,
    quantity = EXCLUDED.quantity,
    unit_cost = EXCLUDED.unit_cost,
    currency_code = EXCLUDED.currency_code,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    active = TRUE,
    write_uid = EXCLUDED.write_uid,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 8. Licencias demo
-- =========================================================
WITH demo_licenses AS (
    SELECT *
    FROM (
        VALUES
            ('LOT-ESET-PRE-2026-001', 'Operador de Licencias', 'ESET Premium disponible', 'ESET-PRE-DEMO-001', 'ZBCD-EFGH-IJKL-MNOP-QRST', 'available', 'first_activation', NULL::DATE, NULL::DATE, CURRENT_DATE + 180, NULL::TIMESTAMPTZ, NULL::DATE, 95.00::NUMERIC, 145.00::NUMERIC, 'annual', 'Licencia física disponible. La vigencia empezará al activar.'),
            ('LOT-ESET-PRE-2026-001', 'Operador de Licencias', 'ESET Premium disponible antigua', 'ESET-PRE-DEMO-002', 'BCDE-FGHI-JKLM-NOPQ-RSTU', 'available', 'first_activation', NULL::DATE, NULL::DATE, CURRENT_DATE + 45, NULL::TIMESTAMPTZ, NULL::DATE, 95.00::NUMERIC, 145.00::NUMERIC, 'annual', 'Disponible con prioridad mayor por fecha de canje más cercana.'),
            ('LOT-WIN11-PRO-2026-001', 'Operador de Licencias', 'Windows 11 Pro reservado', 'WIN11-PRO-DEMO-001', '12345-67890-ABCDE-FGHIJ-KLMNO', 'reserved', 'first_activation', NULL::DATE, NULL::DATE, CURRENT_DATE + 120, NULL::TIMESTAMPTZ, NULL::DATE, 420.00::NUMERIC, 620.00::NUMERIC, 'annual', 'Reservada para instalación programada.'),
            ('LOT-M365-BASIC-2026-001', 'Operador de Licencias', 'Microsoft 365 activada', 'M365-BASIC-DEMO-001', '93456-78901-BCDEF-GHIJK-LMNOP', 'activated', 'purchase_date', CURRENT_DATE - 10, CURRENT_DATE + 60, NULL::DATE, CURRENT_TIMESTAMP - INTERVAL '5 days', NULL::DATE, 23.00::NUMERIC, 39.00::NUMERIC, 'monthly', 'Activada para cliente corporativo demo.'),
            ('LOT-ADOBE-CC-2025-001', 'Operador de Licencias', 'Adobe Creative Cloud por vencer', 'ADOBE-CC-DEMO-001', '9111-2222-3333-4444-5555-6666', 'activated', 'purchase_date', CURRENT_DATE - 350, CURRENT_DATE + 15, NULL::DATE, CURRENT_TIMESTAMP - INTERVAL '330 days', NULL::DATE, 1400.00::NUMERIC, 1950.00::NUMERIC, 'annual', 'Próxima a vencer en 15 días para validar alertas amarillas.'),
            ('LOT-KASP-STD-2025-001', 'Operador de Licencias', 'Kaspersky vencida', 'KASP-STD-DEMO-001', 'ZBCDE12345FGHIJ67890', 'expired', 'purchase_date', CURRENT_DATE - 410, CURRENT_DATE - 45, NULL::DATE, NULL::TIMESTAMPTZ, CURRENT_DATE - 45, 60.00::NUMERIC, 105.00::NUMERIC, 'annual', 'Vencida por superar su periodo de vigencia. Motivo: proveedor rechazó la clave por antigüedad.'),
            ('LOT-ESET-ESS-2026-001', 'Operador de Licencias', 'ESET Essential cancelada', 'ESET-ESS-DEMO-001', 'CDEF-GHIJ-KLMN-OPQR-STUV', 'cancelled', 'first_activation', NULL::DATE, NULL::DATE, CURRENT_DATE + 220, NULL::TIMESTAMPTZ, NULL::DATE, 70.00::NUMERIC, 115.00::NUMERIC, 'annual', 'Cancelada. Motivo: clave reportada como duplicada por el proveedor.')
    ) AS data(batch_number, responsible_name, name, commercial_identifier, license_code, status, validity_start_mode, start_date, next_renewal_date, redeem_deadline_date, activation_date, expiration_date, cost, sale_price, billing_cycle, notes)
)
INSERT INTO license_units (
    batch_id,
    responsible_user_id,
    name,
    commercial_identifier,
    license_code_encrypted,
    license_code_hash,
    masked_code,
    status,
    reserved_customer_id,
    reserved_by,
    reserved_at,
    reservation_expires_at,
    reservation_notes,
    validity_start_mode,
    start_date,
    next_renewal_date,
    redeem_deadline_date,
    activation_date,
    expiration_date,
    cost,
    sale_price,
    billing_cycle,
    currency_code,
    notes,
    active,
    create_uid,
    write_uid
)
SELECT
    lb.id,
    responsible.id,
    dl.name,
    dl.commercial_identifier,
    'demo-encrypted:' || encode(digest(dl.license_code, 'sha256'), 'hex'),
    encode(digest(dl.license_code, 'sha256'), 'hex'),
    left(dl.license_code, 4) || '-************-' || right(dl.license_code, 4),
    dl.status,
    CASE WHEN dl.status = 'reserved' THEN reserved_customer.id ELSE NULL END,
    CASE WHEN dl.status = 'reserved' THEN operator.id ELSE NULL END,
    CASE WHEN dl.status = 'reserved' THEN CURRENT_TIMESTAMP - INTERVAL '1 day' ELSE NULL END,
    CASE WHEN dl.status = 'reserved' THEN CURRENT_DATE + 20 ELSE NULL END,
    CASE WHEN dl.status = 'reserved' THEN 'Reservada para instalación programada del cliente.' ELSE NULL END,
    dl.validity_start_mode,
    dl.start_date,
    dl.next_renewal_date,
    dl.redeem_deadline_date,
    dl.activation_date,
    dl.expiration_date,
    dl.cost,
    dl.sale_price,
    dl.billing_cycle,
    'PEN',
    dl.notes,
    TRUE,
    admin.id,
    admin.id
FROM demo_licenses dl
JOIN license_batches lb ON lb.batch_number = dl.batch_number
JOIN users responsible ON responsible.name = dl.responsible_name
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
CROSS JOIN (SELECT id FROM users WHERE email = 'licencias@tracksaas.local') operator
LEFT JOIN customers reserved_customer ON reserved_customer.name = 'Inversiones Lima SAC'
ON CONFLICT (license_code_hash) DO UPDATE
SET
    batch_id = EXCLUDED.batch_id,
    responsible_user_id = EXCLUDED.responsible_user_id,
    name = EXCLUDED.name,
    commercial_identifier = EXCLUDED.commercial_identifier,
    masked_code = EXCLUDED.masked_code,
    status = EXCLUDED.status,
    reserved_customer_id = EXCLUDED.reserved_customer_id,
    reserved_by = EXCLUDED.reserved_by,
    reserved_at = EXCLUDED.reserved_at,
    reservation_expires_at = EXCLUDED.reservation_expires_at,
    reservation_notes = EXCLUDED.reservation_notes,
    validity_start_mode = EXCLUDED.validity_start_mode,
    start_date = EXCLUDED.start_date,
    next_renewal_date = EXCLUDED.next_renewal_date,
    redeem_deadline_date = EXCLUDED.redeem_deadline_date,
    activation_date = EXCLUDED.activation_date,
    expiration_date = EXCLUDED.expiration_date,
    cost = EXCLUDED.cost,
    sale_price = EXCLUDED.sale_price,
    billing_cycle = EXCLUDED.billing_cycle,
    currency_code = EXCLUDED.currency_code,
    notes = EXCLUDED.notes,
    active = TRUE,
    write_uid = EXCLUDED.write_uid,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 9. Activaciones demo
-- =========================================================
INSERT INTO license_activations (
    license_unit_id,
    customer_id,
    activated_by,
    activation_date,
    device_reference,
    support_reference,
    notes
)
SELECT
    lu.id,
    c.id,
    operator.id,
    COALESCE(lu.activation_date, CURRENT_TIMESTAMP),
    data.device_reference,
    data.support_reference,
    data.notes
FROM (
    VALUES
        ('M365-BASIC-DEMO-001', 'Servicios Integrales Andinos', 'PC-ANDINOS-ADM-01', 'TICKET-M365-001', 'Activación demo de Microsoft 365.'),
        ('ADOBE-CC-DEMO-001', 'Estudio Creativo Norte', 'MAC-CREATIVO-01', 'TICKET-ADOBE-001', 'Activación demo próxima a vencer.')
) AS data(commercial_identifier, customer_name, device_reference, support_reference, notes)
JOIN license_units lu ON lu.commercial_identifier = data.commercial_identifier
JOIN customers c ON c.name = data.customer_name
CROSS JOIN (SELECT id FROM users WHERE email = 'licencias@tracksaas.local') operator
ON CONFLICT (license_unit_id) DO UPDATE
SET
    customer_id = EXCLUDED.customer_id,
    activated_by = EXCLUDED.activated_by,
    activation_date = EXCLUDED.activation_date,
    device_reference = EXCLUDED.device_reference,
    support_reference = EXCLUDED.support_reference,
    notes = EXCLUDED.notes;

-- =========================================================
-- 10. Auditoría demo
-- =========================================================
INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values, new_values, retain_forever)
SELECT admin.id, 'license_units', lu.id, 'create', NULL, jsonb_build_object('demo', TRUE, 'status', lu.status, 'license', lu.name), TRUE
FROM license_units lu
CROSS JOIN (SELECT id FROM users WHERE email = 'admin@tracksaas.local') admin
WHERE lu.commercial_identifier IN (
    'ESET-PRE-DEMO-001',
    'ESET-PRE-DEMO-002',
    'WIN11-PRO-DEMO-001',
    'M365-BASIC-DEMO-001',
    'ADOBE-CC-DEMO-001',
    'KASP-STD-DEMO-001',
    'ESET-ESS-DEMO-001'
)
AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_name = 'license_units'
      AND al.entity_id = lu.id
      AND al.action = 'create'
      AND al.new_values ->> 'demo' = 'true'
);

INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values, new_values, retain_forever)
SELECT operator.id, 'license_units', lu.id, 'activate', jsonb_build_object('status', 'available'), jsonb_build_object('demo', TRUE, 'status', 'activated', 'license', lu.name), TRUE
FROM license_units lu
CROSS JOIN (SELECT id FROM users WHERE email = 'licencias@tracksaas.local') operator
WHERE lu.commercial_identifier IN ('M365-BASIC-DEMO-001', 'ADOBE-CC-DEMO-001')
AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_name = 'license_units'
      AND al.entity_id = lu.id
      AND al.action = 'activate'
      AND al.new_values ->> 'demo' = 'true'
);

INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values, new_values, retain_forever)
SELECT operator.id, 'license_units', lu.id, 'update', jsonb_build_object('status', 'available'), jsonb_build_object('demo', TRUE, 'operation', 'reserve', 'reserved_for', jsonb_build_object('id', c.id, 'name', c.name), 'reservation_expires_at', lu.reservation_expires_at, 'status', 'reserved'), TRUE
FROM license_units lu
JOIN customers c ON c.id = lu.reserved_customer_id
CROSS JOIN (SELECT id FROM users WHERE email = 'licencias@tracksaas.local') operator
WHERE lu.commercial_identifier = 'WIN11-PRO-DEMO-001'
AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_name = 'license_units'
      AND al.entity_id = lu.id
      AND al.action = 'update'
      AND al.new_values ->> 'operation' = 'reserve'
);

INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values, new_values, retain_forever)
SELECT operator.id, 'license_units', lu.id, 'update', jsonb_build_object('status', 'available'), jsonb_build_object('demo', TRUE, 'operation', 'mark_expired', 'reason', 'Proveedor rechazó la clave por antigüedad.', 'status', 'expired'), TRUE
FROM license_units lu
CROSS JOIN (SELECT id FROM users WHERE email = 'licencias@tracksaas.local') operator
WHERE lu.commercial_identifier = 'KASP-STD-DEMO-001'
AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_name = 'license_units'
      AND al.entity_id = lu.id
      AND al.action = 'update'
      AND al.new_values ->> 'operation' = 'mark_expired'
);

INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values, new_values, retain_forever)
SELECT operator.id, 'license_units', lu.id, 'cancel', jsonb_build_object('status', 'available'), jsonb_build_object('demo', TRUE, 'operation', 'cancel', 'reason', 'Clave reportada como duplicada por el proveedor.', 'status', 'cancelled'), TRUE
FROM license_units lu
CROSS JOIN (SELECT id FROM users WHERE email = 'licencias@tracksaas.local') operator
WHERE lu.commercial_identifier = 'ESET-ESS-DEMO-001'
AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_name = 'license_units'
      AND al.entity_id = lu.id
      AND al.action = 'cancel'
      AND al.new_values ->> 'operation' = 'cancel'
);

COMMIT;

-- Verificación rápida
SELECT id, name, email, active FROM users ORDER BY id;
SELECT id, name, active FROM providers ORDER BY id;
SELECT id, name, active FROM products ORDER BY id;
SELECT id, batch_number, status, quantity, unit_cost FROM license_batches ORDER BY id;
SELECT status, COUNT(*) AS total FROM license_units GROUP BY status ORDER BY status;
