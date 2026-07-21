const { getLoginRateLimitOptions } = require("../config/security");

const attempts = new Map();

function getClientKey(req) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return `${req.ip}:${email || "unknown"}`;
}

function cleanupExpired(now, windowMs) {
  for (const [key, entry] of attempts.entries()) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }
}

function loginRateLimit(req, res, next) {
  const { windowMs, max } = getLoginRateLimitOptions();
  const now = Date.now();

  cleanupExpired(now, windowMs);

  const key = getClientKey(req);
  const current = attempts.get(key) || {
    count: 0,
    resetAt: now + windowMs,
  };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  attempts.set(key, current);

  if (current.count > max) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));

    return res.status(429).json({
      message: "Demasiados intentos de inicio de sesión. Intente nuevamente más tarde",
    });
  }

  return next();
}

function resetLoginRateLimit() {
  attempts.clear();
}

module.exports = {
  loginRateLimit,
  resetLoginRateLimit,
};
