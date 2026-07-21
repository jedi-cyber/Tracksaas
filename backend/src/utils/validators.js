const apiError = require("./apiError");

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function requireFields(payload, fields) {
  fields.forEach((field) => {
    if (isBlank(payload[field])) {
      throw apiError(`El campo ${field} es obligatorio`);
    }
  });
}

function validateString(payload, field, options = {}) {
  if (payload[field] === undefined || payload[field] === null) {
    return;
  }

  const value = String(payload[field]).trim();

  if (!options.allowBlank && value === "") {
    throw apiError(`El campo ${field} no puede estar vacío`);
  }

  if (options.max && value.length > options.max) {
    throw apiError(`El campo ${field} no puede superar ${options.max} caracteres`);
  }
}

function validatePositiveInteger(payload, field) {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    return;
  }

  const value = Number(payload[field]);

  if (!Number.isInteger(value) || value <= 0) {
    throw apiError(`El campo ${field} debe ser un entero positivo`);
  }
}

function validateNonNegativeNumber(payload, field) {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    return;
  }

  const value = Number(payload[field]);

  if (!Number.isFinite(value) || value < 0) {
    throw apiError(`El campo ${field} debe ser un número mayor o igual a 0`);
  }
}

function validateDate(payload, field) {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    return;
  }

  const value = String(payload[field]);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw apiError(`El campo ${field} debe tener formato YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw apiError(`El campo ${field} debe ser una fecha válida`);
  }
}

function validateDateOrder(payload, startField, endField) {
  if (isBlank(payload[startField]) || isBlank(payload[endField])) {
    return;
  }

  if (new Date(payload[endField]) < new Date(payload[startField])) {
    throw apiError(`El campo ${endField} no puede ser menor que ${startField}`);
  }
}

function validateEnum(payload, field, allowedValues) {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    return;
  }

  if (!allowedValues.includes(payload[field])) {
    throw apiError(`El campo ${field} debe ser uno de: ${allowedValues.join(", ")}`);
  }
}

function validateCurrency(payload, field = "currency_code") {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    return;
  }

  if (!/^[A-Z]{3}$/.test(String(payload[field]))) {
    throw apiError(`El campo ${field} debe ser una moneda ISO de 3 letras en mayúsculas`);
  }
}

function validateEmail(payload, field = "email") {
  if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload[field]).trim())) {
    throw apiError(`El campo ${field} no tiene un formato válido`);
  }
}

function validateBoolean(payload, field) {
  if (payload[field] === undefined || payload[field] === null) {
    return;
  }

  if (typeof payload[field] !== "boolean") {
    throw apiError(`El campo ${field} debe ser booleano`);
  }
}

module.exports = {
  requireFields,
  validateBoolean,
  validateCurrency,
  validateDate,
  validateDateOrder,
  validateEmail,
  validateEnum,
  validateNonNegativeNumber,
  validatePositiveInteger,
  validateString,
};
