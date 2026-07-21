const dashboardService = require("../services/dashboard.service");

async function overview(req, res, next) {
  try {
    res.status(200).json({ data: await dashboardService.getOverview() });
  } catch (error) {
    next(error);
  }
}

async function financial(req, res, next) {
  try {
    res.status(200).json({ data: await dashboardService.getFinancialDashboard() });
  } catch (error) {
    next(error);
  }
}

async function statusSummary(req, res, next) {
  try {
    res.status(200).json({ data: await dashboardService.getStatusSummary() });
  } catch (error) {
    next(error);
  }
}

async function inventorySummary(req, res, next) {
  try {
    res.status(200).json({ data: await dashboardService.getInventorySummary() });
  } catch (error) {
    next(error);
  }
}

async function alertSummary(req, res, next) {
  try {
    res.status(200).json({ data: await dashboardService.getAlertSummary() });
  } catch (error) {
    next(error);
  }
}

async function alerts(req, res, next) {
  try {
    res.status(200).json(await dashboardService.getAlerts(req.query));
  } catch (error) {
    next(error);
  }
}

async function upcomingRenewals(req, res, next) {
  try {
    res.status(200).json({ data: await dashboardService.getUpcomingRenewals(req.query) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  overview,
  financial,
  statusSummary,
  inventorySummary,
  alertSummary,
  alerts,
  upcomingRenewals,
};
