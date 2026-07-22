const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const {
  encryptLicenseCode,
  hashLicenseCode,
  maskLicenseCode,
} = require("../utils/licenseCrypto");
const { getPagination, paginatedResponse } = require("../utils/pagination");
const {
  validateBoolean,
  validateCurrency,
  validateDate,
  validateDateOrder,
  validateEnum,
  validateNonNegativeNumber,
  validatePositiveInteger,
  validateString,
} = require("../utils/validators");

const LICENSE_STATUSES = ["available", "reserved", "activated", "expired", "cancelled"];
const BILLING_CYCLES = ["monthly", "annual"];
const VALIDITY_START_MODES = ["purchase_date", "first_activation"];
const COMMERCIAL_IDENTIFIER_PATTERN = /^[A-Z0-9][A-Z0-9._/#: +()-]{1,179}$/i;
const LICENSE_CODE_PATTERNS = [
  /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){4}$/i,
  /^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/i,
  /^[A-Z0-9]{20}$/i,
  /^\d{4}(?:-\d{4}){5}$/,
];

function validateLicenseIdentifiers(payload) {
  if (payload.commercial_identifier !== undefined && payload.commercial_identifier !== null && payload.commercial_identifier !== "") {
    const commercialIdentifier = String(payload.commercial_identifier).trim();
    if (!COMMERCIAL_IDENTIFIER_PATTERN.test(commercialIdentifier)) {
      throw apiError("El ID comercial público debe tener entre 2 y 180 caracteres y solo usar letras, números, espacios o símbolos comerciales básicos");
    }
  }

  if (payload.license_code !== undefined && payload.license_code !== null && payload.license_code !== "") {
    const licenseCode = String(payload.license_code).trim();
    if (!LICENSE_CODE_PATTERNS.some((pattern) => pattern.test(licenseCode))) {
      throw apiError("La clave única de activación debe usar un formato válido del proveedor: ESET 5x4, Microsoft 5x5, Kaspersky 20 caracteres o Adobe 6x4 numérico");
    }
  }
}

function validateLicense(payload, partial = false) {
  const required = [
    "batch_id",
    "responsible_user_id",
    "name",
    "license_code",
    "cost",
  ];

  if (!partial) {
    required.forEach((field) => {
      if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
        throw apiError(`El campo ${field} es obligatorio`);
      }
    });
  }

  validatePositiveInteger(payload, "batch_id");
  validatePositiveInteger(payload, "responsible_user_id");
  validateString(payload, "name", { max: 180 });
  validateString(payload, "commercial_identifier", { max: 180 });
  validateString(payload, "license_code", { max: 500 });
  validateLicenseIdentifiers(payload);
  validateEnum(payload, "status", LICENSE_STATUSES);
  validateEnum(payload, "validity_start_mode", VALIDITY_START_MODES);
  const validityStartMode = payload.validity_start_mode || "purchase_date";
  if (!partial && validityStartMode === "purchase_date" && (payload.start_date === undefined || payload.start_date === null || payload.start_date === "")) {
    throw apiError("El campo start_date es obligatorio cuando la vigencia inicia desde compra/facturación");
  }
  validateDate(payload, "start_date");
  validateDate(payload, "next_renewal_date");
  validateDate(payload, "redeem_deadline_date");
  validateDate(payload, "expiration_date");
  validateDateOrder(payload, "start_date", "next_renewal_date");
  validateDateOrder(payload, "start_date", "redeem_deadline_date");
  validateNonNegativeNumber(payload, "cost");
  validateEnum(payload, "billing_cycle", BILLING_CYCLES);
  validateCurrency(payload, "currency_code");
  validateString(payload, "notes", { max: 2000, allowBlank: true });
  validateBoolean(payload, "active");

  if (payload.status === "activated" && !payload.activation_date) {
    throw apiError("Una licencia activada requiere activation_date");
  }
}

function publicLicense(row) {
  const {
    license_code_encrypted,
    license_code_hash,
    ...safeRow
  } = row;

  return safeRow;
}

function fallbackDurationDays(billingCycle) {
  return billingCycle === "monthly" ? 30 : 365;
}

async function getBatchRenewalDefaults(client, batchId) {
  const { rows } = await client.query(
    `
      SELECT pv.billing_cycle, pv.duration_days
      FROM license_batches lb
      JOIN product_variants pv ON pv.id = lb.variant_id
      WHERE lb.id = $1
    `,
    [batchId]
  );

  if (!rows[0]) {
    throw apiError("Lote no encontrado", 404);
  }

  return rows[0];
}

async function assertConfirmedBatchForLicense(client, licenseOrBatchId, options = {}) {
  const byLicense = options.byLicense !== false;
  const { rows } = await client.query(
    byLicense
      ? `
          SELECT lb.status
          FROM license_units lu
          JOIN license_batches lb ON lb.id = lu.batch_id
          WHERE lu.id = $1
        `
      : "SELECT status FROM license_batches WHERE id = $1",
    [licenseOrBatchId]
  );

  if (!rows[0]) {
    throw apiError(byLicense ? "Licencia no encontrada" : "Lote no encontrado", 404);
  }

  if (rows[0].status !== "confirmed") {
    throw apiError("El lote debe estar confirmado para operar licencias", 409);
  }
}

function calculateRenewalDate(startDate, durationDays) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(durationDays));
  return date.toISOString().slice(0, 10);
}

function toDateInput(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function assertLicenseNotOverdueForOperation(license, operation) {
  const today = todayInput();

  if (license.next_renewal_date && toDateInput(license.next_renewal_date) < today) {
    throw apiError(`No se puede ${operation} una licencia con vigencia vencida`, 409);
  }

  if (
    license.validity_start_mode === "first_activation" &&
    !license.activation_date &&
    license.redeem_deadline_date &&
    toDateInput(license.redeem_deadline_date) < today
  ) {
    throw apiError(`No se puede ${operation} una licencia con fecha límite de canje vencida`, 409);
  }
}

function publicActivation(row) {
  return row;
}

async function listLicenses(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const status = query.status || null;
  const batchId = query.batchId || null;
  const responsibleUserId = query.responsibleUserId || null;
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT
        lu.id,
        lu.batch_id,
        lu.responsible_user_id,
        lu.name,
        lu.commercial_identifier,
        lu.masked_code,
        lu.status,
        lu.validity_start_mode,
        lu.start_date,
        lu.next_renewal_date,
        lu.redeem_deadline_date,
        COALESCE(lu.next_renewal_date, lu.redeem_deadline_date, lb.purchase_date) AS activation_priority_date,
        CASE
          WHEN lu.next_renewal_date IS NOT NULL THEN 'vigencia_en_curso'
          WHEN lu.redeem_deadline_date IS NOT NULL THEN 'limite_de_canje'
          ELSE 'compra_mas_antigua'
        END AS activation_priority_reason,
        lu.activation_date,
        lu.expiration_date,
        lu.cost,
        lu.billing_cycle,
        lu.currency_code,
        lu.notes,
        lu.active,
        lu.create_uid,
        lu.write_uid,
        lu.create_date,
        lu.write_date,
        lb.batch_number,
        pv.name AS variant_name,
        p.name AS product_name,
        u.name AS responsible_user_name,
        creator.name AS created_by_name,
        COUNT(*) OVER() AS total_count
      FROM license_units lu
      JOIN license_batches lb ON lb.id = lu.batch_id
      JOIN product_variants pv ON pv.id = lb.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN users u ON u.id = lu.responsible_user_id
      JOIN users creator ON creator.id = lu.create_uid
      WHERE ($1::BOOLEAN = TRUE OR lu.active = TRUE)
        AND ($2::TEXT IS NULL OR lu.status = $2)
        AND ($3::BIGINT IS NULL OR lu.batch_id = $3)
        AND ($4::BIGINT IS NULL OR lu.responsible_user_id = $4)
        AND (
          $5::TEXT IS NULL
          OR lu.name ILIKE $5
          OR lu.commercial_identifier ILIKE $5
          OR lu.masked_code ILIKE $5
        )
      ORDER BY
        CASE
          WHEN lu.status IN ('available', 'reserved') THEN 0
          ELSE 1
        END,
        COALESCE(lu.next_renewal_date, lu.redeem_deadline_date, lb.purchase_date) ASC,
        lb.purchase_date ASC,
        lu.id ASC
      LIMIT $6 OFFSET $7
    `,
    [includeInactive, status, batchId, responsibleUserId, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getLicense(id) {
  const { rows } = await pool.query(
    `
      SELECT
        lu.id,
        lu.batch_id,
        lu.responsible_user_id,
        lu.name,
        lu.commercial_identifier,
        lu.masked_code,
        lu.status,
        lu.validity_start_mode,
        lu.start_date,
        lu.next_renewal_date,
        lu.redeem_deadline_date,
        COALESCE(lu.next_renewal_date, lu.redeem_deadline_date, lb.purchase_date) AS activation_priority_date,
        CASE
          WHEN lu.next_renewal_date IS NOT NULL THEN 'vigencia_en_curso'
          WHEN lu.redeem_deadline_date IS NOT NULL THEN 'limite_de_canje'
          ELSE 'compra_mas_antigua'
        END AS activation_priority_reason,
        lu.activation_date,
        lu.expiration_date,
        lu.cost,
        lu.billing_cycle,
        lu.currency_code,
        lu.notes,
        lu.active,
        lu.create_uid,
        lu.write_uid,
        lu.create_date,
        lu.write_date,
        lb.batch_number,
        pv.name AS variant_name,
        p.name AS product_name,
        u.name AS responsible_user_name,
        creator.name AS created_by_name
      FROM license_units lu
      JOIN license_batches lb ON lb.id = lu.batch_id
      JOIN product_variants pv ON pv.id = lb.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN users u ON u.id = lu.responsible_user_id
      JOIN users creator ON creator.id = lu.create_uid
      WHERE lu.id = $1
    `,
    [id]
  );

  if (!rows[0]) {
    throw apiError("Licencia no encontrada", 404);
  }

  return rows[0];
}

async function createLicense(payload, userId, ipAddress) {
  validateLicense(payload);
  const normalizedLicenseCode = String(payload.license_code).trim().toUpperCase();
  const encryptedCode = encryptLicenseCode(normalizedLicenseCode);
  const codeHash = hashLicenseCode(normalizedLicenseCode);
  const maskedCode = maskLicenseCode(normalizedLicenseCode);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchCapacity = await client.query(
      `
        SELECT lb.id, lb.quantity, lb.status, pv.billing_cycle, pv.duration_days
        FROM license_batches lb
        JOIN product_variants pv ON pv.id = lb.variant_id
        WHERE lb.id = $1
        FOR UPDATE OF lb
      `,
      [payload.batch_id]
    );

    const batch = batchCapacity.rows[0];

    if (!batch) {
      throw apiError("Lote no encontrado", 404);
    }

    if (batch.status !== "confirmed") {
      throw apiError("El lote debe estar confirmado para crear licencias", 409);
    }

    const billingCycle = payload.billing_cycle || batch.billing_cycle;
    const durationDays = batch.duration_days || fallbackDurationDays(billingCycle);
    const validityStartMode = payload.validity_start_mode || "purchase_date";
    const nextRenewalDate =
      validityStartMode === "first_activation"
        ? null
        : calculateRenewalDate(payload.start_date, durationDays);
    const commercialIdentifier = String(payload.commercial_identifier || payload.name).trim().toUpperCase();

    const usedCapacity = await client.query(
      `
        SELECT COUNT(*)::INT AS used_quantity
        FROM license_units
        WHERE batch_id = $1
          AND active = TRUE
          AND status <> 'cancelled'
      `,
      [payload.batch_id]
    );

    if (usedCapacity.rows[0].used_quantity >= batch.quantity) {
      throw apiError("El lote ya alcanzó la cantidad máxima de licencias", 409);
    }

    const { rows } = await client.query(
      `
        INSERT INTO license_units (
          batch_id,
          responsible_user_id,
          name,
          commercial_identifier,
          license_code_encrypted,
          license_code_hash,
          masked_code,
          status,
          validity_start_mode,
          start_date,
          next_renewal_date,
          redeem_deadline_date,
          activation_date,
          expiration_date,
          cost,
          billing_cycle,
          currency_code,
          notes,
          active,
          create_uid,
          write_uid
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'available'), COALESCE($9, 'purchase_date'), $10, $11,
          $12, $13, $14, $15, $16, COALESCE($17, 'PEN'), $18, COALESCE($19, TRUE), $20, $20
        )
        RETURNING *
      `,
      [
        payload.batch_id,
        payload.responsible_user_id,
        String(payload.name).trim(),
        commercialIdentifier,
        encryptedCode,
        codeHash,
        maskedCode,
        payload.status || null,
        validityStartMode,
        validityStartMode === "first_activation" ? null : payload.start_date,
        nextRenewalDate,
        payload.redeem_deadline_date || null,
        payload.activation_date || null,
        payload.expiration_date || null,
        payload.cost,
        billingCycle,
        payload.currency_code || null,
        payload.notes || null,
        payload.active,
        userId,
      ]
    );

    const safeLicense = publicLicense(rows[0]);

    await recordAudit(client, {
      userId,
      entityName: "license_units",
      entityId: rows[0].id,
      action: "create",
      newValues: safeLicense,
      ipAddress,
    });

    await client.query("COMMIT");
    return safeLicense;
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function updateLicense(id, payload, userId, ipAddress) {
  validateLicense(payload, true);

  if (payload.status === "activated") {
    throw apiError("Use el endpoint de activación para activar una licencia", 409);
  }

  const codeFields = {};

  if (payload.license_code !== undefined) {
    const normalizedLicenseCode = String(payload.license_code).trim().toUpperCase();
    codeFields.encrypted = encryptLicenseCode(normalizedLicenseCode);
    codeFields.hash = hashLicenseCode(normalizedLicenseCode);
    codeFields.masked = maskLicenseCode(normalizedLicenseCode);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM license_units WHERE id = $1 FOR UPDATE", [id]);
    const oldLicense = oldResult.rows[0];

    if (!oldLicense) {
      throw apiError("Licencia no encontrada", 404);
    }

    if (oldLicense.status === "activated" && payload.license_code !== undefined) {
      throw apiError("No se puede cambiar el código de una licencia activada");
    }

    if (payload.batch_id !== undefined) {
      await assertConfirmedBatchForLicense(client, payload.batch_id, { byLicense: false });
    }

    const action = payload.status === "cancelled" && oldLicense.status !== "cancelled" ? "cancel" : "update";
    let nextRenewalDate = payload.next_renewal_date;
    const targetValidityStartMode = payload.validity_start_mode || oldLicense.validity_start_mode;
    const targetStartDateForValidation = payload.start_date || oldLicense.start_date;
    if (targetValidityStartMode === "purchase_date" && !targetStartDateForValidation) {
      throw apiError("El campo start_date es obligatorio cuando la vigencia inicia desde compra/facturación");
    }
    const shouldRecalculateRenewal =
      payload.next_renewal_date === undefined &&
      targetValidityStartMode === "purchase_date" &&
      (payload.batch_id !== undefined ||
        payload.start_date !== undefined ||
        payload.billing_cycle !== undefined ||
        payload.validity_start_mode !== undefined);

    if (shouldRecalculateRenewal) {
      const targetBatchId = payload.batch_id || oldLicense.batch_id;
      const defaults = await getBatchRenewalDefaults(client, targetBatchId);
      const targetBillingCycle = payload.billing_cycle || defaults.billing_cycle || oldLicense.billing_cycle;
      const targetStartDate = payload.start_date || toDateInput(oldLicense.start_date);
      const durationDays = defaults.duration_days || fallbackDurationDays(targetBillingCycle);
      nextRenewalDate = calculateRenewalDate(targetStartDate, durationDays);
    }
    const clearRenewalDate = payload.validity_start_mode === "first_activation" && oldLicense.status !== "activated";

    const { rows } = await client.query(
      `
        UPDATE license_units
        SET
          batch_id = COALESCE($2, batch_id),
          responsible_user_id = COALESCE($3, responsible_user_id),
          name = COALESCE($4, name),
          commercial_identifier = COALESCE($5, commercial_identifier),
          license_code_encrypted = COALESCE($6, license_code_encrypted),
          license_code_hash = COALESCE($7, license_code_hash),
          masked_code = COALESCE($8, masked_code),
          status = COALESCE($9, status),
          validity_start_mode = COALESCE($10, validity_start_mode),
          start_date = COALESCE($11, start_date),
          next_renewal_date = CASE WHEN $22::BOOLEAN THEN NULL ELSE COALESCE($12, next_renewal_date) END,
          redeem_deadline_date = COALESCE($13, redeem_deadline_date),
          activation_date = COALESCE($14, activation_date),
          expiration_date = COALESCE($15, expiration_date),
          cost = COALESCE($16, cost),
          billing_cycle = COALESCE($17, billing_cycle),
          currency_code = COALESCE($18, currency_code),
          notes = COALESCE($19, notes),
          active = COALESCE($20, active),
          write_uid = $21
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.batch_id,
        payload.responsible_user_id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.commercial_identifier !== undefined
          ? String(payload.commercial_identifier).trim().toUpperCase()
          : null,
        codeFields.encrypted || null,
        codeFields.hash || null,
        codeFields.masked || null,
        payload.status,
        payload.validity_start_mode,
        payload.start_date,
        nextRenewalDate,
        payload.redeem_deadline_date,
        payload.activation_date,
        payload.expiration_date,
        payload.cost,
        payload.billing_cycle,
        payload.currency_code,
        payload.notes,
        payload.active,
        userId,
        clearRenewalDate,
      ]
    );

    const safeOldLicense = publicLicense(oldLicense);
    const safeLicense = publicLicense(rows[0]);

    await recordAudit(client, {
      userId,
      entityName: "license_units",
      entityId: id,
      action,
      oldValues: safeOldLicense,
      newValues: safeLicense,
      ipAddress,
    });

    await client.query("COMMIT");
    return safeLicense;
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function deactivateLicense(id, userId, ipAddress) {
  return updateLicense(id, { status: "cancelled" }, userId, ipAddress);
}

async function reserveLicense(id, payload, userId, ipAddress) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM license_units WHERE id = $1 FOR UPDATE", [id]);
    const oldLicense = oldResult.rows[0];

    if (!oldLicense) {
      throw apiError("Licencia no encontrada", 404);
    }

    if (!oldLicense.active) {
      throw apiError("No se puede reservar una licencia inactiva", 409);
    }

    await assertConfirmedBatchForLicense(client, id);

    if (oldLicense.status !== "available") {
      throw apiError("Solo se pueden reservar licencias disponibles", 409);
    }

    assertLicenseNotOverdueForOperation(oldLicense, "reservar");

    const { rows } = await client.query(
      `
        UPDATE license_units
        SET
          status = 'reserved',
          responsible_user_id = COALESCE($2, responsible_user_id),
          notes = COALESCE($3, notes),
          write_uid = $4
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.responsible_user_id || null,
        payload.notes || null,
        userId,
      ]
    );

    const safeOldLicense = publicLicense(oldLicense);
    const safeLicense = publicLicense(rows[0]);

    await recordAudit(client, {
      userId,
      entityName: "license_units",
      entityId: id,
      action: "update",
      oldValues: safeOldLicense,
      newValues: {
        operation: "reserve",
        license: safeLicense,
      },
      ipAddress,
    });

    await client.query("COMMIT");
    return safeLicense;
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function releaseReservation(id, payload, userId, ipAddress) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM license_units WHERE id = $1 FOR UPDATE", [id]);
    const oldLicense = oldResult.rows[0];

    if (!oldLicense) {
      throw apiError("Licencia no encontrada", 404);
    }

    if (!oldLicense.active) {
      throw apiError("No se puede liberar una licencia inactiva", 409);
    }

    await assertConfirmedBatchForLicense(client, id);

    if (oldLicense.status !== "reserved") {
      throw apiError("Solo se pueden liberar licencias reservadas", 409);
    }

    const { rows } = await client.query(
      `
        UPDATE license_units
        SET
          status = 'available',
          notes = COALESCE($2, notes),
          write_uid = $3
        WHERE id = $1
        RETURNING *
      `,
      [id, payload.notes || null, userId]
    );

    const safeOldLicense = publicLicense(oldLicense);
    const safeLicense = publicLicense(rows[0]);

    await recordAudit(client, {
      userId,
      entityName: "license_units",
      entityId: id,
      action: "update",
      oldValues: safeOldLicense,
      newValues: {
        operation: "release_reservation",
        license: safeLicense,
      },
      ipAddress,
    });

    await client.query("COMMIT");
    return safeLicense;
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function expireOverdueLicenses(userId, ipAddress) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query(
      `
        SELECT *
        FROM license_units
        WHERE active = TRUE
          AND status IN ('available', 'reserved', 'activated')
          AND (
            next_renewal_date < CURRENT_DATE
            OR (
              validity_start_mode = 'first_activation'
              AND activation_date IS NULL
              AND redeem_deadline_date < CURRENT_DATE
            )
          )
        ORDER BY COALESCE(next_renewal_date, redeem_deadline_date) ASC, id ASC
        FOR UPDATE
      `
    );

    if (oldResult.rows.length === 0) {
      await client.query("COMMIT");
      return {
        expiredCount: 0,
        licenses: [],
      };
    }

    const ids = oldResult.rows.map((license) => license.id);

    const updateResult = await client.query(
      `
        UPDATE license_units
        SET
          status = 'expired',
          expiration_date = COALESCE(expiration_date, next_renewal_date, redeem_deadline_date),
          write_uid = $2
        WHERE id = ANY($1::BIGINT[])
        RETURNING *
      `,
      [ids, userId]
    );

    const oldById = new Map(oldResult.rows.map((license) => [String(license.id), license]));
    const safeLicenses = updateResult.rows.map(publicLicense);

    for (const newLicense of updateResult.rows) {
      await recordAudit(client, {
        userId,
        entityName: "license_units",
        entityId: newLicense.id,
        action: "update",
        oldValues: publicLicense(oldById.get(String(newLicense.id))),
        newValues: {
          operation: "expire_overdue",
          license: publicLicense(newLicense),
        },
        ipAddress,
      });
    }

    await client.query("COMMIT");

    return {
      expiredCount: safeLicenses.length,
      licenses: safeLicenses,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function activateLicense(id, payload, userId, ipAddress) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM license_units WHERE id = $1 FOR UPDATE", [id]);
    const oldLicense = oldResult.rows[0];

    if (!oldLicense) {
      throw apiError("Licencia no encontrada", 404);
    }

    if (!oldLicense.active) {
      throw apiError("No se puede activar una licencia inactiva", 409);
    }

    await assertConfirmedBatchForLicense(client, id);

    if (!["available", "reserved"].includes(oldLicense.status)) {
      throw apiError("Solo se pueden activar licencias disponibles o reservadas", 409);
    }

    assertLicenseNotOverdueForOperation(oldLicense, "activar");

    const existingActivation = await client.query(
      "SELECT id FROM license_activations WHERE license_unit_id = $1 LIMIT 1",
      [id]
    );

    if (existingActivation.rows[0]) {
      throw apiError("La licencia ya fue activada", 409);
    }

    const activationResult = await client.query(
      `
        INSERT INTO license_activations (
          license_unit_id,
          customer_id,
          activated_by,
          device_reference,
          support_reference,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        id,
        payload.customer_id || null,
        userId,
        payload.device_reference || null,
        payload.support_reference || null,
        payload.notes || null,
      ]
    );

    let activationStartDate = oldLicense.start_date ? toDateInput(oldLicense.start_date) : null;
    let activationRenewalDate = oldLicense.next_renewal_date ? toDateInput(oldLicense.next_renewal_date) : null;

    if (oldLicense.validity_start_mode === "first_activation") {
      const activationDate = activationResult.rows[0].activation_date;
      activationStartDate = toDateInput(activationDate);
      const defaults = await getBatchRenewalDefaults(client, oldLicense.batch_id);
      const durationDays = defaults.duration_days || fallbackDurationDays(defaults.billing_cycle || oldLicense.billing_cycle);
      activationRenewalDate = calculateRenewalDate(activationStartDate, durationDays);
    }

    const licenseResult = await client.query(
      `
        UPDATE license_units
        SET
          status = 'activated',
          activation_date = $2,
          start_date = COALESCE($3, start_date),
          next_renewal_date = COALESCE($4, next_renewal_date),
          responsible_user_id = COALESCE($5, responsible_user_id),
          write_uid = $6
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        activationResult.rows[0].activation_date,
        activationStartDate,
        activationRenewalDate,
        payload.responsible_user_id || null,
        userId,
      ]
    );

    const safeOldLicense = publicLicense(oldLicense);
    const safeLicense = publicLicense(licenseResult.rows[0]);
    const activation = publicActivation(activationResult.rows[0]);

    await recordAudit(client, {
      userId,
      entityName: "license_units",
      entityId: id,
      action: "activate",
      oldValues: safeOldLicense,
      newValues: {
        license: safeLicense,
        activation,
      },
      ipAddress,
    });

    await client.query("COMMIT");

    return {
      license: safeLicense,
      activation,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

module.exports = {
  listLicenses,
  getLicense,
  createLicense,
  updateLicense,
  deactivateLicense,
  reserveLicense,
  releaseReservation,
  expireOverdueLicenses,
  activateLicense,
};
