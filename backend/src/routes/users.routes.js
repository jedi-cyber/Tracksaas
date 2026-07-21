const { Router } = require("express");

const usersController = require("../controllers/users.controller");

const router = Router();

router.get("/", usersController.list);
router.post("/", usersController.create);
router.get("/:id", usersController.get);
router.put("/:id", usersController.update);
router.delete("/:id", usersController.remove);

module.exports = router;
