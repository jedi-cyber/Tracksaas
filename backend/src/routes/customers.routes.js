const { Router } = require("express");

const customersController = require("../controllers/customers.controller");

const router = Router();

router.get("/", customersController.list);
router.post("/", customersController.create);
router.get("/:id", customersController.get);
router.put("/:id", customersController.update);
router.delete("/:id", customersController.remove);

module.exports = router;
