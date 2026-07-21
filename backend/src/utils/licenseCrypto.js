const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret = process.env.LICENSE_ENCRYPTION_KEY || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("LICENSE_ENCRYPTION_KEY no está configurado");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptLicenseCode(plainCode) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainCode), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((value) => value.toString("base64")).join(":");
}

function hashLicenseCode(plainCode) {
  return crypto.createHash("sha256").update(String(plainCode).trim()).digest("hex");
}

function maskLicenseCode(plainCode) {
  const code = String(plainCode).trim();

  if (code.length <= 8) {
    return `${"*".repeat(Math.max(code.length - 2, 0))}${code.slice(-2)}`;
  }

  return `${code.slice(0, 4)}-${"*".repeat(Math.min(code.length - 8, 24))}-${code.slice(-4)}`;
}

module.exports = {
  encryptLicenseCode,
  hashLicenseCode,
  maskLicenseCode,
};
