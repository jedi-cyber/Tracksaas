const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const batchesRoutes = require("./routes/batches.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const healthRoutes = require("./routes/health.routes");
const licensesRoutes = require("./routes/licenses.routes");
const productsRoutes = require("./routes/products.routes");
const variantsRoutes = require("./routes/variants.routes");
const { requireAuth } = require("./middlewares/auth.middleware");
const mapDbError = require("./utils/dbErrors");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", requireAuth, productsRoutes);
app.use("/api/variants", requireAuth, variantsRoutes);
app.use("/api/batches", requireAuth, batchesRoutes);
app.use("/api/licenses", requireAuth, licensesRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Ruta no encontrada",
  });
});

app.use((error, req, res, next) => {
  const mappedError = mapDbError(error);
  const statusCode = mappedError.statusCode || 500;

  res.status(statusCode).json({
    message: mappedError.message || "Error interno del servidor",
  });
});

module.exports = app;
