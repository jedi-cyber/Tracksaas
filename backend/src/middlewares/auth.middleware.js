const { verifyToken } = require("../config/jwt");
const authService = require("../services/auth.service");

async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        message: "Token JWT requerido",
      });
    }

    const payload = verifyToken(token);
    const user = await authService.getUserById(payload.sub);

    if (!user) {
      return res.status(401).json({
        message: "Token JWT inválido",
      });
    }

    req.auth = payload;
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Token JWT inválido o expirado",
    });
  }
}

module.exports = {
  requireAuth,
};
