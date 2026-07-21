const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");
const { validateBoolean, validateString } = require("../utils/validators");

function validateProduct(payload, partial = false) {
  if (!partial && !payload.name) {
    throw apiError("El nombre del producto es obligatorio");
  }

  validateString(payload, "name", { max: 180 });
  validateString(payload, "description", { max: 2000, allowBlank: true });
  validateBoolean(payload, "active");
}

async function listProducts(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT
        p.*,
        COUNT(*) OVER() AS total_count
      FROM products p
      WHERE ($1::BOOLEAN = TRUE OR p.active = TRUE)
        AND ($2::TEXT IS NULL OR p.name ILIKE $2 OR p.description ILIKE $2)
      ORDER BY p.name ASC
      LIMIT $3 OFFSET $4
    `,
    [includeInactive, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getProduct(id) {
  const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);

  if (!rows[0]) {
    throw apiError("Producto no encontrado", 404);
  }

  return rows[0];
}

async function createProduct(payload, userId, ipAddress) {
  validateProduct(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO products (name, description, active, create_uid, write_uid)
        VALUES ($1, $2, COALESCE($3, TRUE), $4, $4)
        RETURNING *
      `,
      [
        String(payload.name).trim(),
        payload.description || null,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "products",
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

async function updateProduct(id, payload, userId, ipAddress) {
  validateProduct(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [id]);
    const oldProduct = oldResult.rows[0];

    if (!oldProduct) {
      throw apiError("Producto no encontrado", 404);
    }

    const { rows } = await client.query(
      `
        UPDATE products
        SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          active = COALESCE($4, active),
          write_uid = $5
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.description !== undefined ? payload.description : null,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "products",
      entityId: id,
      action: "update",
      oldValues: oldProduct,
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

async function deactivateProduct(id, userId, ipAddress) {
  return updateProduct(id, { active: false }, userId, ipAddress);
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deactivateProduct,
};
