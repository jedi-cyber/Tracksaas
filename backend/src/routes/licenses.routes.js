const { Router } = require("express");

const licensesController = require("../controllers/licenses.controller");

const router = Router();

router.get("/", licensesController.list);
router.post("/", licensesController.create);
router.post("/:id/activate", licensesController.activate);
router.post("/:id/reserve", licensesController.reserve);
router.post("/:id/release-reservation", licensesController.releaseReservation);
router.get("/:id", licensesController.get);
router.put("/:id", licensesController.update);
router.delete("/:id", licensesController.remove);

module.exports = router;
