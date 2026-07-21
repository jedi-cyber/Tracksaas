const { Router } = require("express");

const auditLogsController = require("../controllers/auditLogs.controller");

const router = Router();

router.get("/", auditLogsController.list);
router.get("/:id", auditLogsController.get);

module.exports = router;
