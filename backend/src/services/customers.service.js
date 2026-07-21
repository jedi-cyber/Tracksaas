const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");
const { validateBoolean, validateEmail, validateString } = require("../utils/validators");

function validateCustomer(payload, partial = false) {
  if (!partial && !payload.name) {
    throw apiError("El nombre del cliente es obligatorio");
  }

  validateString(payload, "name", { max: 180 });
  validateString(payload, "tax_id", { max: 30, allowBlank: true });
  validateEmail(payload, "email");
  validateString(payload, "email", { max: 255, allowBlank: true });
  validateString(payload, "phone", { max: 40, allowBlank: true });
  validateString(payload, "notes", { max: 2000, allowBlank: true });
  validateBoolean(payload, "active");
}

async function listCustomers(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT c.*, COUNT(*) OVER() AS total_count
      FROM customers c
      WHERE ($1::BOOLEAN = TRUE OR c.active = TRUE)
        AND (
          $2::TEXT IS NULL
          OR c.name ILIKE $2
          OR c.tax_id ILIKE $2
          OR c.email ILIKE $2
          OR c.phone ILIKE $2
        )
      ORDER BY c.name ASC, c.id ASC
      LIMIT $3 OFFSET $4
    `,
    [includeInactive, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getCustomer(id) {
  const { rows } = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);

  if (!rows[0]) {
    throw apiError("Cliente no encontrado", 404);
  }

  return rows[0];
}

async function createCustomer(payload, userId, ipAddress) {
  validateCustomer(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO customers (
          name,
          tax_id,
          email,
          phone,
          notes,
          active,
          create_uid,
          write_uid
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), $7, $7)
        RETURNING *
      `,
      [
        String(payload.name).trim(),
        payload.tax_id || null,
        payload.email || null,
        payload.phone || null,
        payload.notes || null,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "customers",
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

async function updateCustomer(id, payload, userId, ipAddress) {
  validateCustomer(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM customers WHERE id = $1 FOR UPDATE", [id]);
    const oldCustomer = oldResult.rows[0];

    if (!oldCustomer) {
      throw apiError("Cliente no encontrado", 404);
    }

    const { rows } = await client.query(
      `
        UPDATE customers
        SET
          name = COALESCE($2, name),
          tax_id = COALESCE($3, tax_id),
          email = COALESCE($4, email),
          phone = COALESCE($5, phone),
          notes = COALESCE($6, notes),
          active = COALESCE($7, active),
          write_uid = $8
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.tax_id,
        payload.email,
        payload.phone,
        payload.notes,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "customers",
      entityId: id,
      action: "update",
      oldValues: oldCustomer,
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

async function deactivateCustomer(id, userId, ipAddress) {
  return updateCustomer(id, { active: false }, userId, ipAddress);
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
};
