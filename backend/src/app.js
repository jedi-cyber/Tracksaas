const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const activationsRoutes = require("./routes/activations.routes");
const auditLogsRoutes = require("./routes/auditLogs.routes");
const authRoutes = require("./routes/auth.routes");
const batchesRoutes = require("./routes/batches.routes");
const customersRoutes = require("./routes/customers.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const healthRoutes = require("./routes/health.routes");
const licensesRoutes = require("./routes/licenses.routes");
const productsRoutes = require("./routes/products.routes");
const providersRoutes = require("./routes/providers.routes");
const rolesRoutes = require("./routes/roles.routes");
const usersRoutes = require("./routes/users.routes");
const variantsRoutes = require("./routes/variants.routes");
const { getCorsOptions, getJsonLimit, isProduction } = require("./config/security");
const { requireAuth } = require("./middlewares/auth.middleware");
const { requirePermission } = require("./middlewares/permissions.middleware");
const mapDbError = require("./utils/dbErrors");

const app = express();

app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(express.json({ limit: getJsonLimit() }));
app.use(morgan("dev"));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/activations", requireAuth, requirePermission("activations"), activationsRoutes);
app.use("/api/audit-logs", requireAuth, requirePermission("auditLogs"), auditLogsRoutes);
app.use("/api/roles", requireAuth, requirePermission("roles"), rolesRoutes);
app.use("/api/users", requireAuth, requirePermission("users"), usersRoutes);
app.use("/api/providers", requireAuth, requirePermission("providers"), providersRoutes);
app.use("/api/customers", requireAuth, requirePermission("customers"), customersRoutes);
app.use("/api/products", requireAuth, requirePermission("products"), productsRoutes);
app.use("/api/variants", requireAuth, requirePermission("variants"), variantsRoutes);
app.use("/api/batches", requireAuth, requirePermission("batches"), batchesRoutes);
app.use("/api/licenses", requireAuth, requirePermission("licenses"), licensesRoutes);
app.use("/api/dashboard", requireAuth, requirePermission("dashboard"), dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Ruta no encontrada",
  });
});

app.use((error, req, res, next) => {
  const mappedError = mapDbError(error);
  const statusCode = mappedError.statusCode || 500;
  const message =
    isProduction() && statusCode >= 500
      ? "Error interno del servidor"
      : mappedError.message || "Error interno del servidor";

  res.status(statusCode).json({
    message,
  });
});

module.exports = app;
