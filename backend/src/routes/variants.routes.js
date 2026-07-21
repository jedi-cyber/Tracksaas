const { Router } = require("express");

const variantsController = require("../controllers/variants.controller");

const router = Router();

router.get("/", variantsController.list);
router.post("/", variantsController.create);
router.get("/:id", variantsController.get);
router.put("/:id", variantsController.update);
router.delete("/:id", variantsController.remove);

module.exports = router;
