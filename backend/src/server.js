require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const { validateProductionSecrets } = require("./config/security");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    validateProductionSecrets();
    await pool.query("SELECT NOW()");

    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
      console.log("Conexión con PostgreSQL establecida");
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error.message);
    process.exit(1);
  }
}

startServer();
