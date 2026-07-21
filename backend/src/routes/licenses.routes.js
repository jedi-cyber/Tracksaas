const { Router } = require("express");

const licensesController = require("../controllers/licenses.controller");

const router = Router();

router.get("/", licensesController.list);
router.post("/", licensesController.create);
router.get("/:id", licensesController.get);
router.put("/:id", licensesController.update);
router.delete("/:id", licensesController.remove);

module.exports = router;
