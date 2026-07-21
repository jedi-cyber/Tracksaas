const pool = require("../config/database");
const apiError = require("../utils/apiError");
const { getPagination, paginatedResponse } = require("../utils/pagination");

function getActivationSelect() {
  return `
    SELECT
      la.id,
      la.license_unit_id,
      la.customer_id,
      la.activated_by,
      la.activation_date,
      la.device_reference,
      la.support_reference,
      la.notes,
      la.create_date,
      lu.name AS license_name,
      lu.masked_code,
      lu.status AS license_status,
      lu.next_renewal_date,
      c.name AS customer_name,
      u.name AS activated_by_name,
      u.email AS activated_by_email,
      lb.batch_number,
      pv.name AS variant_name,
      p.name AS product_name
    FROM license_activations la
    JOIN license_units lu ON lu.id = la.license_unit_id
    LEFT JOIN customers c ON c.id = la.customer_id
    JOIN users u ON u.id = la.activated_by
    JOIN license_batches lb ON lb.id = lu.batch_id
    JOIN product_variants pv ON pv.id = lb.variant_id
    JOIN products p ON p.id = pv.product_id
  `;
}

async function listActivations(query) {
  const { page, limit, offset } = getPagination(query);
  const licenseUnitId = query.licenseUnitId || null;
  const customerId = query.customerId || null;
  const activatedBy = query.activatedBy || null;
  const dateFrom = query.dateFrom || null;
  const dateTo = query.dateTo || null;
  const search = query.search ? `%${query.search.trim()}%` : null;

  const { rows } = await pool.query(
    `
      SELECT activation_data.*, COUNT(*) OVER() AS total_count
      FROM (
        ${getActivationSelect()}
      ) activation_data
      WHERE ($1::BIGINT IS NULL OR activation_data.license_unit_id = $1)
        AND ($2::BIGINT IS NULL OR activation_data.customer_id = $2)
        AND ($3::BIGINT IS NULL OR activation_data.activated_by = $3)
        AND ($4::DATE IS NULL OR activation_data.activation_date::DATE >= $4)
        AND ($5::DATE IS NULL OR activation_data.activation_date::DATE <= $5)
        AND (
          $6::TEXT IS NULL
          OR activation_data.license_name ILIKE $6
          OR activation_data.masked_code ILIKE $6
          OR activation_data.customer_name ILIKE $6
          OR activation_data.device_reference ILIKE $6
          OR activation_data.support_reference ILIKE $6
          OR activation_data.product_name ILIKE $6
          OR activation_data.variant_name ILIKE $6
        )
      ORDER BY activation_data.activation_date DESC, activation_data.id DESC
      LIMIT $7 OFFSET $8
    `,
    [licenseUnitId, customerId, activatedBy, dateFrom, dateTo, search, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getActivation(id) {
  const { rows } = await pool.query(
    `
      ${getActivationSelect()}
      WHERE la.id = $1
      LIMIT 1
    `,
    [id]
  );

  if (!rows[0]) {
    throw apiError("Activación no encontrada", 404);
  }

  return rows[0];
}

async function getActivationByLicense(licenseUnitId) {
  const { rows } = await pool.query(
    `
      ${getActivationSelect()}
      WHERE la.license_unit_id = $1
      LIMIT 1
    `,
    [licenseUnitId]
  );

  if (!rows[0]) {
    throw apiError("Activación no encontrada para la licencia indicada", 404);
  }

  return rows[0];
}

module.exports = {
  listActivations,
  getActivation,
  getActivationByLicense,
};
