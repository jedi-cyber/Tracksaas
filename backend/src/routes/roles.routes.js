const { Router } = require("express");

const rolesController = require("../controllers/roles.controller");

const router = Router();

router.get("/", rolesController.list);
router.post("/", rolesController.create);
router.get("/:id", rolesController.get);
router.put("/:id", rolesController.update);
router.delete("/:id", rolesController.remove);

module.exports = router;
