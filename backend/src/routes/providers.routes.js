const { Router } = require("express");

const providersController = require("../controllers/providers.controller");

const router = Router();

router.get("/", providersController.list);
router.post("/", providersController.create);
router.get("/:id", providersController.get);
router.put("/:id", providersController.update);
router.delete("/:id", providersController.remove);

module.exports = router;
