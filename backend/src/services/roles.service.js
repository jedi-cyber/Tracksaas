const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");

function validateRole(payload, partial = false) {
  if (!partial && !payload.name) {
    throw apiError("El nombre del rol es obligatorio");
  }

  if (payload.name !== undefined && !String(payload.name).trim()) {
    throw apiError("El nombre del rol no puede estar vacío");
  }
}

async function listRoles(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT r.*, COUNT(*) OVER() AS total_count
      FROM roles r
      WHERE ($1::BOOLEAN = TRUE OR r.active = TRUE)
        AND ($2::TEXT IS NULL OR r.name ILIKE $2 OR r.description ILIKE $2)
      ORDER BY r.name ASC
      LIMIT $3 OFFSET $4
    `,
    [includeInactive, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getRole(id) {
  const { rows } = await pool.query("SELECT * FROM roles WHERE id = $1", [id]);

  if (!rows[0]) {
    throw apiError("Rol no encontrado", 404);
  }

  return rows[0];
}

async function createRole(payload, userId, ipAddress) {
  validateRole(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO roles (name, description, active)
        VALUES ($1, $2, COALESCE($3, TRUE))
        RETURNING *
      `,
      [String(payload.name).trim(), payload.description || null, payload.active]
    );

    await recordAudit(client, {
      userId,
      entityName: "roles",
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

async function updateRole(id, payload, userId, ipAddress) {
  validateRole(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query("SELECT * FROM roles WHERE id = $1 FOR UPDATE", [id]);
    const oldRole = oldResult.rows[0];

    if (!oldRole) {
      throw apiError("Rol no encontrado", 404);
    }

    const { rows } = await client.query(
      `
        UPDATE roles
        SET
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          active = COALESCE($4, active)
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.description !== undefined ? payload.description : null,
        payload.active,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "roles",
      entityId: id,
      action: "update",
      oldValues: oldRole,
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

async function deactivateRole(id, userId, ipAddress) {
  return updateRole(id, { active: false }, userId, ipAddress);
}

module.exports = {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deactivateRole,
};
