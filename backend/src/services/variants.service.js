const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");

const BILLING_CYCLES = new Set(["monthly", "annual"]);

function validateVariant(payload, partial = false) {
  const required = ["product_id", "name", "billing_cycle"];

  if (!partial) {
    required.forEach((field) => {
      if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
        throw apiError(`El campo ${field} es obligatorio`);
      }
    });
  }

  if (payload.name !== undefined && !String(payload.name).trim()) {
    throw apiError("El nombre de la variante no puede estar vacío");
  }

  if (payload.billing_cycle !== undefined && !BILLING_CYCLES.has(payload.billing_cycle)) {
    throw apiError("billing_cycle debe ser monthly o annual");
  }
}

async function listVariants(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const productId = query.productId || null;
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT
        pv.*,
        p.name AS product_name,
        COUNT(*) OVER() AS total_count
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE ($1::BOOLEAN = TRUE OR pv.active = TRUE)
        AND ($2::BIGINT IS NULL OR pv.product_id = $2)
        AND ($3::TEXT IS NULL OR pv.name ILIKE $3 OR pv.default_code ILIKE $3)
      ORDER BY p.name ASC, pv.name ASC
      LIMIT $4 OFFSET $5
    `,
    [includeInactive, productId, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getVariant(id) {
  const { rows } = await pool.query(
    `
      SELECT pv.*, p.name AS product_name
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.id = $1
    `,
    [id]
  );

  if (!rows[0]) {
    throw apiError("Variante no encontrada", 404);
  }

  return rows[0];
}

async function createVariant(payload, userId, ipAddress) {
  validateVariant(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO product_variants (
          product_id,
          name,
          default_code,
          billing_cycle,
          duration_days,
          default_cost,
          currency_code,
          active,
          create_uid,
          write_uid
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, 'PEN'), COALESCE($8, TRUE), $9, $9)
        RETURNING *
      `,
      [
        payload.product_id,
        String(payload.name).trim(),
        payload.default_code || null,
        payload.billing_cycle,
        payload.duration_days || null,
        payload.default_cost,
        payload.currency_code || null,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "product_variants",
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

async function updateVariant(id, payload, userId, ipAddress) {
  validateVariant(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM product_variants WHERE id = $1 FOR UPDATE", [id]);
    const oldVariant = oldResult.rows[0];

    if (!oldVariant) {
      throw apiError("Variante no encontrada", 404);
    }

    const { rows } = await client.query(
      `
        UPDATE product_variants
        SET
          product_id = COALESCE($2, product_id),
          name = COALESCE($3, name),
          default_code = COALESCE($4, default_code),
          billing_cycle = COALESCE($5, billing_cycle),
          duration_days = COALESCE($6, duration_days),
          default_cost = COALESCE($7, default_cost),
          currency_code = COALESCE($8, currency_code),
          active = COALESCE($9, active),
          write_uid = $10
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.product_id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.default_code !== undefined ? payload.default_code : null,
        payload.billing_cycle,
        payload.duration_days,
        payload.default_cost,
        payload.currency_code,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "product_variants",
      entityId: id,
      action: "update",
      oldValues: oldVariant,
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

async function deactivateVariant(id, userId, ipAddress) {
  return updateVariant(id, { active: false }, userId, ipAddress);
}

module.exports = {
  listVariants,
  getVariant,
  createVariant,
  updateVariant,
  deactivateVariant,
};
