const { Router } = require("express");

const batchesController = require("../controllers/batches.controller");

const router = Router();

router.get("/", batchesController.list);
router.post("/", batchesController.create);
router.get("/:id", batchesController.get);
router.put("/:id", batchesController.update);
router.delete("/:id", batchesController.remove);

module.exports = router;
