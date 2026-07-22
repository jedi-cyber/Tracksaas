-- TrackSaaS - Esquema inicial v1
-- PostgreSQL 15+
-- Base de datos esperada: tracksaas_db

BEGIN;

CREATE OR REPLACE FUNCTION set_write_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.write_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_roles_write_date ON roles;
CREATE TRIGGER trg_roles_write_date BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id)
        REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
DROP TRIGGER IF EXISTS trg_users_write_date ON users;
CREATE TRIGGER trg_users_write_date BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS providers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(180) NOT NULL UNIQUE,
    tax_id VARCHAR(30),
    contact_name VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(40),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_uid BIGINT,
    write_uid BIGINT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_providers_create_uid FOREIGN KEY (create_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_providers_write_uid FOREIGN KEY (write_uid)
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_providers_active ON providers(active);
DROP TRIGGER IF EXISTS trg_providers_write_date ON providers;
CREATE TRIGGER trg_providers_write_date BEFORE UPDATE ON providers
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(180) NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_uid BIGINT,
    write_uid BIGINT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_create_uid FOREIGN KEY (create_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_products_write_uid FOREIGN KEY (write_uid)
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
DROP TRIGGER IF EXISTS trg_products_write_date ON products;
CREATE TRIGGER trg_products_write_date BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS product_variants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    name VARCHAR(180) NOT NULL,
    default_code VARCHAR(100),
    billing_cycle VARCHAR(20) NOT NULL,
    duration_days INTEGER,
    default_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_code CHAR(3) NOT NULL DEFAULT 'PEN',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_uid BIGINT,
    write_uid BIGINT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variants_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_variants_create_uid FOREIGN KEY (create_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_variants_write_uid FOREIGN KEY (write_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_product_variant_name UNIQUE (product_id, name),
    CONSTRAINT uq_product_variant_code UNIQUE (default_code),
    CONSTRAINT chk_variant_billing_cycle CHECK (billing_cycle IN ('monthly','annual')),
    CONSTRAINT chk_variant_duration_days CHECK (duration_days IS NULL OR duration_days > 0),
    CONSTRAINT chk_variant_default_cost CHECK (default_cost >= 0),
    CONSTRAINT chk_variant_currency CHECK (currency_code ~ '^[A-Z]{3}$')
);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(active);
DROP TRIGGER IF EXISTS trg_variants_write_date ON product_variants;
CREATE TRIGGER trg_variants_write_date BEFORE UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    tax_id VARCHAR(30),
    email VARCHAR(255),
    phone VARCHAR(40),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_uid BIGINT,
    write_uid BIGINT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_create_uid FOREIGN KEY (create_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_customers_write_uid FOREIGN KEY (write_uid)
        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_tax_id ON customers(tax_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active);
DROP TRIGGER IF EXISTS trg_customers_write_date ON customers;
CREATE TRIGGER trg_customers_write_date BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS license_batches (
    id BIGSERIAL PRIMARY KEY,
    variant_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    purchase_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    unit_cost NUMERIC(14,2) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'PEN',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_uid BIGINT NOT NULL,
    write_uid BIGINT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_batches_variant FOREIGN KEY (variant_id)
        REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batches_provider FOREIGN KEY (provider_id)
        REFERENCES providers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_batches_create_uid FOREIGN KEY (create_uid)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_batches_write_uid FOREIGN KEY (write_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_batch_quantity CHECK (quantity > 0),
    CONSTRAINT chk_batch_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_batch_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_batch_status CHECK (status IN ('draft','confirmed','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_batches_variant_id ON license_batches(variant_id);
CREATE INDEX IF NOT EXISTS idx_batches_provider_id ON license_batches(provider_id);
CREATE INDEX IF NOT EXISTS idx_batches_purchase_date ON license_batches(purchase_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON license_batches(status);
DROP TRIGGER IF EXISTS trg_batches_write_date ON license_batches;
CREATE TRIGGER trg_batches_write_date BEFORE UPDATE ON license_batches
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS license_units (
    id BIGSERIAL PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    responsible_user_id BIGINT NOT NULL,
    name VARCHAR(180) NOT NULL,
    commercial_identifier VARCHAR(180) NOT NULL,
    license_code_encrypted TEXT NOT NULL,
    license_code_hash CHAR(64) NOT NULL UNIQUE,
    masked_code VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    validity_start_mode VARCHAR(30) NOT NULL DEFAULT 'purchase_date',
    start_date DATE,
    next_renewal_date DATE,
    redeem_deadline_date DATE,
    activation_date TIMESTAMPTZ,
    expiration_date DATE,
    cost NUMERIC(14,2) NOT NULL,
    sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    billing_cycle VARCHAR(20) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'PEN',
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    create_uid BIGINT NOT NULL,
    write_uid BIGINT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    write_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_license_units_batch FOREIGN KEY (batch_id)
        REFERENCES license_batches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_license_units_responsible FOREIGN KEY (responsible_user_id)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_license_units_create_uid FOREIGN KEY (create_uid)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_license_units_write_uid FOREIGN KEY (write_uid)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_license_status CHECK (status IN ('available','reserved','activated','expired','cancelled')),
    CONSTRAINT chk_license_validity_start_mode CHECK (validity_start_mode IN ('purchase_date','first_activation')),
    CONSTRAINT chk_license_cost CHECK (cost >= 0),
    CONSTRAINT chk_license_sale_price CHECK (sale_price >= 0),
    CONSTRAINT chk_license_billing_cycle CHECK (billing_cycle IN ('monthly','annual')),
    CONSTRAINT chk_license_currency CHECK (currency_code ~ '^[A-Z]{3}$'),
    CONSTRAINT chk_license_dates CHECK (
        (start_date IS NULL AND next_renewal_date IS NULL)
        OR (start_date IS NOT NULL AND next_renewal_date IS NOT NULL AND next_renewal_date >= start_date)
    ),
    CONSTRAINT chk_license_validity_dates CHECK (
        (validity_start_mode = 'purchase_date' AND start_date IS NOT NULL AND next_renewal_date IS NOT NULL)
        OR validity_start_mode = 'first_activation'
    ),
    CONSTRAINT chk_license_redeem_deadline CHECK (
        redeem_deadline_date IS NULL OR start_date IS NULL OR redeem_deadline_date >= start_date
    ),
    CONSTRAINT chk_activation_date_by_status CHECK (
        (status = 'activated' AND activation_date IS NOT NULL)
        OR status <> 'activated'
    )
);
ALTER TABLE license_units
    ADD COLUMN IF NOT EXISTS commercial_identifier VARCHAR(180);
UPDATE license_units
SET commercial_identifier = name
WHERE commercial_identifier IS NULL;
ALTER TABLE license_units
    ALTER COLUMN commercial_identifier SET NOT NULL;
ALTER TABLE license_units
    ADD COLUMN IF NOT EXISTS validity_start_mode VARCHAR(30) NOT NULL DEFAULT 'purchase_date';
ALTER TABLE license_units
    DROP CONSTRAINT IF EXISTS chk_license_validity_start_mode;
ALTER TABLE license_units
    ADD CONSTRAINT chk_license_validity_start_mode
        CHECK (validity_start_mode IN ('purchase_date','first_activation'));
ALTER TABLE license_units
    ADD COLUMN IF NOT EXISTS redeem_deadline_date DATE;
ALTER TABLE license_units
    ADD COLUMN IF NOT EXISTS sale_price NUMERIC(14,2) NOT NULL DEFAULT 0;
UPDATE license_units
SET sale_price = cost
WHERE sale_price = 0;
ALTER TABLE license_units
    DROP CONSTRAINT IF EXISTS chk_license_sale_price;
ALTER TABLE license_units
    ADD CONSTRAINT chk_license_sale_price CHECK (sale_price >= 0);
ALTER TABLE license_units
    ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE license_units
    ALTER COLUMN next_renewal_date DROP NOT NULL;
ALTER TABLE license_units
    DROP CONSTRAINT IF EXISTS chk_license_dates;
ALTER TABLE license_units
    ADD CONSTRAINT chk_license_dates CHECK (
        (start_date IS NULL AND next_renewal_date IS NULL)
        OR (start_date IS NOT NULL AND next_renewal_date IS NOT NULL AND next_renewal_date >= start_date)
    );
ALTER TABLE license_units
    DROP CONSTRAINT IF EXISTS chk_license_validity_dates;
ALTER TABLE license_units
    ADD CONSTRAINT chk_license_validity_dates CHECK (
        (validity_start_mode = 'purchase_date' AND start_date IS NOT NULL AND next_renewal_date IS NOT NULL)
        OR validity_start_mode = 'first_activation'
    );
ALTER TABLE license_units
    DROP CONSTRAINT IF EXISTS chk_license_redeem_deadline;
ALTER TABLE license_units
    ADD CONSTRAINT chk_license_redeem_deadline CHECK (
        redeem_deadline_date IS NULL OR start_date IS NULL OR redeem_deadline_date >= start_date
    );
CREATE OR REPLACE FUNCTION set_license_commercial_identifier()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.commercial_identifier IS NULL OR BTRIM(NEW.commercial_identifier) = '' THEN
        NEW.commercial_identifier := NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE INDEX IF NOT EXISTS idx_license_units_batch_id ON license_units(batch_id);
CREATE INDEX IF NOT EXISTS idx_license_units_commercial_identifier ON license_units(commercial_identifier);
CREATE INDEX IF NOT EXISTS idx_license_units_responsible ON license_units(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_license_units_status ON license_units(status);
CREATE INDEX IF NOT EXISTS idx_license_units_next_renewal ON license_units(next_renewal_date);
CREATE INDEX IF NOT EXISTS idx_license_units_active_status ON license_units(active,status);
DROP TRIGGER IF EXISTS trg_license_units_commercial_identifier ON license_units;
CREATE TRIGGER trg_license_units_commercial_identifier BEFORE INSERT OR UPDATE ON license_units
FOR EACH ROW EXECUTE FUNCTION set_license_commercial_identifier();
DROP TRIGGER IF EXISTS trg_license_units_write_date ON license_units;
CREATE TRIGGER trg_license_units_write_date BEFORE UPDATE ON license_units
FOR EACH ROW EXECUTE FUNCTION set_write_date();

CREATE TABLE IF NOT EXISTS license_activations (
    id BIGSERIAL PRIMARY KEY,
    license_unit_id BIGINT NOT NULL UNIQUE,
    customer_id BIGINT,
    activated_by BIGINT NOT NULL,
    activation_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    device_reference VARCHAR(180),
    support_reference VARCHAR(180),
    notes TEXT,
    create_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activations_license FOREIGN KEY (license_unit_id)
        REFERENCES license_units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_activations_customer FOREIGN KEY (customer_id)
        REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_activations_user FOREIGN KEY (activated_by)
        REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_activations_customer_id ON license_activations(customer_id);
CREATE INDEX IF NOT EXISTS idx_activations_activated_by ON license_activations(activated_by);
CREATE INDEX IF NOT EXISTS idx_activations_date ON license_activations(activation_date);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    entity_name VARCHAR(100) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_audit_action CHECK (action IN ('create','update','delete','activate','cancel'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_name,entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

DROP VIEW IF EXISTS vw_license_alerts;
CREATE VIEW vw_license_alerts AS
SELECT
    lu.id,
    lu.name,
    lu.commercial_identifier,
    lu.status,
    lu.validity_start_mode,
    lu.start_date,
    lu.next_renewal_date,
    lu.redeem_deadline_date,
    CASE
        WHEN lu.next_renewal_date IS NOT NULL THEN lu.next_renewal_date
        WHEN lu.validity_start_mode = 'first_activation'
            AND lu.activation_date IS NULL
            AND lu.redeem_deadline_date IS NOT NULL THEN lu.redeem_deadline_date
        ELSE NULL
    END AS alert_date,
    CASE
        WHEN lu.status = 'expired' THEN 'licencia_vencida'
        WHEN lu.next_renewal_date IS NOT NULL THEN 'vigencia_en_curso'
        WHEN lu.validity_start_mode = 'first_activation'
            AND lu.activation_date IS NULL
            AND lu.redeem_deadline_date IS NOT NULL THEN 'limite_de_canje'
        ELSE 'sin_fecha_critica'
    END AS alert_reason,
    lu.cost,
    lu.billing_cycle,
    lu.currency_code,
    lu.responsible_user_id,
    (
        CASE
            WHEN lu.next_renewal_date IS NOT NULL THEN lu.next_renewal_date
            WHEN lu.validity_start_mode = 'first_activation'
                AND lu.activation_date IS NULL
                AND lu.redeem_deadline_date IS NOT NULL THEN lu.redeem_deadline_date
            ELSE NULL
        END - CURRENT_DATE
    ) AS days_remaining,
    CASE
        WHEN lu.status = 'expired' THEN 'red'
        WHEN (
            CASE
                WHEN lu.next_renewal_date IS NOT NULL THEN lu.next_renewal_date
                WHEN lu.validity_start_mode = 'first_activation'
                    AND lu.activation_date IS NULL
                    AND lu.redeem_deadline_date IS NOT NULL THEN lu.redeem_deadline_date
                ELSE NULL
            END
        ) < CURRENT_DATE THEN 'red'
        WHEN (
            CASE
                WHEN lu.next_renewal_date IS NOT NULL THEN lu.next_renewal_date
                WHEN lu.validity_start_mode = 'first_activation'
                    AND lu.activation_date IS NULL
                    AND lu.redeem_deadline_date IS NOT NULL THEN lu.redeem_deadline_date
                ELSE NULL
            END
        ) <= CURRENT_DATE + 30 THEN 'yellow'
        ELSE 'green'
    END AS alert_color
FROM license_units lu
WHERE lu.active = TRUE
  AND lu.status <> 'cancelled'
  AND (
    lu.status = 'expired'
    OR
    lu.next_renewal_date IS NOT NULL
    OR (
      lu.validity_start_mode = 'first_activation'
      AND lu.activation_date IS NULL
      AND lu.redeem_deadline_date IS NOT NULL
    )
  );

CREATE OR REPLACE VIEW vw_financial_dashboard AS
SELECT
    COALESCE(SUM(sale_price) FILTER (WHERE active = TRUE AND status = 'activated'), 0)::NUMERIC(14,2) AS activated_revenue,
    COALESCE(SUM(cost) FILTER (WHERE active = TRUE AND status = 'activated'), 0)::NUMERIC(14,2) AS sold_license_cost,
    (
      COALESCE(SUM(sale_price) FILTER (WHERE active = TRUE AND status = 'activated'), 0)
      - COALESCE(SUM(cost) FILTER (WHERE active = TRUE AND status = 'activated'), 0)
    )::NUMERIC(14,2) AS estimated_margin,
    COALESCE(SUM(cost) FILTER (WHERE active = TRUE AND status = 'available'), 0)::NUMERIC(14,2) AS available_inventory_value,
    COALESCE(SUM(CASE
        WHEN billing_cycle = 'monthly' THEN cost
        WHEN billing_cycle = 'annual' THEN cost / 12
        ELSE 0 END) FILTER (WHERE active = TRUE AND status <> 'cancelled'), 0)::NUMERIC(14,2) AS monthly_equivalent_cost,
    COALESCE(SUM(CASE
        WHEN billing_cycle = 'monthly' THEN cost * 12
        WHEN billing_cycle = 'annual' THEN cost
        ELSE 0 END) FILTER (WHERE active = TRUE AND status <> 'cancelled'), 0)::NUMERIC(14,2) AS annual_cost_projection
FROM license_units;

COMMIT;
