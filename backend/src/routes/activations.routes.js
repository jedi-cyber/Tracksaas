const { Router } = require("express");

const activationsController = require("../controllers/activations.controller");

const router = Router();

router.get("/", activationsController.list);
router.get("/by-license/:licenseUnitId", activationsController.getByLicense);
router.get("/:id", activationsController.get);

module.exports = router;
