const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");

function validateProvider(payload, partial = false) {
  if (!partial && !payload.name) {
    throw apiError("El nombre del proveedor es obligatorio");
  }

  if (payload.name !== undefined && !String(payload.name).trim()) {
    throw apiError("El nombre del proveedor no puede estar vacío");
  }
}

async function listProviders(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT pr.*, COUNT(*) OVER() AS total_count
      FROM providers pr
      WHERE ($1::BOOLEAN = TRUE OR pr.active = TRUE)
        AND (
          $2::TEXT IS NULL
          OR pr.name ILIKE $2
          OR pr.tax_id ILIKE $2
          OR pr.contact_name ILIKE $2
          OR pr.email ILIKE $2
        )
      ORDER BY pr.name ASC
      LIMIT $3 OFFSET $4
    `,
    [includeInactive, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getProvider(id) {
  const { rows } = await pool.query("SELECT * FROM providers WHERE id = $1", [id]);

  if (!rows[0]) {
    throw apiError("Proveedor no encontrado", 404);
  }

  return rows[0];
}

async function createProvider(payload, userId, ipAddress) {
  validateProvider(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO providers (
          name,
          tax_id,
          contact_name,
          email,
          phone,
          notes,
          active,
          create_uid,
          write_uid
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), $8, $8)
        RETURNING *
      `,
      [
        String(payload.name).trim(),
        payload.tax_id || null,
        payload.contact_name || null,
        payload.email || null,
        payload.phone || null,
        payload.notes || null,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "providers",
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

async function updateProvider(id, payload, userId, ipAddress) {
  validateProvider(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM providers WHERE id = $1 FOR UPDATE", [id]);
    const oldProvider = oldResult.rows[0];

    if (!oldProvider) {
      throw apiError("Proveedor no encontrado", 404);
    }

    const { rows } = await client.query(
      `
        UPDATE providers
        SET
          name = COALESCE($2, name),
          tax_id = COALESCE($3, tax_id),
          contact_name = COALESCE($4, contact_name),
          email = COALESCE($5, email),
          phone = COALESCE($6, phone),
          notes = COALESCE($7, notes),
          active = COALESCE($8, active),
          write_uid = $9
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.tax_id,
        payload.contact_name,
        payload.email,
        payload.phone,
        payload.notes,
        payload.active,
        userId,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "providers",
      entityId: id,
      action: "update",
      oldValues: oldProvider,
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

async function deactivateProvider(id, userId, ipAddress) {
  return updateProvider(id, { active: false }, userId, ipAddress);
}

module.exports = {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deactivateProvider,
};
