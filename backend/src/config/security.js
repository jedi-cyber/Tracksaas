const DEFAULT_JSON_LIMIT = "100kb";
const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_RATE_LIMIT_MAX = 5;
const MIN_SECRET_LENGTH = 32;

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  return splitCsv(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS);
}

function getCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.length === 0) {
    return {
      origin: true,
    };
  }

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por CORS"));
    },
  };
}

function getJsonLimit() {
  return process.env.JSON_BODY_LIMIT || DEFAULT_JSON_LIMIT;
}

function getLoginRateLimitOptions() {
  return {
    windowMs:
      Number.parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) ||
      DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
    max:
      Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) ||
      DEFAULT_LOGIN_RATE_LIMIT_MAX,
  };
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isPlaceholderSecret(value) {
  return !value || /^change_this/i.test(value) || /^test-/i.test(value);
}

function validateSecret(name, value) {
  if (isPlaceholderSecret(value)) {
    throw new Error(`${name} debe configurarse con una clave real`);
  }

  if (String(value).length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  }
}

function validateProductionSecrets() {
  if (!isProduction()) {
    return;
  }

  validateSecret("JWT_SECRET", process.env.JWT_SECRET);
  validateSecret("LICENSE_ENCRYPTION_KEY", process.env.LICENSE_ENCRYPTION_KEY);

  if (process.env.JWT_SECRET === process.env.LICENSE_ENCRYPTION_KEY) {
    throw new Error("JWT_SECRET y LICENSE_ENCRYPTION_KEY deben ser diferentes");
  }
}

module.exports = {
  getCorsOptions,
  getJsonLimit,
  getLoginRateLimitOptions,
  isProduction,
  validateProductionSecrets,
};
