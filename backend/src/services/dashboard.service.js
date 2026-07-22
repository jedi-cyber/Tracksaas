const pool = require("../config/database");
const { getPagination, paginatedResponse } = require("../utils/pagination");
const { ensureLicenseSalePriceColumn } = require("../utils/schemaMigrations");

const ALERT_COLORS = new Set(["green", "yellow", "red"]);

async function getFinancialDashboard() {
  await ensureLicenseSalePriceColumn();

  const { rows } = await pool.query(
    `
      SELECT
        COALESCE(SUM(sale_price) FILTER (WHERE active = TRUE AND status = 'activated'), 0)::NUMERIC(14,2) AS activated_revenue,
        COALESCE(SUM(cost) FILTER (WHERE active = TRUE AND status = 'activated'), 0)::NUMERIC(14,2) AS sold_license_cost,
        (
          COALESCE(SUM(sale_price) FILTER (WHERE active = TRUE AND status = 'activated'), 0)
          - COALESCE(SUM(cost) FILTER (WHERE active = TRUE AND status = 'activated'), 0)
        )::NUMERIC(14,2) AS estimated_margin,
        COALESCE(SUM(cost) FILTER (WHERE active = TRUE AND status = 'available'), 0)::NUMERIC(14,2) AS available_inventory_value,
        COALESCE(SUM(CASE
          WHEN billing_cycle = 'monthly' THEN cost
          WHEN billing_cycle = 'annual' THEN cost / 12
          ELSE 0 END) FILTER (WHERE active = TRUE AND status <> 'cancelled'), 0)::NUMERIC(14,2) AS monthly_equivalent_cost,
        COALESCE(SUM(CASE
          WHEN billing_cycle = 'monthly' THEN cost * 12
          WHEN billing_cycle = 'annual' THEN cost
          ELSE 0 END) FILTER (WHERE active = TRUE AND status <> 'cancelled'), 0)::NUMERIC(14,2) AS annual_cost_projection
      FROM license_units
    `
  );

  return {
    activated_revenue: rows[0]?.activated_revenue || "0.00",
    sold_license_cost: rows[0]?.sold_license_cost || "0.00",
    estimated_margin: rows[0]?.estimated_margin || "0.00",
    available_inventory_value: rows[0]?.available_inventory_value || "0.00",
    monthly_equivalent_cost: rows[0]?.monthly_equivalent_cost || "0.00",
    annual_cost_projection: rows[0]?.annual_cost_projection || "0.00",
  };
}

async function getStatusSummary() {
  const { rows } = await pool.query(
    `
      SELECT status, COUNT(*)::INT AS total
      FROM license_units
      WHERE active = TRUE
      GROUP BY status
      ORDER BY status ASC
    `
  );

  const summary = {
    available: 0,
    reserved: 0,
    activated: 0,
    expired: 0,
    cancelled: 0,
  };

  rows.forEach((row) => {
    summary[row.status] = row.total;
  });

  return summary;
}

async function getInventorySummary() {
  const { rows } = await pool.query(
    `
      SELECT
        (SELECT COUNT(*)::INT FROM products WHERE active = TRUE) AS products,
        (SELECT COUNT(*)::INT FROM product_variants WHERE active = TRUE) AS variants,
        (SELECT COUNT(*)::INT FROM providers WHERE active = TRUE) AS providers,
        (SELECT COUNT(*)::INT FROM license_batches WHERE active = TRUE) AS batches,
        (SELECT COUNT(*)::INT FROM license_units WHERE active = TRUE) AS licenses,
        (SELECT COUNT(*)::INT FROM customers WHERE active = TRUE) AS customers
    `
  );

  return rows[0];
}

async function getAlertSummary() {
  const { rows } = await pool.query(
    `
      SELECT alert_color, COUNT(*)::INT AS total
      FROM vw_license_alerts
      GROUP BY alert_color
    `
  );

  const summary = {
    green: 0,
    yellow: 0,
    red: 0,
  };

  rows.forEach((row) => {
    summary[row.alert_color] = row.total;
  });

  return summary;
}

async function getAlerts(query) {
  const { page, limit, offset } = getPagination(query);
  const color = ALERT_COLORS.has(query.color) ? query.color : null;
  const status = query.status || null;
  const responsibleUserId = query.responsibleUserId || null;

  const { rows } = await pool.query(
    `
      SELECT
        a.*,
        u.name AS responsible_user_name,
        COUNT(*) OVER() AS total_count
      FROM vw_license_alerts a
      JOIN users u ON u.id = a.responsible_user_id
      WHERE ($1::TEXT IS NULL OR a.alert_color = $1)
        AND ($2::TEXT IS NULL OR a.status = $2)
        AND ($3::BIGINT IS NULL OR a.responsible_user_id = $3)
      ORDER BY
        CASE a.alert_color
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          ELSE 3
        END,
        a.alert_date ASC,
        a.id ASC
      LIMIT $4 OFFSET $5
    `,
    [color, status, responsibleUserId, limit, offset]
  );

  return paginatedResponse(rows, page, limit);
}

async function getUpcomingRenewals(query) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 50);
  const days = Math.min(Math.max(Number.parseInt(query.days, 10) || 30, 1), 365);

  const { rows } = await pool.query(
    `
      SELECT
        a.*,
        u.name AS responsible_user_name
      FROM vw_license_alerts a
      JOIN users u ON u.id = a.responsible_user_id
      WHERE a.alert_date >= CURRENT_DATE
        AND a.alert_date <= CURRENT_DATE + ($1::INT * INTERVAL '1 day')
      ORDER BY a.alert_date ASC, a.id ASC
      LIMIT $2
    `,
    [days, limit]
  );

  return rows;
}

async function getOverview() {
  const [financial, statusSummary, inventorySummary, alertSummary, upcomingRenewals] =
    await Promise.all([
      getFinancialDashboard(),
      getStatusSummary(),
      getInventorySummary(),
      getAlertSummary(),
      getUpcomingRenewals({ limit: 10, days: 30 }),
    ]);

  return {
    financial,
    licensesByStatus: statusSummary,
    inventory: inventorySummary,
    alerts: alertSummary,
    upcomingRenewals,
  };
}

module.exports = {
  getOverview,
  getFinancialDashboard,
  getStatusSummary,
  getInventorySummary,
  getAlertSummary,
  getAlerts,
  getUpcomingRenewals,
};
