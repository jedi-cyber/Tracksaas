const pool = require("../config/database");

let salePriceMigrationPromise;

async function ensureLicenseSalePriceColumn() {
  if (!salePriceMigrationPromise) {
    salePriceMigrationPromise = (async () => {
      await pool.query(
        "ALTER TABLE license_units ADD COLUMN IF NOT EXISTS sale_price NUMERIC(14,2) NOT NULL DEFAULT 0"
      );
      await pool.query("UPDATE license_units SET sale_price = cost WHERE sale_price = 0");
      await pool.query("ALTER TABLE license_units DROP CONSTRAINT IF EXISTS chk_license_sale_price");
      await pool.query(
        "ALTER TABLE license_units ADD CONSTRAINT chk_license_sale_price CHECK (sale_price >= 0)"
      );
    })();
  }

  return salePriceMigrationPromise;
}

module.exports = {
  ensureLicenseSalePriceColumn,
};
