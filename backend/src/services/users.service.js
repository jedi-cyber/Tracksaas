const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { recordAudit } = require("../utils/audit");
const mapDbError = require("../utils/dbErrors");
const { getPagination, paginatedResponse } = require("../utils/pagination");
const {
  validateBoolean,
  validateEmail,
  validatePositiveInteger,
  validateString,
} = require("../utils/validators");

function toSafeUser(row) {
  const { password_hash, total_count, ...safeRow } = row;
  return safeRow;
}

function validateUser(payload, partial = false) {
  const required = ["role_id", "name", "email", "password"];

  if (!partial) {
    required.forEach((field) => {
      if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
        throw apiError(`El campo ${field} es obligatorio`);
      }
    });
  }

  validatePositiveInteger(payload, "role_id");
  validateString(payload, "name", { max: 150 });
  validateEmail(payload, "email");
  validateString(payload, "email", { max: 255, allowBlank: true });
  validateBoolean(payload, "active");

  if (payload.password !== undefined && String(payload.password).length < 8) {
    throw apiError("La contraseña debe tener al menos 8 caracteres");
  }

  if (payload.password !== undefined && String(payload.password).length > 128) {
    throw apiError("La contraseña no puede superar 128 caracteres");
  }
}

async function listUsers(query) {
  const { page, limit, offset } = getPagination(query);
  const includeInactive = query.includeInactive === "true";
  const roleId = query.roleId || null;
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.role_id,
        u.name,
        u.email,
        u.active,
        u.last_login_at,
        u.create_date,
        u.write_date,
        r.name AS role_name,
        COUNT(*) OVER() AS total_count
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE ($1::BOOLEAN = TRUE OR u.active = TRUE)
        AND ($2::BIGINT IS NULL OR u.role_id = $2)
        AND ($3::TEXT IS NULL OR u.name ILIKE $3 OR u.email ILIKE $3)
      ORDER BY u.name ASC
      LIMIT $4 OFFSET $5
    `,
    [includeInactive, roleId, search, limit, offset]
  );

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  return {
    data: rows.map(toSafeUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getUser(id) {
  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.role_id,
        u.name,
        u.email,
        u.active,
        u.last_login_at,
        u.create_date,
        u.write_date,
        r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
    `,
    [id]
  );

  if (!rows[0]) {
    throw apiError("Usuario no encontrado", 404);
  }

  return rows[0];
}

async function createUser(payload, userId, ipAddress) {
  validateUser(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        INSERT INTO users (role_id, name, email, password_hash, active)
        VALUES ($1, $2, LOWER($3), crypt($4, gen_salt('bf', 12)), COALESCE($5, TRUE))
        RETURNING id, role_id, name, email, active, last_login_at, create_date, write_date
      `,
      [
        payload.role_id,
        String(payload.name).trim(),
        String(payload.email).trim(),
        payload.password,
        payload.active,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "users",
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

async function updateUser(id, payload, userId, ipAddress) {
  validateUser(payload, true);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const oldResult = await client.query(
      `
        SELECT id, role_id, name, email, active, last_login_at, create_date, write_date
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );
    const oldUser = oldResult.rows[0];

    if (!oldUser) {
      throw apiError("Usuario no encontrado", 404);
    }

    const { rows } = await client.query(
      `
        UPDATE users
        SET
          role_id = COALESCE($2, role_id),
          name = COALESCE($3, name),
          email = COALESCE(LOWER($4), email),
          password_hash = CASE
            WHEN $5::TEXT IS NULL THEN password_hash
            ELSE crypt($5, gen_salt('bf', 12))
          END,
          active = COALESCE($6, active)
        WHERE id = $1
        RETURNING id, role_id, name, email, active, last_login_at, create_date, write_date
      `,
      [
        id,
        payload.role_id,
        payload.name !== undefined ? String(payload.name).trim() : null,
        payload.email !== undefined ? String(payload.email).trim() : null,
        payload.password || null,
        payload.active,
      ]
    );

    await recordAudit(client, {
      userId,
      entityName: "users",
      entityId: id,
      action: "update",
      oldValues: oldUser,
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

async function deactivateUser(id, userId, ipAddress) {
  return updateUser(id, { active: false }, userId, ipAddress);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
};
