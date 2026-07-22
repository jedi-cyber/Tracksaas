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
let licenseCodeCounter = 0;

function makeCommercialIdentifier() {
  return `OEM-WIN11-PRO-${String(Date.now()).slice(-6)}`;
}

function makeLicenseCode() {
  licenseCodeCounter += 1;
  const raw = `${Date.now()}${String(licenseCodeCounter).padStart(7, "0")}`.slice(-20);
  return raw.match(/.{1,4}/g).join("-");
}

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
          OR variant_id IN (
            SELECT id FROM product_variants WHERE name LIKE $1 OR default_code LIKE $1
          )
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
      `
        DELETE FROM license_batches
        WHERE variant_id IN (
          SELECT id FROM product_variants WHERE name LIKE $1 OR default_code LIKE $1
        )
      `,
      [`${TEST_PREFIX}%`]
    );
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
      commercial_identifier: makeCommercialIdentifier(),
      license_code: overrides.licenseCode || makeLicenseCode(),
      validity_start_mode: overrides.validityStartMode || "purchase_date",
      start_date: Object.prototype.hasOwnProperty.call(overrides, "startDate")
        ? overrides.startDate
        : "2026-07-21",
      redeem_deadline_date: overrides.redeemDeadlineDate,
      cost: overrides.cost || 10,
      billing_cycle: overrides.billingCycle || "annual",
    },
    adminUserId,
    "127.0.0.1"
  );
}

async function createBatchFixture(suffix, status = "confirmed") {
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
      VALUES ($1, $2, $3, CURRENT_DATE, 5, 10, 'PEN', $4, $5, $5)
      RETURNING id
    `,
    [
      variant.rows[0].id,
      providerId,
      `${TEST_PREFIX}-BATCH-${suffix}`,
      status,
      adminUserId,
    ]
  );

  return batch.rows[0];
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

  test("no permite crear licencias en lotes sin confirmar", async () => {
    const batch = await createBatchFixture("DRAFT-BLOCK", "draft");

    await assert.rejects(
      () =>
        licensesService.createLicense(
          {
            batch_id: batch.id,
            responsible_user_id: adminUserId,
            name: `${TEST_PREFIX}-LICENSE-DRAFT-BLOCK`,
            commercial_identifier: makeCommercialIdentifier(),
            license_code: makeLicenseCode(),
            validity_start_mode: "purchase_date",
            start_date: "2026-07-21",
            cost: 10,
            billing_cycle: "annual",
          },
          adminUserId,
          "127.0.0.1"
        ),
      /confirmado/
    );
  });

  test("licencia usa costo unitario del lote cuando no envía costo de adquisición", async () => {
    const batch = await createBatchFixture("LICENSE-BATCH-COST", "confirmed");

    const license = await licensesService.createLicense(
      {
        batch_id: batch.id,
        responsible_user_id: adminUserId,
        name: `${TEST_PREFIX}-LICENSE-BATCH-COST`,
        commercial_identifier: makeCommercialIdentifier(),
        license_code: makeLicenseCode(),
        validity_start_mode: "purchase_date",
        start_date: "2026-07-21",
        billing_cycle: "annual",
      },
      adminUserId,
      "127.0.0.1"
    );

    assert.equal(Number(license.cost), 10);
    assert.equal(Number(license.sale_price), 10);
  });

  test("genera código de lote automáticamente cuando no se envía", async () => {
    const providerId = await getProviderId();
    const product = await request("/api/products", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: `${TEST_PREFIX}-PRODUCT-AUTO-BATCH`,
        description: "Producto para lote automático",
      }),
    });
    assert.equal(product.response.status, 201);

    const variant = await request("/api/variants", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        product_id: product.body.data.id,
        name: `${TEST_PREFIX}-VARIANT-AUTO-BATCH`,
        default_code: `${TEST_PREFIX}-VAR-AUTO-BATCH`,
        billing_cycle: "annual",
        duration_days: 365,
        default_cost: 10,
        currency_code: "PEN",
      }),
    });
    assert.equal(variant.response.status, 201);

    const batch = await request("/api/batches", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        variant_id: variant.body.data.id,
        provider_id: providerId,
        purchase_date: "2026-07-22",
        quantity: 3,
        unit_cost: 10,
        currency_code: "PEN",
        status: "confirmed",
      }),
    });

    assert.equal(batch.response.status, 201);
    assert.match(batch.body.data.batch_number, /^LOT-2026-\d{4}$/);
  });

  test("usa costo de referencia de variante cuando lote no envía costo unitario", async () => {
    const providerId = await getProviderId();
    const product = await request("/api/products", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        name: `${TEST_PREFIX}-PRODUCT-BATCH-DEFAULT-COST`,
        description: "Producto para costo de referencia",
      }),
    });
    assert.equal(product.response.status, 201);

    const variant = await request("/api/variants", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        product_id: product.body.data.id,
        name: `${TEST_PREFIX}-VARIANT-BATCH-DEFAULT-COST`,
        default_code: `VAR-DEFAULT-COST-${Date.now()}`,
        billing_cycle: "annual",
        duration_days: 365,
        default_cost: 18,
        currency_code: "PEN",
      }),
    });
    assert.equal(variant.response.status, 201);

    const batch = await request("/api/batches", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        variant_id: variant.body.data.id,
        provider_id: providerId,
        purchase_date: "2026-07-22",
        quantity: 2,
        currency_code: "PEN",
        status: "confirmed",
      }),
    });

    assert.equal(batch.response.status, 201);
    assert.equal(Number(batch.body.data.unit_cost), 18);
  });

  test("lotes devuelven disponibilidad real por estado de licencia", async () => {
    const batch = await createBatchFixture("CAPACITY", "confirmed");
    const basePayload = {
      batch_id: batch.id,
      responsible_user_id: adminUserId,
      validity_start_mode: "purchase_date",
      start_date: "2026-07-21",
      cost: 10,
      billing_cycle: "annual",
    };

    const available = await licensesService.createLicense(
      {
        ...basePayload,
        name: `${TEST_PREFIX}-LICENSE-CAPACITY-AVAILABLE`,
        commercial_identifier: `${TEST_PREFIX}-CAPACITY-AVAILABLE`,
        license_code: makeLicenseCode(),
      },
      adminUserId,
      "127.0.0.1"
    );
    const reserved = await licensesService.createLicense(
      {
        ...basePayload,
        name: `${TEST_PREFIX}-LICENSE-CAPACITY-RESERVED`,
        commercial_identifier: `${TEST_PREFIX}-CAPACITY-RESERVED`,
        license_code: makeLicenseCode(),
      },
      adminUserId,
      "127.0.0.1"
    );
    const expired = await licensesService.createLicense(
      {
        ...basePayload,
        name: `${TEST_PREFIX}-LICENSE-CAPACITY-EXPIRED`,
        commercial_identifier: `${TEST_PREFIX}-CAPACITY-EXPIRED`,
        license_code: makeLicenseCode(),
      },
      adminUserId,
      "127.0.0.1"
    );

    const activated = await request(`/api/licenses/${available.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        device_reference: `${TEST_PREFIX}-CAPACITY-DEVICE`,
      }),
    });
    assert.equal(activated.response.status, 200);
    await pool.query("UPDATE license_units SET status = 'reserved' WHERE id = $1", [reserved.id]);
    await pool.query("UPDATE license_units SET status = 'expired' WHERE id = $1", [expired.id]);

    const response = await request(`/api/batches?search=${TEST_PREFIX}-BATCH-CAPACITY`, {
      headers: jsonHeaders(),
    });

    assert.equal(response.response.status, 200);
    const row = response.body.data.find((item) => item.id === batch.id);
    assert.ok(row);
    assert.equal(row.quantity, 5);
    assert.equal(row.registered_licenses, 3);
    assert.equal(row.available_to_register, 2);
    assert.equal(row.activated_licenses, 1);
    assert.equal(row.reserved_licenses, 1);
    assert.equal(row.expired_licenses, 1);
  });

  test("cifrado, hash y enmascarado de licencia", () => {
    const code = "ABCD-1234-EFGH-5678-IJKL";
    const encrypted = encryptLicenseCode(code);
    const hash = hashLicenseCode(code);
    const masked = maskLicenseCode(code);

    assert.notEqual(encrypted, code);
    assert.equal(hash.length, 64);
    assert.equal(masked.startsWith("ABCD"), true);
    assert.equal(masked.endsWith("IJKL"), true);
    assert.equal(masked.includes("*"), true);
  });

  test("acepta claves de activación multiproveedor", async () => {
    const examples = [
      "ABCD-EFGH-IJKL-MNOP-QRST",
      "12345-67890-ABCDE-FGHIJ-KLMNO",
      "ABCDE12345FGHIJ67890",
      "1111-2222-3333-4444-5555-6666",
    ];

    for (const [index, licenseCode] of examples.entries()) {
      const license = await createLicenseFixture(`MULTI-${index}`, { licenseCode });
      assert.equal(license.status, "available");
      assert.ok(license.masked_code.includes("*"));
    }
  });

  test("registra modo de inicio de vigencia", async () => {
    const license = await createLicenseFixture("VALIDITY-MODE", {
      validityStartMode: "first_activation",
    });

    assert.equal(license.validity_start_mode, "first_activation");
  });

  test("calcula vigencia al activar licencia first_activation", async () => {
    const license = await createLicenseFixture("FIRST-ACTIVATION-DATES", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2027-12-31",
    });

    assert.equal(license.start_date, null);
    assert.equal(license.next_renewal_date, null);
    assert.equal(new Date(license.redeem_deadline_date).toISOString().slice(0, 10), "2027-12-31");

    const activated = await request(`/api/licenses/${license.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        device_reference: `${TEST_PREFIX}-FIRST-ACTIVATION-DEVICE`,
      }),
    });

    assert.equal(activated.response.status, 200);
    assert.ok(activated.body.data.license.start_date);
    assert.ok(activated.body.data.license.next_renewal_date);
  });

  test("mantiene fechas originales al activar licencia purchase_date", async () => {
    const license = await createLicenseFixture("PURCHASE-ACTIVATION-DATES", {
      validityStartMode: "purchase_date",
      startDate: "2026-07-21",
    });
    const originalStartDate = new Date(license.start_date).toISOString().slice(0, 10);
    const originalRenewalDate = new Date(license.next_renewal_date).toISOString().slice(0, 10);

    const activated = await request(`/api/licenses/${license.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        device_reference: `${TEST_PREFIX}-PURCHASE-ACTIVATION-DEVICE`,
      }),
    });

    assert.equal(activated.response.status, 200);
    assert.equal(new Date(activated.body.data.license.start_date).toISOString().slice(0, 10), originalStartDate);
    assert.equal(new Date(activated.body.data.license.next_renewal_date).toISOString().slice(0, 10), originalRenewalDate);
  });

	  test("aplica reglas operativas de canje sin nuevo estado", async () => {
    const pendingActivation = await createLicenseFixture("AVAILABLE-FIRST-ACTIVATION", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2027-12-31",
    });

    assert.equal(pendingActivation.status, "available");
    assert.equal(pendingActivation.start_date, null);

    const runningPurchase = await createLicenseFixture("AVAILABLE-PURCHASE-RUNNING", {
      validityStartMode: "purchase_date",
      startDate: "2026-07-21",
    });

    assert.equal(runningPurchase.status, "available");
    assert.ok(runningPurchase.start_date);
    assert.ok(runningPurchase.next_renewal_date);

    const expiredRedeem = await createLicenseFixture("EXPIRED-REDEEM", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2025-01-01",
    });

    const expiredActivation = await request(`/api/licenses/${expiredRedeem.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    assert.equal(expiredActivation.response.status, 409);

    const expiredPurchase = await createLicenseFixture("EXPIRED-PURCHASE", {
      validityStartMode: "purchase_date",
      startDate: "2020-01-01",
    });

    const expiredPurchaseActivation = await request(`/api/licenses/${expiredPurchase.id}/activate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    assert.equal(expiredPurchaseActivation.response.status, 409);

	    const result = await licensesService.expireOverdueLicenses(adminUserId, "127.0.0.1");
	    const expiredIds = result.licenses.map((license) => license.id);
	    assert.equal(expiredIds.includes(expiredRedeem.id), false);
	    assert.equal(expiredPurchase.status, "expired");
	  });

  test("edición de licencia purchase_date vencida cambia estado a expired", async () => {
    const license = await createLicenseFixture("EDIT-AUTO-EXPIRED", {
      validityStartMode: "purchase_date",
      startDate: "2026-07-21",
    });

    const updated = await request(`/api/licenses/${license.id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        start_date: "2020-01-01",
      }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.status, "expired");
    assert.ok(updated.body.data.expiration_date);
  });

  test("edición de licencia first_activation no expira automáticamente por canje", async () => {
    const license = await createLicenseFixture("EDIT-REDEEM-NO-AUTO-EXPIRED", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2027-12-31",
    });

    const updated = await request(`/api/licenses/${license.id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        redeem_deadline_date: "2025-01-01",
      }),
    });

    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.status, "available");
    assert.equal(new Date(updated.body.data.redeem_deadline_date).toISOString().slice(0, 10), "2025-01-01");
  });

  test("no permite editar fechas operativas de licencia vencida", async () => {
    const license = await createLicenseFixture("LOCK-EXPIRED-DATES", {
      validityStartMode: "purchase_date",
      startDate: "2020-01-01",
    });

    assert.equal(license.status, "expired");

    const updated = await request(`/api/licenses/${license.id}`, {
      method: "PUT",
      headers: jsonHeaders(),
      body: JSON.stringify({
        expiration_date: "2026-12-31",
      }),
    });

    assert.equal(updated.response.status, 409);
  });

	  test("prioriza activación por fecha crítica más antigua", async () => {
    const later = await createLicenseFixture("PRIORITY-LATER", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2028-12-31",
    });
    const sooner = await createLicenseFixture("PRIORITY-SOONER", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2027-01-15",
    });

    const response = await request("/api/licenses?status=available&limit=100", {
      headers: jsonHeaders(),
    });

    assert.equal(response.response.status, 200);
    const ids = response.body.data
      .filter((license) => [sooner.id, later.id].includes(license.id))
      .map((license) => license.id);
    assert.ok(ids.indexOf(sooner.id) < ids.indexOf(later.id));
    assert.equal(response.body.data.find((license) => license.id === sooner.id).activation_priority_reason, "limite_de_canje");
  });

  test("dashboard alerta por renovación o límite de canje", async () => {
    const redeemAlert = await createLicenseFixture("ALERT-REDEEM", {
      validityStartMode: "first_activation",
      startDate: null,
      redeemDeadlineDate: "2026-08-01",
    });
    const renewalAlert = await createLicenseFixture("ALERT-RENEWAL", {
      validityStartMode: "purchase_date",
      startDate: "2026-07-01",
      billingCycle: "monthly",
    });
    const expiredWithFutureDate = await createLicenseFixture("ALERT-EXPIRED-FUTURE", {
      validityStartMode: "purchase_date",
      startDate: "2026-07-01",
      billingCycle: "annual",
    });
    await pool.query(
      "UPDATE license_units SET status = 'expired', expiration_date = CURRENT_DATE WHERE id = $1",
      [expiredWithFutureDate.id]
    );

    const alerts = await request("/api/dashboard/alerts?limit=100", {
      headers: jsonHeaders(),
    });

    assert.equal(alerts.response.status, 200);
    const redeemRow = alerts.body.data.find((license) => license.id === redeemAlert.id);
    const renewalRow = alerts.body.data.find((license) => license.id === renewalAlert.id);
    const expiredRow = alerts.body.data.find((license) => license.id === expiredWithFutureDate.id);

    assert.equal(redeemRow.alert_reason, "limite_de_canje");
    assert.equal(new Date(redeemRow.alert_date).toISOString().slice(0, 10), "2026-08-01");
    assert.equal(renewalRow.alert_reason, "vigencia_en_curso");
    assert.ok(renewalRow.alert_date);
    assert.equal(expiredRow.alert_reason, "licencia_vencida");
    assert.equal(expiredRow.alert_color, "red");
  });

  test("dashboard protegido devuelve resumen", async () => {
    const response = await request("/api/dashboard/overview", {
      headers: jsonHeaders(),
    });

	    assert.equal(response.response.status, 200);
	    assert.ok(response.body.data.financial);
    assert.ok(Object.prototype.hasOwnProperty.call(response.body.data.financial, "activated_revenue"));
    assert.ok(Object.prototype.hasOwnProperty.call(response.body.data.financial, "estimated_margin"));
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
