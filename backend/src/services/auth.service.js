const pool = require("../config/database");
const { signToken } = require("../config/jwt");

function toSafeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: {
      id: row.role_id,
      name: row.role_name,
    },
  };
}

async function login(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    const error = new Error("Correo y contraseña son obligatorios");
    error.statusCode = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.role_id,
        u.name,
        u.email,
        r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = $1
        AND u.active = TRUE
        AND r.active = TRUE
        AND u.password_hash = crypt($2, u.password_hash)
      LIMIT 1
    `,
    [normalizedEmail, password]
  );

  const user = rows[0];

  if (!user) {
    const error = new Error("Credenciales inválidas");
    error.statusCode = 401;
    throw error;
  }

  await pool.query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", [
    user.id,
  ]);

  return {
    token: signToken(user),
    user: toSafeUser(user),
  };
}

async function getUserById(userId) {
  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.role_id,
        u.name,
        u.email,
        r.name AS role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
        AND u.active = TRUE
        AND r.active = TRUE
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] ? toSafeUser(rows[0]) : null;
}

module.exports = {
  login,
  getUserById,
};
