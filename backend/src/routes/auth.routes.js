const { Router } = require("express");

const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth.middleware");
const { loginRateLimit } = require("../middlewares/loginRateLimit.middleware");

const router = Router();

router.post("/login", loginRateLimit, authController.login);
router.get("/me", requireAuth, authController.me);

module.exports = router;
