const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");
const {
  validateBoolean,
  validateCurrency,
  validateDate,
  validateEnum,
  validateNonNegativeNumber,
  validatePositiveInteger,
  validateString,
} = require("../utils/validators");

const BATCH_STATUSES = ["draft", "confirmed", "cancelled"];

function validateBatch(payload, partial = false) {
  const required = ["variant_id", "provider_id", "purchase_date", "quantity", "unit_cost"];

  if (!partial) {
    required.forEach((field) => {
      if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
        throw apiError(`El campo ${field} es obligatorio`);
      }
    });
  }

  validatePositiveInteger(payload, "variant_id");
  validatePositiveInteger(payload, "provider_id");
  if (payload.batch_number !== undefined && payload.batch_number !== null && payload.batch_number !== "") {
    validateString(payload, "batch_number", { max: 100 });
  }
  validateDate(payload, "purchase_date");
  validatePositiveInteger(payload, "quantity");
  validateNonNegativeNumber(payload, "unit_cost");
  validateCurrency(payload, "currency_code");
  validateEnum(payload, "status", BATCH_STATUSES);
  validateString(payload, "notes", { max: 2000, allowBlank: true });
  validateBoolean(payload, "active");
}

async function generateBatchNumber(client, purchaseDate) {
  const year = new Date(purchaseDate).getUTCFullYear();
  const prefix = `LOT-${year}-`;

  await client.query("SELECT pg_advisory_xact_lock(hashtext('license_batches_batch_number'))");

  const { rows } = await client.query(
    `
      SELECT batch_number
      FROM license_batches
      WHERE batch_number LIKE $1
      ORDER BY batch_number DESC
      LIMIT 1
    `,
    [`${prefix}%`]
  );

  const lastNumber = rows[0]?.batch_number
    ? Number.parseInt(rows[0].batch_number.replace(prefix, ""), 10)
    : 0;
  const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

async function listBatches(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const status = query.status || null;
  const variantId = query.variantId || null;
  const providerId = query.providerId || null;
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT
        lb.*,
        pv.name AS variant_name,
        pv.billing_cycle AS variant_billing_cycle,
        pv.duration_days AS variant_duration_days,
        p.name AS product_name,
        pr.name AS provider_name,
        COALESCE(stats.registered_licenses, 0) AS registered_licenses,
        GREATEST(lb.quantity - COALESCE(stats.registered_licenses, 0), 0) AS available_to_register,
        COALESCE(stats.activated_licenses, 0) AS activated_licenses,
        COALESCE(stats.reserved_licenses, 0) AS reserved_licenses,
        COALESCE(stats.expired_licenses, 0) AS expired_licenses,
        COUNT(*) OVER() AS total_count
      FROM license_batches lb
      JOIN product_variants pv ON pv.id = lb.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN providers pr ON pr.id = lb.provider_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status <> 'cancelled')::INT AS registered_licenses,
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status = 'activated')::INT AS activated_licenses,
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status = 'reserved')::INT AS reserved_licenses,
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status = 'expired')::INT AS expired_licenses
        FROM license_units lu
        WHERE lu.batch_id = lb.id
      ) stats ON TRUE
      WHERE ($1::BOOLEAN = TRUE OR lb.active = TRUE)
        AND ($2::TEXT IS NULL OR lb.status = $2)
        AND ($3::BIGINT IS NULL OR lb.variant_id = $3)
        AND ($4::BIGINT IS NULL OR lb.provider_id = $4)
        AND ($5::TEXT IS NULL OR lb.batch_number ILIKE $5)
      ORDER BY lb.purchase_date DESC, lb.id DESC
      LIMIT $6 OFFSET $7
    `,
    [includeInactive, status, variantId, providerId, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getBatch(id) {
  const { rows } = await pool.query(
    `
      SELECT
        lb.*,
        pv.name AS variant_name,
        pv.billing_cycle AS variant_billing_cycle,
        pv.duration_days AS variant_duration_days,
        p.name AS product_name,
        pr.name AS provider_name,
        COALESCE(stats.registered_licenses, 0) AS registered_licenses,
        GREATEST(lb.quantity - COALESCE(stats.registered_licenses, 0), 0) AS available_to_register,
        COALESCE(stats.activated_licenses, 0) AS activated_licenses,
        COALESCE(stats.reserved_licenses, 0) AS reserved_licenses,
        COALESCE(stats.expired_licenses, 0) AS expired_licenses
      FROM license_batches lb
      JOIN product_variants pv ON pv.id = lb.variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN providers pr ON pr.id = lb.provider_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status <> 'cancelled')::INT AS registered_licenses,
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status = 'activated')::INT AS activated_licenses,
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status = 'reserved')::INT AS reserved_licenses,
          COUNT(*) FILTER (WHERE lu.active = TRUE AND lu.status = 'expired')::INT AS expired_licenses
        FROM license_units lu
        WHERE lu.batch_id = lb.id
      ) stats ON TRUE
      WHERE lb.id = $1
    `,
    [id]
  );

  if (!rows[0]) {
    throw apiError("Lote no encontrado", 404);
  }

  return rows[0];
}

async function createBatch(payload, userId, ipAddress) {
  validateBatch(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const batchNumber =
      payload.batch_number && String(payload.batch_number).trim()
        ? String(payload.batch_number).trim()
        : await generateBatchNumber(client, payload.purchase_date);

    const { rows } = await client.query(
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
          notes,
          active,
          create_uid,
          write_uid
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'PEN'), COALESCE($8, 'draft'), $9, COALESCE($10, TRUE), $11, $11)
        RETURNING *
      `,
      [
        payload.variant_id,
        payload.provider_id,
        batchNumber,
        payload.purchase_date,
        payload.quantity,
        payload.unit_cost,
        payload.currency_code || null,
        payload.status || null,
        payload.notes || null,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "license_batches",
      entityId: rows[0].id,
      action: "create",
      newValues: rows[0],
      ipAddress,
    });

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function updateBatch(id, payload, userId, ipAddress) {
  validateBatch(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM license_batches WHERE id = $1 FOR UPDATE", [id]);
    const oldBatch = oldResult.rows[0];

    if (!oldBatch) {
      throw apiError("Lote no encontrado", 404);
    }

    const action = payload.status === "cancelled" && oldBatch.status !== "cancelled" ? "cancel" : "update";

    const { rows } = await client.query(
      `
        UPDATE license_batches
        SET
          variant_id = COALESCE($2, variant_id),
          provider_id = COALESCE($3, provider_id),
          batch_number = COALESCE($4, batch_number),
          purchase_date = COALESCE($5, purchase_date),
          quantity = COALESCE($6, quantity),
          unit_cost = COALESCE($7, unit_cost),
          currency_code = COALESCE($8, currency_code),
          status = COALESCE($9, status),
          notes = COALESCE($10, notes),
          active = COALESCE($11, active),
          write_uid = $12
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.variant_id,
        payload.provider_id,
        payload.batch_number !== undefined ? String(payload.batch_number).trim() : null,
        payload.purchase_date,
        payload.quantity,
        payload.unit_cost,
        payload.currency_code,
        payload.status,
        payload.notes,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "license_batches",
      entityId: id,
      action,
      oldValues: oldBatch,
      newValues: rows[0],
      ipAddress,
    });

    await client.query("COMMIT");
    return rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw mapDbError(error);
  } finally {
    client.release();
  }
}

async function deactivateBatch(id, userId, ipAddress) {
  return updateBatch(id, { status: "cancelled" }, userId, ipAddress);
}

module.exports = {
  listBatches,
  getBatch,
  createBatch,
  updateBatch,
  deactivateBatch,
};
