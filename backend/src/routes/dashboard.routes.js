const { Router } = require("express");

const dashboardController = require("../controllers/dashboard.controller");

const router = Router();

router.get("/overview", dashboardController.overview);
router.get("/financial", dashboardController.financial);
router.get("/status-summary", dashboardController.statusSummary);
router.get("/inventory-summary", dashboardController.inventorySummary);
router.get("/alert-summary", dashboardController.alertSummary);
router.get("/alerts", dashboardController.alerts);
router.get("/renewals", dashboardController.upcomingRenewals);

module.exports = router;
