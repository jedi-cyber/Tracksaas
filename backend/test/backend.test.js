const assert = require("node:assert/strict");
const { after, before, describe, test } = require("node:test");

require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.LICENSE_ENCRYPTION_KEY =
  process.env.LICENSE_ENCRYPTION_KEY || "test-license-encryption-key";

const app = require("../src/app");
const pool = require("../src/config/database");
const {
  encryptLicenseCode,
  hashLicenseCode,
  maskLicenseCode,
} = require("../src/utils/licenseCrypto");
const licensesService = require("../src/services/licenses.service");

const TEST_PREFIX = `TEST-AUTO-${Date.now()}`;

let server;
let baseUrl;
let adminToken;
let adminUserId;

function jsonHeaders(token = adminToken) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

async function cleanupTestData() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        DELETE FROM audit_logs
        WHERE (entity_name = 'license_units' AND entity_id IN (
          SELECT id FROM license_units WHERE name LIKE $1
        ))
        OR (entity_name = 'license_batches' AND entity_id IN (
          SELECT id FROM license_batches WHERE batch_number LIKE $1
        ))
        OR (entity_name = 'product_variants' AND entity_id IN (
          SELECT id FROM product_variants WHERE name LIKE $1 OR default_code LIKE $1
        ))
        OR (entity_name = 'products' AND entity_id IN (
          SELECT id FROM products WHERE name LIKE $1
        ))
        OR (entity_name = 'customers' AND entity_id IN (
          SELECT id FROM customers WHERE name LIKE $1
        ))
        OR (entity_name = 'users' AND entity_id IN (
          SELECT id FROM users WHERE email LIKE LOWER($1)
        ))
      `,
      [`${TEST_PREFIX}%`]
    );

    await client.query(
      `
        DELETE FROM license_activations
        WHERE license_unit_id IN (
          SELECT id FROM license_units WHERE name LIKE $1
        )
      `,
      [`${TEST_PREFIX}%`]
    );
    await client.query("DELETE FROM license_units WHERE name LIKE $1", [`${TEST_PREFIX}%`]);
    await client.query("DELETE FROM license_batches WHERE batch_number LIKE $1", [
      `${TEST_PREFIX}%`,
    ]);
    await client.query(
      "DELETE FROM product_variants WHERE name LIKE $1 OR default_code LIKE $1",
      [`${TEST_PREFIX}%`]
    );
    await client.query("DELETE FROM products WHERE name LIKE $1", [`${TEST_PREFIX}%`]);
    await client.query("DELETE FROM customers WHERE name LIKE $1", [`${TEST_PREFIX}%`]);
    await client.query("DELETE FROM users WHERE email LIKE LOWER($1)", [`${TEST_PREFIX}%`]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAdminUserId() {
  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [
    "admin@tracksaas.local",
  ]);
  return rows[0].id;
}

async function getProviderId() {
  const { rows } = await pool.query("SELECT id FROM providers ORDER BY id ASC LIMIT 1");
  assert.ok(rows[0], "Debe existir al menos un proveedor semilla");
  return rows[0].id;
}

async function createLicenseFixture(suffix, overrides = {}) {
  const providerId = await getProviderId();
  const product = await pool.query(
    `
      INSERT INTO products (name, description, create_uid, write_uid)
      VALUES ($1, $2, $3, $3)
      RETURNING id
    `,
    [`${TEST_PREFIX}-PRODUCT-${suffix}`, "Producto de prueba", adminUserId]
  );
  const variant = await pool.query(
    `
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
      VALUES ($1, $2, $3, 'annual', 365, 10, 'PEN', $4, $4)
      RETURNING id
    `,
    [
      product.rows[0].id,
      `${TEST_PREFIX}-VARIANT-${suffix}`,
      `${TEST_PREFIX}-VAR-${suffix}`,
      adminUserId,
    ]
  );
  const batch = await pool.query(
    `
      INSERT INTO license_batches (
        variant_id,
        provider_id,
        batch_number,
        purchase_date,
        quantity,
        unit_cost,
        currency_code,
        status,
        create_uid,
        write_uid
      )
      VALUES ($1, $2, $3, CURRENT_DATE, $4, 10, 'PEN', 'confirmed', $5, $5)
      RETURNING id
    `,
    [
      variant.rows[0].id,
      providerId,
      `${TEST_PREFIX}-BATCH-${suffix}`,
      overrides.batchQuantity || 5,
      adminUserId,
    ]
  );

  return licensesService.createLicense(
    {
      batch_id: batch.rows[0].id,
      responsible_user_id: adminUserId,
      name: `${TEST_PREFIX}-LICENSE-${suffix}`,
      license_code: `${TEST_PREFIX}-CODE-${suffix}`,
      start_date: overrides.startDate || "2026-07-21",
      next_renewal_date: overrides.nextRenewalDate || "2027-07-21",
      cost: overrides.cost || 10,
      billing_cycle: overrides.billingCycle || "annual",
    },
    adminUserId,
    "127.0.0.1"
  );
}

describe("TrackSaaS backend", () => {
  before(async () => {
    await cleanupTestData();
    adminUserId = await getAdminUserId();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await cleanupTestData();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  test("login JWT y perfil autenticado", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@tracksaas.local",
        password: "Admin123*",
      }),
    });

    assert.equal(login.response.status, 200);
    assert.ok(login.body.token);
    assert.equal(login.body.user.email, "admin@tracksaas.local");
    adminToken = login.body.token;

    const me = await request("/api/auth/me", {
      headers: jsonHeaders(),
    });

    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, "admin@tracksaas.local");
  });

  test("CRUD básico de productos", async () => {
    const name = `${TEST_PREFIX}-CRUD-PRODUCT`;
    const created = await request("/api/products", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        name,
        description: "Producto CRUD de prueba",
      }),
    });

    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.name, name);

    const id = created.body.data.id;
    const detail = await request(`/api/products/${id}`, { headers: jsonHeaders() });
    assert.equal(detail.response.status, 200);

    const updated = await request(`/api/products/${id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({ description: "Actualizado" }),
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.description, "Actualizado");

    const removed = await request(`/api/products/${id}`, {
      method: "DELETE",
      headers: jsonHeaders(),
    });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.body.data.active, false);
  });

  test("activación única de licencia", async () => {
    const license = await createLicenseFixture("ACTIVATION");

    const activated = await request(`/api/licenses/${license.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        device_reference: `${TEST_PREFIX}-DEVICE`,
        support_reference: `${TEST_PREFIX}-TICKET`,
      }),
    });

    assert.equal(activated.response.status, 200);
    assert.equal(activated.body.data.license.status, "activated");
    assert.ok(activated.body.data.activation.id);

    const duplicate = await request(`/api/licenses/${license.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });

    assert.equal(duplicate.response.status, 409);
  });

  test("cifrado, hash y enmascarado de licencia", () => {
    const code = "ABCD-1234-EFGH-5678";
    const encrypted = encryptLicenseCode(code);
    const hash = hashLicenseCode(code);
    const masked = maskLicenseCode(code);

    assert.notEqual(encrypted, code);
    assert.equal(hash.length, 64);
    assert.equal(masked.startsWith("ABCD"), true);
    assert.equal(masked.endsWith("5678"), true);
    assert.equal(masked.includes("*"), true);
  });

  test("dashboard protegido devuelve resumen", async () => {
    const response = await request("/api/dashboard/overview", {
      headers: jsonHeaders(),
    });

    assert.equal(response.response.status, 200);
    assert.ok(response.body.data.financial);
    assert.ok(response.body.data.licensesByStatus);
    assert.ok(response.body.data.alerts);
  });

  test("permisos por rol bloquean acciones no permitidas", async () => {
    const { rows } = await pool.query(
      "SELECT id FROM roles WHERE name = 'viewer' LIMIT 1"
    );
    assert.ok(rows[0], "Debe existir rol viewer");

    const email = `${TEST_PREFIX}-viewer@tracksaas.local`.toLowerCase();
    await pool.query(
      `
        INSERT INTO users (role_id, name, email, password_hash, active)
        VALUES ($1, $2, $3, crypt($4, gen_salt('bf', 12)), TRUE)
      `,
      [rows[0].id, `${TEST_PREFIX}-Viewer`, email, "Viewer123*"]
    );

    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "Viewer123*" }),
    });

    assert.equal(login.response.status, 200);

    const forbidden = await request("/api/licenses", {
      method: "POST",
      headers: jsonHeaders(login.body.token),
      body: JSON.stringify({}),
    });

    assert.equal(forbidden.response.status, 403);

    const allowed = await request("/api/dashboard/overview", {
      headers: jsonHeaders(login.body.token),
    });

    assert.equal(allowed.response.status, 200);
  });
});
