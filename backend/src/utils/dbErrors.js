const CONSTRAINT_MESSAGES = {
  products_name_key: "Ya existe un producto con ese nombre",
  uq_product_variant_name: "Ya existe una variante con ese nombre para el producto",
  uq_product_variant_code: "Ya existe una variante con ese código",
  license_batches_batch_number_key: "Ya existe un lote con ese número",
  license_units_license_code_hash_key: "Ya existe una licencia con ese código",
  license_activations_license_unit_id_key: "La licencia ya fue activada",
};

function mapDbError(error) {
  if (error.code === "23505") {
    error.statusCode = 409;
    error.message = CONSTRAINT_MESSAGES[error.constraint] || "Registro duplicado";
  }

  if (error.code === "23503") {
    error.statusCode = 400;
    error.message = "El registro relacionado no existe o no puede usarse";
  }

  if (error.code === "23514") {
    error.statusCode = 400;
    error.message = "Los datos no cumplen las reglas definidas";
  }

  if (error.code === "22P02") {
    error.statusCode = 400;
    error.message = "Uno de los identificadores o valores enviados tiene formato inválido";
  }

  return error;
}

module.exports = mapDbError;
