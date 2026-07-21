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

function validateLicense(payload, partial = false) {
  const required = [
    "batch_id",
    "responsible_user_id",
    "name",
    "commercial_identifier",
    "license_code",
    "start_date",
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
  validateEnum(payload, "status", LICENSE_STATUSES);
  validateDate(payload, "start_date");
  validateDate(payload, "next_renewal_date");
  validateDate(payload, "expiration_date");
  validateDateOrder(payload, "start_date", "next_renewal_date");
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
        lu.start_date,
        lu.next_renewal_date,
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
        COUNT(*) OVER() AS total_count
      FROM license_units lu
      JOIN license_batches lb ON lb.id = lu.batch_id
      JOIN product_variants pv ON pv.id = lb.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN users u ON u.id = lu.responsible_user_id
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
      ORDER BY lu.next_renewal_date ASC, lu.id DESC
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
        lu.start_date,
        lu.next_renewal_date,
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
        u.name AS responsible_user_name
      FROM license_units lu
      JOIN license_batches lb ON lb.id = lu.batch_id
      JOIN product_variants pv ON pv.id = lb.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN users u ON u.id = lu.responsible_user_id
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
  const encryptedCode = encryptLicenseCode(payload.license_code);
  const codeHash = hashLicenseCode(payload.license_code);
  const maskedCode = maskLicenseCode(payload.license_code);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchCapacity = await client.query(
      `
        SELECT lb.id, lb.quantity, pv.billing_cycle, pv.duration_days
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

    const billingCycle = payload.billing_cycle || batch.billing_cycle;
    const durationDays = batch.duration_days || fallbackDurationDays(billingCycle);
    const nextRenewalDate = calculateRenewalDate(payload.start_date, durationDays);

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
          start_date,
          next_renewal_date,
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
          $1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'available'), $9, $10,
          $11, $12, $13, $14, COALESCE($15, 'PEN'), $16, COALESCE($17, TRUE), $18, $18
        )
        RETURNING *
      `,
      [
        payload.batch_id,
        payload.responsible_user_id,
        String(payload.name).trim(),
        String(payload.commercial_identifier).trim(),
        encryptedCode,
        codeHash,
        maskedCode,
        payload.status || null,
        payload.start_date,
        nextRenewalDate,
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
    codeFields.encrypted = encryptLicenseCode(payload.license_code);
    codeFields.hash = hashLicenseCode(payload.license_code);
    codeFields.masked = maskLicenseCode(payload.license_code);
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

    const action = payload.status === "cancelled" && oldLicense.status !== "cancelled" ? "cancel" : "update";
    let nextRenewalDate = payload.next_renewal_date;
    const shouldRecalculateRenewal =
      payload.next_renewal_date === undefined &&
      (payload.batch_id !== undefined ||
        payload.start_date !== undefined ||
        payload.billing_cycle !== undefined);

    if (shouldRecalculateRenewal) {
      const targetBatchId = payload.batch_id || oldLicense.batch_id;
      const defaults = await getBatchRenewalDefaults(client, targetBatchId);
      const targetBillingCycle = payload.billing_cycle || defaults.billing_cycle || oldLicense.billing_cycle;
      const targetStartDate = payload.start_date || toDateInput(oldLicense.start_date);
      const durationDays = defaults.duration_days || fallbackDurationDays(targetBillingCycle);
      nextRenewalDate = calculateRenewalDate(targetStartDate, durationDays);
    }

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
          start_date = COALESCE($10, start_date),
          next_renewal_date = COALESCE($11, next_renewal_date),
          activation_date = COALESCE($12, activation_date),
          expiration_date = COALESCE($13, expiration_date),
          cost = COALESCE($14, cost),
          billing_cycle = COALESCE($15, billing_cycle),
          currency_code = COALESCE($16, currency_code),
          notes = COALESCE($17, notes),
          active = COALESCE($18, active),
          write_uid = $19
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.batch_id,
        payload.responsible_user_id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.commercial_identifier !== undefined
          ? String(payload.commercial_identifier).trim()
          : null,
        codeFields.encrypted || null,
        codeFields.hash || null,
        codeFields.masked || null,
        payload.status,
        payload.start_date,
        nextRenewalDate,
        payload.activation_date,
        payload.expiration_date,
        payload.cost,
        payload.billing_cycle,
        payload.currency_code,
        payload.notes,
        payload.active,
        userId,
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

    if (oldLicense.status !== "available") {
      throw apiError("Solo se pueden reservar licencias disponibles", 409);
    }

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
          AND next_renewal_date < CURRENT_DATE
        ORDER BY next_renewal_date ASC, id ASC
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
          expiration_date = COALESCE(expiration_date, next_renewal_date),
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

    if (!["available", "reserved"].includes(oldLicense.status)) {
      throw apiError("Solo se pueden activar licencias disponibles o reservadas", 409);
    }

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

    const licenseResult = await client.query(
      `
        UPDATE license_units
        SET
          status = 'activated',
          activation_date = $2,
          responsible_user_id = COALESCE($3, responsible_user_id),
          write_uid = $4
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        activationResult.rows[0].activation_date,
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
