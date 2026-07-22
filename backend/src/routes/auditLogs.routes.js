const { Router } = require("express");

const auditLogsController = require("../controllers/auditLogs.controller");

const router = Router();

router.get("/", auditLogsController.list);
router.get("/cleanup-preview", auditLogsController.cleanupPreview);
router.post("/cleanup", auditLogsController.cleanup);
router.get("/:id", auditLogsController.get);

module.exports = router;
