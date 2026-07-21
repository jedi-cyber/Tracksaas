-- TrackSaaS - Datos iniciales v1
-- Ejecutar después de schema.sql sobre la base tracksaas_db.
-- PostgreSQL 15+

BEGIN;

-- Permite generar hashes bcrypt directamente en PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. Roles iniciales
-- =========================================================
INSERT INTO roles (name, description)
VALUES
    ('administrator', 'Acceso total a configuración, usuarios, productos, lotes, licencias, activaciones y reportes.'),
    ('license_user', 'Puede registrar lotes, consultar unidades enmascaradas, preparar operaciones y registrar activaciones.'),
    ('viewer', 'Acceso de solo lectura al dashboard, licencias, estados y reportes.')
ON CONFLICT (name) DO UPDATE
SET
    description = EXCLUDED.description,
    active = TRUE,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 2. Usuario administrador inicial
-- =========================================================
-- Credenciales de desarrollo:
-- Correo: admin@tracksaas.local
-- Contraseña temporal: Admin123*
-- Debe cambiarse al iniciar sesión por primera vez.
INSERT INTO users (
    role_id,
    name,
    email,
    password_hash,
    active
)
SELECT
    r.id,
    'Administrador TrackSaaS',
    'admin@tracksaas.local',
    crypt('Admin123*', gen_salt('bf', 12)),
    TRUE
FROM roles r
WHERE r.name = 'administrator'
ON CONFLICT (email) DO UPDATE
SET
    role_id = EXCLUDED.role_id,
    name = EXCLUDED.name,
    active = TRUE,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 3. Proveedores de ejemplo
-- =========================================================
INSERT INTO providers (
    name,
    contact_name,
    email,
    phone,
    notes,
    create_uid,
    write_uid
)
SELECT
    data.name,
    data.contact_name,
    data.email,
    data.phone,
    data.notes,
    admin.id,
    admin.id
FROM (
    VALUES
        ('ESET', 'Soporte comercial', 'ventas@eset.example', NULL, 'Proveedor de licencias ESET.'),
        ('Microsoft', 'Soporte comercial', 'ventas@microsoft.example', NULL, 'Proveedor de licencias Microsoft.')
) AS data(name, contact_name, email, phone, notes)
CROSS JOIN (
    SELECT id
    FROM users
    WHERE email = 'admin@tracksaas.local'
) AS admin
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
-- 4. Productos generales de ejemplo
-- =========================================================
INSERT INTO products (
    name,
    description,
    create_uid,
    write_uid
)
SELECT
    data.name,
    data.description,
    admin.id,
    admin.id
FROM (
    VALUES
        ('ESET HOME Security', 'Familia de productos de seguridad ESET para usuarios y empresas.'),
        ('Microsoft 365', 'Familia de suscripciones Microsoft 365.')
) AS data(name, description)
CROSS JOIN (
    SELECT id
    FROM users
    WHERE email = 'admin@tracksaas.local'
) AS admin
ON CONFLICT (name) DO UPDATE
SET
    description = EXCLUDED.description,
    active = TRUE,
    write_uid = EXCLUDED.write_uid,
    write_date = CURRENT_TIMESTAMP;

-- =========================================================
-- 5. Variantes de producto de ejemplo
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
    write_uid
)
SELECT
    p.id,
    data.variant_name,
    data.default_code,
    data.billing_cycle,
    data.duration_days,
    data.default_cost,
    data.currency_code,
    admin.id,
    admin.id
FROM (
    VALUES
        ('ESET HOME Security', 'ESET HOME Security Essential', 'ESET-HOME-ESS', 'annual', 365, 0.00::NUMERIC, 'PEN'),
        ('ESET HOME Security', 'ESET HOME Security Premium',   'ESET-HOME-PRE', 'annual', 365, 0.00::NUMERIC, 'PEN'),
        ('ESET HOME Security', 'ESET HOME Security Ultimate',  'ESET-HOME-ULT', 'annual', 365, 0.00::NUMERIC, 'PEN'),
        ('Microsoft 365', 'Microsoft 365 Business Basic',      'M365-BASIC',    'monthly', 30, 0.00::NUMERIC, 'PEN')
) AS data(product_name, variant_name, default_code, billing_cycle, duration_days, default_cost, currency_code)
JOIN products p
    ON p.name = data.product_name
CROSS JOIN (
    SELECT id
    FROM users
    WHERE email = 'admin@tracksaas.local'
) AS admin
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

COMMIT;

-- Verificación rápida
SELECT id, name, active FROM roles ORDER BY id;
SELECT id, name, email, active FROM users ORDER BY id;
SELECT id, name, active FROM providers ORDER BY id;
SELECT id, name, active FROM products ORDER BY id;
SELECT id, product_id, name, default_code, billing_cycle, active
FROM product_variants
ORDER BY product_id, id;
