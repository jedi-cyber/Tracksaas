const { Router } = require("express");

const productsController = require("../controllers/products.controller");

const router = Router();

router.get("/", productsController.list);
router.post("/", productsController.create);
router.get("/:id", productsController.get);
router.put("/:id", productsController.update);
router.delete("/:id", productsController.remove);

module.exports = router;
