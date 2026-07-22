const auditLogsService = require("../services/auditLogs.service");

async function list(req, res, next) {
  try {
    res.status(200).json(await auditLogsService.listAuditLogs(req.query));
  } catch (error) {
    next(error);
  }
}

async function get(req, res, next) {
  try {
    res.status(200).json({ data: await auditLogsService.getAuditLog(req.params.id) });
  } catch (error) {
    next(error);
  }
}

async function cleanupPreview(req, res, next) {
  try {
    res.status(200).json({ data: await auditLogsService.cleanupPreview(req.query) });
  } catch (error) {
    next(error);
  }
}

async function cleanup(req, res, next) {
  try {
    res.status(200).json({ data: await auditLogsService.cleanupAuditLogs(req.body || {}) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  get,
  cleanupPreview,
  cleanup,
};
