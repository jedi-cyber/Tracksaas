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
      lu.commercial_identifier,
      lu.masked_code,
      lu.status AS license_status,
      lu.responsible_user_id,
      lu.next_renewal_date,
      lu.expiration_date,
      (lu.next_renewal_date - CURRENT_DATE) AS days_remaining,
      c.name AS customer_name,
      u.name AS activated_by_name,
      u.email AS activated_by_email,
      responsible.name AS responsible_user_name,
      lb.batch_number,
      pv.name AS variant_name,
      p.id AS product_id,
      p.name AS product_name,
      pr.id AS provider_id,
      pr.name AS provider_name
    FROM license_activations la
    JOIN license_units lu ON lu.id = la.license_unit_id
    LEFT JOIN customers c ON c.id = la.customer_id
    JOIN users u ON u.id = la.activated_by
    JOIN users responsible ON responsible.id = lu.responsible_user_id
    JOIN license_batches lb ON lb.id = lu.batch_id
    JOIN product_variants pv ON pv.id = lb.variant_id
    JOIN products p ON p.id = pv.product_id
    JOIN providers pr ON pr.id = lb.provider_id
  `;
}

async function listActivations(query) {
  const { page, limit, offset } = getPagination(query);
  const licenseUnitId = query.licenseUnitId || null;
  const customerId = query.customerId || null;
  const activatedBy = query.activatedBy || null;
  const productId = query.productId || null;
  const providerId = query.providerId || null;
  const status = query.status || null;
  const responsibleUserId = query.responsibleUserId || null;
  const due = ["overdue", "next30", "over30", "no_date"].includes(query.due) ? query.due : null;
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
        AND ($4::BIGINT IS NULL OR activation_data.product_id = $4)
        AND ($5::BIGINT IS NULL OR activation_data.provider_id = $5)
        AND ($6::TEXT IS NULL OR activation_data.license_status = $6)
        AND ($7::BIGINT IS NULL OR activation_data.responsible_user_id = $7)
        AND (
          $8::TEXT IS NULL
          OR ($8 = 'overdue' AND activation_data.next_renewal_date < CURRENT_DATE)
          OR ($8 = 'next30' AND activation_data.next_renewal_date >= CURRENT_DATE AND activation_data.next_renewal_date <= CURRENT_DATE + INTERVAL '30 days')
          OR ($8 = 'over30' AND activation_data.next_renewal_date > CURRENT_DATE + INTERVAL '30 days')
          OR ($8 = 'no_date' AND activation_data.next_renewal_date IS NULL)
        )
        AND ($9::DATE IS NULL OR activation_data.activation_date::DATE >= $9)
        AND ($10::DATE IS NULL OR activation_data.activation_date::DATE <= $10)
        AND (
          $11::TEXT IS NULL
          OR activation_data.license_name ILIKE $11
          OR activation_data.commercial_identifier ILIKE $11
          OR activation_data.masked_code ILIKE $11
          OR activation_data.customer_name ILIKE $11
          OR activation_data.device_reference ILIKE $11
          OR activation_data.support_reference ILIKE $11
          OR activation_data.product_name ILIKE $11
          OR activation_data.variant_name ILIKE $11
          OR activation_data.provider_name ILIKE $11
        )
      ORDER BY activation_data.activation_date DESC, activation_data.id DESC
      LIMIT $12 OFFSET $13
    `,
    [
      licenseUnitId,
      customerId,
      activatedBy,
      productId,
      providerId,
      status,
      responsibleUserId,
      due,
      dateFrom,
      dateTo,
      search,
      limit,
      offset,
    ]
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
