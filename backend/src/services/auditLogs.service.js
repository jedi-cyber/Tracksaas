const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { getPagination, paginatedResponse } = require("../utils/pagination");

const AUDIT_ACTIONS = new Set(["create", "update", "delete", "activate", "cancel"]);

function normalizeAction(action) {
  return AUDIT_ACTIONS.has(action) ? action : null;
}

function getAuditSelect() {
  return `
    SELECT
      al.id,
      al.user_id,
      al.entity_name,
      al.entity_id,
      al.action,
      al.old_values,
      al.new_values,
      al.ip_address::TEXT AS ip_address,
      al.created_at,
      u.name AS user_name,
      u.email AS user_email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
  `;
}

async function listAuditLogs(query) {
  const { page, limit, offset } = getPagination(query);
  const userId = query.userId || null;
  const entityName = query.entityName || null;
  const entityId = query.entityId || null;
  const action = normalizeAction(query.action);
  const dateFrom = query.dateFrom || null;
  const dateTo = query.dateTo || null;
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT audit_data.*, COUNT(*) OVER() AS total_count
      FROM (
        ${getAuditSelect()}
      ) audit_data
      WHERE ($1::BIGINT IS NULL OR audit_data.user_id = $1)
        AND ($2::TEXT IS NULL OR audit_data.entity_name = $2)
        AND ($3::BIGINT IS NULL OR audit_data.entity_id = $3)
        AND ($4::TEXT IS NULL OR audit_data.action = $4)
        AND ($5::DATE IS NULL OR audit_data.created_at::DATE >= $5)
        AND ($6::DATE IS NULL OR audit_data.created_at::DATE <= $6)
        AND (
          $7::TEXT IS NULL
          OR audit_data.entity_name ILIKE $7
          OR audit_data.action ILIKE $7
          OR audit_data.user_name ILIKE $7
          OR audit_data.user_email ILIKE $7
          OR audit_data.old_values::TEXT ILIKE $7
          OR audit_data.new_values::TEXT ILIKE $7
        )
      ORDER BY audit_data.created_at DESC, audit_data.id DESC
      LIMIT $8 OFFSET $9
    `,
    [userId, entityName, entityId, action, dateFrom, dateTo, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getAuditLog(id) {
  const { rows } = await pool.query(
    `
      ${getAuditSelect()}
      WHERE al.id = $1
      LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw apiError("Registro de auditoría no encontrado", 404);
  }

  return rows[0];
}

module.exports = {
  listAuditLogs,
  getAuditLog,
};
